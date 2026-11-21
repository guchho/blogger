import { promises as fs } from "node:fs";

import type { Page, Post } from "./model.js";
import { createPageRepository } from "./pages.js";
import { createPostRepository } from "./posts.js";
import { ContentError, isRecord } from "./schema-helpers.js";
import type { Author, SiteSettings } from "./settings-model.js";
import { defaultSettings } from "./settings-model.js";
import { contentHash, dataFilePath } from "./storage.js";
import type { ContentPaths } from "./storage.js";

async function loadJson(paths: ContentPaths, name: string): Promise<unknown> {
  const file = dataFilePath(paths, name);
  let text: string;
  try {
    text = await fs.readFile(file, "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return undefined;
    throw error;
  }
  try {
    return JSON.parse(text) as unknown;
  } catch (error) {
    throw new ContentError(
      "BLOGGER_CONTENT_INVALID_JSON",
      `unable to parse ${name}.json: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

function text(value: unknown, fallback: string): string {
  return typeof value === "string" ? value : fallback;
}

function positiveInteger(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isInteger(value) && value > 0 ? value : fallback;
}

function stringArray(value: unknown): string[] {
  if (Array.isArray(value)) return value.filter((item): item is string => typeof item === "string");
  if (isRecord(value) && Array.isArray(value["categories"])) {
    return value["categories"].filter((item): item is string => typeof item === "string");
  }
  return [];
}

function authors(value: unknown): Author[] {
  const list = Array.isArray(value)
    ? value
    : isRecord(value) && Array.isArray(value["authors"])
      ? value["authors"]
      : [];
  return list.flatMap((item): Author[] => {
    if (!isRecord(item) || typeof item["name"] !== "string") return [];
    const author: Author = { name: item["name"] };
    if (typeof item["profileUrl"] === "string") author.profileUrl = item["profileUrl"];
    if (typeof item["aboutMe"] === "string") author.aboutMe = item["aboutMe"];
    if (typeof item["avatar"] === "string") author.avatar = item["avatar"];
    return [author];
  });
}

export async function loadSettings(paths: ContentPaths): Promise<SiteSettings> {
  const defaults = defaultSettings();
  const [settings, categories, authorData] = await Promise.all([
    loadJson(paths, "settings"),
    loadJson(paths, "categories"),
    loadJson(paths, "authors"),
  ]);
  const record = isRecord(settings) ? settings : {};
  return {
    title: text(record["title"], defaults.title),
    description: text(record["description"], defaults.description),
    baseUrl: text(record["baseUrl"], defaults.baseUrl),
    favicon: text(record["favicon"], defaults.favicon),
    author: text(record["author"], defaults.author),
    postsPerPage: positiveInteger(record["postsPerPage"], defaults.postsPerPage),
    categories: stringArray(categories),
    authors: authors(authorData),
  };
}

export interface ContentSnapshot {
  paths: ContentPaths;
  posts: Post[];
  pages: Page[];
  settings: SiteSettings;
  hash: string;
}

export async function buildSnapshot(
  paths: ContentPaths,
  posts: Post[],
  pages: Page[],
  settings: SiteSettings
): Promise<ContentSnapshot> {
  return { paths, posts, pages, settings, hash: contentHash({ posts, pages, settings }) };
}

export async function loadContent(paths: ContentPaths): Promise<ContentSnapshot> {
  const [posts, pages, settings] = await Promise.all([
    createPostRepository(paths).all(),
    createPageRepository(paths).all(),
    loadSettings(paths),
  ]);
  return buildSnapshot(paths, posts, pages, settings);
}
