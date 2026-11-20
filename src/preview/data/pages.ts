import type { ValueMap } from "../values.js";
import { PREVIEW_BLOG_URL } from "./metadata.js";
import {
  attachWidgetTypeKeys,
  buildBaseData,
  defaultWidgetSeeds,
  mockPages,
  mockPosts,
  mockWidgets,
  type WidgetSeed,
} from "./mock.js";
import type { PreviewScenario } from "./types.js";

function routeOf(url: string): string {
  try {
    return new URL(url).pathname;
  } catch {
    return "/";
  }
}

function withView(data: ValueMap, overrides: ValueMap): ValueMap {
  const view = { ...(data["view"] as ValueMap), ...overrides };
  return { ...data, view };
}

export function buildScenarios(seeds: WidgetSeed[] = defaultWidgetSeeds()): PreviewScenario[] {
  const posts = mockPosts();
  const pages = mockPages();
  const widgets = attachWidgetTypeKeys(mockWidgets(seeds));
  const firstPost = posts[0] as ValueMap;
  const firstPage = pages[0] as ValueMap;

  const scenarios: PreviewScenario[] = [];

  const index = buildBaseData({
    pageType: "index",
    canonicalUrl: PREVIEW_BLOG_URL,
    widgets,
    posts,
  });
  scenarios.push({
    type: "index",
    file: "index.html",
    route: "/",
    title: "Home",
    data: index,
  });

  const post = buildBaseData({
    pageType: "item",
    canonicalUrl: firstPost["url"] as string,
    widgets,
    posts: [firstPost],
    post: firstPost,
  });
  scenarios.push({
    type: "post",
    file: "post.html",
    route: routeOf(firstPost["url"] as string),
    title: "Post",
    data: post,
  });

  const page = buildBaseData({
    pageType: "static_page",
    canonicalUrl: firstPage["url"] as string,
    widgets,
    posts: [],
    page: firstPage,
  });
  scenarios.push({
    type: "page",
    file: "page.html",
    route: routeOf(firstPage["url"] as string),
    title: "Page",
    data: page,
  });

  const label = withView(
    buildBaseData({
      pageType: "label",
      canonicalUrl: `${PREVIEW_BLOG_URL}search/label/Templates`,
      widgets,
      posts: posts.slice(0, 2),
    }),
    {
      search: { label: "Templates", query: "", resultsMessageHtml: "<b>2</b> results" },
    }
  );
  scenarios.push({
    type: "label",
    file: "label.html",
    route: "/search/label/Templates/",
    title: "Label",
    data: label,
  });

  const archive = withView(
    buildBaseData({
      pageType: "archive",
      canonicalUrl: `${PREVIEW_BLOG_URL}2026/01/`,
      widgets,
      posts,
    }),
    { archive: { rangeMessage: "January 2026" } }
  );
  scenarios.push({
    type: "archive",
    file: "archive.html",
    route: "/2026/01/",
    title: "Archive",
    data: archive,
  });

  const search = withView(
    buildBaseData({
      pageType: "search",
      canonicalUrl: `${PREVIEW_BLOG_URL}search?q=guchho`,
      widgets,
      posts: posts.slice(0, 1),
    }),
    {
      search: {
        label: "",
        query: "guchho",
        resultsMessageHtml: "<b>1</b> result",
      },
    }
  );
  scenarios.push({
    type: "search",
    file: "search.html",
    route: "/search/",
    title: "Search",
    data: search,
  });

  const error = buildBaseData({
    pageType: "error_page",
    canonicalUrl: `${PREVIEW_BLOG_URL}404.html`,
    widgets,
    posts: [],
  });
  scenarios.push({
    type: "error",
    file: "404.html",
    route: "/404.html",
    title: "Not Found",
    data: error,
  });

  const widgetsPage = buildBaseData({
    pageType: "index",
    canonicalUrl: `${PREVIEW_BLOG_URL}widgets`,
    widgets,
    posts: posts.slice(0, 1),
  });
  scenarios.push({
    type: "widgets",
    file: "widgets.html",
    route: "/__preview/widgets/",
    title: "Widgets",
    data: widgetsPage,
  });

  return scenarios;
}
