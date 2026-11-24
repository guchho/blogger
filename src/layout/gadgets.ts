import { builtinWidgetTypes } from "../preview/render/widgets.js";
import {
  BLOG_POSTS_ADS_DEFAULTS,
  BLOG_POSTS_ADS_FORMATS,
  BLOG_POSTS_ADS_SETTING,
  BLOG_POSTS_DEFAULT_SETTINGS,
  BLOG_POSTS_ITEM_IDS,
  BLOG_POSTS_SETTING,
} from "./blog-posts.js";
import { LINKLIST_DEFINITION } from "./linklist/schema.js";
import { normalizeLinkListSettings } from "./linklist/serialization.js";
import { validateLinkListSettings } from "./linklist/validation.js";
import { LINKLIST_WIDGET_TYPE } from "./linklist/types.js";

export type GadgetFieldKind = "text" | "number" | "textarea" | "checkbox" | "toggle" | "radio" | "select" | "url" | "color" | "image" | "multi" | "custom";

export interface GadgetFieldOption { value: string; label: string; }
export interface GadgetFieldShowIf { key: string; equals?: string | boolean; notEquals?: string | boolean; truthy?: boolean; falsy?: boolean; }
export interface GadgetFieldSchema {
  kind: GadgetFieldKind;
  key: string;
  label: string;
  description?: string;
  placeholder?: string;
  required?: boolean;
  defaultValue?: string;
  options?: GadgetFieldOption[];
  min?: number;
  max?: number;
  step?: number;
  rows?: number;
  maxLength?: number;
  showIf?: GadgetFieldShowIf;
  advanced?: boolean;
  itemOrder?: readonly string[];
}
export interface GadgetSectionSchema { id: string; label: string; description?: string; fields: GadgetFieldSchema[]; }
export interface GadgetCapabilities { configurable: boolean; duplicable: boolean; removable: boolean; movable: boolean; canHide: boolean; maxInstances?: number; allowedSectionIds?: string[]; }
export interface GadgetDefinition {
  type: string;
  label: string;
  category: string;
  description: string;
  icon: string;
  implemented: "full" | "partial" | "unsupported";
  capabilities: GadgetCapabilities;
  sections: GadgetSectionSchema[];
  defaults: Record<string, string>;
  settingKeys: readonly string[];
}
export interface GadgetCatalogItem {
  type: string; label: string; category: string; description: string; icon: string;
  implemented: "full" | "partial" | "unsupported"; capabilities: GadgetCapabilities; configurable: boolean;
}
export interface GadgetValidationIssue { key: string; message: string; }

const DEFAULT_CAPABILITIES: GadgetCapabilities = { configurable: true, duplicable: true, removable: true, movable: true, canHide: true };

function def(
  type: string, label: string, category: string, description: string, icon: string,
  implemented: GadgetDefinition["implemented"], sections: GadgetSectionSchema[],
  capabilities: Partial<GadgetCapabilities> = {}, defaults: Record<string, string> = {}
): GadgetDefinition {
  const settingKeys = sections.flatMap((s) => s.fields.map((f) => f.key));
  const fullDefaults: Record<string, string> = { ...defaults };
  for (const section of sections) for (const field of section.fields)
    if (fullDefaults[field.key] === undefined && field.defaultValue !== undefined) fullDefaults[field.key] = field.defaultValue;
  return { type, label, category, description, icon, implemented, capabilities: { ...DEFAULT_CAPABILITIES, ...capabilities }, sections, defaults: fullDefaults, settingKeys };
}
function toggle(key: string, label: string, description?: string, defaultValue = "false", showIf?: GadgetFieldShowIf): GadgetFieldSchema { return { kind: "toggle", key, label, description, defaultValue, showIf }; }
function text(key: string, label: string, opts: Partial<GadgetFieldSchema> = {}): GadgetFieldSchema { return { kind: "text", key, label, defaultValue: "", ...opts }; }
function number(key: string, label: string, opts: Partial<GadgetFieldSchema> = {}): GadgetFieldSchema { return { kind: "number", key, label, defaultValue: "0", ...opts }; }
function textarea(key: string, label: string, opts: Partial<GadgetFieldSchema> = {}): GadgetFieldSchema { return { kind: "textarea", key, label, defaultValue: "", rows: 4, ...opts }; }
function select(key: string, label: string, options: GadgetFieldOption[], opts: Partial<GadgetFieldSchema> = {}): GadgetFieldSchema { return { kind: "select", key, label, options, defaultValue: options[0]?.value ?? "", ...opts }; }
function radio(key: string, label: string, options: GadgetFieldOption[], opts: Partial<GadgetFieldSchema> = {}): GadgetFieldSchema { return { kind: "radio", key, label, options, defaultValue: options[0]?.value ?? "", ...opts }; }
function url(key: string, label: string, opts: Partial<GadgetFieldSchema> = {}): GadgetFieldSchema { return { kind: "url", key, label, defaultValue: "", ...opts }; }

const BLOG_POSTS_DEFINITION = def("Blog", "Blog Posts", "Content", "Displays blog posts with configurable metadata, engagement, ads, and item order.", "post", "full", [
  { id: "general", label: "General", fields: [
    toggle("showWidget", "Show this widget", "Display this gadget on the blog.", "true"),
    number(BLOG_POSTS_SETTING.postsPerPage, "Number of posts on the main page", { min: 1, max: 1000, step: 1, defaultValue: BLOG_POSTS_DEFAULT_SETTINGS[BLOG_POSTS_SETTING.postsPerPage] }),
    text(BLOG_POSTS_SETTING.jumpLinkText, "Post page link text", { maxLength: 100, placeholder: "Read more", defaultValue: BLOG_POSTS_DEFAULT_SETTINGS[BLOG_POSTS_SETTING.jumpLinkText] }),
    toggle(BLOG_POSTS_SETTING.showDateHeader, "Show date header", undefined, BLOG_POSTS_DEFAULT_SETTINGS[BLOG_POSTS_SETTING.showDateHeader]),
  ]},
  { id: "post-info", label: "Post Information", fields: [
    toggle(BLOG_POSTS_SETTING.showAuthor, "Show author", undefined, BLOG_POSTS_DEFAULT_SETTINGS[BLOG_POSTS_SETTING.showAuthor]),
    text(BLOG_POSTS_SETTING.authorLabel, "Author prefix", { maxLength: 50, showIf: { key: BLOG_POSTS_SETTING.showAuthor, equals: "true" }, defaultValue: BLOG_POSTS_DEFAULT_SETTINGS[BLOG_POSTS_SETTING.authorLabel] }),
    toggle(BLOG_POSTS_SETTING.showTimestamp, "Show publish time", undefined, BLOG_POSTS_DEFAULT_SETTINGS[BLOG_POSTS_SETTING.showTimestamp]),
    text(BLOG_POSTS_SETTING.timestampLabel, "Publish time prefix", { maxLength: 50, showIf: { key: BLOG_POSTS_SETTING.showTimestamp, equals: "true" }, defaultValue: BLOG_POSTS_DEFAULT_SETTINGS[BLOG_POSTS_SETTING.timestampLabel] }),
    radio(BLOG_POSTS_SETTING.dateFormat, "Date format", [
      { value: "default", label: "Default" }, { value: "monthDayYear", label: "Month day, year" }, { value: "monthDay", label: "Month day" }, { value: "numeric", label: "MM/dd/yyyy" }, { value: "iso", label: "yyyy-MM-dd" },
    ], { showIf: { key: BLOG_POSTS_SETTING.showTimestamp, equals: "true" }, defaultValue: BLOG_POSTS_DEFAULT_SETTINGS[BLOG_POSTS_SETTING.dateFormat] }),
  ]},
  { id: "engagement", label: "Engagement", fields: [
    toggle(BLOG_POSTS_SETTING.showCommentLink, "Show comment count", undefined, BLOG_POSTS_DEFAULT_SETTINGS[BLOG_POSTS_SETTING.showCommentLink]),
    text(BLOG_POSTS_SETTING.commentLabel, "Comment link text", { maxLength: 50, showIf: { key: BLOG_POSTS_SETTING.showCommentLink, equals: "true" }, defaultValue: BLOG_POSTS_DEFAULT_SETTINGS[BLOG_POSTS_SETTING.commentLabel] }),
    toggle(BLOG_POSTS_SETTING.showLabels, "Show labels with prefix", undefined, BLOG_POSTS_DEFAULT_SETTINGS[BLOG_POSTS_SETTING.showLabels]),
    text(BLOG_POSTS_SETTING.postLabelsLabel, "Labels prefix", { maxLength: 50, showIf: { key: BLOG_POSTS_SETTING.showLabels, equals: "true" }, defaultValue: BLOG_POSTS_DEFAULT_SETTINGS[BLOG_POSTS_SETTING.postLabelsLabel] }),
    toggle(BLOG_POSTS_SETTING.showEmailPostLink, "Email post link", undefined, BLOG_POSTS_DEFAULT_SETTINGS[BLOG_POSTS_SETTING.showEmailPostLink]),
    toggle(BLOG_POSTS_SETTING.showShareButtons, "Share buttons", undefined, BLOG_POSTS_DEFAULT_SETTINGS[BLOG_POSTS_SETTING.showShareButtons]),
    toggle(BLOG_POSTS_SETTING.showLocation, "Show location", undefined, BLOG_POSTS_DEFAULT_SETTINGS[BLOG_POSTS_SETTING.showLocation]),
    toggle(BLOG_POSTS_SETTING.showAuthorProfile, "Show author profile", undefined, BLOG_POSTS_DEFAULT_SETTINGS[BLOG_POSTS_SETTING.showAuthorProfile]),
  ]},
  { id: "ads", label: "Ads", description: "AdSense configuration is not available in local preview; settings are preserved for Blogger.", fields: [
    toggle(BLOG_POSTS_ADS_SETTING.showAdsBetweenPosts, "Show ads between posts", "Requires AdSense configuration in Blogger.", BLOG_POSTS_ADS_DEFAULTS[BLOG_POSTS_ADS_SETTING.showAdsBetweenPosts]),
    number(BLOG_POSTS_ADS_SETTING.postsPerAd, "Number of posts between ads", { min: 1, max: 10, step: 1, defaultValue: BLOG_POSTS_ADS_DEFAULTS[BLOG_POSTS_ADS_SETTING.postsPerAd], showIf: { key: BLOG_POSTS_ADS_SETTING.showAdsBetweenPosts, equals: "true" } }),
    select(BLOG_POSTS_ADS_SETTING.adFormat, "Ad format", BLOG_POSTS_ADS_FORMATS.map((format) => ({ value: format.value, label: format.label })), { defaultValue: BLOG_POSTS_ADS_DEFAULTS[BLOG_POSTS_ADS_SETTING.adFormat], showIf: { key: BLOG_POSTS_ADS_SETTING.showAdsBetweenPosts, equals: "true" } }),
  ]},
  { id: "arrange", label: "Arrange Items", fields: [
    { kind: "multi", key: BLOG_POSTS_SETTING.postItemOrder, label: "Post item order", description: "Drag to reorder supported post elements.", defaultValue: BLOG_POSTS_DEFAULT_SETTINGS[BLOG_POSTS_SETTING.postItemOrder], itemOrder: BLOG_POSTS_ITEM_IDS },
  ]},
], { maxInstances: 1, duplicable: false }, { ...BLOG_POSTS_DEFAULT_SETTINGS, ...BLOG_POSTS_ADS_DEFAULTS, showWidget: "true" });

const DEFINITIONS: GadgetDefinition[] = [
  BLOG_POSTS_DEFINITION,
  LINKLIST_DEFINITION,
  def("Header", "Header", "Branding", "Shows your blog title, description, and optional logo.", "header", "full", [
    { id: "general", label: "General", fields: [text("title", "Title", { defaultValue: "" }), textarea("description", "Description", { rows: 3, defaultValue: "" }), url("displayUrl", "Image URL", { placeholder: "https://example.com/logo.png", description: "Logo image shown in preview when available." })] },
  ], { maxInstances: 1, duplicable: false }),
  def("PageList", "Page List", "Navigation", "Displays a list of pages as navigation links.", "pages", "partial", [{ id: "general", label: "General", fields: [text("title", "Title", { defaultValue: "Pages" })] }]),
  def("Label", "Labels", "Navigation", "Shows post labels for filtering content.", "label", "partial", [{ id: "general", label: "General", fields: [text("title", "Title", { defaultValue: "Labels" }), select("display", "Display", [{ value: "list", label: "List" }, { value: "cloud", label: "Cloud" }], { defaultValue: "list" }), toggle("showFreqNumbers", "Show post counts", undefined, "true")] }]),
  def("BlogArchive", "Blog Archive", "Content", "Displays an archive of posts by date.", "archive", "partial", [{ id: "general", label: "General", fields: [text("title", "Title", { defaultValue: "Archive" }), select("style", "Style", [{ value: "HIERARCHY", label: "Hierarchy" }, { value: "FLAT", label: "Flat" }, { value: "MENU", label: "Dropdown menu" }], { defaultValue: "HIERARCHY" })] }]),
  def("PopularPosts", "Popular Posts", "Discovery", "Shows popular posts from your blog.", "popular", "partial", [{ id: "general", label: "General", fields: [text("title", "Title", { defaultValue: "Popular Posts" }), number("numItemsToShow", "Posts to show", { min: 1, max: 10, step: 1, defaultValue: "5" }), toggle("showThumbnails", "Show thumbnails", undefined, "true"), toggle("showSnippets", "Show snippets", undefined, "false")] }]),
  def("FeaturedPost", "Featured Post", "Content", "Highlights a featured post.", "featured", "partial", [{ id: "general", label: "General", fields: [text("title", "Title", { defaultValue: "Featured Post" }), toggle("showPostTitle", "Show post title", undefined, "true"), toggle("showFirstImage", "Show image", undefined, "true")] }]),
  def("BlogSearch", "Blog Search", "Discovery", "Lets readers search your blog.", "search", "partial", [{ id: "general", label: "General", fields: [text("title", "Title", { defaultValue: "Search This Blog" })] }]),
  def("Search", "Search Box", "Discovery", "Adds a search box to your blog.", "search", "partial", [{ id: "general", label: "General", fields: [text("title", "Title", { defaultValue: "Search" })] }]),
  def("FollowByEmail", "Follow by Email", "Community", "Allows readers to subscribe by email.", "email", "partial", [{ id: "general", label: "General", fields: [text("title", "Title", { defaultValue: "Follow by Email" })] }]),
  def("HTML", "HTML/JavaScript", "Utilities", "Add custom HTML or JavaScript content.", "code", "full", [{ id: "general", label: "General", fields: [text("title", "Title", { defaultValue: "" }), textarea("content", "Content", { rows: 10, description: "HTML or JavaScript content. Scripts may be restricted in preview.", defaultValue: "" })] }]),
  def("Text", "Text", "Utilities", "Add plain or formatted text content.", "text", "full", [{ id: "general", label: "General", fields: [text("title", "Title", { defaultValue: "" }), textarea("content", "Content", { rows: 8, defaultValue: "" })] }]),
  def("Image", "Image", "Branding", "Displays an image with optional caption and link.", "image", "full", [{ id: "general", label: "General", fields: [text("title", "Title", { defaultValue: "" }), url("sourceUrl", "Image URL", { placeholder: "https://example.com/image.jpg" }), text("altText", "Alt text", { defaultValue: "" }), text("caption", "Caption", { defaultValue: "" }), url("link", "Link URL", { defaultValue: "" })] }]),
  def("Profile", "Profile", "Branding", "Shows author/profile information.", "profile", "partial", [{ id: "general", label: "General", fields: [text("title", "Title", { defaultValue: "About Me" })] }]),
  def("Subscribe", "Subscribe", "Community", "Provides subscription options.", "subscribe", "partial", [{ id: "general", label: "General", fields: [text("title", "Title", { defaultValue: "Subscribe" })] }]),
  def("Followers", "Followers", "Community", "Shows followers information.", "followers", "partial", [{ id: "general", label: "General", fields: [text("title", "Title", { defaultValue: "Followers" })] }], { maxInstances: 1 }),
  def("Stats", "Stats", "Utilities", "Shows blog statistics.", "stats", "partial", [{ id: "general", label: "General", fields: [text("title", "Title", { defaultValue: "Stats" })] }]),
  def("Translate", "Translate", "Utilities", "Lets visitors translate your blog.", "translate", "partial", [{ id: "general", label: "General", fields: [text("title", "Title", { defaultValue: "Translate" })] }], { maxInstances: 1 }),
  def("ReportAbuse", "Report Abuse", "Community", "Shows a report abuse link.", "report", "partial", [{ id: "general", label: "General", fields: [text("title", "Title", { defaultValue: "Report Abuse" })] }], { maxInstances: 1 }),
  def("ContactForm", "Contact Form", "Community", "Adds a contact form for readers.", "contact", "partial", [{ id: "general", label: "General", fields: [text("title", "Title", { defaultValue: "Contact Form" })] }], { maxInstances: 1 }),
  def("Attribution", "Attribution", "Branding", "Shows attribution/powered-by information.", "attribution", "partial", [{ id: "general", label: "General", fields: [text("title", "Title", { defaultValue: "" })] }], { maxInstances: 1, removable: false, duplicable: false, movable: false, canHide: false }),
];

const DEFS_BY_TYPE = new Map(DEFINITIONS.map((d) => [d.type, d]));

export function gadgetDefinitions(): GadgetDefinition[] { return DEFINITIONS.slice(); }
export function getGadgetDefinition(type: string): GadgetDefinition | undefined { return DEFS_BY_TYPE.get(type); }
export function gadgetCatalog(): GadgetCatalogItem[] {
  return DEFINITIONS.map((d) => ({ type: d.type, label: d.label, category: d.category, description: d.description, icon: d.icon, implemented: d.implemented, capabilities: d.capabilities, configurable: d.sections.some((s) => s.fields.length > 0) }));
}
export function availableGadgetTypes(): string[] {
  const builtins = new Set(builtinWidgetTypes());
  return DEFINITIONS.filter((d) => builtins.has(d.type) || d.type === "Blog").map((d) => d.type).sort();
}

function isFieldVisible(field: GadgetFieldSchema, values: Record<string, string>): boolean {
  const cond = field.showIf;
  if (!cond) return true;
  const actual = values[cond.key];
  if (cond.equals !== undefined) return String(actual) === String(cond.equals);
  if (cond.notEquals !== undefined) return String(actual) !== String(cond.notEquals);
  if (cond.truthy) return actual === "true" || (!!actual && actual !== "false" && actual !== "0");
  if (cond.falsy) return !actual || actual === "false" || actual === "0" || actual === "";
  return true;
}

export function normalizeGadgetSettings(type: string, settings: Readonly<Record<string, string>> = {}): Record<string, string> {
  if (type === LINKLIST_WIDGET_TYPE) return normalizeLinkListSettings(settings);
  const defn = getGadgetDefinition(type);
  if (!defn) return { ...settings };
  const out: Record<string, string> = { ...settings };
  for (const section of defn.sections) for (const field of section.fields) {
    const raw = out[field.key];
    if (raw === undefined) { const dv = defn.defaults[field.key]; if (dv !== undefined) out[field.key] = dv; continue; }
    if (field.kind === "toggle" || field.kind === "checkbox") out[field.key] = raw === "true" ? "true" : "false";
    else if (field.kind === "number") {
      const n = Number(raw);
      if (!Number.isFinite(n)) { out[field.key] = defn.defaults[field.key] ?? "0"; continue; }
      let v = field.step && field.step >= 1 ? Math.trunc(n) : n;
      if (field.min !== undefined && v < field.min) v = field.min;
      if (field.max !== undefined && v > field.max) v = field.max;
      out[field.key] = String(v);
    } else if ((field.kind === "select" || field.kind === "radio") && field.options) {
      if (!field.options.some((o) => o.value === raw)) out[field.key] = defn.defaults[field.key] ?? field.options[0]?.value ?? "";
    } else if (field.kind === "multi" && field.itemOrder) {
      const allowed = field.itemOrder as readonly string[];
      const requested = String(raw).split(",").map((s) => s.trim());
      const order: string[] = [];
      for (const item of requested) {
        if (item && allowed.includes(item) && !order.includes(item)) order.push(item);
      }
      for (const item of allowed) if (!order.includes(item)) order.push(item);
      out[field.key] = order.join(",");
    } else if (field.maxLength !== undefined && raw.length > field.maxLength) out[field.key] = raw.slice(0, field.maxLength);
  }
  return out;
}

export function validateGadgetSettings(type: string, settings: Readonly<Record<string, string>> = {}): GadgetValidationIssue[] {
  if (type === LINKLIST_WIDGET_TYPE) return validateLinkListSettings(settings);
  const defn = getGadgetDefinition(type);
  if (!defn) return [];
  const normalized = normalizeGadgetSettings(type, settings);
  const issues: GadgetValidationIssue[] = [];
  for (const section of defn.sections) for (const field of section.fields) {
    if (!isFieldVisible(field, normalized)) continue;
    const value = normalized[field.key] ?? "";
    if (field.required && !value.trim()) { issues.push({ key: field.key, message: `${field.label} is required.` }); continue; }
    if (field.kind === "number" && value !== "") {
      const n = Number(value);
      if (!Number.isFinite(n)) issues.push({ key: field.key, message: `${field.label} must be a number.` });
      else {
        if (field.min !== undefined && n < field.min) issues.push({ key: field.key, message: `${field.label} must be at least ${field.min}.` });
        if (field.max !== undefined && n > field.max) issues.push({ key: field.key, message: `${field.label} must be at most ${field.max}.` });
      }
    }
    if ((field.kind === "url" || field.kind === "image") && value) {
      try { new URL(value); } catch { if (!value.startsWith("/") && !value.startsWith("#")) issues.push({ key: field.key, message: `${field.label} must be a valid URL.` }); }
    }
    if ((field.kind === "select" || field.kind === "radio") && field.options && value && !field.options.some((o) => o.value === value))
      issues.push({ key: field.key, message: `${field.label} has an invalid value.` });
  }
  return issues;
}

export function gadgetDefaultSettings(type: string): Record<string, string> {
  const defn = getGadgetDefinition(type);
  return defn ? normalizeGadgetSettings(type, defn.defaults) : {};
}

export function gadgetSettingKeys(type: string): readonly string[] { return getGadgetDefinition(type)?.settingKeys ?? []; }

export function isFieldVisibleForValues(field: GadgetFieldSchema, values: Record<string, string>): boolean { return isFieldVisible(field, values); }
