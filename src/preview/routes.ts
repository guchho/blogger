import path from "node:path";

export function previewRouteFile(route: string): string {
  if (!route.startsWith("/") || route.startsWith("//")) {
    throw new Error(`preview route must be an absolute local path: ${route}`);
  }
  const clean = route.split(/[?#]/, 1)[0] ?? "/";
  const segments = clean
    .replace(/\\/g, "/")
    .split("/")
    .filter((segment) => segment !== "" && segment !== ".");
  if (segments.includes("..")) {
    throw new Error(`preview route escapes the output directory: ${route}`);
  }
  if (segments.length === 0) return "index.html";
  const last = segments[segments.length - 1] as string;
  if (path.extname(last) !== "") return segments.join("/");
  return [...segments, "index.html"].join("/");
}
