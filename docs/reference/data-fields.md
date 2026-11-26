---
title: Data fields
description: Blogger-style values available to templates in preview and content builds, with copyable examples.
---

# Data fields

Templates read values through `<data:NAME>` and expressions such as
`data:post.title`. The renderer resolves names from the current scope first
(a widget, a `b:loop` variable, or a `b:include` parameter) and then from the
root data map described below.

There are two data sources:

- **Mock preview** — deterministic posts, pages, comments and widget settings.
  Used when no CMS content is supplied.
- **Content builds** — posts and pages from JSON files, with deterministic
  widgets, messages and comments. This is what `guchho build` and `guchho dev`
  use when the project has content.

The field names are the same in both modes. Only the values and a few optional
fields change; those differences are called out below. For a full list of
supported expression syntax, see [Blogger compatibility](../blogger-compatibility.md).

## A first template

This widget prints the blog title, then either the current post or a list of
posts:

```xml
<b:section id='main'>
  <b:widget id='Blog1' type='Blog' title='Posts'>
    <b:includable id='main'>
      <h1><data:blog.title/></h1>

      <b:if cond='data:view.isPost'>
        <article>
          <h2><data:post.title.escaped/></h2>
          <time expr:datetime='data:post.date.iso8601'><data:post.date/></time>
          <div class='post-body'><data:post.body/></div>
        </article>
      <b:else/>
        <ul>
          <b:loop values='data:posts' var='post'>
            <li><a expr:href='data:post.url'><data:post.title/></a></li>
          </b:loop>
        </ul>
      </b:if>
    </b:includable>
  </b:widget>
</b:section>
```

`data:post.body` is trusted HTML and is emitted as-is. Ordinary strings,
including `data:post.title`, are HTML-escaped automatically; `.escaped` makes
that explicit.

## Root data map

| Key | Type | Description |
| --- | --- | --- |
| `view` | map | Page type, flags, canonical URLs and view-specific messages. |
| `blog` | map | Site identity, locale, page type and sharing platforms. |
| `posts` | array | Posts for the current scenario. One post on post pages, a page on static pages. |
| `post` | map or `null` | The current post; falls back to `posts[0]` when no post was passed explicitly. |
| `page` | map or `null` | The current static page, otherwise `null`. |
| `labels` | array | Labels for the current site. |
| `comments` | array | Deterministic preview comments. |
| `widgets` | array | All preview widgets, plus type-keyed arrays such as `data:widgets.Blog`. |
| `archive` | map | Archive range message. |
| `search` | map | Search label, query and results message. |
| `settings` | map | Root site settings, distinct from widget settings. |
| `allBylineItems` | map | Byline definitions keyed by `author`, `timestamp`, `comments`, and so on. |
| `messages` | map | The `data:messages` catalog. |
| `skin` | map | Skin variables such as `data:skin.vars.keycolor`. |
| `defaultTitle` | string | Fallback page title. |
| `newerPageUrl`, `olderPageUrl` | string | Preview pagination URLs. |
| `cmtIframeInitialHeight` | number | Default comment iframe height. |
| `showCmtPopup` | boolean | Whether a comment popup is requested. |
| `navMessage` | string | Optional navigation message; empty by default. |
| `sourceUrl` | string | Canonical URL of the current scenario. |
| `feedPath` | string | Relative feed path, `feeds/posts/default`. |
| `adClientId` | string | Ad client id; empty by default. |

## `data:view`

| Field | Type | Meaning |
| --- | --- | --- |
| `title`, `description` | string | Current page title and description. |
| `url`, `canonicalUrl` | string | Current page URL. |
| `isHomepage` | boolean | True for the index and widget showcase. |
| `isPost` | boolean | True on a post (`item`) page. |
| `isPage` | boolean | True on a static page. |
| `isMultipleItems` | boolean | True for index, archive, label and search pages. |
| `isSingleItem` | boolean | True for posts and static pages. |
| `isArchive`, `isSearch`, `isLabel`, `isError` | boolean | One flag for each special view. |
| `isLayoutMode` | boolean | Always `false` in the renderer. |
| `isPreview` | boolean | Always `false`, even while rendering a preview. |
| `postId` | string | Id of the explicit post or page; empty on listing views. |
| `archive` | map | `{ rangeMessage }`, for example `January 2026`. |
| `search` | map | `{ label, query, resultsMessageHtml }`. |

Use the boolean flags rather than comparing `data:blog.pageType` to a string:

```xml
<b:if cond='data:view.isHomepage'>
  <p>Welcome.</p>
<b:elseif cond='data:view.isLabel'/>
  <p>Showing <data:view.search.label/> posts.</p>
<b:elseif cond='data:view.isError'/>
  <p><data:messages.theresNothingHere/></p>
</b:if>
```

## `data:blog`

| Field | Type | Meaning |
| --- | --- | --- |
| `title`, `metaDescription` | string | Site title and description. |
| `homepageUrl`, `canonicalUrl`, `sourceUrl` | string | Site and current-page URLs. |
| `blogspotFaviconUrl` | string | Favicon URL used by the preview. |
| `pageType` | string | `index`, `item`, `static_page`, `label`, `archive`, `search` or `error_page`. |
| `pageName` | string | Human label: `Post`, `Page`, `Not Found` or `Home`. |
| `languageDirection`, `languageAlignment`, `language` | string | `ltr`, `left`, `en` in the built-in data. |
| `locale` | map | `{ language, languageAlignment, country, name }`. |
| `isMobileRequest` | boolean | `false` in static output. |
| `jumpLinkMessage` | string | Default `Read more` label. |
| `postImageUrl`, `pageImageUrl` | string | Default images for posts and pages. |
| `enabledCommentProfileImages` | boolean | Exposes comment avatars. |
| `sharing.platforms` | array | Sharing services with `{ key, name }`. |
| `searchUrl`, `searchLabel`, `searchQuery` | string | Search URL and current search terms. |
| `newerPageUrl`, `olderPageUrl` | string | Blogger-style pagination URLs. |
| `navMessage` | string | Empty by default. |
| `analytics4`, `analyticsAccountNumber` | string | Analytics ids; empty by default. |
| `adsenseClientId`, `adsenseHostId`, `adsenseMessage` | string | AdSense fields; empty by default. |

## `data:post`

These fields exist on both posts and the page-like value used on static pages:

| Field | Type | Meaning |
| --- | --- | --- |
| `id`, `title` | string | Item identity and title. |
| `body`, `content` | trusted HTML / string | Sanitized post HTML; `content` is added in content builds. |
| `snippet` | string | Plain-text excerpt. |
| `snippets`, `excerpt` | map / trusted HTML | Short and long HTML summaries. |
| `description` | string | Short description. |
| `url`, `canonical`, `shareUrl` | string | Permalink and sharing URL. |
| `link` | string | Permalink alias, added in content builds. |
| `date`, `timestamp`, `lastUpdated` | date | Publication and update dates. |
| `author` | map | `{ name, profileUrl, aboutMe, authorPhoto }`. |
| `authorProfileUrl`, `authorAvatarSrc` | string | Author links and image; the avatar field is mock-only. |
| `labels` | array | `{ name, url, isLast }` items. |
| `comments`, `numberOfComments`, `commentsUrl` | array / number / string | Comment list, count and `#comments` link. |
| `featuredImage`, `thumbnailUrl` | string | Featured image and smaller variant. |
| `allowComments`, `allowNewComments` | boolean | Comment availability. |
| `viewType` | string | `post` for posts, `page` for static pages. |

```xml
<article class='post'>
  <h1><data:post.title/></h1>
  <p class='meta'>
    <a expr:href='data:post.authorProfileUrl'><data:post.author.name/></a>
    <span expr:datetime='data:post.date.iso8601'><data:post.date/></span>
    <a expr:href='data:post.commentsUrl'><data:post.numberOfComments/> comments</a>
  </p>
  <ul class='labels'>
    <b:loop values='data:post.labels' var='label'>
      <li><a expr:href='data:label.url'><data:label.name/></a></li>
    </b:loop>
  </ul>
  <div class='body'><data:post.body/></div>
</article>
```

Date values render as `January 1, 2026`; use `.iso8601` for a machine-readable
attribute. `.escaped` on a date returns the escaped ISO string, not the long date.

### Mock-only post fields

The deterministic preview adds byline, comment-form and pagination fields that
Blogger themes commonly read: `backlinks`, `reactions`, `reactionsUrl`,
`commentsUrlOnclick`, `location`, `allowIframeComments`, `embedCommentForm`,
`showThreadedComments`, `commentSource`, `commentSrc`, `commentHtml`, `commentJso`,
`commentConfig`, `commentMsgs`, `cmtfpIframe`, `iframeCommentSrc`,
`commentFormIframeSrc`, `appRpcRelayPath`, `commentRangeText`,
`noNewCommentsText`, `commentPagingRequired`, `hasOlderLinks`, `hasNewerLinks`,
`newerLinkUrl`, `olderLinkUrl`, `newestLinkUrl`, `oldestLinkUrl`, `newLinkClass`
and `oldLinkClass`.

Content builds do **not** provide those fields. `comments` is `[]` and
`numberOfComments` is `0` because JSON posts do not store comments.

### `data:page`

A static page has `id`, `title`, `body`, `snippet`, `snippets`, `url`, `canonical`,
`labels`, `featuredImage`, `allowComments`, `viewType` and `date`. Content builds
also provide `content`, `link`, `timestamp` and a full `author` map. Pages do not
have `excerpt`, `description`, `comments` or `numberOfComments`.

On a static-page scenario the same value is exposed as `data:page`, `data:post`
and the only item in `data:posts`, so a theme can render pages with post markup.

## Collections

### `data:posts`

An array of post maps. Use `b:loop` to iterate it, and `data:posts.first` or
`data:posts.length` for summaries. On post pages it contains one post; on home
pages it contains the current page of results.

### `data:labels`

| Context | Fields |
| --- | --- |
| Root `data:labels` in mock preview | `{ name, url, count }`. |
| Root `data:labels` in content builds | `{ name, url, isLast }`; count is not computed. |
| `data:post.labels` | `{ name, url, isLast }` in both modes. |

```xml
<ul class='label-cloud'>
  <b:loop values='data:labels' var='label'>
    <li><a expr:href='data:label.url'><data:label.name/></a></li>
  </b:loop>
</ul>
```

### `data:comments`

Items have `id`, `author`, `authorUrl`, `authorAvatarSrc`, `body`, `timestamp`,
`url`, `deleteUrl`, `adminClass` and `isDeleted`. These are deterministic preview
comments; they are not populated from content files. The theme usually prefixes
the id when it renders the anchor, so comment `1` becomes `id="c1"`.

### `data:widgets`

Each item has `type`, `id`, `title`, `instanceId`, `sectionId` and `settings`.
The array also carries type keys, so `data:widgets.Blog.first` returns the first
Blog widget. Inside a widget's `main` includable the individual settings are
available directly, and `this`/`widget` alias the widget map:

```xml
<b:widget id='Label1' type='Label' title='Topics'>
  <b:widget-settings>
    <b:widget-setting name='title'>Topics</b:widget-setting>
    <b:widget-setting name='shownum'>5</b:widget-setting>
  </b:widget-settings>
  <b:includable id='main'>
    <h3><data:title/></h3>
    <b:loop values='data:labels limit 5' var='label'>
      <a expr:href='data:label.url'><data:label.name/></a>
    </b:loop>
  </b:includable>
</b:widget>
```

### `data:archive` and `data:search`

`data:archive.rangeMessage` is a localized month and year. `data:search` has
`label`, `query` and `resultsMessageHtml`. The same maps are also available as
`data:view.archive` and `data:view.search` on their respective views. Static
output cannot represent query strings, so `query` is empty in content builds.

### `data:messages`

`data:messages` is a fixed catalog used by Blogger themes. Common keys include
`share`, `comments`, `noComments`, `authorSaid`, `readMore`, `home`, `newer`,
`older`, `searchThisBlog`, `labels`, `archive`, `postedBy`, `by`, `subscribe`
and `poweredBy`. Use `b:message` when a message contains placeholders:

```xml
<b:message name='messages.authorSaidWithLink'>
  <b:param expr:value='data:comment.author' name='authorName'/>
  <b:param expr:value='data:comment.authorUrl' name='authorUrl'/>
</b:message>
```

### `data:settings`, `data:skin` and `data:allBylineItems`

`data:settings` exposes `title`, `description`, `postsPerPage`,
`commentsEnabled` and `showCommentLink`. `data:skin.vars` exposes `keycolor`,
`bodyBackground`, `bodyTextColor` and `linkColor`.

`data:allBylineItems` is a map keyed by `author`, `timestamp`, `comments`,
`share`, `location`, `labels`, `reactions`, `backlinks` and `icons`; each value
has `name` and `label`. Widgets receive the same list as an array in
`data:allBylineItems`.

## Preview and content differences

| Area | Mock preview | Content builds |
| --- | --- | --- |
| Posts and pages | Four fixed posts, one page | Published JSON posts and pages |
| Dates | Fixed base date of January 2026 | `publishAt`, `publishedAt` or `createdAt` |
| Comments | Two deterministic comments | Root comments remain mock; `data:post.comments` is empty |
| Widgets and messages | Built-in deterministic data | Same built-in deterministic data |
| `data:blog.title` | `Guchho Blogger Preview` | `data/settings.json` title |
| Optional post fields | Comment form, reactions, location, pagination | `content` and `link` |

`mockData` option overrides are deep-merged into this map, so a theme test can
replace any field without changing the template. See
[Plugin options](../reference/plugin-options.md) for the override syntax and
[Programmatic API](../reference/programmatic-api.md) for direct rendering.

## Related reading

- [Content model](../concepts/content-model.md) — the JSON fields behind `data:post`.
- [Rendering and routes](../concepts/rendering.md) — how content becomes scenarios.
- [Blogger compatibility](../blogger-compatibility.md) — operators, helpers and escaping rules.
