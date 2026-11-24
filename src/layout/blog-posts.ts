export const BLOG_POSTS_WIDGET_ID = "Blog1";

export const BLOG_POSTS_SETTING = {
  postsPerPage: "postsPerPage",
  jumpLinkText: "jumpLinkText",
  showDateHeader: "showDateHeader",
  showAuthor: "showAuthor",
  authorLabel: "authorLabel",
  showTimestamp: "showTimestamp",
  timestampLabel: "timestampLabel",
  dateFormat: "dateFormat",
  showCommentLink: "showCommentLink",
  commentLabel: "commentLabel",
  showLabels: "showLabels",
  postLabelsLabel: "postLabelsLabel",
  showEmailPostLink: "showEmailPostLink",
  showShareButtons: "showShareButtons",
  showLocation: "showLocation",
  showAuthorProfile: "showAuthorProfile",
  postItemOrder: "postItemOrder",
} as const;

export type BlogPostsSettingName =
  (typeof BLOG_POSTS_SETTING)[keyof typeof BLOG_POSTS_SETTING];

export const BLOG_POSTS_SETTING_NAMES: readonly BlogPostsSettingName[] = Object.values(
  BLOG_POSTS_SETTING
);

export const BLOG_POSTS_ITEMS = [
  { id: "dateHeader", label: "Date Header" },
  { id: "postTitle", label: "Post Title" },
  { id: "postBody", label: "Post Body" },
  { id: "comments", label: "Comments" },
  { id: "emailPostLink", label: "Email Post Link" },
  { id: "labels", label: "Labels" },
  { id: "location", label: "Location" },
  { id: "authorProfile", label: "Author Profile" },
] as const;

export type BlogPostsItemId = (typeof BLOG_POSTS_ITEMS)[number]["id"];

export const BLOG_POSTS_ITEM_IDS: readonly BlogPostsItemId[] = BLOG_POSTS_ITEMS.map(
  (item) => item.id
);

export const BLOG_POSTS_DATE_FORMATS = [
  { value: "default", label: "Default" },
  { value: "monthDayYear", label: "Month day, year" },
  { value: "monthDay", label: "Month day" },
  { value: "numeric", label: "MM/dd/yyyy" },
  { value: "iso", label: "yyyy-MM-dd" },
] as const;

export const BLOG_POSTS_DATE_FORMAT_VALUES: readonly string[] = BLOG_POSTS_DATE_FORMATS.map(
  (format) => format.value
);

export const BLOG_POSTS_DEFAULT_SETTINGS: Record<string, string> = {
  [BLOG_POSTS_SETTING.postsPerPage]: "10",
  [BLOG_POSTS_SETTING.jumpLinkText]: "",
  [BLOG_POSTS_SETTING.showDateHeader]: "false",
  [BLOG_POSTS_SETTING.showAuthor]: "true",
  [BLOG_POSTS_SETTING.authorLabel]: "By",
  [BLOG_POSTS_SETTING.showTimestamp]: "true",
  [BLOG_POSTS_SETTING.timestampLabel]: "at",
  [BLOG_POSTS_SETTING.dateFormat]: "default",
  [BLOG_POSTS_SETTING.showCommentLink]: "true",
  [BLOG_POSTS_SETTING.commentLabel]: "comments",
  [BLOG_POSTS_SETTING.showLabels]: "true",
  [BLOG_POSTS_SETTING.postLabelsLabel]: "Labels:",
  [BLOG_POSTS_SETTING.showEmailPostLink]: "false",
  [BLOG_POSTS_SETTING.showShareButtons]: "false",
  [BLOG_POSTS_SETTING.showLocation]: "true",
  [BLOG_POSTS_SETTING.showAuthorProfile]: "false",
  [BLOG_POSTS_SETTING.postItemOrder]: BLOG_POSTS_ITEM_IDS.join(","),
};

export function blogPostsSettings(
  settings: Readonly<Record<string, string>> = {}
): Record<string, string> {
  return { ...BLOG_POSTS_DEFAULT_SETTINGS, ...settings };
}

export function blogPostsItemOrder(value: string | undefined): string[] {
  const requested = String(value ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter((item): item is BlogPostsItemId =>
      (BLOG_POSTS_ITEM_IDS as readonly string[]).includes(item)
    );
  const order: string[] = [];
  for (const item of requested) {
    if (!order.includes(item)) order.push(item);
  }
  for (const item of BLOG_POSTS_ITEM_IDS) {
    if (!order.includes(item)) order.push(item);
  }
  return order;
}
