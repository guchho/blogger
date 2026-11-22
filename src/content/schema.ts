import type { ContentStatus, Page, Post } from "./model.js";
import {
  ContentError,
  isRecord,
  optionalBoolean,
  optionalImage,
  optionalString,
  optionalStringArray,
  optionalTimestamp,
  rejectUnknownFields,
  requireString,
  requireTimestamp,
} from "./schema-helpers.js";
import { assertSlug } from "./slug.js";

const COMMON_FIELDS = [
  "id",
  "type",
  "title",
  "slug",
  "content",
  "status",
  "featuredImage",
  "createdAt",
  "updatedAt",
  "publishedAt",
  "publishAt",
  "trashedAt",
] as const;

const POST_FIELDS = [...COMMON_FIELDS, "excerpt", "labels", "author", "allowComments"] as const;
const PAGE_FIELDS = [...COMMON_FIELDS] as const;

const ID_PATTERN = /^[A-Za-z0-9_-]+$/;

function validateCommon(value: unknown, label: string) {
  if (!isRecord(value)) {
    throw new ContentError("BLOGGER_CONTENT_INVALID", `${label} must be a JSON object`);
  }
  const id = requireString(value, "id", label);
  if (!ID_PATTERN.test(id)) {
    throw new ContentError("BLOGGER_CONTENT_INVALID_ID", `${label}.id contains unsupported characters`);
  }
  const type = requireString(value, "type", label);
  const title = requireString(value, "title", label, true);
  const slug = assertSlug(value["slug"], `${label}.slug`);
  const content = optionalString(value, "content", label, "");
  const status = requireString(value, "status", label);
  if (status !== "draft" && status !== "published" && status !== "scheduled") {
    throw new ContentError(
      "BLOGGER_CONTENT_INVALID_STATUS",
      `${label}.status must be draft, published or scheduled`
    );
  }
  const createdAt = requireTimestamp(value, "createdAt", label);
  const updatedAt = requireTimestamp(value, "updatedAt", label);
  const publishedAt = optionalTimestamp(value, "publishedAt", label, null);
  const publishAt = optionalTimestamp(value, "publishAt", label, null);
  const trashedAt = optionalTimestamp(value, "trashedAt", label, null);
  const featuredImage = optionalImage(value, "featuredImage", label);
  if (status === "scheduled" && publishAt === null) {
    throw new ContentError(
      "BLOGGER_CONTENT_MISSING_PUBLISH_DATE",
      `${label}.publishAt is required for scheduled content`
    );
  }
  return {
    id,
    type,
    title,
    slug,
    content,
    status: status as ContentStatus,
    createdAt,
    updatedAt,
    publishedAt,
    publishAt,
    trashedAt,
    featuredImage,
  };
}

export function validatePost(value: unknown): Post {
  const label = "post";
  const common = validateCommon(value, label);
  if (!isRecord(value)) throw new ContentError("BLOGGER_CONTENT_INVALID", `${label} must be an object`);
  rejectUnknownFields(value, POST_FIELDS, label);
  if (common.type !== "post") {
    throw new ContentError("BLOGGER_CONTENT_WRONG_TYPE", `${label}.type must be "post"`);
  }
  return {
    ...common,
    type: "post",
    excerpt: optionalString(value, "excerpt", label, ""),
    labels: optionalStringArray(value, "labels", label, []),
    author: optionalString(value, "author", label, "admin"),
    allowComments: optionalBoolean(value, "allowComments", label, true),
  };
}

export function validatePage(value: unknown): Page {
  const label = "page";
  const common = validateCommon(value, label);
  if (!isRecord(value)) throw new ContentError("BLOGGER_CONTENT_INVALID", `${label} must be an object`);
  rejectUnknownFields(value, PAGE_FIELDS, label);
  if (common.type !== "page") {
    throw new ContentError("BLOGGER_CONTENT_WRONG_TYPE", `${label}.type must be "page"`);
  }
  return { ...common, type: "page" };
}
