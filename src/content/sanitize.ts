const ALLOWED_TAGS = new Set([
  "a", "b", "blockquote", "br", "code", "dd", "del", "div", "dl", "dt", "em",
  "figcaption", "figure", "h1", "h2", "h3", "h4", "h5", "h6", "hr", "i", "img",
  "li", "ol", "p", "pre", "s", "span", "strong", "sub", "sup", "table", "tbody",
  "td", "th", "thead", "tr", "u", "ul",
]);

const VOID_TAGS = new Set(["br", "hr", "img"]);
const ATTRIBUTE_PATTERN = /([A-Za-z_:][-\w:.]*)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g;
const TAG_PATTERN = /<!--[\s\S]*?-->|<\/?[A-Za-z][^>]*>/g;

function safeUrl(value: string, attribute: string): boolean {
  const normalized = value.trim().toLowerCase();
  if (normalized === "") return true;
  if (normalized.startsWith("javascript:") || normalized.startsWith("vbscript:")) return false;
  if (normalized.startsWith("data:")) {
    return attribute === "src" && /^data:image\/(?:png|jpeg|gif|webp|svg\+xml)[;,]/i.test(normalized);
  }
  if (/^[a-z][a-z0-9+.-]*:/i.test(normalized)) {
    return /^(?:https?|mailto):/i.test(normalized);
  }
  return true;
}

function sanitizeOpeningTag(tag: string): string {
  const match = /^<\s*([A-Za-z][\w-]*)/.exec(tag);
  const name = (match?.[1] ?? "").toLowerCase();
  if (!ALLOWED_TAGS.has(name)) return "";
  const selfClosing = /\/>$/.test(tag);
  const attributes: string[] = [];
  ATTRIBUTE_PATTERN.lastIndex = 0;
  let attribute = ATTRIBUTE_PATTERN.exec(tag);
  let first = true;
  while (attribute !== null) {
    if (first) {
      first = false;
    } else {
      const key = (attribute[1] ?? "").toLowerCase();
      const value = attribute[2] ?? attribute[3] ?? attribute[4] ?? "";
      const allowed =
        key === "href" || key === "src"
          ? safeUrl(value, key)
          : key === "alt" || key === "title" || key === "class" || key === "id" ||
            key === "width" || key === "height" || key === "rel" ||
            (key === "target" && value === "_blank");
      if (allowed) attributes.push(`${key}="${value.replace(/&/g, "&amp;").replace(/"/g, "&quot;")}"`);
    }
    attribute = ATTRIBUTE_PATTERN.exec(tag);
  }
  const suffix = selfClosing || VOID_TAGS.has(name) ? " />" : ">";
  return `<${name}${attributes.length === 0 ? "" : ` ${attributes.join(" ")}`}${suffix}`;
}

/** Conservative allowlist sanitizer for rich-text content stored as HTML. */
export function sanitizeHtml(input: string): string {
  const withoutUnsafeBlocks = input.replace(
    /<(script|style|iframe|object|embed|form|noscript)\b[^>]*>[\s\S]*?<\/\1\s*>/gi,
    ""
  );
  return withoutUnsafeBlocks.replace(TAG_PATTERN, (tag) => {
    if (tag.startsWith("<!--")) return "";
    if (tag.startsWith("</")) {
      const name = (/^<\/\s*([A-Za-z][\w-]*)/.exec(tag)?.[1] ?? "").toLowerCase();
      return ALLOWED_TAGS.has(name) && !VOID_TAGS.has(name) ? `</${name}>` : "";
    }
    return sanitizeOpeningTag(tag);
  });
}
