import assert from "node:assert/strict";
import test from "node:test";

import { sanitizeHtml } from "../src/content/sanitize.js";

test("safe rich-text HTML is preserved", () => {
  const html = '<p class="lead">Hello <strong>world</strong> &amp; <a href="/about">more</a></p>';
  assert.equal(sanitizeHtml(html), html);
});

test("scripts, handlers and unsafe URLs are removed", () => {
  const html =
    '<p onclick="alert(1)">Hi<script>alert("x")</script>' +
    '<a href="javascript:alert(1)" target="_blank">bad</a>' +
    '<img src="data:image/png;base64,AAA" onerror="alert(1)" />' +
    '<iframe src="https://evil.example"></iframe></p>';
  const clean = sanitizeHtml(html);
  assert.equal(clean.includes("onclick"), false);
  assert.equal(clean.includes("onerror"), false);
  assert.equal(clean.includes("javascript:"), false);
  assert.equal(clean.includes("alert"), false);
  assert.equal(clean.includes("iframe"), false);
  assert.equal(clean.includes("data:image/png"), true);
  assert.equal(clean.includes("<strong>"), false);
  assert.match(clean, /^<p>Hi/);
});

test("editor formatting styles and trusted video embeds survive sanitization", () => {
  const html =
    '<p style="color:#ff0000;background-color:rgb(255,255,0);text-align:center">Hi</p>' +
    '<iframe src="https://www.youtube.com/embed/abc123" width="640" allowfullscreen loading="lazy"></iframe>';
  assert.equal(
    sanitizeHtml(html),
    '<p style="color:#ff0000;background-color:rgb(255,255,0);text-align:center">Hi</p>' +
    '<iframe src="https://www.youtube.com/embed/abc123" width="640" allowfullscreen="" loading="lazy"></iframe>'
  );
});

test("unsafe CSS is dropped while safe declarations remain", () => {
  const html = '<p style="color:expression(alert(1));background-color:url(javascript:alert(1));color:red">Hi</p>';
  assert.equal(sanitizeHtml(html), '<p style="color:red">Hi</p>');
});
