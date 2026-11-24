import { copyFileSync, mkdirSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const targetRoot = join(root, ".test-build");
const copies = [
  ["src/preview/layout-editor/editor.css", "src/preview/layout-editor/editor.css"],
  ["examples/src/template.xml", "examples/src/template.xml"],
  ["src/scripts/content-dashboard-script.js", "src/scripts/content-dashboard-script.js"],
  ["src/scripts/content-editor-script.js", "src/scripts/content-editor-script.js"],
  ["src/scripts/dashboard-comments-script.js", "src/scripts/dashboard-comments-script.js"],
  ["src/scripts/dashboard-navigation-script.js", "src/scripts/dashboard-navigation-script.js"],
  ["src/scripts/dashboard-theme-script.js", "src/scripts/dashboard-theme-script.js"],
  ["src/scripts/widget-showcase-script.js", "src/scripts/widget-showcase-script.js"],
];

rmSync(targetRoot, { recursive: true, force: true });

for (const [sourcePath, targetPath] of copies) {
  const target = join(targetRoot, targetPath);
  mkdirSync(dirname(target), { recursive: true });
  copyFileSync(join(root, sourcePath), target);
}
