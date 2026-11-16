// Built-in default markups for Blogger widget families. Blogger ships default
// markup for every widget type; themes may override any includable. The preview
// needs the same fallback so a template that only lists `<b:widget type='...'>`
// still renders something meaningful instead of reporting a missing "main".
//
// These markups are intentionally simple: they exist to keep the preview honest
// (structure, titles, loops) rather than to pixel-match Blogger.

import { isElement, type XmlElement } from "../../xml/ast.js";
import { parseXml } from "../../xml/parser.js";
import { SourceFile } from "../../xml/source.js";

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
      <form class='search-form' expr:action='data:blog.homepageUrl' method='get'>
        <input name='q' type='text'/>
        <input type='submit' expr:value='data:messages.search'/>
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

let cache: Map<string, Map<string, XmlElement>> | undefined;

export function widgetDefaultMarkups(): Map<string, Map<string, XmlElement>> {
  if (cache !== undefined) return cache;
  const document = parseXml(new SourceFile("<widget-defaults>", WIDGET_DEFAULTS_XML));
  const registry = new Map<string, Map<string, XmlElement>>();
  for (const root of document.roots) {
    for (const markup of root.children) {
      if (!isElement(markup) || markup.name !== "b:defaultmarkup") continue;
      const type = markup.attributes.find((attr) => attr.name === "type")?.value;
      if (!type) continue;
      const includables = new Map<string, XmlElement>();
      for (const child of markup.children) {
        if (!isElement(child) || child.name !== "b:includable") continue;
        const id = child.attributes.find((attr) => attr.name === "id")?.value;
        if (id) includables.set(id, child);
      }
      registry.set(type, includables);
    }
  }
  cache = registry;
  return registry;
}
