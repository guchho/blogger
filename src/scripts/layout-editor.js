(function () {
  'use strict';
  var payloadNode = document.getElementById('layout-editor-payload');
  var host = document.getElementById('layout-editor-shadow-host');
  if (!payloadNode || !host) return;
  var payload;
  try { payload = JSON.parse(payloadNode.textContent || '{}'); } catch (error) { return; }
  if (!payload.model || !payload.client) return;
  var BLOG_POSTS = payload.client.blogPosts;
  var BF = BLOG_POSTS.fields;
  var BS = BLOG_POSTS.setting;
  var LINKLIST = payload.client.linkList;
  var LL = LINKLIST.fields;
  var LS = LINKLIST.setting;

  var original = clone(payload.model);
  var model = clone(original);
  var operations = [];
  var currentHash = model.hash;
  var drag = null;
  var drop = null;
  var confirmCallback = null;
  var pendingAdd = null;
  var catalogTrigger = null;
  var activeDialog = null;
  var activeTrigger = null;
  var dialogSnapshots = {};
  var shadow = host.shadowRoot || host.attachShadow({ mode: 'open' });

  function clone(value) { return JSON.parse(JSON.stringify(value)); }

  function esc(value) {
    return String(value === null || value === undefined ? '' : value)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function icon(name) {
    if (name === 'plus') return '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M12 5v14M5 12h14"/></svg>';
    if (name === 'settings') return '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-2.8 2.8-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.6v.2h-4V21a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1L4.2 17l.1-.1a1.7 1.7 0 0 0 .3-1.9 1.7 1.7 0 0 0-1.6-1H3v-4h.2a1.7 1.7 0 0 0 1.6-1 1.7 1.7 0 0 0-.3-1.9L4.4 7.1 7.2 4.3l.1.1a1.7 1.7 0 0 0 1.9.3 1.7 1.7 0 0 0 1-1.6V3h4v.2a1.7 1.7 0 0 0 1 1.6 1.7 1.7 0 0 0 1.9-.3l.1-.1 2.8 2.8-.1.1a1.7 1.7 0 0 0-.3 1.9 1.7 1.7 0 0 0 1.6 1h.2v4H21a1.7 1.7 0 0 0-1.6 1Z"/></svg>';
    if (name === 'edit') return '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M4 20h4l11-11-4-4L4 16v4Z"/><path d="m14 6 4 4"/></svg>';
    if (name === 'trash') return '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M5 7h14M9 7V4h6v3M7 7l1 13h8l1-13"/></svg>';
    if (name === 'eye') return '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M2 12s3.6-6 10-6 10 6 10 6-3.6 6-10 6-10-6-10-6Z"/><circle cx="12" cy="12" r="2.5"/></svg>';
    if (name === 'eye-off') return '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M3 3l18 18M10.6 6.2A11.6 11.6 0 0 1 12 6c6.4 0 10 6 10 6a17.4 17.4 0 0 1-3.2 3.7M6.6 7.7C3.9 9.3 2 12 2 12s3.6 6 10 6a10.6 10.6 0 0 0 4-.8M9.7 9.7a3 3 0 0 0 4.2 4.2"/></svg>';
    if (name === 'grip') return '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M9 5h.01M15 5h.01M9 12h.01M15 12h.01M9 19h.01M15 19h.01"/></svg>';
    if (name === 'copy') return '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h3"/></svg>';
    if (name === 'move') return '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M12 3v18M3 12h18M12 3l-3 3M12 3l3 3M12 21l-3-3M12 21l3-3M3 12l3-3M3 12l3 3M21 12l-3-3M21 12l-3 3"/></svg>';
    if (name === 'chevron') return '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="m6 9 6 6 6-6"/></svg>';
    if (name === 'up') return '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="m6 15 6-6 6 6"/></svg>';
    if (name === 'down') return '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="m6 9 6 6 6-6"/></svg>';
    return '';
  }

  function byId(list, id) {
    for (var i = 0; i < list.length; i++) if (list[i].id === id) return list[i];
    return undefined;
  }

  function findWidget(id) {
    for (var i = 0; i < model.sections.length; i++) {
      var widget = byId(model.sections[i].widgets, id);
      if (widget) return { section: model.sections[i], widget: widget };
    }
    return null;
  }

  function gadgetDef(type) {
    var catalog = payload.gadgetCatalog || [];
    for (var i = 0; i < catalog.length; i++) if (catalog[i].type === type) return catalog[i];
    return null;
  }

  function widgetLabel(type) {
    var def = gadgetDef(type);
    return (def && def.label) || (payload.widgetTypeLabels && payload.widgetTypeLabels[type]) || type;
  }

  function capabilities(type) {
    var def = gadgetDef(type);
    return (def && def.capabilities) || { configurable: true, duplicable: true, removable: true, movable: true, canHide: true };
  }

  function countInstances(type) {
    var count = 0;
    for (var i = 0; i < model.sections.length; i++) {
      var widgets = model.sections[i].widgets;
      for (var j = 0; j < widgets.length; j++) if (widgets[j].type === type) count++;
    }
    return count;
  }

  function canAddType(type, section) {
    if (!section || section.showaddelement === false) return false;
    if (section.maxwidgets !== undefined && section.maxwidgets !== null && section.maxwidgets >= 0 && section.widgets.length >= section.maxwidgets) return false;
    var caps = capabilities(type);
    if (caps.maxInstances !== undefined && countInstances(type) >= caps.maxInstances) return false;
    var allowed = caps.allowedSectionIds;
    return !allowed || allowed.length === 0 || allowed.indexOf(section.id) >= 0;
  }

  function announce(text) {
    var live = document.getElementById('layout-editor-live');
    if (!live) return;
    live.textContent = '';
    window.setTimeout(function () { live.textContent = text; }, 20);
  }

  function isFieldVisible(field, values) {
    var cond = field.showIf;
    if (!cond) return true;
    var actual = values[cond.key];
    if (cond.equals !== undefined) return String(actual) === String(cond.equals);
    if (cond.notEquals !== undefined) return String(actual) !== String(cond.notEquals);
    if (cond.truthy) return actual === 'true' || (!!actual && actual !== 'false' && actual !== '0');
    if (cond.falsy) return !actual || actual === 'false' || actual === '0' || actual === '';
    return true;
  }

  function blogValue(settings, key) {
    return settings && settings[key] !== undefined ? settings[key] : BLOG_POSTS.defaults[key];
  }

  function blogChecked(id) {
    var node = dialog(id);
    return !!node && node.checked;
  }

  function blogInput(id) {
    var node = dialog(id);
    return node ? node.value : '';
  }

  function blogSetToggle(id, settings, key) {
    var node = dialog(id);
    if (node) node.checked = blogValue(settings, key) === 'true';
  }

  function blogSetText(id, settings, key) {
    var node = dialog(id);
    if (node) node.value = blogValue(settings, key);
  }

  function blogSetVisible(id, visible) {
    var node = dialog(id);
    if (node) node.hidden = !visible;
  }

  function blogSetFormat(value) {
    var inputs = document.getElementsByName(BLOG_POSTS.dateFormatName);
    var selected = BLOG_POSTS.dateFormatValues.indexOf(value) >= 0 ? value : BLOG_POSTS.defaults[BS.dateFormat];
    for (var i = 0; i < inputs.length; i++) inputs[i].checked = inputs[i].value === selected;
  }

  function blogSelectedFormat() {
    var inputs = document.getElementsByName(BLOG_POSTS.dateFormatName);
    for (var i = 0; i < inputs.length; i++) if (inputs[i].checked) return inputs[i].value;
    return BLOG_POSTS.defaults[BS.dateFormat];
  }

  function blogFindItem(id) {
    for (var i = 0; i < BLOG_POSTS.items.length; i++) {
      if (BLOG_POSTS.items[i].id === id) return BLOG_POSTS.items[i];
    }
    return null;
  }

  function blogItemMarkup(item) {
    return '<span class="le-blog-grip" aria-hidden="true"><svg viewBox="0 0 24 24" focusable="false"><circle cx="9" cy="6" r="1"/><circle cx="15" cy="6" r="1"/><circle cx="9" cy="12" r="1"/><circle cx="15" cy="12" r="1"/><circle cx="9" cy="18" r="1"/><circle cx="15" cy="18" r="1"/></svg></span><span>' + esc(item.label) + '</span>';
  }

  function blogSetOrder(order) {
    var list = dialog(BF.items);
    if (!list) return;
    list.textContent = '';
    for (var i = 0; i < order.length; i++) {
      var item = blogFindItem(order[i]);
      if (!item) continue;
      var row = document.createElement('li');
      row.className = 'le-blog-item';
      row.draggable = true;
      row.setAttribute('data-blog-item', item.id);
      row.innerHTML = blogItemMarkup(item);
      list.appendChild(row);
    }
  }

  function blogOrderFromDom() {
    var list = dialog(BF.items);
    var order = [];
    if (!list) return order;
    var rows = list.querySelectorAll('.le-blog-item');
    for (var i = 0; i < rows.length; i++) {
      var id = rows[i].getAttribute('data-blog-item');
      if (blogFindItem(id)) order.push(id);
    }
    return order;
  }

  function blogParseOrder(value) {
    var requested = String(value || '').split(',');
    var order = [];
    for (var i = 0; i < requested.length; i++) {
      var id = requested[i].trim();
      if (blogFindItem(id) && order.indexOf(id) < 0) order.push(id);
    }
    for (var j = 0; j < BLOG_POSTS.items.length; j++) {
      var fallback = BLOG_POSTS.items[j].id;
      if (order.indexOf(fallback) < 0) order.push(fallback);
    }
    return order;
  }

  function syncBlogFields() {
    blogSetVisible(BF.authorPrefixField, blogChecked(BF.showAuthor));
    blogSetVisible(BF.publishPrefixField, blogChecked(BF.showTimestamp));
    blogSetVisible(BF.dateFormatField, blogChecked(BF.showTimestamp));
    blogSetVisible(BF.commentLabelField, blogChecked(BF.showCommentCount));
    blogSetVisible(BF.labelsPrefixField, blogChecked(BF.showLabels));
    blogSetVisible(BF.adsSettingsField, blogChecked(BF.showAds));
  }

  function openBlogPosts(found, trigger) {
    var settings = found.widget.settings || {};
    dialog(BF.showWidget).checked = found.widget.visible !== false;
    blogSetText(BF.postsPerPage, settings, BS.postsPerPage);
    blogSetText(BF.jumpLinkText, settings, BS.jumpLinkText);
    blogSetToggle(BF.showDateHeader, settings, BS.showDateHeader);
    blogSetToggle(BF.showAuthor, settings, BS.showAuthor);
    blogSetText(BF.authorPrefix, settings, BS.authorLabel);
    blogSetToggle(BF.showTimestamp, settings, BS.showTimestamp);
    blogSetText(BF.publishPrefix, settings, BS.timestampLabel);
    blogSetFormat(blogValue(settings, BS.dateFormat));
    blogSetToggle(BF.showCommentCount, settings, BS.showCommentLink);
    blogSetText(BF.commentLabel, settings, BS.commentLabel);
    blogSetToggle(BF.showLabels, settings, BS.showLabels);
    blogSetText(BF.labelsPrefix, settings, BS.postLabelsLabel);
    blogSetToggle(BF.showEmailPostLink, settings, BS.showEmailPostLink);
    blogSetToggle(BF.showShareButtons, settings, BS.showShareButtons);
    blogSetToggle(BF.showLocation, settings, BS.showLocation);
    blogSetToggle(BF.showAuthorProfile, settings, BS.showAuthorProfile);
    var ads = BLOG_POSTS.adsSetting;
    blogSetToggle(BF.showAds, settings, ads.showAdsBetweenPosts);
    blogSetText(BF.postsPerAd, settings, ads.postsPerAd);
    var format = dialog(BF.adFormat);
    if (format) {
      var selected = blogValue(settings, ads.adFormat);
      format.value = BLOG_POSTS.adFormats.some(function (item) { return item.value === selected; }) ? selected : BLOG_POSTS.defaults[ads.adFormat];
    }
    blogSetOrder(blogParseOrder(settings[BS.postItemOrder]));
    syncBlogFields();
    openDialog(dialog(BLOG_POSTS.dialogId), trigger);
  }

  function blogSettingsFromForm(found) {
    var settings = clone(found.widget.settings || {});
    var posts = Number(blogInput(BF.postsPerPage));
    var fallback = Number(BLOG_POSTS.defaults[BS.postsPerPage]);
    if (!isFinite(posts) || posts < 1) posts = isFinite(fallback) && fallback > 0 ? fallback : 10;
    settings[BS.postsPerPage] = String(Math.trunc(posts));
    settings[BS.jumpLinkText] = blogInput(BF.jumpLinkText);
    settings[BS.showDateHeader] = String(blogChecked(BF.showDateHeader));
    settings[BS.showAuthor] = String(blogChecked(BF.showAuthor));
    settings[BS.authorLabel] = blogInput(BF.authorPrefix);
    settings[BS.showTimestamp] = String(blogChecked(BF.showTimestamp));
    settings[BS.timestampLabel] = blogInput(BF.publishPrefix);
    settings[BS.dateFormat] = blogSelectedFormat();
    settings[BS.showCommentLink] = String(blogChecked(BF.showCommentCount));
    settings[BS.commentLabel] = blogInput(BF.commentLabel);
    settings[BS.showLabels] = String(blogChecked(BF.showLabels));
    settings[BS.postLabelsLabel] = blogInput(BF.labelsPrefix);
    settings[BS.showEmailPostLink] = String(blogChecked(BF.showEmailPostLink));
    settings[BS.showShareButtons] = String(blogChecked(BF.showShareButtons));
    settings[BS.showLocation] = String(blogChecked(BF.showLocation));
    settings[BS.showAuthorProfile] = String(blogChecked(BF.showAuthorProfile));
    var ads = BLOG_POSTS.adsSetting;
    settings[ads.showAdsBetweenPosts] = String(blogChecked(BF.showAds));
    settings[ads.postsPerAd] = blogInput(BF.postsPerAd);
    settings[ads.adFormat] = blogInput(BF.adFormat);
    settings[BS.postItemOrder] = blogOrderFromDom().join(',');
    return settings;
  }

  function submitBlogPosts() {
    var found = findWidget(BLOG_POSTS.widgetId);
    if (!found || found.widget.type !== 'Blog') {
      message('Blog1 widget was not found', 'error');
      return false;
    }
    var ok = apply({
      kind: 'editWidget',
      widgetId: BLOG_POSTS.widgetId,
      changes: { visible: blogChecked(BF.showWidget), settings: blogSettingsFromForm(found) }
    });
    if (ok) closeDialog(dialog(BLOG_POSTS.dialogId), true);
    return ok;
  }

  var blogDragItem = null;

  function clearBlogDrag() {
    if (blogDragItem) blogDragItem.classList.remove('le-blog-dragging');
    blogDragItem = null;
  }

  function setupBlogItemDrag() {
    var list = dialog(BF.items);
    if (!list) return;
    list.addEventListener('dragstart', function (event) {
      var item = event.target.closest ? event.target.closest('.le-blog-item') : null;
      if (!item) return;
      blogDragItem = item;
      event.dataTransfer.setData('text/plain', item.getAttribute('data-blog-item'));
      event.dataTransfer.effectAllowed = 'move';
      item.classList.add('le-blog-dragging');
    });
    list.addEventListener('dragover', function (event) {
      if (!blogDragItem) return;
      var target = event.target.closest ? event.target.closest('.le-blog-item') : null;
      if (!target || target === blogDragItem) return;
      event.preventDefault();
      event.dataTransfer.dropEffect = 'move';
      var box = target.getBoundingClientRect();
      if (event.clientY < box.top + box.height / 2) list.insertBefore(blogDragItem, target);
      else list.insertBefore(blogDragItem, target.nextSibling);
    });
    list.addEventListener('drop', function (event) {
      if (!blogDragItem) return;
      event.preventDefault();
      clearBlogDrag();
    });
    list.addEventListener('dragend', clearBlogDrag);
  }

  function linkListIndexedKey(key) { return /^(text|link)-\d+$/.test(key); }

  function linkListValidUrl(value) {
    var url = String(value || '').trim();
    if (!url || /[\s<>"']/.test(url)) return false;
    if (/^https?:\/\/[^\s]+$/i.test(url)) return true;
    if (/^[a-z][a-z0-9+.-]*:/i.test(url)) return false;
    return true;
  }

  function linkListLinksFromText(text) {
    var links = [];
    var lines = String(text === null || text === undefined ? '' : text).split(/\r?\n/);
    for (var i = 0; i < lines.length; i++) {
      var line = lines[i];
      var at = line.indexOf(LINKLIST.linksSeparator);
      var name = (at < 0 ? line : line.slice(0, at)).trim();
      var url = at < 0 ? '' : line.slice(at + LINKLIST.linksSeparator.length).trim();
      if (name === '' && url === '') continue;
      links.push({ name: name, url: url });
    }
    return links;
  }

  function linkListLinksFromSettings(settings) {
    var values = settings || {};
    var indices = {};
    for (var key in values) {
      if (!values.hasOwnProperty(key)) continue;
      var match = /^(?:text|link)-(\d+)$/.exec(key);
      if (match) indices[match[1]] = true;
    }
    if (Object.keys(indices).length === 0 && typeof values[LS.legacyLinks] === 'string') {
      return linkListLinksFromText(values[LS.legacyLinks]);
    }
    return Object.keys(indices).map(Number).sort(function (a, b) { return a - b; }).map(function (index) {
      return { name: String(values['text-' + index] || ''), url: String(values['link-' + index] || '') };
    });
  }

  function linkListRows() {
    var list = dialog(LL.linksList);
    if (!list) return [];
    return Array.prototype.slice.call(list.querySelectorAll('.le-linklist-row'));
  }

  function linkListRowMarkup(index) {
    var errorId = LL.linksList + '-row-error-' + index;
    return '<label class="layout-editor-field"><span>Site Name</span>' +
      '<input class="field" type="text" data-linklist-name aria-describedby="' + errorId + '"></label>' +
      '<label class="layout-editor-field"><span>Site URL</span>' +
      '<input class="field" type="text" data-linklist-url aria-describedby="' + errorId + '"></label>' +
      '<span class="le-linklist-actions">' +
      '<button type="button" class="le-linklist-action le-linklist-delete" data-linklist-action="delete" aria-label="Delete this item" title="Delete this item">' + icon('trash') + '</button>' +
      '<button type="button" class="le-linklist-action" data-linklist-action="up" aria-label="Move this item up" title="Move this item up">' + icon('up') + '</button>' +
      '<button type="button" class="le-linklist-action" data-linklist-action="down" aria-label="Move this item down" title="Move this item down">' + icon('down') + '</button>' +
      '</span>' +
      '<small class="le-linklist-error" id="' + errorId + '" role="alert" data-linklist-error></small>';
  }

  function linkListCreateRow(link, index) {
    var row = document.createElement('div');
    row.className = 'le-linklist-row';
    row.setAttribute('data-linklist-index', String(index));
    row.innerHTML = linkListRowMarkup(index);
    var name = row.querySelector('[data-linklist-name]');
    var url = row.querySelector('[data-linklist-url]');
    if (name) name.value = link.name;
    if (url) url.value = link.url;
    return row;
  }

  function linkListRenderRows(links) {
    var list = dialog(LL.linksList);
    if (!list) return;
    list.textContent = '';
    for (var i = 0; i < links.length; i++) list.appendChild(linkListCreateRow(links[i], i));
    linkListRefreshRowButtons();
  }

  function linkListRefreshRowButtons() {
    var rows = linkListRows();
    for (var i = 0; i < rows.length; i++) {
      rows[i].setAttribute('data-linklist-index', String(i));
      var errorId = LL.linksList + '-row-error-' + i;
      var error = rows[i].querySelector('[data-linklist-error]');
      if (error) error.id = errorId;
      var inputs = rows[i].querySelectorAll('[data-linklist-name],[data-linklist-url]');
      for (var j = 0; j < inputs.length; j++) inputs[j].setAttribute('aria-describedby', errorId);
      var up = rows[i].querySelector('[data-linklist-action="up"]');
      var down = rows[i].querySelector('[data-linklist-action="down"]');
      if (up) up.disabled = i === 0;
      if (down) down.disabled = i === rows.length - 1;
    }
    var empty = dialog(LL.linksEmpty);
    if (empty) empty.hidden = rows.length > 0;
  }

  function linkListLinksFromRows() {
    var rows = linkListRows();
    var links = [];
    for (var i = 0; i < rows.length; i++) {
      var name = rows[i].querySelector('[data-linklist-name]');
      var url = rows[i].querySelector('[data-linklist-url]');
      links.push({
        name: String((name && name.value) || '').trim(),
        url: String((url && url.value) || '').trim()
      });
    }
    return links;
  }

  function linkListSortingValue(value) {
    var sorting = String(value === null || value === undefined ? '' : value || LINKLIST.defaults[LS.sorting]);
    return LINKLIST.sortingOptions.some(function (option) { return option.value === sorting; })
      ? sorting
      : LINKLIST.defaults[LS.sorting];
  }

  function linkListSortName(value) {
    return String(value === null || value === undefined ? '' : value).replace(/<[^>]*>/g, '').trim().toLowerCase();
  }

  function linkListSortLinks(links, sorting) {
    if (sorting === 'NONE' || links.length < 2) return links.slice();
    var direction = sorting === 'REVERSE_ALPHABETICAL' ? -1 : 1;
    return links.map(function (link, position) { return { link: link, position: position }; }).sort(function (left, right) {
      var a = linkListSortName(left.link.name);
      var b = linkListSortName(right.link.name);
      if (a < b) return -1 * direction;
      if (a > b) return 1 * direction;
      return left.position - right.position;
    }).map(function (item) { return item.link; });
  }

  function linkListSetManualSorting() {
    var sorting = dialog(LL.sorting);
    if (!sorting || sorting.value === LINKLIST.defaults[LS.sorting]) return false;
    sorting.value = LINKLIST.defaults[LS.sorting];
    return true;
  }

  function linkListAddRow() {
    var rows = linkListRows();
    var row = linkListCreateRow({ name: '', url: '' }, rows.length);
    var list = dialog(LL.linksList);
    if (!list) return;
    list.appendChild(row);
    linkListRefreshRowButtons();
    linkListClearErrors();
    var input = row.querySelector('[data-linklist-name]');
    if (input) input.focus();
    announce('New item added.');
  }

  function linkListFocusRow(row) {
    if (!row) return;
    var input = row.querySelector('[data-linklist-name]') || row.querySelector('[data-linklist-url]');
    if (!input) return;
    input.focus();
    if (input.select) input.select();
  }

  function linkListDeleteRow(row) {
    var list = dialog(LL.linksList);
    if (!list || !row) return;
    var index = linkListRows().indexOf(row);
    list.removeChild(row);
    linkListRefreshRowButtons();
    linkListClearErrors();
    var rows = linkListRows();
    var next = rows[Math.min(index, rows.length - 1)];
    var focusTarget = next ? (next.querySelector('[data-linklist-name]') || next.querySelector('[data-linklist-url]')) : dialog(LL.addLink);
    if (focusTarget && focusTarget.focus) focusTarget.focus();
    announce('Item deleted.');
  }

  function linkListMoveRow(row, direction) {
    var list = dialog(LL.linksList);
    if (!list || !row) return;
    var sibling = direction === 'up' ? row.previousElementSibling : row.nextElementSibling;
    if (!sibling || !sibling.hasAttribute('data-linklist-index')) return;
    if (direction === 'up') list.insertBefore(row, sibling);
    else list.insertBefore(sibling, row);
    var sortingChanged = linkListSetManualSorting();
    linkListRefreshRowButtons();
    linkListClearErrors();
    var moveButton = row.querySelector('[data-linklist-action="' + direction + '"]');
    if (moveButton && !moveButton.disabled) moveButton.focus();
    else linkListFocusRow(row);
    announce('Item moved ' + direction + (sortingChanged ? '. Sort links set to Don\'t sort.' : ''));
  }

  function linkListClearErrors() {
    var names = [LL.titleError, LL.shownumError, LL.linksError];
    for (var i = 0; i < names.length; i++) {
      var node = dialog(names[i]);
      if (node) node.textContent = '';
    }
    var rows = linkListRows();
    for (var j = 0; j < rows.length; j++) {
      var rowError = rows[j].querySelector('[data-linklist-error]');
      if (rowError) rowError.textContent = '';
    }
  }

  function linkListValidateForm() {
    linkListClearErrors();
    var title = dialog(LL.title);
    var advancedTitle = dialog(LL.advancedTitle);
    var titleValue = (title && title.value.length > LINKLIST.titleMaxLength) ? title.value : '';
    if (advancedTitle && advancedTitle.value.length > LINKLIST.titleMaxLength) titleValue = advancedTitle.value;
    if (titleValue !== '') {
      var titleError = dialog(LL.titleError);
      if (titleError) titleError.textContent = 'Title must be at most ' + LINKLIST.titleMaxLength + ' characters.';
      message('Title must be at most ' + LINKLIST.titleMaxLength + ' characters.', 'error');
      (title || advancedTitle).focus();
      return false;
    }
    var shownum = dialog(LL.shownum);
    var shownumValue = shownum ? String(shownum.value || '').trim() : '';
    if (shownumValue !== '' && !/^[1-9]\d*$/.test(shownumValue)) {
      var shownumError = dialog(LL.shownumError);
      if (shownumError) shownumError.textContent = 'Show must be a whole number of at least 1, or blank to show all links.';
      message('Show must be a whole number of at least 1, or blank to show all links.', 'error');
      shownum.focus();
      return false;
    }
    var links = linkListLinksFromRows();
    var rows = linkListRows();
    var problems = [];
    var firstInvalid = null;
    for (var i = 0; i < links.length; i++) {
      var itemProblems = [];
      if (links[i].name === '') itemProblems.push('Site Name is required.');
      if (links[i].url === '') itemProblems.push('Site URL is required.');
      else if (!linkListValidUrl(links[i].url)) itemProblems.push('Use a relative URL or http:// or https://.');
      if (itemProblems.length === 0) continue;
      var rowError = rows[i].querySelector('[data-linklist-error]');
      if (rowError) rowError.textContent = itemProblems.join(' ');
      for (var p = 0; p < itemProblems.length; p++) problems.push('Item ' + (i + 1) + ': ' + itemProblems[p]);
      if (!firstInvalid) firstInvalid = rows[i];
    }
    if (problems.length > 0) {
      var linksError = dialog(LL.linksError);
      if (linksError) linksError.textContent = problems.join(' ');
      message('Fix the highlighted link settings before applying.', 'error');
      if (firstInvalid) linkListFocusRow(firstInvalid);
      return false;
    }
    return true;
  }

  function linkListSettingsFromForm(found) {
    var settings = clone(found && found.widget.settings ? found.widget.settings : LINKLIST.defaults);
    for (var key in settings) {
      if (settings.hasOwnProperty(key) && (key === LS.legacyLinks || linkListIndexedKey(key))) delete settings[key];
    }
    var sorting = dialog(LL.sorting);
    var shownum = dialog(LL.shownum);
    var sortingValue = sorting ? sorting.value : LINKLIST.defaults[LS.sorting];
    var previous = linkListSortingValue(found && found.widget.settings ? found.widget.settings[LS.sorting] : LINKLIST.defaults[LS.sorting]);
    var links = linkListLinksFromRows();
    if (sortingValue !== previous) links = linkListSortLinks(links, sortingValue);
    settings[LS.sorting] = sortingValue;
    settings[LS.shownum] = shownum ? String(shownum.value || '').trim() : '';
    for (var i = 0; i < links.length; i++) {
      settings['text-' + i] = links[i].name;
      settings['link-' + i] = links[i].url;
    }
    return settings;
  }

  function openLinkList(found, trigger, isAdd) {
    var settings = found && found.widget.settings ? found.widget.settings : LINKLIST.defaults;
    var sorting = linkListSortingValue(settings[LS.sorting]);
    var title = found ? (found.widget.title || '') : 'Link List';
    var visible = found ? found.widget.visible !== false : true;
    dialog(LL.widgetId).value = found ? found.widget.id : '';
    dialog(LL.title).value = title;
    dialog(LL.advancedTitle).value = title;
    dialog(LL.visible).checked = visible;
    dialog(LL.advancedVisible).checked = visible;
    dialog(LL.locked).checked = found ? !!found.widget.locked : false;
    dialog(LL.version).value = found ? (found.widget.version || '') : '2';
    dialog(LL.sorting).value = sorting;
    dialog(LL.shownum).value = settings[LS.shownum] === undefined ? '' : settings[LS.shownum];
    linkListRenderRows(linkListLinksFromSettings(settings));
    var advanced = dialog(LINKLIST.advancedId);
    if (advanced) advanced.open = false;
    linkListClearErrors();
    setDialogTitle(LINKLIST.dialogId, isAdd ? 'Add Link List' : 'Edit gadget');
    openDialog(dialog(LINKLIST.dialogId), trigger);
  }

  function submitLinkList() {
    if (!linkListValidateForm()) return false;
    var titleNode = dialog(LL.title);
    var title = titleNode ? titleNode.value.trim() : '';
    var visibleNode = dialog(LL.visible);
    var visible = visibleNode ? visibleNode.checked : true;
    var current = findWidget(dialog(LL.widgetId).value);
    var settings = linkListSettingsFromForm(current);
    if (pendingAdd && pendingAdd.type === LINKLIST.widgetType) {
      var added = apply({ kind: 'addWidget', sectionId: pendingAdd.sectionId, widgetType: LINKLIST.widgetType, title: title, settings: settings });
      if (added) {
        pendingAdd = null;
        closeDialog(dialog(LINKLIST.dialogId), true);
        closeCatalog();
      }
      return added;
    }
    if (!current) {
      message('Link List widget was not found', 'error');
      return false;
    }
    var lockedNode = dialog(LL.locked);
    var versionNode = dialog(LL.version);
    var changes = { title: title, visible: visible, settings: settings };
    if (lockedNode) changes.locked = lockedNode.checked;
    if (versionNode) changes.version = versionNode.value;
    var ok = apply({ kind: 'editWidget', widgetId: current.widget.id, changes: changes });
    if (ok) closeDialog(dialog(LINKLIST.dialogId), true);
    return ok;
  }

  function message(text, kind) {
    var banner = document.getElementById('layout-editor-message');
    if (!banner) return;
    banner.textContent = text;
    banner.className = 'layout-editor-message' + (kind ? ' ' + kind : '');
    banner.hidden = text === '';
    if (text && kind === 'error') announce(text);
  }

  function dirty() {
    var badge = document.getElementById('layout-editor-status');
    if (badge) {
      badge.textContent = operations.length === 0 ? 'All changes saved' : 'Unsaved changes (' + operations.length + ')';
      badge.setAttribute('data-state', operations.length === 0 ? 'saved' : 'dirty');
    }
    var save = document.getElementById('layout-editor-save');
    if (save) save.disabled = operations.length === 0;
    var reset = document.getElementById('layout-editor-reset');
    if (reset) reset.disabled = operations.length === 0;
  }

  function sectionHtml(section) {
    var label = section.name || section.id;
    var widgets = '';
    for (var i = 0; i < section.widgets.length; i++) {
      var widget = section.widgets[i];
      widgets += widgetHtml(widget, section.id) + '<div class="dropregion dropregion_v" aria-hidden="true"></div>';
    }
    var canAdd = section.showaddelement !== false &&
      (section.maxwidgets === undefined || section.maxwidgets === null || section.maxwidgets < 0 || section.widgets.length < section.maxwidgets);
    var add = canAdd
      ? '<div class="add_widget"><span class="add-icon">+</span><button type="button" class="le-add" data-action="add-gadget" data-section-id="' + esc(section.id) + '">Add a Gadget</button></div>'
      : '';
    var classes = ['section', 'le-section'];
    if (section.className) classes.push(section.className);
    if (section.widgets.length === 0) classes.push('no-items');
    var attrs = ' id="' + esc(section.id) + '" data-section-id="' + esc(section.id) + '" name="' + esc(label) + '"';
    if (section.growth) attrs += ' growth="' + esc(section.growth) + '"';
    if (section.maxwidgets !== undefined && section.maxwidgets !== null) attrs += ' maxwidgets="' + esc(section.maxwidgets) + '"';
    attrs += ' showaddelement="' + (section.showaddelement ? 'true' : 'false') + '"';
    var settings = '<button type="button" class="le-section-settings" data-action="section-settings" data-section-id="' + esc(section.id) + '" title="Section settings" aria-label="Settings for ' + esc(label) + '">' + icon('settings') + '</button>';
    var dropStart = '<div class="dropregion dropregion_v" aria-hidden="true"></div>';
    return '<div class="' + esc(classes.join(' ')) + '"' + attrs + '>' +
      '<h4><span class="le-section-title"><span class="le-section-count">' + section.widgets.length + '</span>' + esc(label) + '</span>' + settings + '</h4>' + add +
      '<div class="le-widgets" data-section-id="' + esc(section.id) + '" role="list" aria-label="Gadgets in ' + esc(label) + '">' + dropStart + widgets + '</div></div>';
  }

  function actionButton(action, widget, iconName, title, extraClass) {
    return '<button type="button" class="le-btn' + (extraClass ? ' ' + extraClass : '') + '" data-action="' + action + '" data-widget-id="' + esc(widget.id) + '" title="' + esc(title) + '" aria-label="' + esc(title) + '">' + icon(iconName) + '</button>';
  }

  function widgetHtml(widget, sectionId) {
    var defn = gadgetDef(widget.type);
    var label = widgetLabel(widget.type);
    var caps = capabilities(widget.type);
    var canRemove = !widget.locked && caps.removable !== false;
    var canEdit = caps.configurable !== false;
    var canMove = !widget.locked && caps.movable !== false;
    var actions = '';
    if (canEdit) actions += actionButton('edit-widget', widget, 'edit', 'Edit ' + label);
    if (canRemove) actions += actionButton('remove-widget', widget, 'trash', 'Remove ' + label, 'le-danger');
    actions += '<button type="button" class="le-btn" data-action="collapse-widget" data-widget-id="' + esc(widget.id) + '" title="Toggle details" aria-label="Toggle details for ' + esc(label) + '" aria-expanded="false">' + icon('chevron') + '</button>';
    var status = widget.visible === false ? '<span class="le-widget-hidden">Hidden</span>' : '';
    var detail = '<div class="le-widget-detail" hidden><span>' + esc(label) + ' · ' + esc(widget.type) + '</span>' +
      '<span>Id: ' + esc(widget.id) + '</span><span>Section: ' + esc(sectionId) + '</span>' +
      '<span>Version: ' + esc(widget.version || '2') + '</span>' +
      '<span class="le-gadget-card-badge le-gadget-card-badge-' + esc(defn ? defn.implemented : 'partial') + '">' +
      esc(defn ? defn.implemented : 'custom') + '</span></div>';
    return '<div class="widget le-widget ' + esc(widget.type) + (widget.locked ? ' locked-widget' : ' draggable-widget') + (widget.visible === false ? ' le-widget-is-hidden' : '') + '" draggable="' + (widget.locked || !canMove ? 'false' : 'true') + '"' +
      ' data-version="' + esc(widget.version || '2') + '" data-widget-id="' + esc(widget.id) + '" data-section-id="' + esc(sectionId) + '"' +
      ' role="listitem" aria-label="' + esc(widget.title || label) + '">' +
      '<div class="widget-wrap1"><div class="widget-wrap2"><div class="widget-wrap3"><div class="widget-content visibility"><div class="le-widget-row">' +
      '<span class="le-grip" aria-hidden="true">' + icon('grip') + '</span>' +
      '<div class="le-widget-copy"><div class="layout-title">' + esc(widget.title || label) + status + '</div>' +
      '<div class="layout-widget-description">' + esc(label) + ' · ' + esc(widget.id) + '</div></div>' +
      '<div class="layout-widget-state ' + (widget.visible !== false ? 'visible' : 'not-visible') + '" title="' + (widget.visible !== false ? 'Currently visible' : 'Currently hidden') + '">' + icon(widget.visible !== false ? 'eye' : 'eye-off') + '</div>' +
      '<span class="le-actions">' + actions + '</span>' +
      '</div>' + detail + '</div></div></div></div></div>';
  }

  function nodeHtml(node) {
    if (!node) return '';
    if (node.sectionId) {
      var section = byId(model.sections, node.sectionId);
      if (!section) return '';
      return sectionHtml(section);
    }
    var children = '';
    for (var i = 0; i < node.children.length; i++) children += nodeHtml(node.children[i]);
    if (children === '') return '';
    var id = node.id ? ' id="' + esc(node.id) + '"' : '';
    var label = node.id ? ' data-label="' + esc(node.id) + '"' : '';
    var classes = ['le-wrapper'];
    if (node.className) classes.push(node.className);
    var tag = /^[a-z][a-z0-9-]*$/.test(node.tag || '') ? node.tag : 'div';
    return '<' + tag + ' class="' + esc(classes.join(' ')) + '"' + id + label + '>' + children + '</' + tag + '>';
  }

  function structureHtml() {
    var nodes = clone(model.structure || []);
    var present = {};
    countSections(nodes, function (node) { present[node.sectionId] = true; });
    for (var i = 0; i < model.sections.length; i++) {
      var section = model.sections[i];
      if (present[section.id]) continue;
      nodes.push({ tag: 'b:section', id: section.id, className: section.className || '', sectionId: section.id, children: [] });
    }
    var html = '';
    for (var n = 0; n < nodes.length; n++) html += nodeHtml(nodes[n]);
    return html;
  }

  function countSections(nodes, visit) {
    for (var i = 0; i < nodes.length; i++) {
      if (nodes[i].sectionId) visit(nodes[i]);
      countSections(nodes[i].children || [], visit);
    }
  }

  function render() {
    shadow.textContent = '';
    var skin = document.createElement('link');
    skin.rel = 'stylesheet';
    skin.href = payload.client.skinCssUrl;
    shadow.appendChild(skin);
    var templateSkin = document.createElement('link');
    templateSkin.rel = 'stylesheet';
    templateSkin.href = payload.client.templateSkinCssUrl;
    shadow.appendChild(templateSkin);
    var style = document.createElement('style');
    style.textContent = (model.css.style || '') + '\n' + payload.client.editorCss;
    shadow.appendChild(style);
    var html = structureHtml();
    var page = document.createElement('body');
    page.id = 'layout';
    page.className = 'blogger-layout-page';
    page.innerHTML = html === ''
      ? '<p class="le-empty-state">No b:section elements were found in template.xml.</p>'
      : html;
    shadow.appendChild(page);
  }

  function simulate(operation) {
    var next = clone(model);
    var target, section, widget, index;
    switch (operation.kind) {
      case 'addWidget':
        section = byId(next.sections, operation.sectionId);
        if (!section) return { error: 'Section not found' };
        if (payload.widgetTypes.indexOf(operation.widgetType) < 0) return { error: 'Unknown widget type' };
        if (!canAddType(operation.widgetType, section)) return { error: 'This gadget cannot be added to this section or its instance limit was reached' };
        var used = {};
        for (var i = 0; i < next.sections.length; i++) for (var j = 0; j < next.sections[i].widgets.length; j++) used[next.sections[i].widgets[j].id] = true;
        var prefix = operation.widgetType.replace(/[^A-Za-z0-9]/g, '') || 'Widget';
        var id = prefix + '1';
        for (var n = 1; used[id]; n++) id = prefix + (n + 1);
        section.widgets.push({ id: id, type: operation.widgetType, title: operation.title || operation.widgetType, locked: false, visible: true, version: '2', sectionId: section.id, attributes: [], includables: ['main'], settings: operation.settings || {}, span: { start: 0, end: 0 } });
        break;
      case 'removeWidget':
        target = findWidgetIn(next, operation.widgetId);
        if (!target) return { error: 'Widget not found' };
        if (target.widget.locked) return { error: 'Locked widgets cannot be removed' };
        if (capabilities(target.widget.type).removable === false) return { error: 'This gadget cannot be removed' };
        target.section.widgets.splice(target.section.widgets.indexOf(target.widget), 1);
        break;
      case 'reorderWidget':
      case 'moveWidget':
        target = findWidgetIn(next, operation.widgetId);
        if (!target) return { error: 'Widget not found' };
        if (target.widget.locked) return { error: 'Locked widgets cannot be moved' };
        if (capabilities(target.widget.type).movable === false) return { error: 'This gadget cannot be moved' };
        section = operation.kind === 'moveWidget' ? byId(next.sections, operation.sectionId) : target.section;
        if (!section) return { error: 'Section not found' };
        var targetCaps = capabilities(target.widget.type);
        if (targetCaps.allowedSectionIds && targetCaps.allowedSectionIds.length && targetCaps.allowedSectionIds.indexOf(section.id) < 0) return { error: 'This gadget cannot be placed in that section' };
        if (section.maxwidgets !== undefined && section.maxwidgets !== null && section.maxwidgets >= 0 &&
            (operation.kind === 'moveWidget' || section !== target.section) && section.widgets.length >= section.maxwidgets) return { error: 'Section widget limit reached' };
        target.section.widgets.splice(target.section.widgets.indexOf(target.widget), 1);
        index = Math.max(0, Math.min(operation.index, section.widgets.length));
        section.widgets.splice(index, 0, target.widget);
        target.widget.sectionId = section.id;
        break;
      case 'editWidget':
        target = findWidgetIn(next, operation.widgetId);
        if (!target) return { error: 'Widget not found' };
        if (operation.changes.visible !== undefined && capabilities(target.widget.type).canHide === false) return { error: 'This gadget cannot be hidden' };
        if (operation.changes.title !== undefined) target.widget.title = operation.changes.title;
        if (operation.changes.locked !== undefined) target.widget.locked = operation.changes.locked;
        if (operation.changes.visible !== undefined) target.widget.visible = operation.changes.visible;
        if (operation.changes.version !== undefined) target.widget.version = operation.changes.version;
        if (operation.changes.imageUrl !== undefined) {
          if (!target.widget.settings) target.widget.settings = {};
          target.widget.settings.displayUrl = operation.changes.imageUrl;
        }
        if (operation.changes.settings !== undefined) {
          if (!target.widget.settings) target.widget.settings = {};
          if (target.widget.type === LINKLIST.widgetType) {
            for (var llKey in target.widget.settings) {
              if (target.widget.settings.hasOwnProperty(llKey) && (llKey === LS.legacyLinks || linkListIndexedKey(llKey))) delete target.widget.settings[llKey];
            }
          }
          for (var key in operation.changes.settings) {
            if (operation.changes.settings.hasOwnProperty(key)) {
              target.widget.settings[key] = operation.changes.settings[key];
            }
          }
        }
        break;
      case 'duplicateWidget':
        target = findWidgetIn(next, operation.widgetId);
        if (!target) return { error: 'Widget not found' };
        if (target.widget.locked) return { error: 'Locked widgets cannot be duplicated' };
        var dupCaps = capabilities(target.widget.type);
        if (dupCaps.duplicable === false) return { error: 'This gadget cannot be duplicated' };
        if (dupCaps.maxInstances !== undefined && countInstances(target.widget.type) >= dupCaps.maxInstances) return { error: 'This gadget has reached its instance limit' };
        section = target.section;
        if (section.maxwidgets !== undefined && section.maxwidgets !== null && section.maxwidgets >= 0 && section.widgets.length >= section.maxwidgets) return { error: 'Section widget limit reached' };
        var dupUsed = {};
        for (var di = 0; di < next.sections.length; di++) for (var dj = 0; dj < next.sections[di].widgets.length; dj++) dupUsed[next.sections[di].widgets[dj].id] = true;
        var dupPrefix = target.widget.type.replace(/[^A-Za-z0-9]/g, '') || 'Widget';
        var dupId = dupPrefix + '1';
        for (var dn = 1; dupUsed[dupId]; dn++) dupId = dupPrefix + (dn + 1);
        var copy = clone(target.widget);
        copy.id = dupId;
        copy.title = (target.widget.title || widgetLabel(target.widget.type)) + ' (Copy)';
        copy.sectionId = section.id;
        copy.span = { start: 0, end: 0 };
        section.widgets.splice(section.widgets.indexOf(target.widget) + 1, 0, copy);
        break;
      case 'editSection':
        section = byId(next.sections, operation.sectionId);
        if (!section) return { error: 'Section not found' };
        for (var key in operation.changes) if (operation.changes.hasOwnProperty(key)) section[key] = operation.changes[key];
        break;
      default:
        return { error: 'Unknown operation' };
    }
    return { model: next };
  }

  function findWidgetIn(next, id) {
    for (var i = 0; i < next.sections.length; i++) {
      var widget = byId(next.sections[i].widgets, id);
      if (widget) return { section: next.sections[i], widget: widget };
    }
    return null;
  }

  function apply(operation) {
    var result = simulate(operation);
    if (result.error) { message(result.error, 'error'); return false; }
    model = result.model;
    operations.push(operation);
    render();
    dirty();
    message('', '');
    announce(operation.kind.replace(/([A-Z])/g, ' $1') + ' applied');
    return true;
  }

  function clearIndicators() {
    var nodes = shadow.querySelectorAll('.le-drop-before,.le-drop-after,.le-drop-active,.le-drop-invalid');
    for (var i = 0; i < nodes.length; i++) nodes[i].classList.remove('le-drop-before', 'le-drop-after', 'le-drop-active', 'le-drop-invalid');
  }

  function onDragStart(event) {
    var widget = event.target.closest ? event.target.closest('.le-widget') : null;
    if (!widget || widget.getAttribute('draggable') === 'false') { event.preventDefault(); return; }
    drag = { id: widget.getAttribute('data-widget-id'), sectionId: widget.getAttribute('data-section-id') };
    event.dataTransfer.setData('text/plain', drag.id);
    event.dataTransfer.effectAllowed = 'move';
    widget.classList.add('le-dragging');
  }

  function canDropWidget(sectionId) {
    if (!drag) return false;
    var source = findWidget(drag.id);
    var target = byId(model.sections, sectionId);
    if (!source || !target) return false;
    if (source.widget.locked || capabilities(source.widget.type).movable === false) return false;
    var caps = capabilities(source.widget.type);
    if (caps.allowedSectionIds && caps.allowedSectionIds.length && caps.allowedSectionIds.indexOf(sectionId) < 0) return false;
    if (sectionId !== source.section.id && target.maxwidgets !== undefined && target.maxwidgets !== null && target.maxwidgets >= 0 && target.widgets.length >= target.maxwidgets) return false;
    return true;
  }

  function onDragOver(event) {
    if (!drag) return;
    var container = event.target.closest ? event.target.closest('.le-widgets') : null;
    if (!container) return;
    event.preventDefault();
    var sectionId = container.getAttribute('data-section-id');
    var valid = canDropWidget(sectionId);
    event.dataTransfer.dropEffect = valid ? 'move' : 'none';
    clearIndicators();
    var sectionElement = container.closest('.le-section');
    if (sectionElement) sectionElement.classList.add(valid ? 'le-drop-active' : 'le-drop-invalid');
    if (!valid) { drop = null; return; }
    var widgets = container.querySelectorAll('.le-widget');
    var index = widgets.length;
    for (var i = 0; i < widgets.length; i++) {
      var box = widgets[i].getBoundingClientRect();
      if (event.clientY < box.top + box.height / 2) { index = i; break; }
    }
    if (index < widgets.length) widgets[index].classList.add('le-drop-before');
    else container.classList.add('le-drop-after');
    drop = { sectionId: container.getAttribute('data-section-id'), index: index };
  }

  function onDrop(event) {
    if (!drag || !drop) return;
    event.preventDefault();
    if (!canDropWidget(drop.sectionId)) {
      message('This gadget cannot be placed in that section', 'error');
      cleanupDrag();
      return;
    }
    var index = drop.index;
    if (drag.sectionId === drop.sectionId) {
      var source = findWidget(drag.id);
      if (source) {
        var current = source.section.widgets.indexOf(source.widget);
        if (current < index) index--;
      }
      if (index === findWidgetIndex(drag.id)) { cleanupDrag(); return; }
      apply({ kind: 'reorderWidget', widgetId: drag.id, index: index });
    } else {
      apply({ kind: 'moveWidget', widgetId: drag.id, sectionId: drop.sectionId, index: index });
    }
    cleanupDrag();
  }

  function findWidgetIndex(id) {
    var found = findWidget(id);
    return found ? found.section.widgets.indexOf(found.widget) : -1;
  }

  function cleanupDrag() {
    drag = null;
    drop = null;
    clearIndicators();
    var dragging = shadow.querySelectorAll('.le-dragging');
    for (var i = 0; i < dragging.length; i++) dragging[i].classList.remove('le-dragging');
  }

  function dialog(id) { return document.getElementById(id); }

  function formSnapshot(node) {
    if (!node) return '';
    var values = {};
    var fields = node.querySelectorAll('input,select,textarea');
    for (var i = 0; i < fields.length; i++) {
      var field = fields[i];
      var key = field.id || field.name || ('field-' + i);
      values[key] = field.type === 'checkbox' || field.type === 'radio' ? field.checked : field.value;
    }
    return JSON.stringify(values);
  }

  function isDialogDirty(node) {
    return !!node && dialogSnapshots[node.id] !== undefined && formSnapshot(node) !== dialogSnapshots[node.id];
  }

  function activeTopDialog() {
    var open = document.querySelectorAll('dialog[open]');
    return open.length ? open[open.length - 1] : null;
  }

  function openDialog(node, trigger, preserveTrigger) {
    if (!node) return;
    activeDialog = node;
    if (!preserveTrigger) activeTrigger = trigger || document.activeElement;
    dialogSnapshots[node.id] = formSnapshot(node);
    node.showModal();
    var focusable = node.querySelector('input:not([type=hidden]),select,textarea,button');
    if (focusable) focusable.focus();
  }

  function closeDialog(node, force) {
    if (!node || !node.open) return;
    if (!force && isDialogDirty(node)) {
      var pending = confirmCallback;
      confirmCallback = function () {
        confirmCallback = pending;
        closeDialog(node, true);
      };
      openConfirmText('This dialog has unsaved changes. Discard them?', false, null, true);
      return;
    }
    node.close();
    if ((node.id === 'le-widget-dialog' || node.id === LINKLIST.dialogId) && pendingAdd) { pendingAdd = null; updateCatalog(); }
    if (node.id === 'le-confirm-dialog' && !force) confirmCallback = null;
    if (activeDialog === node) {
      activeDialog = null;
      if (activeTrigger && activeTrigger.focus) activeTrigger.focus();
      activeTrigger = null;
    }
  }

  function setDialogTitle(id, title) {
    var head = dialog(id);
    var heading = head ? head.querySelector('.layout-editor-dialog-head h2') : null;
    if (heading) heading.textContent = title;
    var apply = head ? head.querySelector('[data-le-apply]') : null;
    if (apply) apply.textContent = (id === 'le-widget-dialog' || id === LINKLIST.dialogId) && pendingAdd ? 'Add gadget' : 'Apply';
  }

  function clearErrors() {
    var errors = document.querySelectorAll('.le-gf-error');
    for (var i = 0; i < errors.length; i++) errors[i].textContent = '';
  }

  function setFieldError(field, text) {
    var error = dialog('le-gf-error-' + field.key.replace(/[^A-Za-z0-9_-]/g, '_'));
    if (error) error.textContent = text;
  }

  function validateGenericFields(definition) {
    var values = collectGenericValues(definition);
    var errors = 0;
    clearErrors();
    for (var si = 0; si < definition.sections.length; si++) {
      var fields = definition.sections[si].fields;
      for (var fi = 0; fi < fields.length; fi++) {
        var field = fields[fi];
        if (!isFieldVisible(field, values)) continue;
        var value = values[field.key] === undefined ? '' : String(values[field.key]);
        var problem = '';
        if (field.required && !value.trim()) problem = field.label + ' is required.';
        else if (field.kind === 'number' && value !== '') {
          var number = Number(value);
          if (!isFinite(number)) problem = field.label + ' must be a number.';
          else if (field.min !== undefined && number < field.min) problem = field.label + ' must be at least ' + field.min + '.';
          else if (field.max !== undefined && number > field.max) problem = field.label + ' must be at most ' + field.max + '.';
        } else if (field.kind === 'url' || field.kind === 'image') {
          if (value && !/^(https?:\/\/|\/|#)/i.test(value)) problem = field.label + ' must be a valid URL.';
        } else if ((field.kind === 'select' || field.kind === 'radio') && field.options && value && !field.options.some(function (option) { return option.value === value; })) {
          problem = field.label + ' has an invalid value.';
        } else if (field.kind === 'custom' && value) {
          try { JSON.parse(value); } catch (error) { problem = field.label + ' must be valid JSON.'; }
        }
        if (problem) { setFieldError(field, problem); errors++; }
      }
    }
    return errors === 0 ? values : null;
  }

  function catalogSection() { return byId(model.sections, dialog('le-gadget-section').value); }

  function updateCatalog() {
    var query = (dialog('le-gadget-search').value || '').toLowerCase().trim();
    var category = dialog('le-gadget-category').value;
    var support = dialog('le-gadget-support').value;
    var section = catalogSection();
    var cards = document.querySelectorAll('[data-le-add-type]');
    var visible = 0;
    for (var i = 0; i < cards.length; i++) {
      var card = cards[i];
      var type = card.getAttribute('data-le-add-type');
      var text = (card.textContent || '').toLowerCase();
      var matches = (!query || text.indexOf(query) >= 0) &&
        (!category || card.getAttribute('data-category') === category) &&
        (!support || card.getAttribute('data-support') === support);
      var blocked = card.getAttribute('data-support') === 'unsupported' || !canAddType(type, section);
      card.hidden = !matches;
      card.disabled = blocked;
      if (matches) visible++;
    }
    var empty = dialog('le-gadget-empty');
    if (empty) empty.hidden = visible !== 0;
    var fallback = dialog('le-gadget-type');
    if (fallback) {
      for (var oi = 0; oi < fallback.options.length; oi++) fallback.options[oi].disabled = !canAddType(fallback.options[oi].value, section);
    }
    var selected = document.querySelector('.le-gadget-card-selected');
    if (selected && (selected.hidden || selected.disabled)) selected.classList.remove('le-gadget-card-selected');
  }

  function showGadgetDetail(card) {
    var detail = dialog('le-gadget-detail');
    if (!detail) return;
    var caps = JSON.parse(card.getAttribute('data-capabilities') || '{}');
    var flags = [];
    if (caps.configurable) flags.push('configurable');
    if (caps.duplicable) flags.push('duplicable');
    if (caps.removable) flags.push('removable');
    if (caps.movable) flags.push('movable');
    if (caps.canHide) flags.push('hideable');
    if (caps.maxInstances !== undefined) flags.push('max ' + caps.maxInstances);
    detail.innerHTML = '<strong>' + esc(card.querySelector('.le-gadget-card-name').textContent) + '</strong>' +
      '<p>' + esc(card.querySelector('.le-gadget-card-desc').textContent) + '</p>' +
      '<p class="le-gadget-detail-caps">' + esc(flags.join(' · ') || 'no optional capabilities') + '</p>';
  }

  function selectGadgetCard(card) {
    if (!card || card.disabled) return;
    var cards = document.querySelectorAll('.le-gadget-card');
    for (var i = 0; i < cards.length; i++) cards[i].classList.remove('le-gadget-card-selected');
    card.classList.add('le-gadget-card-selected');
    var fallback = dialog('le-gadget-type');
    if (fallback) fallback.value = card.getAttribute('data-le-add-type');
    showGadgetDetail(card);
  }

  function closeCatalog() {
    var catalog = dialog('le-gadget-dialog');
    var trigger = catalogTrigger;
    closeDialog(catalog, true);
    if (trigger && trigger.focus) trigger.focus();
    catalogTrigger = null;
  }

  function openGadget(sectionId, trigger) {
    catalogTrigger = trigger || null;
    dialog('le-gadget-section').value = sectionId;
    dialog('le-gadget-search').value = '';
    dialog('le-gadget-category').value = '';
    dialog('le-gadget-support').value = '';
    pendingAdd = null;
    setDialogTitle('le-gadget-dialog', 'Add a gadget');
    updateCatalog();
    var detail = dialog('le-gadget-detail');
    if (detail) detail.innerHTML = '<p class="le-gadget-detail-empty">Select a gadget to see its details.</p>';
    openDialog(dialog('le-gadget-dialog'), trigger || null);
  }

  function openAddConfig(type, sectionId, trigger) {
    var defn = gadgetDef(type);
    pendingAdd = { type: type, sectionId: sectionId };
    dialog('le-widget-id').value = '';
    dialog('le-widget-title').value = widgetLabel(type);
    dialog('le-widget-locked').checked = false;
    dialog('le-widget-visible').checked = true;
    dialog('le-widget-version').value = '2';
    var imageField = dialog('le-widget-image-field');
    if (imageField) imageField.hidden = true;
    renderGenericFields({ settings: defn ? defn.defaults : {} }, defn);
    var adv = dialog('le-widget-advanced');
    if (adv) adv.open = false;
    setDialogTitle('le-widget-dialog', 'Add ' + widgetLabel(type));
    openDialog(dialog('le-widget-dialog'), trigger);
  }

  function genericFieldId(key) { return 'le-gf-' + key.replace(/[^A-Za-z0-9_-]/g, '_'); }

  function renderGenericFields(widget, definition) {
    var container = dialog('le-widget-generic-fields');
    var advancedContainer = dialog('le-widget-advanced-fields');
    if (!container) return;
    container.textContent = '';
    if (advancedContainer) advancedContainer.textContent = '';
    if (!definition || !definition.sections || definition.sections.length === 0) {
      container.innerHTML = '<p class="le-gf-empty">No configurable fields for this gadget type. Use Advanced for core widget attributes.</p>';
      return;
    }
    var values = clone(widget.settings || {});
    function createSection(sec) {
      var section = document.createElement('section');
      section.className = 'le-gadget-section';
      var heading = document.createElement('h3');
      heading.className = 'le-gadget-section-title';
      heading.textContent = sec.label;
      section.appendChild(heading);
      if (sec.description) { var desc = document.createElement('p'); desc.className = 'le-gadget-section-desc'; desc.textContent = sec.description; section.appendChild(desc); }
      return section;
    }
    function appendField(section, field) {
      var wrap = document.createElement('label');
      wrap.className = field.kind === 'toggle' || field.kind === 'checkbox' ? 'layout-editor-check le-gf' : 'layout-editor-field le-gf';
      wrap.setAttribute('data-gf-key', field.key);
      var id = genericFieldId(field.key);
      var current = values[field.key] !== undefined ? String(values[field.key]) : (field.defaultValue !== undefined ? String(field.defaultValue) : '');
      if (field.kind === 'toggle' || field.kind === 'checkbox') {
        wrap.innerHTML = '<input id="' + id + '" type="checkbox"' + (current === 'true' ? ' checked' : '') + '> <span>' + esc(field.label) + '</span>';
      } else {
        var label = document.createElement('span'); label.textContent = field.label; wrap.appendChild(label);
        var input;
        if (field.kind === 'custom') {
          input = document.createElement('textarea'); input.className = 'field le-custom-field'; input.rows = field.rows || 4;
          try { current = JSON.stringify(JSON.parse(current), null, 2); } catch (error) {}
          input.value = current;
        } else if (field.kind === 'textarea') { input = document.createElement('textarea'); input.className = 'field'; input.rows = field.rows || 4; input.value = current; }
        else if (field.kind === 'color') { input = document.createElement('input'); input.className = 'field le-color-field'; input.type = 'color'; input.value = /^#[0-9a-f]{6}$/i.test(current) ? current : '#000000'; }
        else if (field.kind === 'select') {
          input = document.createElement('select'); input.className = 'field';
          var opts = field.options || [];
          for (var oi = 0; oi < opts.length; oi++) { var opt = document.createElement('option'); opt.value = opts[oi].value; opt.textContent = opts[oi].label; if (opts[oi].value === current) opt.selected = true; input.appendChild(opt); }
        } else if (field.kind === 'radio') {
          input = document.createElement('div'); input.className = 'le-radio-group';
          var ropts = field.options || [];
          for (var ri = 0; ri < ropts.length; ri++) { var rlab = document.createElement('label'); rlab.className = 'layout-editor-check'; var rin = document.createElement('input'); rin.type = 'radio'; rin.name = id; rin.value = ropts[ri].value; rin.checked = ropts[ri].value === current; rlab.appendChild(rin); rlab.appendChild(document.createTextNode(' ' + ropts[ri].label)); input.appendChild(rlab); }
        } else if (field.kind === 'multi') {
          input = document.createElement('div'); input.className = 'le-blog-items'; input.id = id; input.setAttribute('data-multi-key', field.key);
          var order = String(current || '').split(',').map(function (s) { return s.trim(); }).filter(Boolean);
          var known = {}; for (var ki = 0; ki < (field.itemOrder || []).length; ki++) known[field.itemOrder[ki]] = true;
          var finalOrder = []; for (var oi2 = 0; oi2 < order.length; oi2++) if (known[order[oi2]] && finalOrder.indexOf(order[oi2]) < 0) finalOrder.push(order[oi2]);
          for (var ki2 = 0; ki2 < (field.itemOrder || []).length; ki2++) if (finalOrder.indexOf(field.itemOrder[ki2]) < 0) finalOrder.push(field.itemOrder[ki2]);
          for (var mi = 0; mi < finalOrder.length; mi++) {
            var li = document.createElement('div'); li.className = 'le-blog-item'; li.draggable = true; li.setAttribute('data-item-id', finalOrder[mi]);
            li.innerHTML = '<span class="le-blog-grip" aria-hidden="true">' + icon('grip') + '</span><span>' + esc(finalOrder[mi]) + '</span>' +
              '<span class="le-blog-item-actions"><button type="button" class="le-blog-item-move" data-move-item="up" aria-label="Move ' + esc(finalOrder[mi]) + ' up">Up</button>' +
              '<button type="button" class="le-blog-item-move" data-move-item="down" aria-label="Move ' + esc(finalOrder[mi]) + ' down">Down</button></span>';
            input.appendChild(li);
          }
          input.onclick = function (event) {
            var button = event.target.closest ? event.target.closest('[data-move-item]') : null;
            if (!button) return;
            var item = button.closest('[data-item-id]');
            if (!item) return;
            var sibling = button.getAttribute('data-move-item') === 'up' ? item.previousElementSibling : item.nextElementSibling;
            if (!sibling || !sibling.hasAttribute('data-item-id')) return;
            if (button.getAttribute('data-move-item') === 'up') input.insertBefore(item, sibling);
            else input.insertBefore(sibling, item);
            announce(item.getAttribute('data-item-id') + ' moved ' + button.getAttribute('data-move-item'));
          };
        } else {
          input = document.createElement('input'); input.className = 'field'; input.type = field.kind === 'number' ? 'number' : (field.kind === 'url' || field.kind === 'image') ? 'url' : 'text';
          if (field.min !== undefined) input.min = String(field.min); if (field.max !== undefined) input.max = String(field.max); if (field.step !== undefined) input.step = String(field.step);
          if (field.maxLength !== undefined) input.maxLength = field.maxLength; if (field.placeholder) input.placeholder = field.placeholder; input.value = current;
        }
        if (input.id !== id && field.kind !== 'radio' && field.kind !== 'multi') input.id = id;
        wrap.appendChild(input);
      }
      if (field.description && field.kind !== 'toggle' && field.kind !== 'checkbox') { var help = document.createElement('small'); help.className = 'le-gf-help'; help.textContent = field.description; wrap.appendChild(help); }
      var error = document.createElement('small'); error.className = 'le-gf-error'; error.id = 'le-gf-error-' + id.replace('le-gf-', ''); error.setAttribute('role', 'alert'); wrap.appendChild(error);
      section.appendChild(wrap);
    }
    for (var di = 0; di < definition.sections.length; di++) {
      var sec = definition.sections[di];
      var coreFields = sec.fields.filter(function (field) { return !field.advanced; });
      var advancedFields = sec.fields.filter(function (field) { return !!field.advanced; });
      if (coreFields.length) {
        var section = createSection(sec);
        for (var fi = 0; fi < coreFields.length; fi++) appendField(section, coreFields[fi]);
        container.appendChild(section);
      }
      if (advancedFields.length && advancedContainer) {
        var advSection = createSection(sec);
        for (var ai = 0; ai < advancedFields.length; ai++) appendField(advSection, advancedFields[ai]);
        advancedContainer.appendChild(advSection);
      }
    }
    var form = dialog('le-widget-form');
    if (form) {
      form.onchange = function () { syncGenericFieldVisibility(definition); };
      form.oninput = function (event) {
        var target = event.target;
        var wrapper = target && target.closest ? target.closest('[data-gf-key]') : null;
        var key = wrapper ? wrapper.getAttribute('data-gf-key') : null;
        if (key) { var error = dialog('le-gf-error-' + key.replace(/[^A-Za-z0-9_-]/g, '_')); if (error) error.textContent = ''; }
      };
    }
    syncGenericFieldVisibility(definition);
    setupMultiDrag(container);
    if (advancedContainer) setupMultiDrag(advancedContainer);
  }

  function collectGenericValues(definition) {
    var values = {};
    if (!definition) return values;
    for (var si = 0; si < definition.sections.length; si++) {
      var fields = definition.sections[si].fields;
      for (var fi = 0; fi < fields.length; fi++) {
        var field = fields[fi]; var id = genericFieldId(field.key);
        if (field.kind === 'toggle' || field.kind === 'checkbox') { var cb = dialog(id); values[field.key] = cb && cb.checked ? 'true' : 'false'; }
        else if (field.kind === 'radio') { var inputs = document.getElementsByName(id); var val = field.defaultValue || ''; for (var i = 0; i < inputs.length; i++) if (inputs[i].checked) val = inputs[i].value; values[field.key] = val; }
        else if (field.kind === 'multi') { var list = dialog(id); var items = list ? list.querySelectorAll('[data-item-id]') : []; var order = []; for (var j = 0; j < items.length; j++) order.push(items[j].getAttribute('data-item-id')); values[field.key] = order.join(','); }
        else if (field.kind === 'custom') { var customNode = dialog(id); var customValue = customNode ? customNode.value : (field.defaultValue || ''); try { values[field.key] = JSON.stringify(JSON.parse(customValue)); } catch (error) { values[field.key] = customValue; } }
        else { var node = dialog(id); values[field.key] = node ? node.value : (field.defaultValue || ''); }
      }
    }
    return values;
  }

  function syncGenericFieldVisibility(definition) {
    if (!definition) return;
    var values = collectGenericValues(definition);
    var form = dialog('le-widget-form');
    var wraps = (form || document).querySelectorAll('[data-gf-key]');
    for (var i = 0; i < wraps.length; i++) {
      var key = wraps[i].getAttribute('data-gf-key'); var field = null;
      for (var si = 0; si < definition.sections.length && !field; si++) for (var fi = 0; fi < definition.sections[si].fields.length; fi++) if (definition.sections[si].fields[fi].key === key) { field = definition.sections[si].fields[fi]; break; }
      if (field) wraps[i].hidden = !isFieldVisible(field, values);
    }
  }

  var multiDragItem = null;
  function setupMultiDrag(container) {
    var lists = container.querySelectorAll('[data-multi-key]');
    for (var i = 0; i < lists.length; i++) {
      var list = lists[i];
      list.ondragstart = function (e) { var item = e.target.closest ? e.target.closest('[data-item-id]') : null; if (!item) return; multiDragItem = item; item.classList.add('le-blog-item-dragging'); if (e.dataTransfer) e.dataTransfer.effectAllowed = 'move'; };
      list.ondragover = function (e) { if (!multiDragItem || multiDragItem.parentNode !== e.currentTarget) return; e.preventDefault(); var target = e.target.closest ? e.target.closest('[data-item-id]') : null; if (!target || target === multiDragItem) return; var rect = target.getBoundingClientRect(); e.currentTarget.insertBefore(multiDragItem, e.clientY > rect.top + rect.height / 2 ? target.nextSibling : target); };
      list.ondrop = function (e) { if (multiDragItem) e.preventDefault(); };
      list.ondragend = function () { if (multiDragItem) multiDragItem.classList.remove('le-blog-item-dragging'); multiDragItem = null; };
    }
  }

  function openWidget(id, trigger) {
    var found = findWidget(id);
    if (!found) return;
    if (id === BLOG_POSTS.widgetId && found.widget.type === 'Blog') {
      pendingAdd = null;
      setDialogTitle(BLOG_POSTS.dialogId, 'Blog Posts');
      openBlogPosts(found, trigger);
      return;
    }
    if (found.widget.type === LINKLIST.widgetType) {
      pendingAdd = null;
      openLinkList(found, trigger, false);
      return;
    }
    var defn = gadgetDef(found.widget.type);
    pendingAdd = null;
    dialog('le-widget-id').value = id;
    dialog('le-widget-title').value = found.widget.title || '';
    dialog('le-widget-locked').checked = !!found.widget.locked;
    dialog('le-widget-visible').checked = found.widget.visible !== false;
    dialog('le-widget-version').value = found.widget.version || '';
    var imageField = dialog('le-widget-image-field');
    if (imageField) imageField.hidden = found.widget.type !== 'Header';
    dialog('le-widget-image-url').value = (found.widget.settings && found.widget.settings.displayUrl) || '';
    renderGenericFields(found.widget, defn);
    var adv = dialog('le-widget-advanced');
    if (adv) adv.open = !defn || !defn.configurable;
    setDialogTitle('le-widget-dialog', 'Edit gadget');
    openDialog(dialog('le-widget-dialog'), trigger);
  }

  function openSection(id, trigger) {
    var section = byId(model.sections, id);
    if (!section) return;
    dialog('le-section-id').value = id;
    dialog('le-section-name').value = section.name || '';
    dialog('le-section-class').value = section.className || '';
    dialog('le-section-maxwidgets').value = section.maxwidgets === undefined || section.maxwidgets === null ? '' : String(section.maxwidgets);
    dialog('le-section-showaddelement').checked = section.showaddelement !== false;
    dialog('le-section-growth').value = section.growth || '';
    openDialog(dialog('le-section-dialog'), trigger);
  }

  function openMove(id, trigger) {
    var found = findWidget(id);
    if (!found) return;
    if (found.widget.locked || capabilities(found.widget.type).movable === false) {
      message('This gadget cannot be moved', 'error');
      return;
    }
    dialog('le-move-widget').value = id;
    var select = dialog('le-move-section');
    select.textContent = '';
    for (var i = 0; i < model.sections.length; i++) {
      var option = document.createElement('option');
      option.value = model.sections[i].id;
      option.textContent = model.sections[i].name || model.sections[i].id;
      option.selected = model.sections[i].id === found.section.id;
      select.appendChild(option);
    }
    dialog('le-move-position').value = 'end';
    openDialog(dialog('le-move-dialog'), trigger);
  }

  function duplicateWidget(id) {
    apply({ kind: 'duplicateWidget', widgetId: id });
  }

  function toggleVisible(id) {
    var found = findWidget(id);
    if (!found) return;
    if (capabilities(found.widget.type).canHide === false) {
      message('This gadget cannot be hidden', 'error');
      return;
    }
    apply({ kind: 'editWidget', widgetId: id, changes: { visible: found.widget.visible === false } });
  }

  function confirmRemove(id, trigger) {
    var found = findWidget(id);
    if (!found) return;
    if (found.widget.locked) { message('Locked widgets cannot be removed', 'error'); return; }
    if (capabilities(found.widget.type).removable === false) { message('This gadget cannot be removed', 'error'); return; }
    confirmCallback = function () { apply({ kind: 'removeWidget', widgetId: id }); };
    openConfirmText('Remove gadget "' + (found.widget.title || id) + '" from template.xml? This is a destructive action.', true, trigger);
  }

  function openConfirmText(text, destructive, trigger, preserveTrigger) {
    dialog('le-confirm-text').textContent = text;
    var applyButton = dialog('le-confirm-dialog').querySelector('[data-le-apply]');
    if (applyButton) applyButton.textContent = destructive ? 'Remove' : 'Discard';
    openDialog(dialog('le-confirm-dialog'), trigger || null, preserveTrigger);
  }

  function save() {
    var button = dialog('layout-editor-save');
    if (button) button.disabled = true;
    message('Saving…', '');
    fetch(payload.saveUrl, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ entry: model.entryPath, hash: currentHash, operations: operations })
    }).then(function (response) {
      return response.json().then(function (body) { return { ok: response.ok, body: body }; });
    }).then(function (result) {
      if (!result.ok) {
        message(result.body.message || result.body.error || 'Save failed', 'error');
        dirty();
        return;
      }
      currentHash = result.body.hash;
      operations = [];
      model.hash = currentHash;
      original = clone(model);
      render();
      dirty();
      message(result.body.unchanged ? 'No changes to save.' : 'Saved to ' + model.entryPath, 'ok');
    }).catch(function (error) {
      message('Save failed: ' + error.message, 'error');
      dirty();
    });
  }

  function reset() {
    model = clone(original);
    operations = [];
    render();
    dirty();
    message('Changes discarded.', 'ok');
  }

  shadow.addEventListener('click', function (event) {
    var target = event.target.closest ? event.target.closest('[data-action]') : null;
    if (!target) return;
    var action = target.getAttribute('data-action');
    var widgetId = target.getAttribute('data-widget-id');
    if (action === 'add-gadget') openGadget(target.getAttribute('data-section-id'), target);
    if (action === 'edit-widget') openWidget(widgetId, target);
    if (action === 'duplicate-widget') duplicateWidget(widgetId);
    if (action === 'move-widget') openMove(widgetId, target);
    if (action === 'toggle-visible') toggleVisible(widgetId);
    if (action === 'collapse-widget') {
      var widget = target.closest('.le-widget');
      var detail = widget ? widget.querySelector('.le-widget-detail') : null;
      if (detail) {
        detail.hidden = !detail.hidden;
        target.setAttribute('aria-expanded', detail.hidden ? 'false' : 'true');
      }
    }
    if (action === 'remove-widget') confirmRemove(widgetId, target);
    if (action === 'section-settings') openSection(target.getAttribute('data-section-id'), target);
  });
  shadow.addEventListener('dragstart', onDragStart);
  shadow.addEventListener('dragover', onDragOver);
  shadow.addEventListener('drop', onDrop);
  shadow.addEventListener('dragend', cleanupDrag);

  var search = dialog('le-gadget-search');
  if (search) search.addEventListener('input', updateCatalog);
  var category = dialog('le-gadget-category');
  if (category) category.addEventListener('change', updateCatalog);
  var support = dialog('le-gadget-support');
  if (support) support.addEventListener('change', updateCatalog);

  function addFromCatalog(type, trigger) {
    var sectionId = dialog('le-gadget-section').value;
    if (type === LINKLIST.widgetType) {
      pendingAdd = { type: type, sectionId: sectionId };
      openLinkList(null, trigger, true);
      return;
    }
    var defn = gadgetDef(type);
    var configurable = defn && defn.configurable && defn.sections.some(function (section) { return section.fields.length > 0; });
    if (configurable) { openAddConfig(type, sectionId, trigger); return; }
    if (apply({ kind: 'addWidget', sectionId: sectionId, widgetType: type })) closeCatalog();
  }

  var gadgetForm = dialog('le-gadget-form');
  if (gadgetForm) gadgetForm.addEventListener('click', function (event) {
    var card = event.target.closest ? event.target.closest('[data-le-add-type]') : null;
    if (!card || card.disabled) return;
    selectGadgetCard(card);
    addFromCatalog(card.getAttribute('data-le-add-type'), card);
  });
  if (gadgetForm) gadgetForm.addEventListener('submit', function (event) {
    event.preventDefault();
    addFromCatalog(dialog('le-gadget-type').value, null);
  });
  var widgetForm = dialog('le-widget-form');
  if (widgetForm) widgetForm.addEventListener('submit', function (event) {
    event.preventDefault();
    var title = dialog('le-widget-title').value;
    if (pendingAdd) {
      var addDefn = gadgetDef(pendingAdd.type);
      var addValues = addDefn && addDefn.configurable ? validateGenericFields(addDefn) : {};
      if (addValues === null) return;
      var added = apply({ kind: 'addWidget', sectionId: pendingAdd.sectionId, widgetType: pendingAdd.type, title: title, settings: addValues });
      if (added) {
        pendingAdd = null;
        closeDialog(dialog('le-widget-dialog'), true);
        closeCatalog();
      }
      return;
    }
    var widgetId = dialog('le-widget-id').value;
    var found = findWidget(widgetId);
    var defn = found ? gadgetDef(found.widget.type) : null;
    var values = defn && defn.configurable ? validateGenericFields(defn) : {};
    if (values === null) return;
    var changes = {
      title: title,
      locked: dialog('le-widget-locked').checked,
      visible: dialog('le-widget-visible').checked,
      version: dialog('le-widget-version').value
    };
    var imageField = dialog('le-widget-image-field');
    if (imageField && !imageField.hidden) changes.imageUrl = dialog('le-widget-image-url').value.trim();
    if (defn && defn.configurable) changes.settings = values;
    var ok = apply({ kind: 'editWidget', widgetId: widgetId, changes: changes });
    if (ok) closeDialog(dialog('le-widget-dialog'), true);
  });
  var blogForm = dialog(BLOG_POSTS.formId);
  if (blogForm) blogForm.addEventListener('submit', function (event) {
    event.preventDefault();
    submitBlogPosts();
  });
  var linkListForm = dialog(LINKLIST.formId);
  if (linkListForm) linkListForm.addEventListener('submit', function (event) {
    event.preventDefault();
    submitLinkList();
  });
  function linkListMirror(sourceId, targetId, eventName, property) {
    var source = dialog(sourceId);
    var target = dialog(targetId);
    if (!source || !target) return;
    source.addEventListener(eventName, function () { target[property] = source[property]; });
  }
  linkListMirror(LL.title, LL.advancedTitle, 'input', 'value');
  linkListMirror(LL.advancedTitle, LL.title, 'input', 'value');
  linkListMirror(LL.visible, LL.advancedVisible, 'change', 'checked');
  linkListMirror(LL.advancedVisible, LL.visible, 'change', 'checked');
  var linkListAdd = dialog(LL.addLink);
  if (linkListAdd) linkListAdd.addEventListener('click', function () { linkListAddRow(); });
  var linkListRowsNode = dialog(LL.linksList);
  if (linkListRowsNode) linkListRowsNode.addEventListener('click', function (event) {
    var button = event.target.closest ? event.target.closest('[data-linklist-action]') : null;
    if (!button || !linkListRowsNode.contains(button)) return;
    var row = button.closest ? button.closest('.le-linklist-row') : null;
    var action = button.getAttribute('data-linklist-action');
    if (action === 'delete') linkListDeleteRow(row);
    else if (action === 'up') linkListMoveRow(row, 'up');
    else if (action === 'down') linkListMoveRow(row, 'down');
  });
  if (linkListRowsNode) linkListRowsNode.addEventListener('input', function (event) {
    var row = event.target.closest ? event.target.closest('.le-linklist-row') : null;
    var rowError = row ? row.querySelector('[data-linklist-error]') : null;
    if (rowError) rowError.textContent = '';
    var error = dialog(LL.linksError);
    if (error) error.textContent = '';
  });
  var sectionForm = dialog('le-section-form');
  if (sectionForm) sectionForm.addEventListener('submit', function (event) {
    event.preventDefault();
    var max = dialog('le-section-maxwidgets').value.trim();
    var ok = apply({ kind: 'editSection', sectionId: dialog('le-section-id').value, changes: {
      name: dialog('le-section-name').value,
      className: dialog('le-section-class').value,
      maxwidgets: max === '' ? null : Number(max),
      showaddelement: dialog('le-section-showaddelement').checked,
      growth: dialog('le-section-growth').value
    } });
    if (ok) closeDialog(dialog('le-section-dialog'), true);
  });
  var moveForm = dialog('le-move-form');
  if (moveForm) moveForm.addEventListener('submit', function (event) {
    event.preventDefault();
    var id = dialog('le-move-widget').value;
    var sectionId = dialog('le-move-section').value;
    var found = findWidget(id);
    if (!found) return;
    var position = dialog('le-move-position').value;
    var targetSection = byId(model.sections, sectionId);
    var index = position === 'start' ? 0 : (targetSection ? targetSection.widgets.length : 0);
    var operation = sectionId === found.section.id
      ? { kind: 'reorderWidget', widgetId: id, index: index }
      : { kind: 'moveWidget', widgetId: id, sectionId: sectionId, index: index };
    if (apply(operation)) closeDialog(dialog('le-move-dialog'), true);
  });
  var confirmForm = dialog('le-confirm-form');
  if (confirmForm) confirmForm.addEventListener('submit', function (event) {
    event.preventDefault();
    var callback = confirmCallback;
    closeDialog(dialog('le-confirm-dialog'), true);
    if (callback) callback();
    confirmCallback = null;
  });

  var closers = document.querySelectorAll('[data-le-close]');
  for (var c = 0; c < closers.length; c++) {
    closers[c].addEventListener('click', function (event) {
      var node = event.currentTarget.getAttribute('data-le-close');
      var target = document.getElementById(node);
      if (target) closeDialog(target, false);
    });
  }
  var dialogs = document.querySelectorAll('dialog');
  for (var d = 0; d < dialogs.length; d++) {
    dialogs[d].addEventListener('cancel', function (event) {
      event.preventDefault();
      closeDialog(event.currentTarget, false);
    });
  }
  document.addEventListener('keydown', function (event) {
    var node = activeTopDialog();
    if (!node || event.key !== 'Tab') return;
    var focusable = node.querySelectorAll('button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),a[href]');
    if (!focusable.length) return;
    var first = focusable[0];
    var last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  });

  var blogToggles = [
    BF.showAuthor,
    BF.showTimestamp,
    BF.showCommentCount,
    BF.showLabels,
    BF.showAds
  ];
  for (var b = 0; b < blogToggles.length; b++) {
    var toggle = dialog(blogToggles[b]);
    if (toggle) toggle.addEventListener('change', syncBlogFields);
  }
  setupBlogItemDrag();

  var saveButton = dialog('layout-editor-save');
  if (saveButton) saveButton.addEventListener('click', save);
  var resetButton = dialog('layout-editor-reset');
  if (resetButton) resetButton.addEventListener('click', reset);
  window.addEventListener('beforeunload', function (event) {
    if (operations.length === 0) return undefined;
    event.preventDefault();
    event.returnValue = '';
    return '';
  });

  render();
  dirty();
  if (payload.statusUrl) {
    fetch(payload.statusUrl).then(function (response) { return response.json(); }).then(function (status) {
      if (status.hash && status.hash !== model.hash) message('template.xml changed outside the editor. Reload before saving.', 'error');
    }).catch(function () {});
  }
})();
