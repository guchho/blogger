import assert from "node:assert/strict";
import { promises as fs } from "node:fs";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import { hashSource } from "../src/layout/extract.js";
import { startSaveService } from "../src/layout/save-service.js";
import type { LayoutOperation } from "../src/layout/model.js";

const TEMPLATE = `<?xml version="1.0"?>
<html xmlns:b='http://www.google.com/2005/gml/b'>
<body>
<b:section id='main' class='main' maxwidgets='3'>
  <b:widget id='Blog1' type='Blog' title='Posts'>
    <b:includable id='main'>posts</b:includable>
  </b:widget>
</b:section>
</body></html>`;

async function withService(
  run: (context: {
    root: string;
    entry: string;
    port: number;
    source: string;
    post(
      body: unknown,
      headers?: Record<string, string>
    ): Promise<{ status: number; body: Record<string, unknown> }>;
    getStatus(): Promise<Record<string, unknown>>;
  }) => Promise<void>
): Promise<void> {
  const root = await fs.mkdtemp(path.join(tmpdir(), "guchho-blogger-save-"));
  const entry = path.join(root, "template.xml");
  await fs.writeFile(entry, TEMPLATE, "utf8");
  const service = await startSaveService({ entryPath: entry, projectRoot: root, port: 0 });
  try {
    const base = `http://127.0.0.1:${service.port}`;
    await run({
      root,
      entry,
      port: service.port,
      source: TEMPLATE,
      async post(body, headers = {}) {
        const response = await fetch(`${base}/api/layout/save`, {
          method: "POST",
          headers: { "content-type": "application/json", ...headers },
          body: JSON.stringify(body),
        });
        return { status: response.status, body: (await response.json()) as Record<string, unknown> };
      },
      async getStatus() {
        const response = await fetch(`${base}/api/layout/status`);
        return (await response.json()) as Record<string, unknown>;
      },
    });
  } finally {
    await service.close();
    await fs.rm(root, { recursive: true, force: true });
  }
}

test("status reports the hash of the current source", async () => {
  await withService(async ({ getStatus }) => {
    const status = await getStatus();
    assert.equal(status.service, "guchho-blogger-layout");
    assert.equal(status.hash, hashSource(TEMPLATE));
    assert.equal(status.entry, "template.xml");
  });
});

test("save applies operations, validates, writes and backs up the source", async () => {
  await withService(async ({ entry, root, source, post }) => {
    const operation: LayoutOperation = { kind: "addWidget", sectionId: "main", widgetType: "HTML" };
    const result = await post({ entry: "template.xml", hash: hashSource(source), operations: [operation] });
    assert.equal(result.status, 200);
    assert.equal(result.body.unchanged, false);
    assert.equal(result.body.sections, 1);
    const updated = await fs.readFile(entry, "utf8");
    assert.match(updated, /<b:widget id='HTML1'/);
    assert.equal(hashSource(updated), result.body.hash);
    const files = await fs.readdir(root);
    assert.equal(files.filter((file) => file.includes(".layout-backup-")).length, 1);
    const backup = files.find((file) => file.includes(".layout-backup-"));
    assert.equal(await fs.readFile(path.join(root, backup ?? ""), "utf8"), source);
  });
});

test("no operations return unchanged without writing a backup", async () => {
  await withService(async ({ entry, root, source, post }) => {
    const result = await post({ entry: "template.xml", hash: hashSource(source), operations: [] });
    assert.equal(result.status, 200);
    assert.equal(result.body.unchanged, true);
    assert.equal(await fs.readFile(entry, "utf8"), source);
    assert.equal((await fs.readdir(root)).some((file) => file.includes(".layout-backup-")), false);
  });
});

test("stale hash is rejected without touching the file", async () => {
  await withService(async ({ entry, source, post }) => {
    const result = await post({
      entry: "template.xml",
      hash: "stale",
      operations: [{ kind: "removeWidget", widgetId: "Blog1" }],
    });
    assert.equal(result.status, 409);
    assert.equal(result.body.error, "BLOGGER_LAYOUT_STALE");
    assert.equal(result.body.hash, hashSource(source));
    assert.equal(await fs.readFile(entry, "utf8"), source);
  });
});

test("invalid operations and paths are rejected", async () => {
  await withService(async ({ source, entry, post }) => {
    const invalid = await post({
      entry: "template.xml",
      hash: hashSource(source),
      operations: [{ kind: "removeWidget", widgetId: "Missing" }],
    });
    assert.equal(invalid.status, 400);
    assert.equal(invalid.body.error, "BLOGGER_LAYOUT_WIDGET_MISSING");

    const escaped = await post({
      entry: "../outside.xml",
      hash: hashSource(source),
      operations: [],
    });
    assert.equal(escaped.status, 400);
    assert.equal(escaped.body.error, "BLOGGER_LAYOUT_SAVE_FORBIDDEN");
    assert.equal(await fs.readFile(entry, "utf8"), source);
  });
});

test("unknown routes return 404 and CORS headers are present", async () => {
  await withService(async ({ port }) => {
    const response = await fetch(`http://127.0.0.1:${port}/api/unknown`);
    assert.equal(response.status, 404);
    assert.equal(response.headers.get("access-control-allow-origin"), "*");
  });
});

test("foreign browser origins are rejected and localhost origins are echoed", async () => {
  await withService(async ({ port, entry, source, post }) => {
    const foreign = await fetch(`http://127.0.0.1:${port}/api/layout/status`, {
      headers: { origin: "https://evil.example" },
    });
    assert.equal(foreign.status, 403);
    assert.equal(
      ((await foreign.json()) as Record<string, unknown>).error,
      "BLOGGER_LAYOUT_ORIGIN_FORBIDDEN"
    );

    const forbidden = await post(
      {
        entry: "template.xml",
        hash: hashSource(source),
        operations: [{ kind: "removeWidget", widgetId: "Blog1" }],
      },
      { origin: "https://evil.example" }
    );
    assert.equal(forbidden.status, 403);
    assert.equal(await fs.readFile(entry, "utf8"), source);

    const local = await fetch(`http://127.0.0.1:${port}/api/layout/status`, {
      headers: { origin: "http://localhost:3000" },
    });
    assert.equal(local.status, 200);
    assert.equal(local.headers.get("access-control-allow-origin"), "http://localhost:3000");
  });
});

async function freePort(): Promise<number> {
  const server = createServer();
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  const port = typeof address === "object" && address !== null ? address.port : 0;
  await new Promise<void>((resolve, reject) => {
    server.close((error) => (error === undefined ? resolve() : reject(error)));
  });
  return port;
}

test("fixed port startup reuses an existing Guchho save service", async () => {
  const root = await fs.mkdtemp(path.join(tmpdir(), "guchho-blogger-reuse-"));
  const entry = path.join(root, "template.xml");
  await fs.writeFile(entry, TEMPLATE, "utf8");
  const port = await freePort();
  const first = await startSaveService({ entryPath: entry, projectRoot: root, port });
  let second: Awaited<ReturnType<typeof startSaveService>> | undefined;
  try {
    second = await startSaveService({
      entryPath: `${root}//template.xml`,
      projectRoot: root,
      port,
    });
    assert.equal(second.port, port);
    const response = await fetch(`http://127.0.0.1:${port}/api/layout/status`);
    const status = (await response.json()) as Record<string, unknown>;
    assert.equal(status.service, "guchho-blogger-layout");
    assert.equal(status.project, root);
    assert.equal(status.entryPath, path.resolve(entry));
  } finally {
    if (second !== undefined) await second.close();
    await first.close();
    await fs.rm(root, { recursive: true, force: true });
  }
});

test("fixed port startup rejects a foreign listener", async () => {
  const port = await freePort();
  const root = await fs.mkdtemp(path.join(tmpdir(), "guchho-blogger-foreign-"));
  const entry = path.join(root, "template.xml");
  await fs.writeFile(entry, TEMPLATE, "utf8");
  const server = createServer((_request, response) => {
    response.writeHead(200, { "content-type": "application/json" });
    response.end("{}");
  });
  await new Promise<void>((resolve) => server.listen(port, "127.0.0.1", resolve));
  try {
    await assert.rejects(
      startSaveService({ entryPath: entry, projectRoot: root, port }),
      (error: unknown) => (error as NodeJS.ErrnoException).code === "EADDRINUSE"
    );
  } finally {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => (error === undefined ? resolve() : reject(error)));
    });
    await fs.rm(root, { recursive: true, force: true });
  }
});
