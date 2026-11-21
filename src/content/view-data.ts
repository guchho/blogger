import { BloggerDate, HtmlString, type ValueMap } from "../preview/values.js";
import type { Page, Post } from "./model.js";
import type { Author, SiteSettings } from "./settings-model.js";
import { sanitizeHtml } from "./sanitize.js";
import { labelUrl, pageUrl, postUrl } from "./routes.js";

function excerptOf(text: string, limit = 180): string {
  const plain = text.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
  return plain.length <= limit ? plain : `${plain.slice(0, limit).trimEnd()}…`;
}

function authorValue(name: string, settings: SiteSettings): ValueMap {
  const found: Author | undefined =
    settings.authors.find((author) => author.name === name) ??
    settings.authors[0] ??
    undefined;
  const profileUrl = found?.profileUrl ?? `${normalizedBase(settings.baseUrl)}p/about.html`;
  return {
    name: found?.name ?? name,
    profileUrl,
    aboutMe: found?.aboutMe ?? "",
    authorPhoto: { image: found?.avatar ?? "" },
  };
}

function normalizedBase(baseUrl: string): string {
  return baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`;
}

export interface ViewDataOptions {
  settings: SiteSettings;
  sanitize?: boolean;
}

export function postToValueMap(post: Post, options: ViewDataOptions): ValueMap {
  const { settings } = options;
  const content = options.sanitize === false ? post.content : sanitizeHtml(post.content);
  const body = new HtmlString(content);
  const url = postUrl(settings.baseUrl, post);
  const date = new BloggerDate(post.publishAt ?? post.publishedAt ?? post.createdAt);
  const author = authorValue(post.author, settings);
  const excerpt = post.excerpt === "" ? excerptOf(content) : post.excerpt;
  const labels = post.labels.map((name, index) => ({
    name,
    url: labelUrl(settings.baseUrl, name),
    isLast: index === post.labels.length - 1,
  }));
  return {
    id: post.id,
    title: post.title,
    body,
    content,
    snippet: excerpt,
    snippets: {
      short: new HtmlString(`<p>${excerpt}</p>`),
      long: new HtmlString(`<p>${excerpt}</p>`),
    },
    excerpt: new HtmlString(`<p>${excerpt}</p>`),
    description: excerpt,
    url,
    canonical: url,
    link: url,
    date,
    timestamp: date,
    lastUpdated: new BloggerDate(post.updatedAt),
    author,
    authorProfileUrl: author["profileUrl"] ?? "",
    labels,
    numberOfComments: 0,
    comments: [],
    commentsUrl: `${url}#comments`,
    emailPostUrl: `mailto:?subject=${encodeURIComponent(post.title)}`,
    shareUrl: url,
    featuredImage: post.featuredImage ?? "",
    thumbnailUrl: post.featuredImage ?? "",
    allowComments: post.allowComments,
    allowNewComments: post.allowComments,
    viewType: "post",
  };
}

export function pageToValueMap(page: Page, options: ViewDataOptions): ValueMap {
  const { settings } = options;
  const content = options.sanitize === false ? page.content : sanitizeHtml(page.content);
  const body = new HtmlString(content);
  const url = pageUrl(settings.baseUrl, page);
  const date = new BloggerDate(page.publishAt ?? page.publishedAt ?? page.createdAt);
  return {
    id: page.id,
    title: page.title,
    body,
    content,
    snippet: excerptOf(content),
    snippets: { short: new HtmlString(`<p>${excerptOf(content)}</p>`) },
    url,
    canonical: url,
    link: url,
    date,
    timestamp: date,
    author: authorValue(settings.author, settings),
    labels: [],
    featuredImage: page.featuredImage ?? "",
    allowComments: false,
    viewType: "page",
  };
}
