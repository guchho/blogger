import assert from "node:assert/strict";
import { promises as fs } from "node:fs";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import path from "node:path";
import test, { afterEach } from "node:test";
import { fileURLToPath } from "node:url";

import { stopAllSaveServices } from "../src/layout/save-service.js";
import { blogger } from "../src/plugin.js";

const EXAMPLE_ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "examples"
);
const ENTRY = path.join(EXAMPLE_ROOT, "src", "template.xml");

afterEach(async () => {
  await stopAllSaveServices();
});

function fakeContext(options: { watchMode?: boolean } = {}) {
  const warnings: unknown[] = [];
  const emitted: Array<{ type: string; fileName: string; source: string }> = [];
  const context = {
    meta: { watchMode: options.watchMode === true },
    warn(value: unknown) {
      warnings.push(value);
    },
    error(value: unknown): never {
      const message =
        typeof value === "string"
          ? value
          : value !== null && typeof value === "object" && "message" in value
            ? String((value as { message: unknown }).message)
            : String(value);
      throw new Error(message);
    },
    emitFile(file: { type: string; fileName: string; source: string | Uint8Array }) {
      emitted.push({
        ...file,
        source:
          typeof file.source === "string"
            ? file.source
            : Buffer.from(file.source).toString("base64"),
      });
    },
  };
  return { context, warnings, emitted };
}

type FakeContext = ReturnType<typeof fakeContext>["context"];
type FakeHarness = ReturnType<typeof fakeContext>;

async function closePlugin(plugin: ReturnType<typeof blogger>, context: FakeContext): Promise<void> {
  const close = plugin.closeBundle as unknown as
    | ((this: unknown) => Promise<void>)
    | undefined;
  if (close !== undefined) await close.call(context);
}

async function freePort(): Promise<number> {
  const server = createServer();
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  const port = typeof address === "object" && address !== null ? address.port : 0;
  await new Promise<void>((resolve) => server.close(() => resolve()));
  return port;
}

async function runBuild(
  plugin: ReturnType<typeof blogger>,
  harness: FakeHarness,
  outputDir: string,
  extraEntries: Record<string, unknown> = {}
) {
  const { context, warnings, emitted } = harness;
  const start = await (
    plugin.buildStart as unknown as (this: unknown) => Promise<{
      entries: { input: string; output: string }[];
    }>
  ).call(context);
  const resolved = (
    plugin.resolveId as unknown as (
      this: unknown,
      source: string,
      importer: string | undefined,
      options: unknown
    ) => { id: string } | null
  ).call(context, start.entries[0]!.input, undefined, {});
  assert.ok(resolved);
  const loaded = (
    plugin.load as unknown as (
      this: unknown,
      id: string
    ) => { code: string } | null
  ).call(context, resolved.id);
  assert.ok(loaded);

  const bundle: Record<string, unknown> = {
    ...extraEntries,
    "guchho-blogger-carrier.js": {
      type: "chunk",
      fileName: "guchho-blogger-carrier.js",
      code: `${loaded.code}
console.log("hello");`,
    },
    "style.css": {
      type: "asset",
      fileName: "style.css",
      source: "body { margin: 0; }",
    },
    "index.html": {
      type: "asset",
      fileName: "index.html",
      source: '<!doctype html><html><body id="normal"></body></html>',
    },
  };

  await (
    plugin.generateBundle as unknown as (
      this: unknown,
      options: { dir: string },
      bundle: Record<string, unknown>
    ) => Promise<void>
  ).call(context, { dir: outputDir }, bundle);

  return { bundle, emitted, warnings };
}

async function buildBundle(
  plugin: ReturnType<typeof blogger>,
  outputDir = path.join(EXAMPLE_ROOT, "dist"),
  extraEntries: Record<string, unknown> = {}
) {
  const harness = fakeContext();
  try {
    return await runBuild(plugin, harness, outputDir, extraEntries);
  } finally {
    await closePlugin(plugin, harness.context);
  }
}

async function makeResourceProject() {
  const tempDir = await fs.mkdtemp(
    path.join(process.cwd(), ".tmp-blogger-resources-")
  );
  const entry = path.join(tempDir, "template.xml");
  await fs.writeFile(
    entry,
    `<html><head><link href="./style.css" rel="stylesheet"/></head>` +
      `<body><script src="./app.js"></script><img src="./icon.svg"/></body></html>`
  );
  await fs.writeFile(path.join(tempDir, "style.css"), "body { color: red; }");
  await fs.writeFile(path.join(tempDir, "app.js"), "console.log('local');");
  await fs.writeFile(
    path.join(tempDir, "icon.svg"),
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1 1"><path d="M0 0h1v1z"/></svg>`
  );
  return { tempDir, entry };
}

test("plugin emits the assembled Blogger template and removes carriers", async () => {
  const { tempDir, entry } = await makeResourceProject();
  try {
    const plugin = blogger({ entry, preview: false, minify: true, validate: false });
    const { bundle, emitted } = await buildBundle(plugin);

    assert.equal(bundle["guchho-blogger-carrier.js"], undefined);
    const template = emitted.find((file) => file.fileName === "template.xml");
    assert.ok(template);
    assert.match(template.source, /console\.log\(["']hello["']\)/);
    assert.match(template.source, /body\s*\{\s*margin:\s*0/);
    assert.match(template.source, /data:image\/svg\+xml;base64,/);
    assert.equal(template.source.includes("@@GUCHHO_BLOGGER"), false);
    assert.equal(template.source.includes(tempDir.replace(/\\/g, "/")), false);
  } finally {
    await fs.rm(tempDir, { recursive: true, force: true });
  }
});

test("plugin emits the default favicon asset", async () => {
  const plugin = blogger({ entry: ENTRY, preview: false });
  const { emitted } = await buildBundle(plugin);
  const favicon = emitted.find((file) => file.fileName === "favicon.ico");
  assert.ok(favicon);
  assert.ok(favicon.source.length > 0);
});

test("configured XML entries resolve to the empty carrier sibling", async () => {
  const plugin = blogger({ entry: ENTRY, preview: false });
  const { context } = fakeContext();
  await (
    plugin.buildStart as unknown as (this: unknown) => Promise<unknown>
  ).call(context);

  const resolved = (
    plugin.resolveId as unknown as (
      this: unknown,
      source: string,
      importer: string | undefined,
      options: unknown
    ) => { id: string } | null
  ).call(context, ENTRY, undefined, {});
  assert.ok(resolved);
  assert.match(resolved.id, /configured/);

  const loaded = (
    plugin.load as unknown as (
      this: unknown,
      id: string
    ) => { code: string } | null
  ).call(context, resolved.id);
  assert.ok(loaded);
  assert.match(loaded.code, /__guchhoBloggerConfiguredCarrier/);
  assert.equal(loaded.code.includes("__guchhoBloggerCarrier"), false);
  assert.equal(loaded.code.includes(".css"), false);
});

test("CLI dev and watch commands emit preview pages without meta.watchMode", async () => {
  const original = process.argv;
  try {
    for (const command of ["dev", "watch"]) {
      process.argv = [...original.slice(0, 2), command];
      const plugin = blogger({ entry: ENTRY, minify: false });
      const { emitted } = await buildBundle(plugin);
      const files = emitted.map((file) => file.fileName);
      assert.ok(files.includes("preview/index.html"), `${command} should emit preview pages`);
      assert.ok(files.includes("preview/dashboard.html"), `${command} should emit the dashboard`);
      assert.ok(
        files.includes("__preview/dashboard/index.html"),
        `${command} should emit the dashboard route`
      );
      assert.ok(
        files.includes("preview/dashboard-posts.html"),
        `${command} should emit admin screens`
      );
      assert.ok(
        files.includes("__preview/dashboard/posts/index.html"),
        `${command} should emit admin screen routes`
      );
      assert.ok(
        files.includes("preview/dashboard-settings.html"),
        `${command} should emit the settings screen`
      );
    }
  } finally {
    process.argv = original;
  }
});

test("previewDashboard false suppresses dashboard emission", async () => {
  const original = process.argv;
  try {
    process.argv = [...original.slice(0, 2), "dev"];
    const plugin = blogger({ entry: ENTRY, previewDashboard: false });
    const { emitted } = await buildBundle(plugin);
    const files = emitted.map((file) => file.fileName);
    assert.ok(files.includes("preview/index.html"));
    assert.equal(files.some((file) => file.startsWith("preview/dashboard")), false);
    assert.equal(files.some((file) => file.startsWith("__preview/dashboard")), false);
    const home = emitted.find((file) => file.fileName === "preview/index.html");
    assert.ok(home);
    assert.equal(home.source.includes("dashboard-button"), false);
  } finally {
    process.argv = original;
  }
});

test("previewDashboard URL is forwarded to the banner button", async () => {
  const original = process.argv;
  try {
    process.argv = [...original.slice(0, 2), "dev"];
    const plugin = blogger({ entry: ENTRY, previewDashboard: "/custom/dashboard/" });
    const { emitted } = await buildBundle(plugin);
    const home = emitted.find((file) => file.fileName === "preview/index.html");
    assert.ok(home);
    assert.ok(home.source.includes('href="/custom/dashboard/"'));
    assert.equal(
      emitted.some((file) => file.fileName.startsWith("preview/dashboard")),
      false
    );
  } finally {
    process.argv = original;
  }
});

test("watch builds emit flat preview pages and route-shaped copies", async () => {
  const plugin = blogger({ entry: ENTRY, minify: false });
  const { context, emitted } = fakeContext({ watchMode: true });
  try {
    const start = await (
      plugin.buildStart as unknown as (this: unknown) => Promise<{
        entries: { input: string; output: string }[];
      }>
    ).call(context);
    const resolved = (
      plugin.resolveId as unknown as (
        this: unknown,
        source: string,
        importer: string | undefined,
        options: unknown
      ) => { id: string } | null
    ).call(context, start.entries[0]!.input, undefined, {});
    assert.ok(resolved);
    const loaded = (
      plugin.load as unknown as (
        this: unknown,
        id: string
      ) => { code: string } | null
    ).call(context, resolved.id);
    assert.ok(loaded);

    const bundle: Record<string, unknown> = {
      "guchho-blogger-carrier.js": {
        type: "chunk",
        fileName: "guchho-blogger-carrier.js",
        code: loaded.code,
      },
      "index.html": { type: "asset", fileName: "index.html", source: "<html></html>" },
    };

    await (
      plugin.generateBundle as unknown as (
        this: unknown,
        options: { dir: string },
        bundle: Record<string, unknown>
      ) => Promise<void>
    ).call(context, { dir: path.join(EXAMPLE_ROOT, "dist") }, bundle);

    const files = emitted.map((file) => file.fileName);
    assert.ok(files.includes("preview/index.html"));
    assert.ok(files.includes("preview/post.html"));
    assert.ok(
      files.includes("2026/01/getting-started-with-guchho.html"),
      "post route should be emitted"
    );
    assert.equal(files.includes("index.html"), false, "normal entry owns index.html");
  } finally {
    await closePlugin(plugin, context);
  }
});

test("watch builds forward the running layout save port into the editor", async () => {
  const plugin = blogger({ entry: ENTRY, layoutSavePort: 0 });
  const harness = fakeContext({ watchMode: true });
  try {
    const { emitted } = await runBuild(plugin, harness, path.join(EXAMPLE_ROOT, "dist"));
    const layout = emitted.find((file) => file.fileName === "preview/dashboard-layout.html");
    assert.ok(layout);
    const match = /http:\/\/localhost:(\d+)\/api\/layout\/save/.exec(layout.source);
    assert.ok(match);
    const port = Number(match[1]);
    assert.ok(port > 0, "ephemeral save port should be resolved before emission");
    const response = await fetch(`http://127.0.0.1:${port}/api/layout/status`);
    assert.equal(response.status, 200);
  } finally {
    await closePlugin(plugin, harness.context);
  }
});

test("production builds do not start the layout save service", async () => {
  const port = await freePort();
  const originalArgv = process.argv;
  process.argv = [...originalArgv.slice(0, 2), "build"];
  const plugin = blogger({ entry: ENTRY, layoutSavePort: port });
  const harness = fakeContext();
  try {
    await (
      plugin.buildStart as unknown as (this: unknown) => Promise<unknown>
    ).call(harness.context);
    await assert.rejects(
      () => fetch(`http://127.0.0.1:${port}/api/layout/status`),
      /fetch failed|ECONNREFUSED/
    );
  } finally {
    process.argv = originalArgv;
    await closePlugin(plugin, harness.context);
  }
});

test("plugin resolves a custom outfile inside the output directory", async () => {
  const outputDir = path.join(process.cwd(), "test-output");
  const plugin = blogger({
    entry: ENTRY,
    outfile: "test-output/blogger/theme.xml",
    preview: false,
  });
  const { emitted } = await buildBundle(plugin, outputDir);
  assert.ok(emitted.some((file) => file.fileName === "blogger/theme.xml"));
});

test("plugin rejects an outfile outside the output directory", async () => {
  const plugin = blogger({ entry: ENTRY, outfile: "../outside.xml", preview: false });
  await assert.rejects(
    () => buildBundle(plugin),
    /outfile must resolve inside the Guchho output directory/
  );
});

test("previewDir must stay inside the output directory", () => {
  assert.throws(
    () => blogger({ entry: ENTRY, previewDir: "../outside" }),
    /previewDir must be a relative path/
  );
  assert.throws(
    () => blogger({ entry: ENTRY, previewDir: path.resolve("outside") }),
    /previewDir must be a relative path/
  );
});

test("plugin loads and watches a mockData JSON fixture", async () => {
  const root = await fs.mkdtemp(path.join(tmpdir(), "guchho-blogger-mock-"));
  try {
    const fixture = path.join(root, "preview.json");
    await fs.writeFile(
      fixture,
      JSON.stringify({ blog: { title: "Fixture Blog" } }),
      "utf8"
    );
    const plugin = blogger({
      entry: ENTRY,
      mockData: fixture,
      minify: false,
    });
    const { context, emitted } = fakeContext({ watchMode: true });
    try {
      const start = await (
        plugin.buildStart as unknown as (this: unknown) => Promise<{
          entries: { input: string; output: string }[];
          watchFiles: string[];
        }>
      ).call(context);
      assert.ok(start.watchFiles.includes(fixture));

      const resolved = (
        plugin.resolveId as unknown as (
          this: unknown,
          source: string,
          importer: string | undefined,
          options: unknown
        ) => { id: string } | null
      ).call(context, start.entries[0]!.input, undefined, {});
      assert.ok(resolved);
      const loaded = (
        plugin.load as unknown as (
          this: unknown,
          id: string
        ) => { code: string } | null
      ).call(context, resolved.id);
      assert.ok(loaded);

      await (
        plugin.generateBundle as unknown as (
          this: unknown,
          options: { dir: string },
          bundle: Record<string, unknown>
        ) => Promise<void>
      ).call(
        context,
        { dir: path.join(root, "dist") },
        {
          "guchho-blogger-carrier.js": {
            type: "chunk",
            fileName: "guchho-blogger-carrier.js",
            code: loaded.code,
          },
        }
      );

      const preview = emitted.find((file) => file.fileName === "preview/index.html");
      assert.ok(preview);
      assert.match(preview.source, /Fixture Blog/);
    } finally {
      await closePlugin(plugin, context);
    }
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});


test("plugin reports template output collisions", async () => {
  const plugin = blogger({ entry: ENTRY, preview: false });
  await assert.rejects(
    () =>
      buildBundle(plugin, path.join(EXAMPLE_ROOT, "dist"), {
        "template.xml": {
          type: "asset",
          fileName: "template.xml",
          source: "existing",
        },
      }),
    /collides with another emitted file/
  );
});
