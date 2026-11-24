import { copyFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const source = join(root, "src", "preview", "layout-editor", "editor.css");
const target = join(root, "dist", "preview", "layout-editor", "editor.css");

mkdirSync(dirname(target), { recursive: true });
undefined
