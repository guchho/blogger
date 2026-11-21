import { PREVIEW_FALLBACK_IMAGE } from "../data/metadata.js";

export function withImageFallback(
  html: string,
  fallback: string = PREVIEW_FALLBACK_IMAGE
): string {
  const source = fallback
    .replace(/\\/g, "\\\\")
    .replace(/'/g, "\\'")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/"/g, "&quot;");
  const handler = ` onerror="this.onerror=null;this.src='${source}'"`;
  return html.replace(/<img\b([^>]*?)(\/?)>/gi, (match, attributes: string, slash: string) => {
    if (/\sonerror\s*=/i.test(attributes) || /\ssrc\s*=\s*["']data:/i.test(attributes)) {
      return match;
    }
    return `<img${attributes}${handler}${slash}>`;
  });
}
