// Preview-only Blogger feed emulation. Themes commonly load post lists through
// JSONP feed requests such as "/feeds/posts/default?alt=json-in-script". A
// static preview has no Blogger backend, so the injected runtime answers those
// requests in the page instead of letting them 404 against the dev server.

import { BloggerDate, HtmlString, isDate, type Value, type ValueMap } from "./values.js";

/** A post in the shape Blogger's JSON feed returns. */
export interface PreviewFeedEntry {
  [key: string]: unknown;
}

export function previewFeedEntries(posts: ValueMap[]): PreviewFeedEntry[] {
  return posts.map((post) => {
    const labels = Array.isArray(post["labels"]) ? post["labels"] : [];
    const dateValue = post["date"] as Value | undefined;
    const date = isDate(dateValue as Value)
      ? (dateValue as BloggerDate).date
      : new Date(0);
    const published = `${date.toISOString().slice(0, 23)}+00:00`;
    const body = post["body"];
    const content =
      body instanceof HtmlString ? body.value : String(post["snippet"] ?? "");
    const author =
      post["author"] !== null && typeof post["author"] === "object"
        ? (post["author"] as ValueMap)
        : undefined;
    const authorName =
      author === undefined ? "" : String(author["name"] ?? "");
    const authorUrl =
      author === undefined ? "" : String(author["profileUrl"] ?? "");
    const thumbnail = String(post["thumbnailUrl"] ?? "");
    const title = String(post["title"] ?? "");
    const url = String(post["url"] ?? "");

    const categories = labels
      .filter(
        (label): label is ValueMap =>
          label !== null && typeof label === "object" && !Array.isArray(label)
      )
      .map((label) => ({ term: String(label["name"] ?? "") }));

    const entry: PreviewFeedEntry = {
      id: { $t: `tag:blogger.com,1999:blog-${String(post["id"] ?? "")}` },
      published: { $t: published },
      updated: { $t: published },
      title: { $t: title, type: "text" },
      content: { $t: content, type: "html" },
      link: [{ rel: "alternate", type: "text/html", href: url }],
      author: [{ name: { $t: authorName }, uri: { $t: authorUrl } }],
    };
    if (categories.length > 0) entry["category"] = categories;
    if (thumbnail !== "") entry["media$thumbnail"] = { url: thumbnail };
    return entry;
  });
}

/**
 * The script that intercepts JSONP feed requests in a preview page.
 *
 * The callback name is read from the requested URL, so the same embedded data
 * answers every theme variant: recent posts, random posts, label feeds and the
 * summary feed used for pagination.
 */
export function previewFeedScript(entries: PreviewFeedEntry[]): string {
  const data = JSON.stringify(entries).replace(/</g, "\\u003c");
  return (
    `<script data-guchho-preview="feeds">` +
    `(function(){` +
    `if(window.__guchhoPreviewFeeds)return;` +
    `var all=${data};` +
    `function respond(url){` +
    `var entries=all,label=null;` +
    `var match=/\\/feeds\\/posts\\/[^/]+\\/-\\/([^/?#]+)/.exec(url.pathname);` +
    `if(match){try{label=decodeURIComponent(match[1]);}catch(e){label=match[1];}}` +
    `if(label!==null){entries=entries.filter(function(entry){` +
    `return(entry.category||[]).some(function(item){return item.term===label;});});}` +
    `var start=parseInt(url.searchParams.get("start-index")||"1",10);` +
    `var max=parseInt(url.searchParams.get("max-results")||String(entries.length),10);` +
    `if(!isFinite(start)||start<1)start=1;` +
    `if(!isFinite(max)||max<0)max=entries.length;` +
    `return{feed:{openSearch$totalResults:{$t:String(entries.length)},` +
    `openSearch$startIndex:{$t:String(start)},` +
    `entry:entries.slice(start-1,start-1+max)}};}` +
    `function intercept(node){` +
    `try{` +
    `if(!node||node.tagName!=="SCRIPT"||!node.src)return false;` +
    `var url=new URL(node.src,location.href);` +
    `if(!/\\/feeds\\/posts\\//.test(url.pathname))return false;` +
    `var name=url.searchParams.get("callback");` +
    `if(!name||typeof window[name]!=="function")return false;` +
    `var callback=window[name],payload=respond(url);` +
    `setTimeout(function(){try{callback(payload);}catch(error){console.error(error);}},0);` +
    `return true;` +
    `}catch(error){return false;}` +
    `}` +
    `var appendChild=Node.prototype.appendChild;` +
    `Node.prototype.appendChild=function(node){` +
    `if(intercept(node))return node;` +
    `return appendChild.call(this,node);};` +
    `window.__guchhoPreviewFeeds=true;` +
    `})();` +
    `</script>`
  );
}
