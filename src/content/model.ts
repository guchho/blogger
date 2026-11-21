export type ContentKind = "post" | "page";

export type ContentStatus = "draft" | "published" | "scheduled";

export type EffectiveStatus = ContentStatus | "trash";

export interface ContentBase {
  id: string;
  type: ContentKind;
  title: string;
  slug: string;
  content: string;
  status: ContentStatus;
  featuredImage: string | null;
  createdAt: string;
  updatedAt: string;
  publishedAt: string | null;
  publishAt: string | null;
  trashedAt: string | null;
}

export interface Post extends ContentBase {
  type: "post";
  excerpt: string;
  labels: string[];
  author: string;
  allowComments: boolean;
}

export interface Page extends ContentBase {
  type: "page";
}

export type ContentItem = Post | Page;

export function isPost(item: ContentItem): item is Post {
  return item.type === "post";
}

export function isPage(item: ContentItem): item is Page {
  return item.type === "page";
}

export function isTrashed(item: ContentItem): boolean {
  return item.trashedAt !== null;
}

export function effectiveStatus(
  item: ContentItem,
  now: Date = new Date()
): EffectiveStatus {
  if (isTrashed(item)) return "trash";
  if (
    item.status === "scheduled" &&
    item.publishAt !== null &&
    Date.parse(item.publishAt) <= now.getTime()
  ) {
    return "published";
  }
  return item.status;
}

export function isPublished(item: ContentItem, now: Date = new Date()): boolean {
  return effectiveStatus(item, now) === "published";
}

export function isScheduled(item: ContentItem, now: Date = new Date()): boolean {
  return effectiveStatus(item, now) === "scheduled";
}

export function timestamp(date: Date = new Date()): string {
  return date.toISOString();
}

export function newItemId(kind: ContentKind): string {
  return `${kind}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export function defaultPost(overrides: Partial<Post> = {}): Post {
  const now = timestamp();
  return {
    id: newItemId("post"),
    type: "post",
    title: "",
    slug: "untitled",
    content: "",
    excerpt: "",
    status: "draft",
    labels: [],
    author: "admin",
    featuredImage: null,
    allowComments: true,
    createdAt: now,
    updatedAt: now,
    publishedAt: null,
    publishAt: null,
    trashedAt: null,
    ...overrides,
  };
}

export function defaultPage(overrides: Partial<Page> = {}): Page {
  const now = timestamp();
  return {
    id: newItemId("page"),
    type: "page",
    title: "",
    slug: "untitled",
    content: "",
    status: "draft",
    featuredImage: null,
    createdAt: now,
    updatedAt: now,
    publishedAt: null,
    publishAt: null,
    trashedAt: null,
    ...overrides,
  };
}
