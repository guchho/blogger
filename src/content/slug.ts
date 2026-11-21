import { ContentError } from "./schema-helpers.js";

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const MAX_SLUG_LENGTH = 80;

export const RESERVED_SLUGS = new Set([
  "api",
  "dashboard",
  "index",
  "index.html",
  "preview",
  "__preview",
  "search",
  "template.xml",
  "favicon.ico",
  "404",
  "404.html",
  "p",
]);

export function slugify(input: string): string {
  const slug = input
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, MAX_SLUG_LENGTH)
    .replace(/-+$/g, "");
  return slug === "" ? "untitled" : slug;
}

export function isValidSlug(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.length > 0 &&
    value.length <= MAX_SLUG_LENGTH &&
    SLUG_PATTERN.test(value)
  );
}

export function assertSlug(value: unknown, label = "slug"): string {
  if (!isValidSlug(value)) {
    throw new ContentError(
      "BLOGGER_CONTENT_INVALID_SLUG",
      `${label} must use lowercase letters, digits and single hyphens`
    );
  }
  return value;
}

export interface UniqueSlugResult {
  slug: string;
  suggested?: string;
}

export function ensureUniqueSlug(
  input: string,
  taken: Iterable<string>
): UniqueSlugResult {
  const slug = assertSlug(slugify(input));
  const used = new Set(taken);
  if (RESERVED_SLUGS.has(slug)) {
    return { slug, suggested: `${slug}-post` };
  }
  if (!used.has(slug)) return { slug };
  let index = 2;
  while (used.has(`${slug}-${index}`)) index += 1;
  return { slug, suggested: `${slug}-${index}` };
}
