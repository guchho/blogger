import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { TemplateCompiler } from "../src/compiler/compiler.js";
import { buildPreview } from "../src/preview/index.js";

const EXAMPLE_ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "examples"
);

test("the example project compiles and renders a clean preview", async () => {
  const entryPath = path.join(EXAMPLE_ROOT, "src", "template.xml");
  const result = await new TemplateCompiler({
    entryPath,
    projectRoot: EXAMPLE_ROOT,
    validate: true,
  }).compile();

  assert.deepEqual(
    result.diagnostics.filter((diagnostic) => diagnostic.severity === "error"),
    []
  );
  assert.ok(result.template);
  const xml = result.template.xml;

  assert.ok(!xml.includes("g:include"), "includes should be expanded");
  assert.ok(!xml.includes(EXAMPLE_ROOT), "no local paths should leak");
  assert.ok(
    result.template.watchFiles.some(
      (file) => path.resolve(file) === path.resolve(entryPath)
    ),
    "the entry should be watched"
  );

  const preview = buildPreview({ entryPath, xml, banner: false });
  assert.deepEqual(preview.diagnostics, []);
  assert.ok(preview.pages.length >= 7);
  const index = preview.pages.find((page) => page.file === "index.html");
  assert.ok(index);
  assert.match(index.html, /class="widget Blog"/);
  assert.match(index.html, /class="widget-title"/);
});
