import type { Page } from "./model.js";
import { defaultPage } from "./model.js";
import { createRepository } from "./repository.js";
import { validatePage } from "./schema.js";
import type { ContentPaths } from "./storage.js";

export function createPageRepository(paths: ContentPaths) {
  return createRepository<Page>({
    kind: "page",
    paths,
    validate: validatePage,
    defaults: defaultPage,
  });
}
