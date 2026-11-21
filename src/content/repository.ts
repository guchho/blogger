import type { ContentItem, ContentKind, ContentStatus, EffectiveStatus } from "./model.js";
import { effectiveStatus, isPost, timestamp } from "./model.js";
import { ContentError } from "./schema-helpers.js";
import { ensureUniqueSlug, slugify } from "./slug.js";
import type { ContentPaths } from "./storage.js";
import {
  contentFilePath,
  contentHash,
  deleteWithBackup,
  fileExists,
  readAll,
  readJsonFile,
  writeJsonAtomic,
  withFileLock,
} from "./storage.js";

export type ContentSort = "date-desc" | "date-asc" | "title-asc" | "title-desc";

export interface ListOptions {
  includeTrashed?: boolean;
  status?: "all" | EffectiveStatus;
  search?: string;
  label?: string;
  sort?: ContentSort;
  limit?: number;
  offset?: number;
  now?: Date;
}

export interface ContentList<T> {
  items: T[];
  total: number;
}

export interface MutationResult<T> {
  item: T;
  hash: string;
  backup: string | null;
}

export interface BulkResult {
  succeeded: number;
  failed: { id: string; code: string; message: string }[];
}

export interface RepositoryConfig<T extends ContentItem> {
  kind: ContentKind;
  paths: ContentPaths;
  validate: (value: unknown) => T;
  defaults: (overrides?: Partial<T>) => T;
}

export interface ContentRepository<T extends ContentItem> {
  all(): Promise<T[]>;
  list(options?: ListOptions): Promise<ContentList<T>>;
  get(id: string): Promise<T>;
  find(id: string): Promise<T | null>;
  getBySlug(slug: string): Promise<T | null>;
  slugs(excludeId?: string): Promise<string[]>;
  hash(id: string): Promise<string>;
  create(input: Partial<T>): Promise<MutationResult<T>>;
  update(id: string, patch: Partial<T>, expectedHash?: string): Promise<MutationResult<T>>;
  setStatus(id: string, status: ContentStatus, publishAt?: string | null): Promise<MutationResult<T>>;
  trash(id: string): Promise<MutationResult<T>>;
  restore(id: string): Promise<MutationResult<T>>;
  remove(id: string): Promise<{ backup: string }>;
  bulk(ids: string[], action: "publish" | "unpublish" | "trash" | "restore" | "delete"): Promise<BulkResult>;
  filePath(id: string): string;
}

export function createRepository<T extends ContentItem>(
  config: RepositoryConfig<T>
): ContentRepository<T> {
  const directory = config.kind === "post" ? config.paths.postsDir : config.paths.pagesDir;

  async function all(): Promise<T[]> {
    return readAll(directory, config.validate);
  }

  async function find(id: string): Promise<T | null> {
    try {
      return await readJsonFile(contentFilePath(config.paths, config.kind, id), config.validate);
    } catch (error) {
      if (error instanceof ContentError && error.code === "BLOGGER_CONTENT_NOT_FOUND") return null;
      throw error;
    }
  }

  async function get(id: string): Promise<T> {
    const item = await find(id);
    if (item === null) {
      throw new ContentError("BLOGGER_CONTENT_NOT_FOUND", `${config.kind} not found`, 404);
    }
    return item;
  }

  async function hash(id: string): Promise<string> {
    return contentHash(await get(id));
  }

  async function slugs(excludeId?: string): Promise<string[]> {
    return (await all()).filter((item) => item.id !== excludeId).map((item) => item.slug);
  }

  async function getBySlug(slug: string): Promise<T | null> {
    return (await all()).find((item) => item.slug === slug && item.trashedAt === null) ?? null;
  }

  function matches(item: T, options: ListOptions, now: Date): boolean {
    if (item.trashedAt !== null && options.includeTrashed !== true) return false;
    const status = effectiveStatus(item, now);
    if (options.status !== undefined && options.status !== "all" && status !== options.status) {
      return false;
    }
    const search = options.search?.trim().toLowerCase();
    if (search !== undefined && search !== "") {
      const haystack = [item.title, item.slug, item.content];
      if (isPost(item)) haystack.push(item.excerpt, item.author, ...item.labels);
      if (!haystack.some((value) => value.toLowerCase().includes(search))) return false;
    }
    if (options.label !== undefined && options.label !== "") {
      if (!isPost(item) || !item.labels.includes(options.label)) return false;
    }
    return true;
  }

  function compare(a: T, b: T, sort: ContentSort): number {
    switch (sort) {
      case "date-asc":
        return Date.parse(a.createdAt) - Date.parse(b.createdAt);
      case "title-asc":
        return a.title.localeCompare(b.title);
      case "title-desc":
        return b.title.localeCompare(a.title);
      default:
        return Date.parse(b.createdAt) - Date.parse(a.createdAt);
    }
  }

  async function list(options: ListOptions = {}): Promise<ContentList<T>> {
    const now = options.now ?? new Date();
    const items = (await all()).filter((item) => matches(item, options, now));
    const sorted = [...items].sort((a, b) => compare(a, b, options.sort ?? "date-desc"));
    const offset = options.offset ?? 0;
    const limit = options.limit ?? sorted.length;
    return { items: sorted.slice(offset, offset + limit), total: items.length };
  }

  async function ensureSlug(slug: string, excludeId?: string): Promise<string> {
    const check = ensureUniqueSlug(slugify(slug), await slugs(excludeId));
    if (check.suggested === undefined) return check.slug;
    throw new ContentError(
      "BLOGGER_CONTENT_SLUG_CONFLICT",
      `slug "${check.slug}" is already used`,
      409,
      { suggested: check.suggested }
    );
  }

  async function create(input: Partial<T>): Promise<MutationResult<T>> {
    const base = config.defaults();
    const draft = { ...base, ...input, id: input.id ?? base.id } as T;
    draft.slug = await ensureSlug(input.slug ?? draft.title);
    draft.createdAt = input.createdAt ?? timestamp();
    draft.updatedAt = draft.createdAt;
    const file = contentFilePath(config.paths, config.kind, draft.id);
    return withFileLock(file, async () => {
      if (await fileExists(file)) {
        throw new ContentError("BLOGGER_CONTENT_ALREADY_EXISTS", `${config.kind} id already exists`, 409);
      }
      const item = config.validate(draft);
      const written = await writeJsonAtomic(config.paths, file, item);
      return { item, hash: written.hash, backup: written.backup };
    });
  }

  async function update(
    id: string,
    patch: Partial<T>,
    expectedHash?: string
  ): Promise<MutationResult<T>> {
    const file = contentFilePath(config.paths, config.kind, id);
    return withFileLock(file, async () => {
      const current = await get(id);
      const currentHash = contentHash(current);
      if (expectedHash !== undefined && expectedHash !== currentHash) {
        throw new ContentError("BLOGGER_CONTENT_STALE", `${config.kind} changed since it was loaded`, 409, {
          hash: currentHash,
        });
      }
      if (patch.slug !== undefined && patch.slug !== current.slug) {
        patch = { ...patch, slug: await ensureSlug(patch.slug, id) };
      }
      const merged = config.validate({
        ...current,
        ...patch,
        id: current.id,
        type: current.type,
        createdAt: current.createdAt,
        updatedAt: timestamp(),
      });
      const written = await writeJsonAtomic(config.paths, file, merged);
      return { item: merged, hash: written.hash, backup: written.backup };
    });
  }

  async function setStatus(
    id: string,
    status: ContentStatus,
    publishAt?: string | null
  ): Promise<MutationResult<T>> {
    const current = await get(id);
    const now = timestamp();
    const patch: Partial<T> = { status, updatedAt: now } as Partial<T>;
    if (status === "scheduled") {
      if (publishAt === undefined || publishAt === null) {
        throw new ContentError(
          "BLOGGER_CONTENT_MISSING_PUBLISH_DATE",
          "a publish date is required for scheduled content"
        );
      }
      patch.publishAt = publishAt as T["publishAt"];
    } else if (status === "published") {
      patch.publishedAt = now as T["publishedAt"];
      patch.publishAt = (publishAt ?? current.publishAt ?? now) as T["publishAt"];
    } else if (publishAt !== undefined) {
      patch.publishAt = publishAt as T["publishAt"];
    }
    return update(id, patch);
  }

  async function trash(id: string): Promise<MutationResult<T>> {
    return update(id, { trashedAt: timestamp() } as Partial<T>);
  }

  async function restore(id: string): Promise<MutationResult<T>> {
    return update(id, { trashedAt: null } as Partial<T>);
  }

  async function remove(id: string): Promise<{ backup: string }> {
    const file = contentFilePath(config.paths, config.kind, id);
    return withFileLock(file, async () => {
      await get(id);
      const backup = await deleteWithBackup(config.paths, file);
      return { backup: backup ?? "" };
    });
  }

  async function bulk(
    ids: string[],
    action: "publish" | "unpublish" | "trash" | "restore" | "delete"
  ): Promise<BulkResult> {
    const result: BulkResult = { succeeded: 0, failed: [] };
    for (const id of ids) {
      try {
        if (action === "delete") await remove(id);
        else if (action === "publish") await setStatus(id, "published");
        else if (action === "unpublish") await setStatus(id, "draft");
        else if (action === "trash") await trash(id);
        else await restore(id);
        result.succeeded += 1;
      } catch (error) {
        result.failed.push({
          id,
          code: error instanceof ContentError ? error.code : "BLOGGER_CONTENT_INTERNAL",
          message: error instanceof Error ? error.message : String(error),
        });
      }
    }
    return result;
  }

  return {
    all,
    list,
    get,
    find,
    getBySlug,
    slugs,
    hash,
    create,
    update,
    setStatus,
    trash,
    restore,
    remove,
    bulk,
    filePath: (id: string) => contentFilePath(config.paths, config.kind, id),
  };
}
