import { createHash, randomUUID } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";

import { isInside } from "../compiler/compiler.js";
import { ContentError, isRecord } from "./schema-helpers.js";
import type { ContentKind } from "./model.js";

export interface ContentPaths {
  projectRoot: string;
  postsDir: string;
  pagesDir: string;
  dataDir: string;
  backupDir: string;
}

export interface ContentPathOverrides {
  postsDir?: string;
  pagesDir?: string;
  dataDir?: string;
  backupDir?: string;
}

export interface WriteResult {
  hash: string;
  backup: string | null;
}

const FILE_NAME_PATTERN = /^[A-Za-z0-9_-]+$/;

export function resolveContentPaths(
  projectRoot: string,
  overrides: ContentPathOverrides = {}
): ContentPaths {
  const root = path.resolve(projectRoot);
  const resolve = (value: string | undefined, fallback: string, label: string): string => {
    const target = path.resolve(root, value ?? fallback);
    if (!isInside(root, target)) {
      throw new ContentError(
        "BLOGGER_CONTENT_PATH_FORBIDDEN",
        `${label} must be inside the project directory`
      );
    }
    return target;
  };
  return {
    projectRoot: root,
    postsDir: resolve(overrides.postsDir, "src/posts", "postsDir"),
    pagesDir: resolve(overrides.pagesDir, "src/pages", "pagesDir"),
    dataDir: resolve(overrides.dataDir, "data", "dataDir"),
    backupDir: resolve(overrides.backupDir, ".blogger-backups", "backupDir"),
  };
}

export function assertInsideProject(paths: ContentPaths, target: string): string {
  const resolved = path.resolve(target);
  if (!isInside(paths.projectRoot, resolved)) {
    throw new ContentError(
      "BLOGGER_CONTENT_PATH_FORBIDDEN",
      "content paths must stay inside the project directory",
      403
    );
  }
  return resolved;
}

export function safeFileName(id: string): string {
  if (!FILE_NAME_PATTERN.test(id) || id === "." || id === "..") {
    throw new ContentError(
      "BLOGGER_CONTENT_INVALID_ID",
      "content ids may only contain letters, digits, hyphens and underscores"
    );
  }
  return `${id}.json`;
}

export function contentFilePath(paths: ContentPaths, kind: ContentKind, id: string): string {
  const directory = kind === "post" ? paths.postsDir : paths.pagesDir;
  return assertInsideProject(paths, path.join(directory, safeFileName(id)));
}

export function dataFilePath(paths: ContentPaths, name: string): string {
  return assertInsideProject(paths, path.join(paths.dataDir, safeFileName(name)));
}

export function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (isRecord(value)) {
    const entries = Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`);
    return `{${entries.join(",")}}`;
  }
  return JSON.stringify(value ?? null);
}

export function contentHash(value: unknown): string {
  return createHash("sha256").update(canonicalJson(value)).digest("hex");
}

export function serializeContent(value: unknown): string {
  return `${JSON.stringify(value, null, 2)}\n`;
}

export async function readAll<T>(directory: string, validate: (value: unknown) => T): Promise<T[]> {
  let names: string[];
  try {
    names = await fs.readdir(directory);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw error;
  }
  const files = names.filter((name) => name.endsWith(".json")).sort();
  const items: T[] = [];
  for (const name of files) {
    const file = path.join(directory, name);
    let parsed: unknown;
    try {
      parsed = JSON.parse(await fs.readFile(file, "utf8")) as unknown;
    } catch (error) {
      throw new ContentError(
        "BLOGGER_CONTENT_INVALID_JSON",
        `unable to parse ${name}: ${error instanceof Error ? error.message : String(error)}`
      );
    }
    items.push(validate(parsed));
  }
  return items;
}

export async function fileExists(file: string): Promise<boolean> {
  try {
    await fs.access(file);
    return true;
  } catch {
    return false;
  }
}

export async function readJsonFile<T>(file: string, validate: (value: unknown) => T): Promise<T> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(await fs.readFile(file, "utf8")) as unknown;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      throw new ContentError("BLOGGER_CONTENT_NOT_FOUND", "content file was not found", 404);
    }
    throw new ContentError(
      "BLOGGER_CONTENT_INVALID_JSON",
      `unable to parse ${path.basename(file)}: ${error instanceof Error ? error.message : String(error)}`
    );
  }
  return validate(parsed);
}

const locks = new Map<string, Promise<unknown>>();

export async function withFileLock<T>(file: string, operation: () => Promise<T>): Promise<T> {
  const key = path.resolve(file);
  const previous = locks.get(key) ?? Promise.resolve();
  let release: () => void = () => undefined;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  const chain = previous.then(() => gate);
  locks.set(key, chain);
  await previous;
  try {
    return await operation();
  } finally {
    release();
    void chain.then(() => {
      if (locks.get(key) === chain) locks.delete(key);
    });
  }
}

function backupStamp(): string {
  return new Date().toISOString().replace(/[-:.]/g, "").replace("Z", "Z");
}

export async function writeJsonAtomic(
  paths: ContentPaths,
  file: string,
  value: unknown
): Promise<WriteResult> {
  const target = assertInsideProject(paths, file);
  const directory = path.dirname(target);
  await fs.mkdir(directory, { recursive: true });
  const text = serializeContent(value);
  const hash = contentHash(value);

  let backup: string | null = null;
  if (await fileExists(target)) {
    await fs.mkdir(paths.backupDir, { recursive: true });
    const name = `${path.basename(target)}.bak-${backupStamp()}`;
    const backupPath = assertInsideProject(paths, path.join(paths.backupDir, name));
    await fs.copyFile(target, backupPath);
    backup = name;
  }

  const temporary = path.join(
    directory,
    `.${path.basename(target)}.tmp-${process.pid}-${randomUUID()}`
  );
  try {
    const handle = await fs.open(temporary, "wx", 0o600);
    try {
      await handle.writeFile(text, "utf8");
      await handle.sync();
    } finally {
      await handle.close();
    }
    await fs.rename(temporary, target);
  } catch (error) {
    await fs.rm(temporary, { force: true }).catch(() => undefined);
    throw error;
  }
  return { hash, backup };
}

export async function deleteWithBackup(paths: ContentPaths, file: string): Promise<string | null> {
  const target = assertInsideProject(paths, file);
  if (!(await fileExists(target))) {
    throw new ContentError("BLOGGER_CONTENT_NOT_FOUND", "content file was not found", 404);
  }
  await fs.mkdir(paths.backupDir, { recursive: true });
  const name = `${path.basename(target)}.deleted-${backupStamp()}`;
  const backupPath = assertInsideProject(paths, path.join(paths.backupDir, name));
  await fs.copyFile(target, backupPath);
  await fs.rm(target, { force: true });
  return name;
}

export function hashMatches(value: unknown, expected: string): boolean {
  return contentHash(value) === expected;
}
