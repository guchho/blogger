// The shape of a deterministic preview page. One scenario produces one page
// and one `data:` root object, mirroring the groups Blogger exposes to a theme.

import type { ValueMap } from "../values.js";

export type PreviewPageType =
  | "index"
  | "post"
  | "page"
  | "label"
  | "archive"
  | "search"
  | "error"
  | "widgets";

export interface PreviewScenario {
  type: PreviewPageType;
  /** Output file name relative to the preview directory, e.g. "post.html". */
  file: string;
  /** Human label shown in the preview index. */
  title: string;
  /** The `data:` root object for this page. */
  data: ValueMap;
}
