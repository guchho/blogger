import {
  BLOG_POSTS_ADS_DEFAULTS,
  BLOG_POSTS_ADS_FORMATS,
  BLOG_POSTS_ADS_SETTING,
  BLOG_POSTS_DATE_FORMAT_VALUES,
  BLOG_POSTS_DATE_FORMATS,
  BLOG_POSTS_DEFAULT_SETTINGS,
  BLOG_POSTS_ITEMS,
  BLOG_POSTS_SETTING,
  BLOG_POSTS_WIDGET_ID,
} from "../../layout/blog-posts.js";
import { escapeHtml } from "../values.js";

export const BLOG_POSTS_DIALOG_ID = "le-blog-posts-dialog";
export const BLOG_POSTS_FORM_ID = "le-blog-posts-form";
export const BLOG_POSTS_DATE_FORMAT_NAME = "le-blog-date-format";

export const BLOG_POSTS_FIELD_IDS = {
  showWidget: "le-blog-show-widget",
  postsPerPage: "le-blog-posts-per-page",
  jumpLinkText: "le-blog-jump-link-text",
  showDateHeader: "le-blog-show-date-header",
  showAuthor: "le-blog-show-author",
  authorPrefixField: "le-blog-author-prefix-field",
  authorPrefix: "le-blog-author-prefix",
  showTimestamp: "le-blog-show-timestamp",
  publishPrefixField: "le-blog-publish-prefix-field",
  publishPrefix: "le-blog-publish-prefix",
  dateFormat: "le-blog-date-format",
  dateFormatField: "le-blog-date-format-field",
  showCommentCount: "le-blog-show-comment-count",
  commentLabelField: "le-blog-comment-label-field",
  commentLabel: "le-blog-comment-label",
  showLabels: "le-blog-show-labels",
  labelsPrefixField: "le-blog-labels-prefix-field",
  labelsPrefix: "le-blog-labels-prefix",
  showEmailPostLink: "le-blog-show-email-post-link",
  showShareButtons: "le-blog-show-share-buttons",
  showLocation: "le-blog-show-location",
  showAuthorProfile: "le-blog-show-author-profile",
  items: "le-blog-items",
  showAds: "le-blog-show-ads",
  adsSettingsField: "le-blog-ads-settings-field",
  postsPerAd: "le-blog-posts-per-ad",
  adFormat: "le-blog-ad-format",
  adFormatField: "le-blog-ad-format-field",
} as const;

export const BLOG_POSTS_CLIENT_CONFIG = {
  widgetId: BLOG_POSTS_WIDGET_ID,
  dialogId: BLOG_POSTS_DIALOG_ID,
  formId: BLOG_POSTS_FORM_ID,
  dateFormatName: BLOG_POSTS_DATE_FORMAT_NAME,
  dateFormatValues: BLOG_POSTS_DATE_FORMAT_VALUES,
  fields: BLOG_POSTS_FIELD_IDS,
  setting: BLOG_POSTS_SETTING,
  defaults: { ...BLOG_POSTS_DEFAULT_SETTINGS, ...BLOG_POSTS_ADS_DEFAULTS },
  adsSetting: BLOG_POSTS_ADS_SETTING,
  adFormats: BLOG_POSTS_ADS_FORMATS,
  items: BLOG_POSTS_ITEMS,
} as const;

function field(label: string, control: string): string {
  return `<label class="layout-editor-field"><span>${escapeHtml(label)}</span>${control}</label>`;
}

function group(title: string, content: string): string {
  return `<section class="le-settings-group"><h3>${escapeHtml(title)}</h3>${content}</section>`;
}

function toggle(id: string, label: string): string {
  return `<label class="layout-editor-check"><input id="${id}" type="checkbox"><span>${escapeHtml(label)}</span></label>`;
}

function hiddenField(id: string, label: string, control: string): string {
  return `<div class="le-settings-dependent" id="${id}" hidden>${field(label, control)}</div>`;
}

export function blogPostsSettingsMarkup(): string {
  const ids = BLOG_POSTS_FIELD_IDS;
  const general =
    toggle(ids.showWidget, "Show this widget") +
    field(
      "Number of posts on the main page",
      `<input class="field" id="${ids.postsPerPage}" type="number" min="1" max="1000" inputmode="numeric">`
    ) +
    field(
      "Post page link text",
      `<input class="field" id="${ids.jumpLinkText}" type="text" maxlength="100">`
    ) +
    toggle(ids.showDateHeader, "Show date header");

  const postInformation =
    toggle(ids.showAuthor, "Show author") +
    hiddenField(
      ids.authorPrefixField,
      "Author prefix",
      `<input class="field" id="${ids.authorPrefix}" type="text" maxlength="50">`
    ) +
    toggle(ids.showTimestamp, "Show publish time") +
    hiddenField(
      ids.publishPrefixField,
      "Publish time prefix",
      `<input class="field" id="${ids.publishPrefix}" type="text" maxlength="50">`
    ) +
    hiddenField(
      ids.dateFormatField,
      "Date format",
      `<div class="le-radio-group">${BLOG_POSTS_DATE_FORMATS.map(
        (format) =>
          `<label class="le-radio"><input id="${ids.dateFormat}-${escapeHtml(
            format.value
          )}" type="radio" name="${BLOG_POSTS_DATE_FORMAT_NAME}" value="${escapeHtml(
            format.value
          )}"><span>${escapeHtml(format.label)}</span></label>`
      ).join("")}</div>`
    );

  const engagement =
    toggle(ids.showCommentCount, "Show comment count") +
    hiddenField(
      ids.commentLabelField,
      "Comment link text",
      `<input class="field" id="${ids.commentLabel}" type="text" maxlength="50">`
    ) +
    toggle(ids.showLabels, "Show labels with prefix") +
    hiddenField(
      ids.labelsPrefixField,
      "Labels prefix",
      `<input class="field" id="${ids.labelsPrefix}" type="text" maxlength="50">`
    ) +
    toggle(ids.showEmailPostLink, "Email post link") +
    toggle(ids.showShareButtons, "Share buttons") +
    toggle(ids.showLocation, "Show location") +
    toggle(ids.showAuthorProfile, "Show author profile");

  const ads =
    toggle(ids.showAds, "Show ads between posts") +
    `<div class="le-settings-dependent" id="${ids.adsSettingsField}" hidden>` +
    `<p class="le-settings-hint">AdSense account settings are configured in Blogger and are not available in this preview.</p>` +
    field(
      "Number of posts between ads",
      `<input class="field" id="${ids.postsPerAd}" type="number" min="1" max="10" step="1">`
    ) +
    field(
      "Ad format",
      `<select class="field" id="${ids.adFormat}">${BLOG_POSTS_ADS_FORMATS.map(
        (format) => `<option value="${escapeHtml(format.value)}">${escapeHtml(format.label)}</option>`
      ).join("")}</select>`
    ) +
    `</div>`;

  const arrange = `<p class="le-settings-hint">Drag the items to arrange how they appear with each post.</p>` +
    `<ul class="le-blog-items" id="${ids.items}">${BLOG_POSTS_ITEMS.map(
      (item) =>
        `<li class="le-blog-item" draggable="true" data-blog-item="${escapeHtml(
          item.id
        )}"><span class="le-blog-grip" aria-hidden="true"><svg viewBox="0 0 24 24" focusable="false"><circle cx="9" cy="6" r="1"/><circle cx="15" cy="6" r="1"/><circle cx="9" cy="12" r="1"/><circle cx="15" cy="12" r="1"/><circle cx="9" cy="18" r="1"/><circle cx="15" cy="18" r="1"/></svg></span><span>${escapeHtml(
          item.label
        )}</span></li>`
    ).join("")}</ul>`;

  return (
    group("General", general) +
    group("Post Information", postInformation) +
    group("Engagement", engagement) +
    group("Ads", ads) +
    group("Arrange Items", arrange)
  );
}
