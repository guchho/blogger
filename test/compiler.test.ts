import assert from "node:assert/strict";
import { promises as fs } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import {
  ASSET_TOKEN_PREFIX,
  CSS_SKIN_TOKEN,
  CSS_TOKEN,
  JS_TOKEN,
  TemplateCompiler,
} from "../src/compiler/compiler.js";
import { assembleTemplate, findUnresolvedTokens } from "../src/compiler/assemble.js";
import { parseXml } from "../src/xml/parser.js";
import { SourceFile } from "../src/xml/source.js";
import type { CompiledTemplate } from "../src/types.js";

async function project(
  files: Record<string, string>,
  run: (root: string) => Promise<void>
): Promise<void> {
  const root = await fs.mkdtemp(path.join(tmpdir(), "guchho-blogger-"));
  try {
    for (const [name, contents] of Object.entries(files)) {
      const file = path.join(root, name);
      await fs.mkdir(path.dirname(file), { recursive: true });
      await fs.writeFile(file, contents);
    }
    await run(root);
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
}

function template(root: string, xml: string, marker = "@@MARKER@@"): CompiledTemplate {
  return {
    marker,
    entryPath: path.join(root, "template.xml"),
    xml,
    watchFiles: [],
    resources: [],
  };
}

test("parser keeps raw slices for declarations, doctypes, comments and CDATA", () => {
  const text =
    '<?xml version="1.0"?>\n<!DOCTYPE html [<!ENTITY x "y">]>\n' +
    "<root a='1' b=\"2\"><!-- c --><![CDATA[<x>]]></root>";
  const source = new SourceFile("test.xml", text);
  const document = parseXml(source);

  assert.equal(document.roots.length, 1);
  const root = document.roots[0]!;
  assert.equal(text.slice(root.startTagSpan.start, root.startTagSpan.end), "<root a='1' b=\"2\">");
  assert.equal(root.attributes[0]!.quote, "'");

  const comment = root.children.find((node) => node.type === "comment");
  const cdata = root.children.find((node) => node.type === "cdata");
  assert.equal(comment?.type, "comment");
  assert.equal(cdata?.type, "cdata");
  if (comment?.type === "comment") assert.equal(comment.value, " c ");
  if (cdata?.type === "cdata") assert.equal(cdata.value, "<x>");
  assert.ok(document.children.some((node) => node.type === "doctype"));
});

test("compiler expands includes and discovers CSS, JS and assets", async () => {
  await project(
    {
      "template.xml":
        '<html><head><link href="./styles/main.css" rel="stylesheet" /></head>' +
        '<body><g:include src="./components/body.xml" />' +
        '<script src="./scripts/app.js"></script></body></html>',
      "components/body.xml": '<div><img src="./assets/logo.svg" /></div>',
      "components/assets/logo.svg": "<svg></svg>",
      "styles/main.css": "body { color: red; }",
      "scripts/app.js": "console.log('ok');",
    },
    async (root) => {
      const result = await new TemplateCompiler({
        entryPath: path.join(root, "template.xml"),
        projectRoot: root,
        validate: true,
      }).compile();

      assert.deepEqual(
        result.diagnostics.filter((item) => item.severity === "error"),
        []
      );
      assert.ok(result.template);
      const xml = result.template.xml;
      assert.ok(xml.includes(CSS_TOKEN));
      assert.ok(xml.includes(ASSET_TOKEN_PREFIX));
      assert.ok(!xml.includes("g:include"));
      assert.deepEqual(
        [...new Set(result.template.resources.map((resource) => resource.kind))].sort(),
        ["asset", "css", "js"]
      );
      assert.ok(
        result.template.watchFiles.some((file) => file.endsWith("body.xml"))
      );
    }
  );
});

test("compiler reports missing and cyclic includes", async () => {
  await project(
    {
      "missing.xml": '<html><body><g:include src="./nope.xml" /></body></html>',
      "cycle-a.xml": '<html><body><g:include src="./cycle-b.xml" /></body></html>',
      "cycle-b.xml": '<div><g:include src="./cycle-a.xml" /></div>',
    },
    async (root) => {
      const missing = await new TemplateCompiler({
        entryPath: path.join(root, "missing.xml"),
        projectRoot: root,
        validate: true,
      }).compile();
      assert.ok(
        missing.diagnostics.some((item) => item.code === "BLOGGER_INCLUDE_MISSING")
      );
      assert.equal(missing.template, undefined);

      const cycle = await new TemplateCompiler({
        entryPath: path.join(root, "cycle-a.xml"),
        projectRoot: root,
        validate: true,
      }).compile();
      assert.ok(
        cycle.diagnostics.some((item) => item.code === "BLOGGER_INCLUDE_CYCLE")
      );
      assert.equal(cycle.template, undefined);
    }
  );
});

test("validator enforces section, widget and duplicate rules", async () => {
  await project(
    {
      "template.xml":
        '<html><body><b:widget id="w" type="Blog" />' +
        '<b:section id="s"><b:section id="s" /></b:section></body></html>',
    },
    async (root) => {
      const result = await new TemplateCompiler({
        entryPath: path.join(root, "template.xml"),
        projectRoot: root,
        validate: true,
      }).compile();

      const codes = new Set(result.diagnostics.map((item) => item.code));
      assert.ok(codes.has("BLOGGER_VALIDATION_WIDGET_PARENT"));
      assert.ok(codes.has("BLOGGER_VALIDATION_DUPLICATE_ID"));
      assert.equal(result.template, undefined);
    }
  );
});

test("validator accepts b:include with expr:name and rejects neither", async () => {
  await project(
    {
      "expr-name.xml":
        '<html><body><b:section id="s"><b:widget id="w" type="Blog">' +
        '<b:includable id="main"><b:include expr:name="data:name" /></b:includable>' +
        "</b:widget></b:section></body></html>",
      "no-name.xml":
        '<html><body><b:section id="s"><b:widget id="w" type="Blog">' +
        '<b:includable id="main"><b:include /></b:includable>' +
        "</b:widget></b:section></body></html>",
    },
    async (root) => {
      const compile = (file: string) =>
        new TemplateCompiler({
          entryPath: path.join(root, file),
          projectRoot: root,
          validate: true,
        }).compile();

      const dynamic = await compile("expr-name.xml");
      assert.equal(
        dynamic.diagnostics.some(
          (item) => item.code === "BLOGGER_VALIDATION_INCLUDE_NAME"
        ),
        false
      );
      assert.ok(dynamic.template);

      const missing = await compile("no-name.xml");
      assert.ok(
        missing.diagnostics.some(
          (item) => item.code === "BLOGGER_VALIDATION_INCLUDE_NAME"
        )
      );
      assert.equal(missing.template, undefined);
    }
  );
});

test("compiler injects theme CSS into <b:skin> when present", async () => {
  await project(
    {
      "template.xml":
        '<html><head><b:skin><![CDATA[/* old */]]></b:skin>' +
        '<link href="./main.css" rel="stylesheet" /></head><body></body></html>',
      "main.css": "body { color: red; }",
    },
    async (root) => {
      const result = await new TemplateCompiler({
        entryPath: path.join(root, "template.xml"),
        projectRoot: root,
        validate: true,
      }).compile();

      assert.ok(result.template);
      assert.ok(result.template.xml.includes(CSS_SKIN_TOKEN));
      const output = assembleTemplate(result.template, {
        css: "body { color: red; }",
        js: "",
        assets: new Map(),
      });
      assert.ok(
        output.includes(
          "/* old */]]><![CDATA[body { color: red; }]]></b:skin>"
        )
      );
    }
  );
});

test("assemble inlines CSS/JS and escapes CDATA terminators", async () => {
  await project({}, async (root) => {
    const xml = `<head>${CSS_TOKEN}</head><body><script>${JS_TOKEN}</script>${ASSET_TOKEN_PREFIX}0@@</body>`;
    const output = assembleTemplate(template(root, xml), {
      css: "a {}",
      js: "if (x) { y(); } ]]> tail",
      assets: new Map([[`${ASSET_TOKEN_PREFIX}0@@`, "data:image/svg+xml;base64,AA=="]]),
    });

    assert.ok(output.includes("<style><![CDATA[a {}]]></style>"));
    assert.ok(output.includes("<script><![CDATA["));
    assert.ok(output.includes("]]]]><![CDATA[>"));
    assert.ok(output.includes("data:image/svg+xml;base64,AA=="));
    assert.deepEqual(findUnresolvedTokens(output), []);
  });
});
