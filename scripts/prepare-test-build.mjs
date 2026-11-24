import { copyFileSync, mkdirSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const targetRoot = join(root, ".test-build");
const copies = [
  ["src/preview/layout-editor/editor.css", "src/preview/layout-editor/editor.css"],
  ["examples/src/template.xml", "examples/src/template.xml"],
  ["src/scripts/content-dashboard.js", "src/scripts/content-dashboard.js"],
  ["src/scripts/content-editor.js", "src/scripts/content-editor.js"],
  ["src/scripts/dashboard-comments.js", "src/scripts/dashboard-comments.js"],
  ["src/scripts/dashboard-navigation.js", "src/scripts/dashboard-navigation.js"],
  ["src/scripts/dashboard-settings.js", "src/scripts/dashboard-settings.js"],
  ["src/scripts/dashboard-theme.js", "src/scripts/dashboard-theme.js"],
  ["src/scripts/layout-editor.js", "src/scripts/layout-editor.js"],
  ["src/scripts/widget-showcase.js", "src/scripts/widget-showcase.js"],
];

rmSync(targetRoot, { recursive: true, force: true });

for (const [sourcePath, targetPath] of copies) {
  const target = join(targetRoot, targetPath);
  mkdirSync(dirname(target), { recursive: true });
  copyFileSync(join(root, sourcePath), target);
}
