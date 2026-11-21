export class ContentError extends Error {
  readonly code: string;
  readonly status: number;
  readonly details: Record<string, unknown>;

  constructor(
    code: string,
    message: string,
    status = 400,
    details: Record<string, unknown> = {}
  ) {
    super(message);
    this.name = "ContentError";
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

const ISO_8601 = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$/;

export function isIsoTimestamp(value: unknown): value is string {
  return typeof value === "string" && ISO_8601.test(value) && !Number.isNaN(Date.parse(value));
}

export function requireString(
  record: Record<string, unknown>,
  key: string,
  label: string,
  allowEmpty = false
): string {
  const value = record[key];
  if (typeof value !== "string" || (!allowEmpty && value.trim() === "")) {
    throw new ContentError(
      "BLOGGER_CONTENT_INVALID_FIELD",
      `${label}.${key} must be a non-empty string`
    );
  }
  return value;
}

export function optionalString(
  record: Record<string, unknown>,
  key: string,
  label: string,
  fallback: string
): string {
  const value = record[key];
  if (value === undefined) return fallback;
  if (typeof value !== "string") {
    throw new ContentError(
      "BLOGGER_CONTENT_INVALID_FIELD",
      `${label}.${key} must be a string`
    );
  }
  return value;
}

export function optionalTimestamp(
  record: Record<string, unknown>,
  key: string,
  label: string,
  fallback: string | null
): string | null {
  const value = record[key];
  if (value === undefined) return fallback;
  if (value === null) return null;
  if (!isIsoTimestamp(value)) {
    throw new ContentError(
      "BLOGGER_CONTENT_INVALID_DATE",
      `${label}.${key} must be an ISO 8601 UTC timestamp`
    );
  }
  return value;
}

export function requireTimestamp(
  record: Record<string, unknown>,
  key: string,
  label: string
): string {
  const value = optionalTimestamp(record, key, label, null);
  if (value === null) {
    throw new ContentError(
      "BLOGGER_CONTENT_INVALID_DATE",
      `${label}.${key} must be an ISO 8601 UTC timestamp`
    );
  }
  return value;
}

export function optionalBoolean(
  record: Record<string, unknown>,
  key: string,
  label: string,
  fallback: boolean
): boolean {
  const value = record[key];
  if (value === undefined) return fallback;
  if (typeof value !== "boolean") {
    throw new ContentError(
      "BLOGGER_CONTENT_INVALID_FIELD",
      `${label}.${key} must be a boolean`
    );
  }
  return value;
}

export function optionalStringArray(
  record: Record<string, unknown>,
  key: string,
  label: string,
  fallback: string[]
): string[] {
  const value = record[key];
  if (value === undefined) return [...fallback];
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string")) {
    throw new ContentError(
      "BLOGGER_CONTENT_INVALID_FIELD",
      `${label}.${key} must be an array of strings`
    );
  }
  return [...(value as string[])];
}

export function optionalImage(
  record: Record<string, unknown>,
  key: string,
  label: string
): string | null {
  const value = record[key];
  if (value === undefined || value === null) return null;
  if (typeof value !== "string" || value.trim() === "") {
    throw new ContentError(
      "BLOGGER_CONTENT_INVALID_FIELD",
      `${label}.${key} must be a URL string or null`
    );
  }
  return value;
}

export function rejectUnknownFields(
  record: Record<string, unknown>,
  allowed: readonly string[],
  label: string
): void {
  const known = new Set(allowed);
  for (const key of Object.keys(record)) {
    if (!known.has(key)) {
      throw new ContentError(
        "BLOGGER_CONTENT_UNKNOWN_FIELD",
        `${label} has an unknown field "${key}"`
      );
    }
  }
}
