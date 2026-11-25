import { copyFileSync, mkdirSync, readdirSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const targetRoot = join(root, ".test-build");
const styleDir = join(root, "src", "style");
const copies = [
  ...readdirSync(styleDir)
    .filter((entry) => entry.endsWith(".css"))
    .map((entry) => [`src/style/${entry}`, `src/style/${entry}`]),
  ["test/fixtures/template.xml", "test/fixtures/template.xml"],
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
