// Static blog and locale metadata for the mock pages, plus the message catalog
// Blogger exposes as `data:messages`.

import { BloggerDate, type ValueMap } from "../values.js";

export const PREVIEW_BLOG_URL = "https://preview.example.com/";
export const PREVIEW_FAVICON =
  "https://preview.example.com/favicon.ico";
export const PREVIEW_IMAGE =
  "https://blogger.googleusercontent.com/img/preview/s1600/preview.png";

export const SHARING_PLATFORMS: ValueMap[] = [
  { key: "blogThis", name: "BlogThis!" },
  { key: "facebook", name: "Facebook" },
  { key: "twitter", name: "Twitter" },
  { key: "email", name: "Email" },
  { key: "pinterest", name: "Pinterest" },
  { key: "print", name: "Print" },
];

export function blogMetadata(pageType: string, canonicalUrl: string): ValueMap {
  return {
    title: "Guchho Blogger Preview",
    homepageUrl: PREVIEW_BLOG_URL,
    canonicalUrl,
    blogspotFaviconUrl: PREVIEW_FAVICON,
    metaDescription:
      "A deterministic mock blog used to render this Blogger template outside Blogger.",
    languageDirection: "ltr",
    languageAlignment: "left",
    language: "en",
    locale: {
      language: "en",
      languageAlignment: "left",
      country: "US",
      name: "English",
    },
    pageType,
    isMobileRequest: false,
    jumpLinkMessage: "Read more",
    postImageUrl: PREVIEW_IMAGE,
    pageImageUrl: PREVIEW_IMAGE,
    enabledCommentProfileImages: true,
    sharing: {
      platforms: SHARING_PLATFORMS,
    },
    adsenseClientId: "",
    adsenseHostId: "",
    adsenseMessage: "",
    navMessage: "",
    searchLabel: "",
    searchQuery: "",
    sourceUrl: canonicalUrl,
    newerPageUrl: `${PREVIEW_BLOG_URL}search?updated-max=2026`,
    olderPageUrl: `${PREVIEW_BLOG_URL}search?updated-max=2024`,
  };
}

export function messages(): ValueMap {
  return {
    share: "Share",
    postAComment: "Post a comment",
    comments: "Comments",
    readMore: "Read more",
    home: "Home",
    newerPosts: "Newer Posts",
    olderPosts: "Older Posts",
    subscribe: "Subscribe",
    search: "Search",
    labels: "Labels",
    archive: "Archive",
    by: "by",
    noComments: "No comments",
    oneComment: "1 comment",
    commentsCount: "Comments",
    loading: "Loading…",
    poweredBy: "Powered by Blogger",
    reportAbuse: "Report Abuse",
    contact: "Contact",
  };
}

export function skinData(): ValueMap {
  return {
    vars: {
      keycolor: "#00c2ff",
      bodyBackground: "#ffffff",
      bodyTextColor: "#1c1c1c",
      linkColor: "#08475b",
    },
  };
}

export function allBylineItems(): ValueMap[] {
  return [
    { name: "author", title: "Author", isCustom: false },
    { name: "timestamp", title: "Timestamp", isCustom: false },
    { name: "comments", title: "Comments", isCustom: false },
    { name: "share", title: "Share", isCustom: false },
    { name: "location", title: "Location", isCustom: false },
    { name: "labels", title: "Labels", isCustom: false },
    { name: "icons", title: "Icons", isCustom: false },
  ];
}

export function previewTimestamp(daysAgo: number): BloggerDate {
  const base = Date.UTC(2026, 0, 1, 12, 0, 0);
  return new BloggerDate(new Date(base - daysAgo * 24 * 60 * 60 * 1000));
}
