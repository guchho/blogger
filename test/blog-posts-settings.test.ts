import assert from "node:assert/strict";
import test from "node:test";

import {
  BLOG_POSTS_SETTING,
  blogPostsItemOrder,
  blogPostsSettings,
} from "../src/layout/blog-posts.js";
import { applyLayoutOperations } from "../src/layout/operations.js";

const TEMPLATE = `<?xml version="1.0" encoding="UTF-8"?>
<html xmlns:b='http://www.google.com/2005/gml/b' xmlns:data='http://www.google.com/2005/gml/data' xmlns:expr='http://www.google.com/2005/gml/expr'>
<head><b:skin><![CDATA[.post{color:red}]]></b:skin></head>
<body>
<b:section id='main' showaddelement='false'>
  <b:widget id='Blog1' type='Blog' title='Blog Posts' locked='true' visible='true' version='2'>
    <b:widget-settings>
      <b:widget-setting name='showAuthor'>true</b:widget-setting>
      <b:widget-setting name='timestampLabel'/>
      <b:widget-setting name='style.layout'>1x1</b:widget-setting>
    </b:widget-settings>
    <b:includable id='main'><data:posts/></b:includable>
  </b:widget>
  <b:widget id='HTML1' type='HTML' title='HTML' locked='false' visible='true' version='2'>
    <b:includable id='main'>hello</b:includable>
  </b:widget>
</b:section>
</body></html>`;

function apply(
  widgetId: string,
  settings: Record<string, string>,
  visible?: boolean
) {
  return applyLayoutOperations(
    TEMPLATE,
    [
      {
        kind: "editWidget",
        widgetId,
        changes: { visible, settings },
      },
    ],
    "blog-posts-template.xml"
  );
}

test("blogPostsSettings preserves saved values and fills missing defaults", () => {
  const settings = blogPostsSettings({ showAuthor: "false", timestampLabel: "" });
  assert.equal(settings[BLOG_POSTS_SETTING.showAuthor], "false");
  assert.equal(settings[BLOG_POSTS_SETTING.timestampLabel], "");
  assert.equal(settings[BLOG_POSTS_SETTING.postsPerPage], "10");
  assert.equal(settings[BLOG_POSTS_SETTING.dateFormat], "default");
});

test("blogPostsItemOrder keeps saved order, removes duplicates and adds missing items", () => {
  assert.deepEqual(blogPostsItemOrder("comments,postBody,comments,labels"), [
    "comments",
    "postBody",
    "labels",
    "dateHeader",
    "postTitle",
    "emailPostLink",
    "location",
    "authorProfile",
  ]);
});

test("editing Blog1 settings writes native and custom settings into the widget", () => {
  const { xml, model } = apply(
    "Blog1",
    {
      showAuthor: "false",
      authorLabel: "Written by",
      timestampLabel: "at",
      postsPerPage: "7",
      postItemOrder: "postBody,comments,postBody",
    },
    false
  );
  assert.match(xml, /visible='false'/);
  assert.match(xml, /locked='true'/);
  assert.match(xml, /<b:widget-setting name='showAuthor'>false<\/b:widget-setting>/);
  assert.match(xml, /<b:widget-setting name='authorLabel'>Written by<\/b:widget-setting>/);
  assert.match(xml, /<b:widget-setting name='timestampLabel'>at<\/b:widget-setting>/);
  assert.match(xml, /<b:widget-setting name='postsPerPage'>7<\/b:widget-setting>/);
  assert.match(
    xml,
    /<b:widget-setting name='postItemOrder'>postBody,comments,dateHeader,postTitle,emailPostLink,labels,location,authorProfile<\/b:widget-setting>/
  );
  assert.match(xml, /<b:widget-setting name='style.layout'>1x1<\/b:widget-setting>/);
  assert.doesNotMatch(xml, /<b:widget-setting name='timestampLabel'\/>/);
  const settings = model.sections[0]?.widgets[0]?.settings;
  assert.equal(settings?.[BLOG_POSTS_SETTING.showAuthor], "false");
  assert.equal(settings?.[BLOG_POSTS_SETTING.timestampLabel], "at");
  assert.equal(settings?.[BLOG_POSTS_SETTING.postsPerPage], "7");
  assert.equal(settings?.[BLOG_POSTS_SETTING.postItemOrder], "postBody,comments,dateHeader,postTitle,emailPostLink,labels,location,authorProfile");
  assert.equal(settings?.["style.layout"], "1x1");
});

test("settings edits are ignored for widgets other than Blog1", () => {
  const { xml } = apply("HTML1", { postItemOrder: "postBody,comments" });
  assert.doesNotMatch(xml, /postItemOrder/);
  assert.match(xml, /<b:widget-setting name='showAuthor'>true<\/b:widget-setting>/);
});
