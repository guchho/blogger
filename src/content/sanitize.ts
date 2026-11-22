const ALLOWED_TAGS = new Set([
  "a", "b", "blockquote", "br", "code", "dd", "del", "div", "dl", "dt", "em",
  "figcaption", "figure", "h1", "h2", "h3", "h4", "h5", "h6", "hr", "i", "iframe", "img",
  "li", "ol", "p", "pre", "s", "span", "strong", "sub", "sup", "table", "tbody",
  "td", "th", "thead", "tr", "u", "ul",
]);

const VOID_TAGS = new Set(["br", "hr", "img"]);
const ATTRIBUTE_PATTERN = /([A-Za-z_:][-\w:.]*)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g;
const TAG_PATTERN = /<!--[\s\S]*?-->|<\/?[A-Za-z][^>]*>/g;
const ALLOWED_STYLES = new Set([
  "background-color", "color", "direction", "font-family", "font-size",
  "margin-left", "margin-right", "text-align", "text-decoration",
]);

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

function safeEmbedUrl(value: string): boolean {
  const normalized = value.trim().toLowerCase();
  return /^https:\/\/(?:www\.)?(?:youtube\.com\/embed\/[\w-]+|youtube-nocookie\.com\/embed\/[\w-]+)(?:\?[^\s"'<>]*)?$/.test(normalized) ||
    /^https:\/\/player\.vimeo\.com\/video\/\d+(?:\?[^\s"'<>]*)?$/.test(normalized);
}

function safeStyle(value: string): string {
  const declarations: string[] = [];
  for (const declaration of value.split(";")) {
    const separator = declaration.indexOf(":");
    if (separator < 0) continue;
    const name = declaration.slice(0, separator).trim().toLowerCase();
    const styleValue = declaration.slice(separator + 1).trim();
    if (!ALLOWED_STYLES.has(name)) continue;
    if (/url\s*\(|expression\s*\(|@import|[<>:!\\]/.test(styleValue)) continue;
    if (!/^[\w\s#.,%()'"+-]+$/.test(styleValue)) continue;
    declarations.push(`${name}:${styleValue}`);
  }
  return declarations.join(";");
}

function escapeAttribute(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function allowedAttribute(name: string, value: string, tagName: string): boolean {
  if (name === "style") return safeStyle(value) !== "";
  if (name === "href") return safeUrl(value, name);
  if (name === "src") return tagName === "iframe" ? safeEmbedUrl(value) : safeUrl(value, name);
  if (name === "dir") return /^(?:ltr|rtl|auto)$/i.test(value);
  if (name === "lang") return /^[a-z]{2,}(?:-[a-z0-9]{2,8})*$/i.test(value);
  if (name === "width" || name === "height") return /^\d{1,4}(?:px|%)?$/.test(value);
  if (name === "loading") return value === "lazy" || value === "eager";
  if (name === "allowfullscreen") return true;
  if (name === "allow") return /^(?:accelerometer|autoplay|encrypted-media|picture-in-picture|fullscreen|[;\s])+$/i.test(value);
  return name === "alt" || name === "title" || name === "class" || name === "id" ||
    name === "rel" || (name === "target" && value === "_blank");
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
      if (allowedAttribute(key, value, name)) {
        const safeValue = key === "style" ? safeStyle(value) : value;
        attributes.push(`${key}="${escapeAttribute(safeValue)}"`);
      }
    }
    attribute = ATTRIBUTE_PATTERN.exec(tag);
  }
  const suffix = selfClosing || VOID_TAGS.has(name) ? " />" : ">";
  return `<${name}${attributes.length === 0 ? "" : ` ${attributes.join(" ")}`}${suffix}`;
}

function keepSafeEmbed(tag: string): string {
  const match = /src\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+))/i.exec(tag);
  const url = match?.[1] ?? match?.[2] ?? match?.[3] ?? "";
  return safeEmbedUrl(url) ? tag : "";
}

/** Conservative allowlist sanitizer for rich-text content stored as HTML. */
export function sanitizeHtml(input: string): string {
  const withoutUnsafeBlocks = input
    .replace(/<(script|style|object|embed|form|noscript)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, "")
    .replace(/<iframe\b[^>]*>[\s\S]*?<\/iframe\s*>/gi, keepSafeEmbed)
    .replace(/<iframe\b[^>]*\/>/gi, keepSafeEmbed);
  return withoutUnsafeBlocks.replace(TAG_PATTERN, (tag) => {
    if (tag.startsWith("<!--")) return "";
    if (tag.startsWith("</")) {
      const name = (/^<\/\s*([A-Za-z][\w-]*)/.exec(tag)?.[1] ?? "").toLowerCase();
      return ALLOWED_TAGS.has(name) && !VOID_TAGS.has(name) ? `</${name}>` : "";
    }
    return sanitizeOpeningTag(tag);
  });
}
