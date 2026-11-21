import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { promises as fs } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";

const packageRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  ".."
);
const repo = process.env.GUCHHO_REPO;
const binary = process.env.GUCHHO_BINARY;
const skip =
  repo === undefined || binary === undefined
    ? "set GUCHHO_REPO and GUCHHO_BINARY to run integration tests"
    : false;

test(
  "builds template.xml beside a normal HTML entry",
  { skip },
  async () => {
    const plugin = path.join(packageRoot, "dist", "index.js");
    try {
      await fs.access(plugin);
    } catch {
      return;
    }

    const root = await fs.mkdtemp(path.join(tmpdir(), "guchho-blogger-e2e-"));
    try {
      const files: Record<string, string> = {
        "package.json": '{"type":"module"}',
        "guchho.config.js":
          `import blogger from ${JSON.stringify(pathToFileURL(plugin).href)};\n` +
          "export default {\n" +
          "  plugins: [blogger({ entry: 'src/template.xml', content: { seedDefaultPost: false } })],\n" +
          "  build: { entry: 'src/index.html', outdir: 'dist' },\n" +
          "};\n",
        "src/index.html":
          '<!doctype html><html><body><p id="app">normal entry</p>' +
          '<script src="./page.js"></script></body></html>',
        "src/page.js": "console.log('page');",
        "src/template.xml":
          "<html><head><b:skin><![CDATA[/* old */]]></b:skin>" +
          '<link href="./styles/main.css" rel="stylesheet" /></head><body>' +
          '<b:section id="main"><b:widget id="Blog1" type="Blog" /></b:section>' +
          '<img src="./assets/logo.svg" />' +
          '<script src="./scripts/app.js"></script></body></html>',
        "src/styles/main.css": "body { color: red; }",
        "src/scripts/app.js": "console.log('hello');",
        "src/assets/logo.svg": '<svg xmlns="http://www.w3.org/2000/svg"></svg>',
      };
      for (const [name, contents] of Object.entries(files)) {
        const file = path.join(root, name);
        await fs.mkdir(path.dirname(file), { recursive: true });
        await fs.writeFile(file, contents);
      }

      const result = spawnSync(
        process.execPath,
        [path.join(repo, "package", "npm", "guchho", "bin", "guchho.js"), "build"],
        {
          cwd: root,
          encoding: "utf8",
          env: { ...process.env, GUCHHO_BINARY: binary },
        }
      );

      assert.equal(result.status, 0, result.stdout + result.stderr);

      const template = await fs.readFile(
        path.join(root, "dist", "template.xml"),
        "utf8"
      );
      const html = await fs.readFile(
        path.join(root, "dist", "index.html"),
        "utf8"
      );

      assert.ok(html.includes("normal entry"));
      assert.ok(template.includes("/* old */]]><![CDATA["));
      assert.match(template, /body\s*\{\s*color:\s*red;?\s*\}/);
      assert.ok(template.includes("data:image/svg+xml;base64,"));
      assert.match(template, /console\.log\(["']hello["']\)/);
      assert.ok(!template.includes("@@GUCHHO_BLOGGER"));
      assert.ok(!template.includes("__guchhoBloggerCarrier"));
      assert.ok(!template.includes(root));
    } finally {
      await fs.rm(root, { recursive: true, force: true });
    }
  }
);
