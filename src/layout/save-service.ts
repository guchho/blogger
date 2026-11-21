import { promises as fs } from "node:fs";
import {
  createServer,
  get as httpGet,
  type IncomingMessage,
  type ServerResponse,
} from "node:http";
import path from "node:path";

import { isInside } from "../compiler/compiler.js";
import { ContentError, handleContentRequest } from "../content/index.js";
import type { ContentPaths } from "../content/index.js";
import { hashSource } from "./extract.js";
import { LayoutError, type LayoutOperation } from "./model.js";
import { serializeLayout } from "./serialize.js";

export interface SaveServiceOptions {
  entryPath: string;
  projectRoot: string;
  port: number;
  contentPaths?: ContentPaths;
}

export interface SaveServiceHandle {
  readonly port: number;
  close(): Promise<void>;
}

interface SaveRequest {
  entry?: unknown;
  hash?: unknown;
  operations?: unknown;
}

const MAX_BODY_BYTES = 1024 * 1024;
const SERVICE_MARKER = "guchho-blogger-layout";
const STATUS_TIMEOUT_MS = 750;
const services = new Map<string, SaveServiceHandle>();

export async function startSaveService(
  options: SaveServiceOptions
): Promise<SaveServiceHandle> {
  const key = `${options.port}:${options.entryPath}`;
  const existing = services.get(key);
  if (existing !== undefined) return existing;

  const server = createServer((request, response) => {
    void handleRequest(request, response, options).catch((error: unknown) => {
      sendJson(
        response,
        500,
        {
          error: "BLOGGER_LAYOUT_INTERNAL",
          message: error instanceof Error ? error.message : String(error),
        },
        request.headers.origin ?? null
      );
    });
  });
  try {
    await new Promise<void>((resolve, reject) => {
      server.once("error", reject);
      server.listen(options.port, "127.0.0.1", () => {
        server.off("error", reject);
        resolve();
      });
    });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "EADDRINUSE") throw error;
    const existing = await findExternalService(options.port, options.entryPath, options.projectRoot);
    if (existing === undefined) throw error;
    return existing;
  }
  const address = server.address();
  const port = typeof address === "object" && address !== null ? address.port : options.port;
  const handle: SaveServiceHandle = {
    port,
    async close() {
      if (services.get(key) === handle) services.delete(key);
      await new Promise<void>((resolve, reject) => {
        server.close((error) => (error === undefined ? resolve() : reject(error)));
      });
    },
  };
  services.set(key, handle);
  return handle;
}

async function findExternalService(
  port: number,
  entryPath: string,
  projectRoot: string
): Promise<SaveServiceHandle | undefined> {
  if (port === 0) return undefined;
  const expectedEntry = path.resolve(entryPath);
  const expectedProject = path.resolve(projectRoot);
  try {
    const response = await probeStatus(port);
    if (response.statusCode !== 200) return undefined;
    const payload = JSON.parse(response.body) as {
      service?: unknown;
      entryPath?: unknown;
      project?: unknown;
    };
    if (
      payload.service !== SERVICE_MARKER ||
      path.resolve(String(payload.entryPath ?? "")) !== expectedEntry ||
      path.resolve(String(payload.project ?? "")) !== expectedProject
    ) {
      return undefined;
    }
    const key = `${port}:${entryPath}`;
    const handle: SaveServiceHandle = {
      port,
      async close() {
        if (services.get(key) === handle) services.delete(key);
      },
    };
    if (services.has(key) === false) services.set(key, handle);
    return handle;
  } catch {
    return undefined;
  }
}

function probeStatus(port: number): Promise<{ statusCode: number | undefined; body: string }> {
  return new Promise((resolve, reject) => {
    const request = httpGet(
      `http://127.0.0.1:${port}/api/layout/status`,
      { headers: { accept: "application/json" } },
      (response) => {
        const chunks: Buffer[] = [];
        response.on("data", (chunk: Buffer) => chunks.push(chunk));
        response.on("end", () =>
          resolve({ statusCode: response.statusCode, body: Buffer.concat(chunks).toString("utf8") })
        );
        response.on("error", reject);
      }
    );
    request.setTimeout(STATUS_TIMEOUT_MS, () =>
      request.destroy(new Error("layout status probe timed out"))
    );
    request.on("error", reject);
  });
}

export function stopAllSaveServices(): Promise<void[]> {
  const handles = [...services.values()];
  services.clear();
  return Promise.all(handles.map((handle) => handle.close()));
}

async function handleRequest(
  request: IncomingMessage,
  response: ServerResponse,
  options: SaveServiceOptions
): Promise<void> {
  const url = new URL(request.url ?? "/", "http://localhost");
  const origin = request.headers.origin ?? null;
  if (!isAllowedOrigin(origin)) {
    sendJson(
      response,
      403,
      {
        error: "BLOGGER_LAYOUT_ORIGIN_FORBIDDEN",
        message: "layout saves are limited to localhost origins",
      },
      origin
    );
    return;
  }
  if (request.method === "OPTIONS") {
    sendNoContent(response, origin);
    return;
  }
  if (url.pathname === "/api/layout/status" && request.method === "GET") {
    await handleStatus(response, options, origin);
    return;
  }
  if (url.pathname === "/api/layout/save" && request.method === "POST") {
    await handleSave(request, response, options, origin);
    return;
  }
  if (await handleContentRequest(request, response, options, origin)) return;
  sendJson(response, 404, { error: "BLOGGER_LAYOUT_ROUTE_MISSING", message: "unknown route" }, origin);
}

async function handleStatus(
  response: ServerResponse,
  options: SaveServiceOptions,
  origin: string | null
): Promise<void> {
  try {
    const source = await fs.readFile(options.entryPath, "utf8");
    const stats = await fs.stat(options.entryPath);
    sendJson(
      response,
      200,
      {
        service: SERVICE_MARKER,
        project: path.resolve(options.projectRoot),
        entry: path.basename(options.entryPath),
        entryPath: path.resolve(options.entryPath),
        hash: hashSource(source),
        size: stats.size,
        modified: stats.mtime.toISOString(),
        capabilities: ["layout", ...(options.contentPaths === undefined ? [] : ["content"])],
      },
      origin
    );
  } catch (error) {
    sendError(response, error, origin);
  }
}

async function handleSave(
  request: IncomingMessage,
  response: ServerResponse,
  options: SaveServiceOptions,
  origin: string | null
): Promise<void> {
  try {
    const body = await readBody(request);
    const payload = JSON.parse(body) as SaveRequest;
    if (typeof payload.entry !== "string" || typeof payload.hash !== "string") {
      throw new LayoutError("BLOGGER_LAYOUT_SAVE_INVALID", "entry and hash are required");
    }
    const entry = path.resolve(options.projectRoot, payload.entry);
    if (entry !== path.resolve(options.entryPath) || !isInside(options.projectRoot, entry)) {
      throw new LayoutError("BLOGGER_LAYOUT_SAVE_FORBIDDEN", "template path is outside the project entry");
    }
    if (!Array.isArray(payload.operations)) {
      throw new LayoutError("BLOGGER_LAYOUT_SAVE_INVALID", "operations must be an array");
    }
    const operations = payload.operations as LayoutOperation[];
    const source = await fs.readFile(entry, "utf8");
    const currentHash = hashSource(source);
    if (currentHash !== payload.hash) {
      sendJson(
        response,
        409,
        {
          error: "BLOGGER_LAYOUT_STALE",
          message: "template.xml changed outside the editor; reload before saving",
          hash: currentHash,
        },
        origin
      );
      return;
    }
    const result = serializeLayout(source, operations, entry);
    if (result.xml === source) {
      sendJson(response, 200, { hash: currentHash, unchanged: true }, origin);
      return;
    }
    const backup = `${entry}.layout-backup-${Date.now()}.xml`;
    await fs.writeFile(backup, source, "utf8");
    const temporary = `${entry}.layout-tmp-${process.pid}`;
    await fs.writeFile(temporary, result.xml, "utf8");
    await fs.rename(temporary, entry);
    sendJson(
      response,
      200,
      {
        hash: hashSource(result.xml),
        unchanged: false,
        backup: path.basename(backup),
        sections: result.model.sections.length,
      },
      origin
    );
  } catch (error) {
    sendError(response, error, origin);
  }
}

function readBody(request: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks: Buffer[] = [];
    request.on("data", (chunk: Buffer) => {
      size += chunk.length;
      if (size > MAX_BODY_BYTES) {
        reject(new LayoutError("BLOGGER_LAYOUT_SAVE_TOO_LARGE", "save payload exceeds 1 MB"));
        request.destroy();
        return;
      }
      chunks.push(chunk);
    });
    request.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    request.on("error", reject);
  });
}

function sendError(response: ServerResponse, error: unknown, origin: string | null): void {
  if (error instanceof LayoutError) {
    sendJson(response, 400, { error: error.code, message: error.message }, origin);
    return;
  }
  if (error instanceof ContentError) {
    sendJson(
      response,
      error.status,
      { error: error.code, message: error.message, ...error.details },
      origin
    );
    return;
  }
  sendJson(
    response,
    500,
    {
      error: "BLOGGER_LAYOUT_INTERNAL",
      message: error instanceof Error ? error.message : String(error),
    },
    origin
  );
}

function isAllowedOrigin(origin: string | null): boolean {
  if (origin === null) return true;
  try {
    const url = new URL(origin);
    return (
      (url.protocol === "http:" || url.protocol === "https:") &&
      ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname)
    );
  } catch {
    return false;
  }
}

function sendJson(
  response: ServerResponse,
  status: number,
  body: unknown,
  origin: string | null
): void {
  const headers: Record<string, string> = {
    "content-type": "application/json; charset=utf-8",
    "access-control-allow-origin": origin ?? "*",
    "access-control-allow-methods": "GET, POST, PUT, DELETE, OPTIONS",
    "access-control-allow-headers": "content-type",
    "cache-control": "no-store",
  };
  response.writeHead(status, headers);
  response.end(JSON.stringify(body));
}

function sendNoContent(response: ServerResponse, origin: string | null): void {
  response.writeHead(204, {
    "access-control-allow-origin": origin ?? "*",
    "access-control-allow-methods": "GET, POST, PUT, DELETE, OPTIONS",
    "access-control-allow-headers": "content-type",
  });
  response.end();
}
