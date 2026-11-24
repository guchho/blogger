import { copyFileSync, mkdirSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const scriptDir = join(root, "src", "scripts");
const copies = [
  ["src/preview/layout-editor/editor.css", "dist/preview/layout-editor/editor.css"],
  ...readdirSync(scriptDir)
    .filter((entry) => entry.endsWith(".js"))
    .map((entry) => [`src/scripts/${entry}`, `dist/scripts/${entry}`]),
];

for (const [sourcePath, targetPath] of copies) {
  const target = join(root, targetPath);
  mkdirSync(dirname(target), { recursive: true });
  copyFileSync(join(root, sourcePath), target);
}
