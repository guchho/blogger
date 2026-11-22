import { HtmlString, type ValueMap } from "../preview/values.js";
import type { PreviewScenario } from "../preview/data/types.js";
import {
  attachWidgetTypeKeys,
  buildBaseData,
  defaultWidgetSeeds,
  mockWidgets,
  type WidgetSeed,
} from "../preview/data/mock.js";
import { isPublished } from "./model.js";
import { archiveUrl, assertNoRouteCollisions, labelUrl, routeOf, searchUrl } from "./routes.js";
import { slugify } from "./slug.js";
import type { ContentSnapshot } from "./settings.js";
import { pageToValueMap, postToValueMap } from "./view-data.js";

export interface ContentScenarioOptions {
  baseUrl?: string;
  favicon?: string;
  now?: Date;
  includeWidgets?: boolean;
  sanitize?: boolean;
  postsPerPage?: number;
  widgetSeeds?: WidgetSeed[];
}

export function buildContentScenarios(
  snapshot: ContentSnapshot,
  options: ContentScenarioOptions = {}
): PreviewScenario[] {
  const baseUrl = options.baseUrl ?? snapshot.settings.baseUrl;
  const now = options.now ?? new Date();
  const viewOptions = { settings: snapshot.settings, sanitize: options.sanitize };
  const publishedPosts = snapshot.posts
    .filter((post) => isPublished(post, now))
    .sort((a, b) => Date.parse(b.publishAt ?? b.publishedAt ?? b.createdAt) - Date.parse(a.publishAt ?? a.publishedAt ?? a.createdAt));
  const publishedPages = snapshot.pages.filter((page) => isPublished(page, now));
  assertNoRouteCollisions(publishedPosts, publishedPages);

  const postValues = publishedPosts.map((post) => postToValueMap(post, viewOptions));
  const postValuesById = new Map(publishedPosts.map((post, index) => [post.id, postValues[index]]));
  const pageValues = publishedPages.map((page) => pageToValueMap(page, viewOptions));
  const widgetSeeds = options.widgetSeeds ?? defaultWidgetSeeds();
  const widgets = attachWidgetTypeKeys(mockWidgets(widgetSeeds));
  const perPage = options.postsPerPage ?? snapshot.settings.postsPerPage;
  const favicon = options.favicon ?? snapshot.settings.favicon;

  const labels = [
    ...new Set([...publishedPosts.flatMap((post) => post.labels), ...snapshot.settings.categories]),
  ].sort();
  const labelValues = labels.map((name, index) => ({
    name,
    url: labelUrl(baseUrl, name),
    isLast: index === labels.length - 1,
  }));

  const withContent = (
    data: ValueMap,
    canonicalUrl: string,
    extras: ValueMap = {}
  ): ValueMap => {
    const view = (data["view"] ?? {}) as ValueMap;
    const blog = (data["blog"] ?? {}) as ValueMap;
    const settings = (data["settings"] ?? {}) as ValueMap;
    return {
      ...data,
      ...extras,
      view: { ...view, title: snapshot.settings.title, description: snapshot.settings.description, url: canonicalUrl, canonicalUrl },
      blog: {
        ...blog,
        title: snapshot.settings.title,
        homepageUrl: new URL(baseUrl).toString(),
        canonicalUrl,
        metaDescription: snapshot.settings.description,
        blogspotFaviconUrl: favicon,
        searchUrl: searchUrl(baseUrl),
        sourceUrl: canonicalUrl,
      },
      settings: { ...settings, title: snapshot.settings.title, description: snapshot.settings.description, postsPerPage: perPage },
      labels: labelValues,
      defaultTitle: snapshot.settings.title,
    };
  };

  const base = (
    type: string,
    canonicalUrl: string,
    pagePosts: ValueMap[] = postValues,
    post?: ValueMap,
    page?: ValueMap
  ): ValueMap =>
    withContent(
      buildBaseData({ pageType: type, canonicalUrl, widgets, posts: pagePosts, post, page }),
      canonicalUrl
    );

  const scenarios: PreviewScenario[] = [
    {
      type: "index",
      file: "index.html",
      route: "/",
      title: "Home",
      data: base("index", new URL(baseUrl).toString(), postValues.slice(0, perPage)),
    },
  ];

  for (const [index, post] of publishedPosts.entries()) {
    const value = postValues[index];
    if (value === undefined) continue;
    const canonical = String(value["url"]);
    scenarios.push({
      type: "post",
      file: `post-${post.slug}.html`,
      route: routeOf(canonical),
      title: post.title,
      data: base("item", canonical, [value], value),
    });
  }

  for (const [index, page] of publishedPages.entries()) {
    const value = pageValues[index];
    if (value === undefined) continue;
    const canonical = String(value["url"]);
    scenarios.push({
      type: "page",
      file: `page-${page.slug}.html`,
      route: routeOf(canonical),
      title: page.title,
      data: base("static_page", canonical, [value], value, value),
    });
  }

  for (const label of labels) {
    const matching = publishedPosts.filter((post) => post.labels.includes(label));
    const canonical = labelUrl(baseUrl, label);
    const data = base("label", canonical, matching.flatMap((post) => {
      const value = postValuesById.get(post.id);
      return value === undefined ? [] : [value];
    }));
    const view = data["view"] as ValueMap;
    const search = { ...(data["search"] as ValueMap), label, query: "", resultsMessageHtml: new HtmlString(`<b>${matching.length}</b> results`) };
    scenarios.push({
      type: "label",
      file: `label-${slugify(label)}.html`,
      route: routeOf(canonical),
      title: `Label: ${label}`,
      data: { ...data, view: { ...view, search }, search },
    });
  }

  const archives = new Map<string, typeof publishedPosts>();
  for (const post of publishedPosts) {
    const date = new Date(post.publishAt ?? post.publishedAt ?? post.createdAt);
    const key = `${date.getUTCFullYear()}/${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
    const bucket = archives.get(key) ?? [];
    bucket.push(post);
    archives.set(key, bucket);
  }
  for (const [key, items] of archives) {
    const canonical = archiveUrl(baseUrl, items[0] as (typeof publishedPosts)[number]);
    const data = base("archive", canonical, items.map((post) => postToValueMap(post, viewOptions)));
    const [year, month] = key.split("/");
    const rangeMessage = new Date(Date.UTC(Number(year), Number(month) - 1, 1)).toLocaleDateString("en-US", {
      year: "numeric", month: "long", timeZone: "UTC",
    });
    scenarios.push({
      type: "archive",
      file: `archive-${key.replace("/", "-")}.html`,
      route: routeOf(canonical),
      title: rangeMessage,
      data: { ...data, archive: { rangeMessage }, view: { ...(data["view"] as ValueMap), archive: { rangeMessage } } },
    });
  }

  const searchCanonical = searchUrl(baseUrl);
  const searchData = base("search", searchCanonical, postValues);
  const searchView = { ...(searchData["view"] as ValueMap), search: { label: "", query: "", resultsMessageHtml: new HtmlString(`<b>${postValues.length}</b> results`) } };
  scenarios.push({
    type: "search",
    file: "search.html",
    route: "/search/",
    title: "Search",
    data: { ...searchData, search: searchView["search"], view: searchView },
  });

  const errorCanonical = new URL("404.html", baseUrl).toString();
  scenarios.push({
    type: "error",
    file: "404.html",
    route: "/404.html",
    title: "Not Found",
    data: base("error_page", errorCanonical, []),
  });

  if (options.includeWidgets === true) {
    const canonical = new URL("widgets", baseUrl).toString();
    scenarios.push({
      type: "widgets",
      file: "widgets.html",
      route: "/__preview/widgets/",
      title: "Widgets",
      data: base("index", canonical, postValues.slice(0, 1)),
    });
  }

  return scenarios;
}

