// Deterministic mock content. Every value here is fixed so that a preview
// build is reproducible; nothing is read from the network or the clock.

import {
  BloggerDate,
  HtmlString,
  toText,
  type Value,
  type ValueMap,
} from "../values.js";
import {
  PREVIEW_BLOG_URL,
  PREVIEW_IMAGE,
  allBylineItems,
  blogMetadata,
  messages,
  previewImage,
  previewTimestamp,
  skinData,
  SHARING_PLATFORMS,
} from "./metadata.js";
import { linkListSortName } from "../../layout/linklist/serialization.js";
import {
  LINKLIST_SETTING,
  LINKLIST_SORTING,
} from "../../layout/linklist/types.js";

const IMAGE = (id: number, size = 1600): string =>
  previewImage(`Post ${id}`, size, (id * 47 + 190) % 360);
const AVATAR = (label: string, id: number): string =>
  previewImage(label, 160, (id * 67 + 24) % 360);

export interface MockAuthor {
  name: string;
  profileUrl: string;
  aboutMe: string;
  avatar: string;
}

export const AUTHORS: MockAuthor[] = [
  {
    name: "Ada Lovelace",
    profileUrl: `${PREVIEW_BLOG_URL}p/about.html`,
    aboutMe: "Writes about templates and the web.",
    avatar: AVATAR("AL", 1),
  },
  {
    name: "Grace Hopper",
    profileUrl: `${PREVIEW_BLOG_URL}p/about.html`,
    aboutMe: "Compiler enthusiast and blogger.",
    avatar: AVATAR("GH", 2),
  },
];

function label(name: string, index: number, total: number): ValueMap {
  return {
    name,
    url: `${PREVIEW_BLOG_URL}search/label/${encodeURIComponent(name)}`,
    isLast: index === total - 1,
  };
}

function makePost(
  index: number,
  title: string,
  labels: string[],
  daysAgo: number
): ValueMap {
  const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  const url = `${PREVIEW_BLOG_URL}2026/01/${slug}.html`;
  const author = AUTHORS[index % AUTHORS.length] as MockAuthor;
  const labelValues = labels.map((name, position) =>
    label(name, position, labels.length)
  );
  const date = previewTimestamp(daysAgo);
  const body = new HtmlString(
    `<p>${title} is one of the deterministic mock posts used to render this template.</p>` +
      `<p>It exists so the preview can exercise loops, conditionals and bylines ` +
      `without talking to Blogger.</p>`
  );
  const snippetHtml = new HtmlString(
    `<p>${title} is one of the deterministic mock posts used to render this template…</p>`
  );
  const comments = mockComments(url);

  return {
    id: `100000000000000000${index + 1}`,
    title,
    body,
    snippet: `${title} is one of the deterministic mock posts used to render this template…`,
    snippets: {
      short: snippetHtml,
      long: snippetHtml,
    },
    excerpt: snippetHtml,
    description: `${title} is a deterministic mock post.`,
    url,
    canonical: url,
    date,
    timestamp: date,
    lastUpdated: date,
    author: {
      name: author.name,
      profileUrl: author.profileUrl,
      aboutMe: author.aboutMe,
      authorPhoto: { image: author.avatar },
    },
    authorProfileUrl: author.profileUrl,
    authorAvatarSrc: author.avatar,
    labels: labelValues,
    comments,
    backlinks: [],
    reactions: [],
    commentsUrl: `${url}#comments`,
    commentsUrlOnclick: `return false;`,
    emailPostUrl: `mailto:?subject=${encodeURIComponent(title)}`,
    shareUrl: url,
    numberOfComments: comments.length,
    reactionsUrl: `${url}#reactions`,
    featuredImage: IMAGE(index + 1),
    thumbnailUrl: IMAGE(index + 1, 400),
    location: {
      name: "Internet",
      mapsUrl: "https://maps.google.com/?q=internet",
    },
    allowComments: true,
    allowNewComments: true,
    allowIframeComments: false,
    embedCommentForm: false,
    showThreadedComments: false,
    commentSource: "blogger",
    commentSrc: "",
    commentHtml: new HtmlString("<p>Mock comment.</p>"),
    commentJso: "",
    commentConfig: "",
    commentMsgs: "",
    cmtfpIframe: false,
    iframeCommentSrc: "",
    commentFormIframeSrc: "",
    appRpcRelayPath: "",
    commentRangeText: "",
    noNewCommentsText: "Comments are closed.",
    commentPagingRequired: false,
    hasOlderLinks: index < 4,
    hasNewerLinks: index > 0,
    newerLinkUrl: `${PREVIEW_BLOG_URL}2026/01/newer.html`,
    olderLinkUrl: `${PREVIEW_BLOG_URL}2026/01/older.html`,
    newestLinkUrl: `${PREVIEW_BLOG_URL}2026/01/newest.html`,
    oldestLinkUrl: `${PREVIEW_BLOG_URL}2026/01/oldest.html`,
    newLinkClass: "newer",
    oldLinkClass: "older",
    viewType: "post",
  };
}

export function mockPosts(): ValueMap[] {
  return [
    makePost(0, "Getting started with Guchho", ["Guchho", "Templates"], 1),
    makePost(1, "Building a Blogger theme", ["Blogger", "Templates"], 3),
    makePost(2, "Component driven templates", ["Guchho", "Components"], 6),
    makePost(3, "Designing for readers", ["Design"], 9),
  ];
}

export function mockPages(): ValueMap[] {
  return [
    {
      id: "2000000000000000001",
      title: "About",
      body: new HtmlString("<p>About this mock blog.</p>"),
      snippet: "About this mock blog.",
      snippets: { short: new HtmlString("<p>About this mock blog.</p>") },
      url: `${PREVIEW_BLOG_URL}p/about.html`,
      canonical: `${PREVIEW_BLOG_URL}p/about.html`,
      date: previewTimestamp(30),
      author: { name: "Ada Lovelace", profileUrl: `${PREVIEW_BLOG_URL}p/about.html` },
      labels: [],
      featuredImage: PREVIEW_IMAGE,
      allowComments: false,
      viewType: "page",
    },
  ];
}

export function mockLabels(): ValueMap[] {
  return ["Guchho", "Blogger", "Templates", "Components", "Design"].map((name, index) => ({
    name,
    url: `${PREVIEW_BLOG_URL}search/label/${encodeURIComponent(name)}`,
    count: (index + 1) * 3,
  }));
}

export function mockComments(
  baseUrl = `${PREVIEW_BLOG_URL}2026/01/getting-started.html`
): ValueMap[] {
  return [
    {
      id: "c1",
      author: "Reader One",
      authorUrl: `${PREVIEW_BLOG_URL}profile/reader-one`,
      authorAvatarSrc: AVATAR("R1", 3),
      body: new HtmlString("<p>Great post, thanks!</p>"),
      timestamp: previewTimestamp(1),
      url: `${baseUrl}#c1`,
      deleteUrl: `${baseUrl}#delete-c1`,
      adminClass: "comment-author",
      isDeleted: false,
    },
    {
      id: "c2",
      author: "Reader Two",
      authorUrl: `${PREVIEW_BLOG_URL}profile/reader-two`,
      authorAvatarSrc: AVATAR("R2", 4),
      body: new HtmlString("<p>Very helpful.</p>"),
      timestamp: previewTimestamp(2),
      url: `${baseUrl}#c2`,
      deleteUrl: `${baseUrl}#delete-c2`,
      adminClass: "comment-author",
      isDeleted: false,
    },
  ];
}

export interface WidgetSeed {
  type: string;
  id: string;
  title?: string;
  settings?: Record<string, string>;
  sectionId?: string;
}

export function defaultWidgetSeeds(): WidgetSeed[] {
  return [
    { type: "Header", id: "Header1", title: "Guchho Blogger Preview", sectionId: "header" },
    { type: "PageList", id: "PageList1", title: "Pages", sectionId: "header" },
    { type: "Blog", id: "Blog1", title: "Blog Posts", sectionId: "main" },
    { type: "Label", id: "Label1", title: "Labels", sectionId: "sidebar" },
    { type: "BlogArchive", id: "BlogArchive1", title: "Archive", sectionId: "sidebar" },
    { type: "PopularPosts", id: "PopularPosts1", title: "Popular Posts", sectionId: "sidebar" },
    { type: "LinkList", id: "LinkList1", title: "Links", sectionId: "sidebar" },
    { type: "HTML", id: "HTML1", title: "HTML", sectionId: "sidebar" },
    { type: "Attribution", id: "Attribution1", sectionId: "footer" },
  ];
}

function bylineItemsArray(): ValueMap[] {
  return allBylineItems().map((item) => ({
    name: item["name"] as Value,
    label: item["title"] as Value,
  }));
}

/**
 * Widget-type specific mock fields. Blogger exposes a different data shape per
 * widget type; these values let the built-in default markups render something
 * meaningful when a template does not override them.
 */
export function widgetTypeExtras(type: string): ValueMap {
  switch (type) {
    case "PageList":
      return {
        pages: [
          { name: "Home", url: PREVIEW_BLOG_URL },
          { name: "About", url: `${PREVIEW_BLOG_URL}p/about.html` },
        ],
      };
    case "Text":
      return {
        content: new HtmlString("<p>A deterministic mock text widget.</p>"),
      };
    case "HTML":
      return {
        content: new HtmlString("<p>A deterministic mock HTML widget.</p>"),
      };
    case "Image":
      return {
        sourceUrl: PREVIEW_IMAGE,
        link: `${PREVIEW_BLOG_URL}p/about.html`,
        width: 320,
        height: 180,
        altText: "Mock image",
        caption: "Mock image caption",
      };
    case "Profile":
      return {
        team: [
          {
            displayname: "Ada Lovelace",
            userProfileUrl: `${PREVIEW_BLOG_URL}p/about.html`,
            aboutMe: "Writes about templates and the web.",
            image: { image: PREVIEW_IMAGE },
          },
        ],
      };
    case "Subscribe":
    case "FollowByEmail":
      return { feedUrl: `${PREVIEW_BLOG_URL}feeds/posts/default` };
    case "BlogSearch":
    case "Search":
      return { searchUrl: `${PREVIEW_BLOG_URL}search` };
    case "Followers":
      return { totalCount: 42, followers: [] };
    case "Stats":
      return { totalCount: 1234 };
    case "ReportAbuse":
      return { reportAbuseUrl: `${PREVIEW_BLOG_URL}report-abuse.html` };
    case "ContactForm":
      return {
        contactFormMessage: "Message",
        contactFormMessageSent: "Your message has been sent.",
        contactFormMessageError: "An error occurred.",
      };
    default:
      return {};
  }
}

export function widgetDataFor(seed: WidgetSeed): ValueMap {
  const items = bylineItemsArray();
  const extras = widgetTypeExtras(seed.type);
  const data: ValueMap = {
    ...extras,
    type: seed.type,
    id: seed.id,
    title: seed.title ?? "",
    instanceId: seed.id,
    allBylineItems: items,
    headerByline: {
      name: "header",
      items: items.filter((item) =>
        ["author", "timestamp", "comments", "share", "location"].includes(
          item["name"] as string
        )
      ),
    },
    footerBylines: [
      {
        name: "footer1",
        items: items.filter((item) => item["name"] === "labels"),
      },
      {
        name: "footer2",
        items: items.filter((item) =>
          ["reactions", "backlinks", "icons"].includes(item["name"] as string)
        ),
      },
    ],
    showFreqNumbers: false,
    style: "FLAT",
    display: "all",
    image: PREVIEW_IMAGE,
    height: 160,
    width: 160,
    imagePlacement: "REPLACE",
    sourceUrl: extras["sourceUrl"] ?? PREVIEW_BLOG_URL,
    description: "A deterministic mock widget.",
    messages: messages(),
    sharing: { platforms: SHARING_PLATFORMS },
    postDisplay: {
      showAuthor: true,
      showDate: true,
      showFeaturedImage: true,
      showSnippet: true,
      showTitle: true,
    },
    links: [
      { name: "Home", target: PREVIEW_BLOG_URL },
      { name: "About", target: `${PREVIEW_BLOG_URL}p/about.html` },
    ],
    data: [],
  };
  return data;
}

/**
 * Expands Blogger LinkList `text-N`/`link-N` settings into an ordered `links`
 * array, skipping missing indices like Blogger does. Text may contain trusted
 * HTML, so it is wrapped in `HtmlString`.
 */
export function expandLinks(settings: ValueMap): ValueMap[] {
  const indices = new Set<number>();
  for (const key of Object.keys(settings)) {
    const match = /^(?:text|link)-(\d+)$/.exec(key);
    if (match) indices.add(Number.parseInt(match[1] as string, 10));
  }
  const links = [...indices]
    .sort((a, b) => a - b)
    .map((index) => {
      const rawText = settings[`text-${index}`];
      const text = typeof rawText === "string" ? rawText : toText(rawText ?? null);
      const rawLink = settings[`link-${index}`];
      return {
        name: new HtmlString(text),
        target: typeof rawLink === "string" ? rawLink : "",
      };
    });
  const sorting = settings[LINKLIST_SETTING.sorting];
  if (sorting === LINKLIST_SORTING.alphabetical || sorting === LINKLIST_SORTING.reverseAlphabetical) {
    const direction = sorting === LINKLIST_SORTING.reverseAlphabetical ? -1 : 1;
    links.sort((left, right) => {
      const a = linkListSortName((left.name as HtmlString).value);
      const b = linkListSortName((right.name as HtmlString).value);
      if (a < b) return -1 * direction;
      if (a > b) return 1 * direction;
      return 0;
    });
  }
  const shownum = Number.parseInt(String(settings[LINKLIST_SETTING.shownum] ?? ""), 10);
  return Number.isFinite(shownum) && shownum > 0 ? links.slice(0, shownum) : links;
}

export function mockWidgets(seeds: WidgetSeed[]): ValueMap[] {  const widgets = seeds.map((seed) => ({
    type: seed.type,
    id: seed.id,
    title: seed.title ?? "",
    instanceId: seed.id,
    sectionId: seed.sectionId ?? "",
    settings: widgetDataFor(seed),
  }));
  return widgets as unknown as ValueMap[];
}

/** Groups widgets by type so `data:widgets.Blog.first` works like Blogger. */
export function attachWidgetTypeKeys(widgets: ValueMap[]): ValueMap[] {
  for (const widget of widgets) {
    const type = widget["type"];
    if (typeof type !== "string") continue;
    const bucket = (widgets as unknown as Record<string, ValueMap[]>)[type] ?? [];
    bucket.push(widget);
    (widgets as unknown as Record<string, ValueMap[]>)[type] = bucket;
  }
  return widgets;
}

export interface BaseDataOptions {
  pageType: string;
  canonicalUrl: string;
  widgets: ValueMap[];
  posts: ValueMap[];
  post?: ValueMap;
  page?: ValueMap;
}

export function buildBaseData(options: BaseDataOptions): ValueMap {
  const labels = mockLabels();
  const bylineMap: ValueMap = {};
  for (const item of allBylineItems()) {
    const name = item["name"] as string;
    bylineMap[name] = { name: item["name"] as Value, label: item["title"] as Value };
  }
  return {
    view: {
      title: "Guchho Blogger Preview",
      description: "A deterministic mock blog.",
      url: options.canonicalUrl,
      canonicalUrl: options.canonicalUrl,
      isHomepage: options.pageType === "index",
      isPost: options.pageType === "item",
      isPage: options.pageType === "static_page",
      isMultipleItems: ["index", "archive", "label", "search"].includes(
        options.pageType
      ),
      isSingleItem: ["item", "static_page"].includes(options.pageType),
      isArchive: options.pageType === "archive",
      isSearch: options.pageType === "search",
      isLabel: options.pageType === "label",
      isError: options.pageType === "error_page",
      isLayoutMode: false,
      isPreview: false,
      postId: options.post?.["id"] ?? "",
      archive: { rangeMessage: "January 2026" },
      search: {
        label: "",
        query: "",
        resultsMessageHtml: new HtmlString("<b>0</b> results"),
      },
    },
    blog: blogMetadata(options.pageType, options.canonicalUrl),
    posts: options.posts,
    post: options.post ?? options.posts[0] ?? null,
    page: options.page ?? null,
    labels,
    comments: mockComments(),
    widgets: options.widgets,
    archive: { rangeMessage: "January 2026" },
    search: {
      label: "",
      query: "",
      resultsMessageHtml: new HtmlString("<b>0</b> results"),
    },
    settings: {
      title: "Guchho Blogger Preview",
      description: "A deterministic mock blog.",
      postsPerPage: 4,
      commentsEnabled: true,
      showCommentLink: true,
    },
    allBylineItems: bylineMap,
    messages: messages(),
    skin: skinData(),
    defaultTitle: "Guchho Blogger Preview",
    newerPageUrl: `${PREVIEW_BLOG_URL}search?updated-max=newer`,
    olderPageUrl: `${PREVIEW_BLOG_URL}search?updated-max=older`,
    cmtIframeInitialHeight: 260,
    showCmtPopup: false,
    navMessage: "",
    sourceUrl: options.canonicalUrl,
    feedPath: "feeds/posts/default",
    adClientId: "",
  };
}

export { IMAGE as mockImage, BloggerDate };
