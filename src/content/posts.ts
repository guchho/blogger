import type { Post } from "./model.js";
import { defaultPost } from "./model.js";
import { createRepository } from "./repository.js";
import { validatePost } from "./schema.js";
import type { ContentPaths } from "./storage.js";

export function createPostRepository(paths: ContentPaths) {
  return createRepository<Post>({
    kind: "post",
    paths,
    validate: validatePost,
    defaults: defaultPost,
  });
}
