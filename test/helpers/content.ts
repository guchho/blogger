import { promises as fs } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { resolveContentPaths } from "../../src/content/storage.js";
import type { ContentPaths } from "../../src/content/storage.js";

export async function withContentRoot(
  run: (paths: ContentPaths, root: string) => Promise<void>
): Promise<void> {
  const root = await fs.mkdtemp(path.join(tmpdir(), "guchho-content-crud-"));
  try {
    await run(resolveContentPaths(root), root);
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
}
