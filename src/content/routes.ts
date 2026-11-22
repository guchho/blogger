import { ContentError } from "./schema-helpers.js";
import { normalizedBaseUrl } from "./settings-model.js";
import type { ContentItem } from "./model.js";

export const RESERVED_ROUTES = new Set([
  "/",
  "/search/",
  "/search",
  "/dashboard/",
  "/preview/",
  "/__preview/",
  "/404.html",
  "/favicon.ico",
  "/template.xml",
]);

function dateParts(item: ContentItem): { year: string; month: string } {
  const value = item.publishAt ?? item.publishedAt ?? item.createdAt;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new ContentError("BLOGGER_CONTENT_INVALID_DATE", "content has an invalid publication date");
  }
  return {
    year: String(date.getUTCFullYear()),
    month: String(date.getUTCMonth() + 1).padStart(2, "0"),
  };
}

export function postPath(item: ContentItem): string {
  const { year, month } = dateParts(item);
  return `/${year}/${month}/${item.slug}.html`;
}

export function pagePath(item: ContentItem): string {
  return `/p/${item.slug}.html`;
}

export function labelPath(label: string): string {
  return `/search/label/${encodeURIComponent(label)}/`;
}

export function archivePath(item: ContentItem): string {
  const { year, month } = dateParts(item);
  return `/${year}/${month}/`;
}

export function postUrl(baseUrl: string, item: ContentItem): string {
  return new URL(postPath(item).slice(1), normalizedBaseUrl(baseUrl)).toString();
}

export function pageUrl(baseUrl: string, item: ContentItem): string {
  return new URL(pagePath(item).slice(1), normalizedBaseUrl(baseUrl)).toString();
}

export function labelUrl(baseUrl: string, label: string): string {
  return new URL(labelPath(label).slice(1), normalizedBaseUrl(baseUrl)).toString();
}

export function archiveUrl(baseUrl: string, item: ContentItem): string {
  return new URL(archivePath(item).slice(1), normalizedBaseUrl(baseUrl)).toString();
}

export function searchUrl(baseUrl: string, query = ""): string {
  const url = new URL("search/", normalizedBaseUrl(baseUrl));
  if (query !== "") url.searchParams.set("q", query);
  return url.toString();
}

export function routeOf(url: string): string {
  try {
    return new URL(url).pathname;
  } catch {
    return "/";
  }
}

export function assertNoRouteCollisions(
  posts: ContentItem[],
  pages: ContentItem[]
): Map<string, string> {
  const routes = new Map<string, string>();
  const register = (route: string, id: string) => {
    if (RESERVED_ROUTES.has(route)) {
      throw new ContentError("BLOGGER_CONTENT_ROUTE_RESERVED", `route "${route}" is reserved`, 409);
    }
    const existing = routes.get(route);
    if (existing !== undefined && existing !== id) {
      throw new ContentError(
        "BLOGGER_CONTENT_ROUTE_CONFLICT",
        `route "${route}" is used by both ${existing} and ${id}`,
        409
      );
    }
    routes.set(route, id);
  };
  for (const post of posts) register(postPath(post), post.id);
  for (const page of pages) register(pagePath(page), page.id);
  return routes;
}
