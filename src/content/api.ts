import type { IncomingMessage, ServerResponse } from "node:http";

import { ContentError, isRecord } from "./schema-helpers.js";
import { createPageRepository } from "./pages.js";
import { createPostRepository } from "./posts.js";
import { loadContent } from "./settings.js";
import type { ContentPaths } from "./storage.js";

const MAX_CONTENT_BODY_BYTES = 4 * 1024 * 1024;
const ID_PATTERN = /^[A-Za-z0-9_-]+$/;

export interface ContentApiOptions {
  contentPaths?: ContentPaths;
}

export async function handleContentRequest(
  request: IncomingMessage,
  response: ServerResponse,
  options: ContentApiOptions,
  origin: string | null
): Promise<boolean> {
  if (options.contentPaths === undefined) return false;
  const url = new URL(request.url ?? "/", "http://localhost");
  const pathname = url.pathname.replace(/\/+$/, "") || "/";
  const paths = options.contentPaths;

  try {
    if (pathname === "/api/content/status" && request.method === "GET") {
      const snapshot = await loadContent(paths);
      sendContentJson(
        response,
        200,
        {
          service: "guchho-blogger-content",
          project: paths.projectRoot,
          hash: snapshot.hash,
          posts: snapshot.posts.length,
          pages: snapshot.pages.length,
          postsDir: paths.postsDir,
          pagesDir: paths.pagesDir,
        },
        origin
      );
      return true;
    }

    if (pathname === "/api/content/meta" && request.method === "GET") {
      const snapshot = await loadContent(paths);
      const labels = [
        ...new Set(snapshot.posts.flatMap((post) => post.labels)),
        ...snapshot.settings.categories,
      ].sort();
      sendContentJson(
        response,
        200,
        { settings: snapshot.settings, labels, hash: snapshot.hash },
        origin
      );
      return true;
    }

    for (const kind of ["post", "page"] as const) {
      const base = kind === "post" ? "/api/posts" : "/api/pages";
      if (pathname !== base && !pathname.startsWith(`${base}/`)) continue;
      const repository = kind === "post" ? createPostRepository(paths) : createPageRepository(paths);
      const suffix = pathname.slice(base.length + 1);
      const method = request.method ?? "GET";

      if (suffix === "" && method === "GET") {
        const status = url.searchParams.get("status") ?? undefined;
        const search = url.searchParams.get("q") ?? undefined;
        const label = url.searchParams.get("label") ?? undefined;
        const sort = url.searchParams.get("sort") ?? undefined;
        const includeTrashed = url.searchParams.get("trashed") === "1";
        const result = await repository.list({
          status: status === null || status === "all" ? "all" : (status as "draft"),
          search,
          label,
          sort: sort === null ? undefined : (sort as "date-desc"),
          includeTrashed,
        });
        sendContentJson(response, 200, result, origin);
        return true;
      }

      if (suffix === "" && method === "POST") {
        const payload = await readJsonBody(request);
        const created = await repository.create(payload);
        sendContentJson(response, 201, created, origin);
        return true;
      }

      if (suffix === "bulk" && method === "POST") {
        const payload = await readJsonBody(request);
        if (!isRecord(payload) || !Array.isArray(payload["ids"]) || typeof payload["action"] !== "string") {
          throw new ContentError("BLOGGER_CONTENT_INVALID", "ids and action are required");
        }
        const action = payload["action"];
        if (!["publish", "unpublish", "trash", "restore", "delete"].includes(action)) {
          throw new ContentError("BLOGGER_CONTENT_INVALID_ACTION", "unknown bulk action");
        }
        const result = await repository.bulk(
          payload["ids"].filter((id): id is string => typeof id === "string"),
          action as "publish" | "unpublish" | "trash" | "restore" | "delete"
        );
        sendContentJson(response, 200, result, origin);
        return true;
      }

      const segments = suffix.split("/");
      const id = segments[0] ?? "";
      if (!ID_PATTERN.test(id)) {
        throw new ContentError("BLOGGER_CONTENT_INVALID_ID", "unsupported content id");
      }
      const action = segments[1];

      if (segments.length === 1 && method === "GET") {
        const item = await repository.get(id);
        sendContentJson(response, 200, { item, hash: await repository.hash(id) }, origin);
        return true;
      }

      if (segments.length === 1 && method === "PUT") {
        const payload = await readJsonBody(request);
        if (!isRecord(payload)) throw new ContentError("BLOGGER_CONTENT_INVALID", "body must be an object");
        const { hash, ...patch } = payload;
        if (hash !== undefined && typeof hash !== "string") {
          throw new ContentError("BLOGGER_CONTENT_INVALID", "hash must be a string");
        }
        const updated = await repository.update(id, patch, hash);
        sendContentJson(response, 200, updated, origin);
        return true;
      }

      if (segments.length === 1 && method === "DELETE") {
        const result = await repository.remove(id);
        sendContentJson(response, 200, result, origin);
        return true;
      }

      if (segments.length === 2 && method === "POST" && action !== undefined) {
        const payload = await readJsonBody(request).catch(() => ({}) as Record<string, unknown>);
        const publishAt =
          isRecord(payload) && typeof payload["publishAt"] === "string"
            ? payload["publishAt"]
            : null;
        let result;
        if (action === "publish") result = await repository.setStatus(id, "published", publishAt);
        else if (action === "unpublish") result = await repository.setStatus(id, "draft");
        else if (action === "trash") result = await repository.trash(id);
        else if (action === "restore") result = await repository.restore(id);
        else throw new ContentError("BLOGGER_CONTENT_ROUTE_MISSING", "unknown content action", 404);
        sendContentJson(response, 200, result, origin);
        return true;
      }
    }
  } catch (error) {
    sendContentError(response, error, origin);
    return true;
  }
  return false;
}

function readJsonBody(request: IncomingMessage): Promise<Record<string, unknown>> {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks: Buffer[] = [];
    request.on("data", (chunk: Buffer) => {
      size += chunk.length;
      if (size > MAX_CONTENT_BODY_BYTES) {
        reject(new ContentError("BLOGGER_CONTENT_TOO_LARGE", "content payload exceeds 4 MB", 413));
        request.destroy();
        return;
      }
      chunks.push(chunk);
    });
    request.on("end", () => {
      try {
        const parsed: unknown = JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}");
        if (!isRecord(parsed)) {
          reject(new ContentError("BLOGGER_CONTENT_INVALID", "body must be a JSON object"));
          return;
        }
        resolve(parsed);
      } catch (error) {
        reject(
          new ContentError(
            "BLOGGER_CONTENT_INVALID_JSON",
            error instanceof Error ? error.message : String(error)
          )
        );
      }
    });
    request.on("error", reject);
  });
}

function sendContentError(response: ServerResponse, error: unknown, origin: string | null): void {
  if (error instanceof ContentError) {
    sendContentJson(
      response,
      error.status,
      { error: error.code, message: error.message, ...error.details },
      origin
    );
    return;
  }
  sendContentJson(
    response,
    500,
    {
      error: "BLOGGER_CONTENT_INTERNAL",
      message: error instanceof Error ? error.message : String(error),
    },
    origin
  );
}

function sendContentJson(
  response: ServerResponse,
  status: number,
  body: unknown,
  origin: string | null
): void {
  response.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "access-control-allow-origin": origin ?? "*",
    "access-control-allow-methods": "GET, POST, PUT, DELETE, OPTIONS",
    "access-control-allow-headers": "content-type",
    "cache-control": "no-store",
  });
  response.end(JSON.stringify(body));
}
