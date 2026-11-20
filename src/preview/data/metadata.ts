// Static blog and locale metadata for the mock pages, plus the message catalog
// Blogger exposes as `data:messages`.

import { BloggerDate, HtmlString, type ValueMap } from "../values.js";

export const PREVIEW_BLOG_URL = "https://preview.example.com/";
export const PREVIEW_FAVICON = "favicon.ico";
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

export function blogMetadata(
  pageType: string,
  canonicalUrl: string,
  favicon = PREVIEW_FAVICON
): ValueMap {
  return {
    title: "Guchho Blogger Preview",
    homepageUrl: PREVIEW_BLOG_URL,
    canonicalUrl,
    blogspotFaviconUrl: favicon,
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
    pageName:
      pageType === "item"
        ? "Post"
        : pageType === "static_page"
          ? "Page"
          : pageType === "error_page"
            ? "Not Found"
            : "Home",
    isMobileRequest: false,
    jumpLinkMessage: "Read more",
    postImageUrl: PREVIEW_IMAGE,
    pageImageUrl: PREVIEW_IMAGE,
    enabledCommentProfileImages: true,
    sharing: {
      platforms: SHARING_PLATFORMS,
    },
    analytics4: "",
    analyticsAccountNumber: "",
    adsenseClientId: "",
    adsenseHostId: "",
    adsenseMessage: "",
    navMessage: "",
    searchUrl: `${PREVIEW_BLOG_URL}search`,
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
    sharePost: "Share this post",
    postAComment: "Post a comment",
    comments: "Comments",
    commentsCount: "{numComments} comments",
    numberOfComments: "{numComments} comments",
    blogComment: "Comment",
    noComments: "No comments",
    oneComment: "1 comment",
    authorSaid: "{authorName} said…",
    authorSaidWithLink: new HtmlString(
      '<a href="{authorUrl}" rel="nofollow">{authorName}</a> said…'
    ),
    deleteComment: "Delete",
    emailPost: "Email this post",
    emailAddress: "Email address",
    readMore: "Read more",
    home: "Home",
    newest: "Newest",
    oldest: "Oldest",
    recentPosts: "Recent Posts",
    newer: "Newer",
    older: "Older",
    newerPosts: "Newer Posts",
    olderPosts: "Older Posts",
    loadMorePosts: "Load more posts",
    noResultsFound: "No results found",
    showAll: "Show all",
    theresNothingHere: "There's nothing here.",
    youMayLikeThesePosts: "You may like these posts",
    postedBy: "Posted by",
    subscribe: "Subscribe",
    search: "Search",
    searchThisBlog: "Search this blog",
    labels: "Labels",
    archive: "Archive",
    by: "by",
    loading: "Loading…",
    poweredBy: "Powered by Blogger",
    reportAbuse: "Report Abuse",
    contact: "Contact",
    blogThis: "BlogThis!",
    facebook: "Facebook",
    twitter: "Twitter",
    email: "Email",
    pinterest: "Pinterest",
    print: "Print",
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
    { name: "reactions", title: "Reactions", isCustom: false },
    { name: "backlinks", title: "Backlinks", isCustom: false },
    { name: "icons", title: "Icons", isCustom: false },
  ];
}

export function previewTimestamp(daysAgo: number): BloggerDate {
  const base = Date.UTC(2026, 0, 1, 12, 0, 0);
  return new BloggerDate(new Date(base - daysAgo * 24 * 60 * 60 * 1000));
}
