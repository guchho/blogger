import { readFileSync } from "node:fs";
import { BLOG_POSTS_CLIENT_CONFIG } from "../preview/layout-editor/blog-posts-settings.js";
import {
  LAYOUT_SKIN_CSS_URL,
  LAYOUT_TEMPLATE_SKIN_CSS_URL,
} from "../preview/layout-editor/skin-css.js";

const EDITOR_CSS = readFileSync(new URL("../preview/layout-editor/editor.css", import.meta.url), "utf8");

export const LAYOUT_EDITOR_SCRIPT = `(function () {
  'use strict';
  var payloadNode = document.getElementById('layout-editor-payload');
  var host = document.getElementById('layout-editor-shadow-host');
  if (!payloadNode || !host) return;
  var payload;
  try { payload = JSON.parse(payloadNode.textContent || '{}'); } catch (error) { return; }
  if (!payload.model) return;
  var BLOG_POSTS = ${JSON.stringify(BLOG_POSTS_CLIENT_CONFIG)};
  var BF = BLOG_POSTS.fields;
  var BS = BLOG_POSTS.setting;

  var original = clone(payload.model);
  var model = clone(original);
  var operations = [];
  var currentHash = model.hash;
  var drag = null;
  var drop = null;
  var confirmCallback = null;
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
  }

  function openBlogPosts(found) {
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
    blogSetOrder(blogParseOrder(settings[BS.postItemOrder]));
    syncBlogFields();
    dialog(BLOG_POSTS.dialogId).showModal();
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
    if (ok) dialog(BLOG_POSTS.dialogId).close();
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

  function message(text, kind) {
    var banner = document.getElementById('layout-editor-message');
    if (!banner) return;
    banner.textContent = text;
    banner.className = 'layout-editor-message' + (kind ? ' ' + kind : '');
    banner.hidden = text === '';
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
      '<div class="le-widgets" data-section-id="' + esc(section.id) + '">' + dropStart + widgets + '</div></div>';
  }

  function widgetHtml(widget, sectionId) {
    var defn = gadgetDef(widget.type);
    var label = widgetLabel(widget.type);
    var canRemove = !widget.locked && (!defn || defn.capabilities.removable !== false);
    var remove = canRemove ? '<button type="button" class="le-btn le-danger" data-action="remove-widget" data-widget-id="' + esc(widget.id) + '" title="Remove gadget">' + icon('trash') + '</button>' : '';
    var canEdit = !defn || defn.capabilities.configurable !== false;
    var edit = canEdit ? '<button type="button" class="le-btn" data-action="edit-widget" data-widget-id="' + esc(widget.id) + '" title="Edit gadget">' + icon('edit') + '</button>' : '';
    var status = widget.visible === false ? '<span class="le-widget-hidden">Hidden</span>' : '';
    return '<div class="widget le-widget ' + esc(widget.type) + (widget.locked ? ' locked-widget' : ' draggable-widget') + (widget.visible === false ? ' le-widget-is-hidden' : '') + '" draggable="' + (widget.locked ? 'false' : 'true') + '"' +
      ' data-version="' + esc(widget.version || '2') + '" data-widget-id="' + esc(widget.id) + '" data-section-id="' + esc(sectionId) + '">' +
      '<div class="widget-wrap1"><div class="widget-wrap2"><div class="widget-wrap3"><div class="widget-content visibility"><div class="le-widget-row">' +
      '<span class="le-grip" aria-hidden="true">' + icon('grip') + '</span>' +
      '<div class="le-widget-copy"><div class="layout-title">' + esc(widget.title || label) + status + '</div>' +
      '<div class="layout-widget-description">' + esc(label) + ' · ' + esc(widget.id) + '</div></div>' +
      '<div class="layout-widget-state ' + (widget.visible !== false ? 'visible' : 'not-visible') + '" title="' + (widget.visible !== false ? 'Currently visible' : 'Currently hidden') + '">' + icon(widget.visible !== false ? 'eye' : 'eye-off') + '</div>' +
      '<span class="le-actions">' + edit + remove + '</span>' +
      '</div></div></div></div></div></div>';
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
    skin.href = '${LAYOUT_SKIN_CSS_URL}';
    shadow.appendChild(skin);
    var templateSkin = document.createElement('link');
    templateSkin.rel = 'stylesheet';
    templateSkin.href = '${LAYOUT_TEMPLATE_SKIN_CSS_URL}';
    shadow.appendChild(templateSkin);
    var style = document.createElement('style');
    style.textContent = (model.css.style || '') + '\\n' + ${JSON.stringify(EDITOR_CSS)};
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
        if (section.showaddelement === false) return { error: 'This section does not allow adding widgets' };
        if (section.maxwidgets !== undefined && section.maxwidgets !== null && section.maxwidgets >= 0 && section.widgets.length >= section.maxwidgets) return { error: 'Section widget limit reached' };
        if (payload.widgetTypes.indexOf(operation.widgetType) < 0) return { error: 'Unknown widget type' };
        var used = {};
        for (var i = 0; i < next.sections.length; i++) for (var j = 0; j < next.sections[i].widgets.length; j++) used[next.sections[i].widgets[j].id] = true;
        var prefix = operation.widgetType.replace(/[^A-Za-z0-9]/g, '') || 'Widget';
        var id = prefix + '1';
        for (var n = 1; used[id]; n++) id = prefix + (n + 1);
        section.widgets.push({ id: id, type: operation.widgetType, title: operation.widgetType, locked: false, visible: true, version: '2', sectionId: section.id, attributes: [], includables: ['main'], settings: {}, span: { start: 0, end: 0 } });
        break;
      case 'removeWidget':
        target = findWidgetIn(next, operation.widgetId);
        if (!target) return { error: 'Widget not found' };
        if (target.widget.locked) return { error: 'Locked widgets cannot be removed' };
        target.section.widgets.splice(target.section.widgets.indexOf(target.widget), 1);
        break;
      case 'reorderWidget':
      case 'moveWidget':
        target = findWidgetIn(next, operation.widgetId);
        if (!target) return { error: 'Widget not found' };
        if (target.widget.locked) return { error: 'Locked widgets cannot be moved' };
        section = operation.kind === 'moveWidget' ? byId(next.sections, operation.sectionId) : target.section;
        if (!section) return { error: 'Section not found' };
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
          for (var key in operation.changes.settings) {
            if (operation.changes.settings.hasOwnProperty(key)) {
              target.widget.settings[key] = operation.changes.settings[key];
            }
          }
        }
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
    return true;
  }

  function clearIndicators() {
    var nodes = shadow.querySelectorAll('.le-drop-before,.le-drop-after,.le-drop-active');
    for (var i = 0; i < nodes.length; i++) nodes[i].classList.remove('le-drop-before', 'le-drop-after', 'le-drop-active');
  }

  function onDragStart(event) {
    var widget = event.target.closest ? event.target.closest('.le-widget') : null;
    if (!widget || widget.getAttribute('draggable') === 'false') { event.preventDefault(); return; }
    drag = { id: widget.getAttribute('data-widget-id'), sectionId: widget.getAttribute('data-section-id') };
    event.dataTransfer.setData('text/plain', drag.id);
    event.dataTransfer.effectAllowed = 'move';
    widget.classList.add('le-dragging');
  }

  function onDragOver(event) {
    if (!drag) return;
    var container = event.target.closest ? event.target.closest('.le-widgets') : null;
    if (!container) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
    clearIndicators();
    container.closest('.le-section').classList.add('le-drop-active');
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

  function openGadget(sectionId) {
    dialog('le-gadget-section').value = sectionId;
    var typeSel = dialog('le-gadget-type');
    if (typeSel && typeSel.options.length) typeSel.value = typeSel.options[0].value;
    dialog('le-gadget-dialog').showModal();
  }

  function genericFieldId(key) { return 'le-gf-' + key.replace(/[^A-Za-z0-9_-]/g, '_'); }

  function renderGenericFields(widget, definition) {
    var container = dialog('le-widget-generic-fields');
    if (!container) return;
    container.textContent = '';
    if (!definition || !definition.sections || definition.sections.length === 0) {
      container.innerHTML = '<p class="le-gf-empty">No configurable fields for this gadget type. Use Advanced for core widget attributes.</p>';
      return;
    }
    var values = clone(widget.settings || {});
    for (var di = 0; di < definition.sections.length; di++) {
      var sec = definition.sections[di];
      var section = document.createElement('section');
      section.className = 'le-gadget-section';
      var heading = document.createElement('h3');
      heading.className = 'le-gadget-section-title';
      heading.textContent = sec.label;
      section.appendChild(heading);
      if (sec.description) { var desc = document.createElement('p'); desc.className = 'le-gadget-section-desc'; desc.textContent = sec.description; section.appendChild(desc); }
      for (var fi = 0; fi < sec.fields.length; fi++) {
        var field = sec.fields[fi];
        var wrap = document.createElement('label');
        wrap.className = field.kind === 'toggle' || field.kind === 'checkbox' ? 'layout-editor-check le-gf' : 'layout-editor-field le-gf';
        wrap.setAttribute('data-gf-key', field.key);
        var id = genericFieldId(field.key);
        var current = values[field.key] !== undefined ? values[field.key] : (field.defaultValue !== undefined ? field.defaultValue : '');
        if (field.kind === 'toggle' || field.kind === 'checkbox') {
          wrap.innerHTML = '<input id="' + id + '" type="checkbox"' + (current === 'true' ? ' checked' : '') + '> <span>' + esc(field.label) + '</span>';
        } else {
          var label = document.createElement('span'); label.textContent = field.label; wrap.appendChild(label);
          var input;
          if (field.kind === 'textarea') { input = document.createElement('textarea'); input.className = 'field'; input.rows = field.rows || 4; input.value = current; }
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
            for (var mi = 0; mi < finalOrder.length; mi++) { var li = document.createElement('div'); li.className = 'le-blog-item'; li.draggable = true; li.setAttribute('data-item-id', finalOrder[mi]); li.innerHTML = '<span class="le-blog-grip" aria-hidden="true">' + icon('grip') + '</span><span>' + esc(finalOrder[mi]) + '</span>'; input.appendChild(li); }
          } else {
            input = document.createElement('input'); input.className = 'field'; input.type = field.kind === 'number' ? 'number' : field.kind === 'url' ? 'url' : 'text';
            if (field.min !== undefined) input.min = String(field.min); if (field.max !== undefined) input.max = String(field.max); if (field.step !== undefined) input.step = String(field.step);
            if (field.maxLength !== undefined) input.maxLength = field.maxLength; if (field.placeholder) input.placeholder = field.placeholder; input.value = current;
          }
          if (input.id !== id && field.kind !== 'radio' && field.kind !== 'multi') input.id = id;
          wrap.appendChild(input);
        }
        if (field.description && field.kind !== 'toggle' && field.kind !== 'checkbox') { var help = document.createElement('small'); help.className = 'le-gf-help'; help.textContent = field.description; wrap.appendChild(help); }
        section.appendChild(wrap);
      }
      container.appendChild(section);
    }
    syncGenericFieldVisibility(definition);
    container.onchange = function () { syncGenericFieldVisibility(definition); };
    setupMultiDrag(container);
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
        else { var node = dialog(id); values[field.key] = node ? node.value : (field.defaultValue || ''); }
      }
    }
    return values;
  }

  function syncGenericFieldVisibility(definition) {
    if (!definition) return;
    var values = collectGenericValues(definition);
    var wraps = (dialog('le-widget-generic-fields') || document).querySelectorAll('[data-gf-key]');
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

  function openWidget(id) {
    var found = findWidget(id);
    if (!found) return;
    if (id === BLOG_POSTS.widgetId && found.widget.type === 'Blog') {
      openBlogPosts(found);
      return;
    }
    var defn = gadgetDef(found.widget.type);
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
    dialog('le-widget-dialog').showModal();
  }

  function openSection(id) {
    var section = byId(model.sections, id);
    if (!section) return;
    dialog('le-section-id').value = id;
    dialog('le-section-name').value = section.name || '';
    dialog('le-section-class').value = section.className || '';
    dialog('le-section-maxwidgets').value = section.maxwidgets === undefined || section.maxwidgets === null ? '' : String(section.maxwidgets);
    dialog('le-section-showaddelement').checked = section.showaddelement !== false;
    dialog('le-section-growth').value = section.growth || '';
    dialog('le-section-dialog').showModal();
  }

  function confirmRemove(id) {
    var found = findWidget(id);
    if (!found) return;
    if (found.widget.locked) { message('Locked widgets cannot be removed', 'error'); return; }
    confirmCallback = function () { apply({ kind: 'removeWidget', widgetId: id }); };
    dialog('le-confirm-text').textContent = 'Remove widget "' + (found.widget.title || id) + '" from template.xml?';
    dialog('le-confirm-dialog').showModal();
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
    if (action === 'add-gadget') openGadget(target.getAttribute('data-section-id'));
    if (action === 'edit-widget') openWidget(target.getAttribute('data-widget-id'));
    if (action === 'remove-widget') confirmRemove(target.getAttribute('data-widget-id'));
    if (action === 'section-settings') openSection(target.getAttribute('data-section-id'));
  });
  shadow.addEventListener('dragstart', onDragStart);
  shadow.addEventListener('dragover', onDragOver);
  shadow.addEventListener('drop', onDrop);
  shadow.addEventListener('dragend', cleanupDrag);

  var gadgetForm = dialog('le-gadget-form');
  if (gadgetForm) gadgetForm.addEventListener('click', function (event) {
    var card = event.target.closest ? event.target.closest('[data-le-add-type]') : null;
    if (!card) return;
    var type = card.getAttribute('data-le-add-type');
    var typeSel = dialog('le-gadget-type');
    if (typeSel) typeSel.value = type;
    if (apply({ kind: 'addWidget', sectionId: dialog('le-gadget-section').value, widgetType: type })) dialog('le-gadget-dialog').close();
  });
  if (gadgetForm) gadgetForm.addEventListener('submit', function (event) {
    event.preventDefault();
    if (apply({ kind: 'addWidget', sectionId: dialog('le-gadget-section').value, widgetType: dialog('le-gadget-type').value })) dialog('le-gadget-dialog').close();
  });
  var widgetForm = dialog('le-widget-form');
  if (widgetForm) widgetForm.addEventListener('submit', function (event) {
    event.preventDefault();
    var widgetId = dialog('le-widget-id').value;
    var found = findWidget(widgetId);
    var defn = found ? gadgetDef(found.widget.type) : null;
    var changes = {
      title: dialog('le-widget-title').value,
      locked: dialog('le-widget-locked').checked,
      visible: dialog('le-widget-visible').checked,
      version: dialog('le-widget-version').value
    };
    var imageField = dialog('le-widget-image-field');
    if (imageField && !imageField.hidden) changes.imageUrl = dialog('le-widget-image-url').value.trim();
    if (defn && defn.configurable) changes.settings = collectGenericValues(defn);
    var ok = apply({ kind: 'editWidget', widgetId: widgetId, changes: changes });
    if (ok) dialog('le-widget-dialog').close();
  });
  var blogForm = dialog(BLOG_POSTS.formId);
  if (blogForm) blogForm.addEventListener('submit', function (event) {
    event.preventDefault();
    submitBlogPosts();
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
    if (ok) dialog('le-section-dialog').close();
  });
  var confirmForm = dialog('le-confirm-form');
  if (confirmForm) confirmForm.addEventListener('submit', function (event) {
    event.preventDefault();
    dialog('le-confirm-dialog').close();
    if (confirmCallback) confirmCallback();
    confirmCallback = null;
  });

  var closers = document.querySelectorAll('[data-le-close]');
  for (var c = 0; c < closers.length; c++) {
    closers[c].addEventListener('click', function (event) {
      var node = event.currentTarget.getAttribute('data-le-close');
      var target = document.getElementById(node);
      if (target && target.close) target.close();
    });
  }

  var blogToggles = [
    BF.showAuthor,
    BF.showTimestamp,
    BF.showCommentCount,
    BF.showLabels
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
})();`;
