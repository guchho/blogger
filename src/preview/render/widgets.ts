// Built-in default markups for Blogger widget families. Blogger ships default
// markup for every widget type; themes may override any includable. The preview
// needs the same fallback so a template that only lists `<b:widget type='...'>`
// still renders something meaningful instead of reporting a missing "main".
//
// These markups are intentionally simple: they exist to keep the preview honest
// (structure, titles, loops) rather than to pixel-match Blogger.

import type { BloggerWidgetRegistry } from "../../types.js";
import { isElement, walk, type XmlElement } from "../../xml/ast.js";
import { parseXml } from "../../xml/parser.js";
import { SourceFile } from "../../xml/source.js";
import { toValue } from "../data/mockData.js";
import type { ValueMap } from "../values.js";

const WIDGET_DEFAULTS_XML = `<b:widget-defaults>
<b:defaultmarkup type='Blog'>
  <b:includable id='main'>
    <b:if cond='data:title'><h3 class='title'><data:title/></h3></b:if>
    <div class='widget-content'>
      <b:loop values='data:posts' var='post'>
        <article class='post'>
          <h3 class='post-title'><a expr:href='data:post.url'><data:post.title/></a></h3>
          <div class='post-body'><data:post.body/></div>
        </article>
      </b:loop>
    </div>
  </b:includable>
</b:defaultmarkup>
<b:defaultmarkup type='Header'>
  <b:includable id='main'>
    <div class='header-widget'>
      <b:if cond='data:title'><h1 class='title'><data:title/></h1></b:if>
      <b:if cond='data:description'><p class='description'><data:description/></p></b:if>
    </div>
  </b:includable>
</b:defaultmarkup>
<b:defaultmarkup type='PageList'>
  <b:includable id='main'>
    <b:if cond='data:title'><h3 class='title'><data:title/></h3></b:if>
    <div class='widget-content'>
      <ul class='pagelist'>
        <b:loop values='data:pages' var='page'>
          <li><a expr:href='data:page.url'><data:page.name/></a></li>
        </b:loop>
      </ul>
    </div>
  </b:includable>
</b:defaultmarkup>
<b:defaultmarkup type='Label'>
  <b:includable id='main'>
    <b:if cond='data:title'><h3 class='title'><data:title/></h3></b:if>
    <div class='widget-content'>
      <ul class='label-list'>
        <b:loop values='data:labels' var='label'>
          <li><a expr:href='data:label.url'><data:label.name/></a> <span class='count'><data:label.count/></span></li>
        </b:loop>
      </ul>
    </div>
  </b:includable>
</b:defaultmarkup>
<b:defaultmarkup type='BlogArchive'>
  <b:includable id='main'>
    <b:if cond='data:title'><h3 class='title'><data:title/></h3></b:if>
    <div class='widget-content archive'>
      <ul>
        <b:loop values='data:posts' var='post'>
          <li><a expr:href='data:post.url'><data:post.title/></a></li>
        </b:loop>
      </ul>
    </div>
  </b:includable>
</b:defaultmarkup>
<b:defaultmarkup type='PopularPosts'>
  <b:includable id='main'>
    <b:if cond='data:title'><h3 class='title'><data:title/></h3></b:if>
    <div class='widget-content popular-posts'>
      <ul>
        <b:loop values='data:posts' var='post'>
          <li><a expr:href='data:post.url'><data:post.title/></a></li>
        </b:loop>
      </ul>
    </div>
  </b:includable>
</b:defaultmarkup>
<b:defaultmarkup type='FeaturedPost'>
  <b:includable id='main'>
    <b:if cond='data:title'><h3 class='title'><data:title/></h3></b:if>
    <div class='widget-content featured-post'>
      <b:loop values='data:posts' var='post' index='i'>
        <b:if cond='data:i == 0'>
          <h4><a expr:href='data:post.url'><data:post.title/></a></h4>
          <div class='post-body'><data:post.body/></div>
        </b:if>
      </b:loop>
    </div>
  </b:includable>
</b:defaultmarkup>
<b:defaultmarkup type='BlogSearch'>
  <b:includable id='main'>
    <b:if cond='data:title'><h3 class='title'><data:title/></h3></b:if>
    <div class='widget-content'>
      <form class='search-form' expr:action='data:blog.searchUrl' method='get'>
        <input name='q' type='text'/>
        <input type='submit' expr:value='data:messages.search'/>
      </form>
    </div>
  </b:includable>
</b:defaultmarkup>
<b:defaultmarkup type='Search'>
  <b:includable id='main'>
    <b:if cond='data:title'><h3 class='title'><data:title/></h3></b:if>
    <div class='widget-content'>
      <form class='search-form' expr:action='data:blog.searchUrl' method='get'>
        <input name='q' type='text'/>
        <input type='submit' expr:value='data:messages.search'/>
      </form>
    </div>
  </b:includable>
</b:defaultmarkup>
<b:defaultmarkup type='FollowByEmail'>
  <b:includable id='main'>
    <b:if cond='data:title'><h3 class='title'><data:title/></h3></b:if>
    <div class='widget-content'>
      <form class='follow-by-email' method='post'>
        <input expr:placeholder='data:messages.emailAddress' name='email' type='email'/>
        <input type='submit' expr:value='data:messages.subscribe'/>
      </form>
    </div>
  </b:includable>
</b:defaultmarkup>
<b:defaultmarkup type='HTML'>
  <b:includable id='main'>
    <b:if cond='data:title'><h3 class='title'><data:title/></h3></b:if>
    <div class='widget-content'><data:content/></div>
  </b:includable>
</b:defaultmarkup>
<b:defaultmarkup type='Text'>
  <b:includable id='main'>
    <b:if cond='data:title'><h3 class='title'><data:title/></h3></b:if>
    <div class='widget-content'><data:content/></div>
  </b:includable>
</b:defaultmarkup>
<b:defaultmarkup type='Image'>
  <b:includable id='main'>
    <b:if cond='data:title'><h3 class='title'><data:title/></h3></b:if>
    <div class='widget-content image-widget'>
      <b:if cond='data:link'>
        <a expr:href='data:link'><img expr:alt='data:altText' expr:height='data:height' expr:src='data:sourceUrl' expr:width='data:width'/></a>
      <b:else/>
        <img expr:alt='data:altText' expr:height='data:height' expr:src='data:sourceUrl' expr:width='data:width'/>
      </b:if>
    </div>
  </b:includable>
</b:defaultmarkup>
<b:defaultmarkup type='LinkList'>
  <b:includable id='main'>
    <b:if cond='data:title'><h3 class='title'><data:title/></h3></b:if>
    <div class='widget-content'>
      <ul class='link-list'>
        <b:loop values='data:links' var='link'>
          <li><a expr:href='data:link.target'><data:link.name/></a></li>
        </b:loop>
      </ul>
    </div>
  </b:includable>
</b:defaultmarkup>
<b:defaultmarkup type='Profile'>
  <b:includable id='main'>
    <b:if cond='data:title'><h3 class='title'><data:title/></h3></b:if>
    <div class='widget-content'>
      <ul class='profile-team'>
        <b:loop values='data:team' var='member'>
          <li>
            <b:if cond='data:member.userProfileUrl'>
              <a expr:href='data:member.userProfileUrl'><data:member.displayname/></a>
            <b:else/>
              <data:member.displayname/>
            </b:if>
          </li>
        </b:loop>
      </ul>
    </div>
  </b:includable>
</b:defaultmarkup>
<b:defaultmarkup type='Subscribe'>
  <b:includable id='main'>
    <b:if cond='data:title'><h3 class='title'><data:title/></h3></b:if>
    <div class='widget-content'>
      <a class='subscribe' expr:href='data:feedUrl'><data:messages.subscribe/></a>
    </div>
  </b:includable>
</b:defaultmarkup>
<b:defaultmarkup type='Followers'>
  <b:includable id='main'>
    <b:if cond='data:title'><h3 class='title'><data:title/></h3></b:if>
    <div class='widget-content'>
      <span class='followers-count'><data:totalCount/></span>
    </div>
  </b:includable>
</b:defaultmarkup>
<b:defaultmarkup type='Stats'>
  <b:includable id='main'>
    <b:if cond='data:title'><h3 class='title'><data:title/></h3></b:if>
    <div class='widget-content stats'><data:totalCount/></div>
  </b:includable>
</b:defaultmarkup>
<b:defaultmarkup type='Translate'>
  <b:includable id='main'>
    <b:if cond='data:title'><h3 class='title'><data:title/></h3></b:if>
    <div class='widget-content' id='google_translate_element'></div>
  </b:includable>
</b:defaultmarkup>
<b:defaultmarkup type='ReportAbuse'>
  <b:includable id='main'>
    <div class='widget-content'>
      <a expr:href='data:reportAbuseUrl'><data:messages.reportAbuse/></a>
    </div>
  </b:includable>
</b:defaultmarkup>
<b:defaultmarkup type='ContactForm'>
  <b:includable id='main'>
    <b:if cond='data:title'><h3 class='title'><data:title/></h3></b:if>
    <div class='widget-content'>
      <form class='contact-form'>
        <input name='name' type='text'/>
        <input name='email' type='email'/>
        <textarea name='message'></textarea>
        <input type='submit' expr:value='data:contactFormMessage'/>
      </form>
    </div>
  </b:includable>
</b:defaultmarkup>
<b:defaultmarkup type='Attribution'>
  <b:includable id='main'>
    <div class='widget-content attribution'>
      <a expr:href='data:blog.homepageUrl'><data:blog.title/></a>
      <span class='powered-by'><data:messages.poweredBy/></span>
    </div>
  </b:includable>
</b:defaultmarkup>
</b:widget-defaults>`;

export interface WidgetRegistry {
  markups: Map<string, Map<string, XmlElement>>;
  data: Map<string, ValueMap>;
}

export function builtinWidgetTypes(): string[] {
  return [...widgetDefaultMarkups().markups.keys()].sort();
}

export function widgetDefaultMarkupSource(type: string): string | undefined {
  const document = parseXml(new SourceFile("<widget-defaults>", WIDGET_DEFAULTS_XML));
  for (const node of document.children) {
    if (!isElement(node) || node.name !== "b:defaultmarkup") continue;
    const candidate = node.attributes.find((attr) => attr.name === "type")?.value;
    if (candidate !== type) continue;
    const end = node.endTagSpan?.start ?? node.span.end;
    return WIDGET_DEFAULTS_XML.slice(node.startTagSpan.end, end).trim();
  }
  return undefined;
}

let cache: WidgetRegistry | undefined;

export function widgetDefaultMarkups(): WidgetRegistry {
  if (cache !== undefined) return cache;
  const markups = parseMarkups(
    WIDGET_DEFAULTS_XML,
    "<widget-defaults>",
    undefined
  );
  cache = { markups, data: new Map() };
  return cache;
}

export function buildWidgetRegistry(
  custom: BloggerWidgetRegistry | undefined
): WidgetRegistry {
  const base = widgetDefaultMarkups();
  if (custom === undefined) return base;

  const markups = new Map<string, Map<string, XmlElement>>();
  for (const [type, includables] of base.markups) {
    markups.set(type, new Map(includables));
  }
  const data = new Map(base.data);

  for (const [type, definition] of Object.entries(custom)) {
    const markup = typeof definition === "string" ? definition : definition.markup;
    const fragment = markup.trim().startsWith("<b:defaultmarkup")
      ? markup
      : `<b:defaultmarkup type='${escapeAttribute(type)}'>${markup}</b:defaultmarkup>`;
    const parsed = parseMarkups(fragment, `<custom-widget:${type}>`, type);
    const includables = parsed.get(type);
    if (includables === undefined || includables.size === 0) {
      throw new Error(`custom widget "${type}" has no b:includable markup`);
    }
    markups.set(type, includables);
    if (typeof definition !== "string" && definition.data !== undefined) {
      data.set(type, toValue(definition.data) as ValueMap);
    }
  }

  return { markups, data };
}

function parseMarkups(
  xml: string,
  fileName: string,
  fallbackType: string | undefined
): Map<string, Map<string, XmlElement>> {
  const document = parseXml(new SourceFile(fileName, xml), { fragment: true });
  const registry = new Map<string, Map<string, XmlElement>>();
  walk(document.children, (node) => {
    if (!isElement(node) || node.name !== "b:defaultmarkup") return;
    const type =
      node.attributes.find((attr) => attr.name === "type")?.value ?? fallbackType;
    if (type === undefined) return;
    const includables = new Map<string, XmlElement>();
    for (const child of node.children) {
      if (!isElement(child) || child.name !== "b:includable") continue;
      const id = child.attributes.find((attr) => attr.name === "id")?.value;
      if (id) includables.set(id, child);
    }
    registry.set(type, includables);
  });
  return registry;
}

function escapeAttribute(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/'/g, "&#39;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
