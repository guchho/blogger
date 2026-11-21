import { promises as fs } from "node:fs";

import { defaultPost, type Post } from "./model.js";
import { createPostRepository } from "./posts.js";
import { ContentError } from "./schema-helpers.js";
import type { ContentPaths } from "./storage.js";

export const DEFAULT_SEED_POST_ID = "hello-world";
export const DEFAULT_SEED_TIMESTAMP = "2026-01-01T00:00:00.000Z";

export interface DefaultPostSeedResult {
  created: boolean;
  item?: Post;
  file?: string;
}

async function hasJsonFile(directory: string): Promise<boolean> {
  try {
    const names = await fs.readdir(directory);
    return names.some((name) => name.endsWith(".json"));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return false;
    throw error;
  }
}

export async function ensureDefaultPost(
  paths: ContentPaths,
  now: Date = new Date()
): Promise<DefaultPostSeedResult> {
  if (await hasJsonFile(paths.postsDir)) return { created: false };

  const repository = createPostRepository(paths);
  const timestamp = now.toISOString();

  try {
    const written = await repository.create(
      defaultPost({
        id: DEFAULT_SEED_POST_ID,
        title: "Hello world",
        slug: DEFAULT_SEED_POST_ID,
        content:
          "<p>Welcome to your Guchho Blogger site. Edit this post in the dashboard or replace <code>src/posts/hello-world.json</code> with your own content.</p>",
        excerpt: "Welcome to your Guchho Blogger site.",
        status: "published",
        labels: ["General"],
        author: "admin",
        featuredImage: null,
        allowComments: true,
        createdAt: timestamp,
        updatedAt: timestamp,
        publishedAt: timestamp,
        publishAt: timestamp,
        trashedAt: null,
      })
    );
    return {
      created: true,
      item: written.item,
      file: repository.filePath(written.item.id),
    };
  } catch (error) {
    if (
      error instanceof ContentError &&
      error.code === "BLOGGER_CONTENT_ALREADY_EXISTS"
    ) {
      return { created: false };
    }
    throw error;
  }
}
