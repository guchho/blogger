export const LAYOUT_EDITOR_SCRIPT = `(function () {
  'use strict';
  var payloadNode = document.getElementById('layout-editor-payload');
  var host = document.getElementById('layout-editor-shadow-host');
  if (!payloadNode || !host) return;
  var payload;
  try { payload = JSON.parse(payloadNode.textContent || '{}'); } catch (error) { return; }
  if (!payload.model) return;

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
      '<h4>' + esc(label) + settings + '</h4>' + add +
      '<div class="le-widgets" data-section-id="' + esc(section.id) + '">' + dropStart + widgets + '</div></div>';
  }

  function widgetHtml(widget, sectionId) {
    var remove = widget.locked ? '' : '<button type="button" class="le-btn le-danger" data-action="remove-widget" data-widget-id="' + esc(widget.id) + '" title="Remove gadget">' + icon('trash') + '</button>';
    return '<div class="widget le-widget ' + esc(widget.type) + (widget.locked ? ' locked-widget' : ' draggable-widget') + '" draggable="' + (widget.locked ? 'false' : 'true') + '"' +
      ' data-version="' + esc(widget.version || '2') + '" data-widget-id="' + esc(widget.id) + '" data-section-id="' + esc(sectionId) + '">' +
      '<div class="widget-wrap1"><div class="widget-wrap2"><div class="widget-wrap3"><div class="widget-content visibility">' +
      '<div class="layout-widget-state ' + (widget.visible ? 'visible' : 'not-visible') + '" title="' + (widget.visible ? 'Currently visible' : 'Currently hidden') + '">' + icon(widget.visible ? 'eye' : 'eye-off') + '</div>' +
      '<div class="layout-title">' + esc(widget.title || widget.type) + '</div>' +
      '<div class="layout-widget-description">' + esc(widget.type) + ' gadget</div>' +
      '<span class="le-actions"><button type="button" class="le-btn" data-action="edit-widget" data-widget-id="' + esc(widget.id) + '" title="Edit gadget">' + icon('edit') + '</button>' + remove + '</span>' +
      '</div></div></div></div></div>';
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
    var classes = ['le-wrapper'];
    if (node.className) classes.push(node.className);
    var tag = /^[a-z][a-z0-9-]*$/.test(node.tag || '') ? node.tag : 'div';
    return '<' + tag + ' class="' + esc(classes.join(' ')) + '"' + id + '>' + children + '</' + tag + '>';
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

  function editorCss() {
    return [
      'body#layout.blogger-layout-page{box-sizing:border-box;width:800px;max-width:100%;min-height:320px;margin:0 auto;padding:18px 12px;background:#f1f3f4;color:#3c4043;font:13px/1.45 Arial,sans-serif;overflow:visible}',
      'body#layout.blogger-layout-page #outer-wrapper,body#layout.blogger-layout-page .row{width:auto;max-width:100%;padding:0}',
      'body#layout.blogger-layout-page .hidden-widgets{display:block!important;visibility:visible!important;opacity:1!important}',
      'body#layout.blogger-layout-page #content-wrapper{display:flow-root!important;visibility:visible!important;opacity:1!important;height:auto!important;min-height:180px!important;overflow:visible!important;clear:both!important;margin:14px 0!important}',
      'body#layout.blogger-layout-page #content-wrapper>.container{display:flow-root!important;visibility:visible!important;height:auto!important;min-height:160px!important;width:100%!important;overflow:visible!important;margin:0!important}',
      'body#layout.blogger-layout-page #main-wrapper,body#layout.blogger-layout-page #sidebar-wrapper{display:block!important;visibility:visible!important;opacity:1!important;height:auto!important;min-height:120px!important}',
      'body#layout.blogger-layout-page .le-section,body#layout.blogger-layout-page .le-widget{visibility:visible!important;opacity:1!important}',
      '.le-wrapper{position:relative;box-sizing:border-box;border:0;border-radius:0;padding:0;min-height:0}',
      '.le-wrapper:hover{border-color:transparent;background:transparent}',
      'body#layout.blogger-layout-page div.le-section{position:relative;display:block!important;box-sizing:border-box;min-height:44px;margin:0 5px 10px!important;padding:16px 16px 18px!important;border:1px solid #c4c4c4;border-radius:0;background:#e7e7e7;box-shadow:none}',
      '.le-section h4{margin:0 0 12px!important;padding:0;color:#333;font-size:14px;font-weight:600;line-height:20px}',
      '.le-section-settings{float:right;display:inline-flex;align-items:center;justify-content:center;padding:2px 5px;border:0;background:transparent;color:#777;cursor:pointer}',
      '.le-section-settings svg{width:14px;height:14px;fill:none;stroke:currentColor;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round}',
      '.le-widgets{display:contents}',
      '.le-widget{position:relative;display:block!important;box-sizing:border-box;min-height:40px;margin:0 0 6px;padding:0;border:1px solid #c9c9c9;border-radius:2px;background:#fff;overflow:visible;box-shadow:0 1px 2px rgba(0,0,0,.08)}',
      '.le-widget.le-dragging{opacity:.45}',
      '.widget-wrap1,.widget-wrap2,.widget-wrap3{display:block;min-height:inherit}',
      '.le-widget-content.visibility{display:flex!important;align-items:center;gap:9px;min-height:40px;padding:7px 10px;background:#fff}',
      '.le-actions{display:flex;gap:6px;opacity:.35;transition:opacity .12s ease}',
      '.le-widget:hover .le-actions,.le-widget:focus-within .le-actions{opacity:1}',
      '.layout-widget-state{display:inline-flex;align-items:center;justify-content:center;width:16px;height:16px;flex:none;color:#777}',
      '.layout-widget-state.visible{color:#6aa84f}',
      '.layout-widget-state svg{width:14px;height:14px;fill:none;stroke:currentColor;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round}',
      '.layout-title{flex:1;color:#333;font-size:13px;font-weight:500}',
      '.layout-widget-description{display:none}',
      '.le-btn{display:inline-flex;align-items:center;justify-content:center;width:25px;height:25px;padding:4px;border:1px solid transparent;border-radius:2px;background:transparent;color:#666;cursor:pointer}',
      '.le-btn:hover{border-color:#bbb;background:#f5f5f5}',
      '.le-danger{color:#a33}',
      '.le-btn svg{width:14px;height:14px;fill:none;stroke:currentColor;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round}',
      '.add_widget{display:flex;align-items:center;justify-content:center;gap:6px;min-height:30px;margin:0 auto 8px;color:#666}',
      '.le-add{width:auto;margin:0;padding:3px 7px;border:0;background:transparent;color:#666;font:12px/1.4 Arial,sans-serif;cursor:pointer}',
      '.le-add:hover{color:#1a73e8;text-decoration:underline}',
      '.add-icon{display:inline-flex;align-items:center;justify-content:center;width:16px;height:16px;border:1px solid #888;border-radius:50%;font-size:13px;line-height:1}',
      '.dropregion{display:block;clear:both;height:9px;margin:0 0 2px;border:1px dashed transparent}',
      '.dropregion:hover,.le-drop-active .dropregion{border-color:#4285f4;background:rgba(66,133,244,.06)}',
      '.le-drop-before{box-shadow:0 -3px 0 #4285f4}',
      '.le-drop-after{box-shadow:0 3px 0 #4285f4}',
      '.le-empty-state{padding:30px;border:1px dashed #aaa;background:#fff;color:#666;text-align:center}',
      '@media(max-width:760px){body#layout.blogger-layout-page{width:100%;padding:12px}body#layout.blogger-layout-page #main-wrapper,body#layout.blogger-layout-page #sidebar-wrapper{float:none!important;width:100%!important}.le-section{margin-left:0!important;margin-right:0!important}}'
    ].join('');
  }

  function render() {
    shadow.textContent = '';
    var style = document.createElement('style');
    style.textContent = (model.css.combined || '') + '\\n' + editorCss();
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
        section.widgets.push({ id: id, type: operation.widgetType, title: operation.widgetType, locked: false, visible: true, version: '2', sectionId: section.id, attributes: [], includables: ['main'], span: { start: 0, end: 0 } });
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
    var select = dialog('le-gadget-type');
    if (!select) return;
    select.innerHTML = '';
    for (var i = 0; i < payload.widgetTypes.length; i++) {
      var option = document.createElement('option');
      option.value = payload.widgetTypes[i];
      option.textContent = payload.widgetTypes[i];
      select.appendChild(option);
    }
    dialog('le-gadget-section').value = sectionId;
    dialog('le-gadget-dialog').showModal();
  }

  function openWidget(id) {
    var found = findWidget(id);
    if (!found) return;
    dialog('le-widget-id').value = id;
    dialog('le-widget-title').value = found.widget.title || '';
    dialog('le-widget-locked').checked = !!found.widget.locked;
    dialog('le-widget-visible').checked = found.widget.visible !== false;
    dialog('le-widget-version').value = found.widget.version || '';
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
  if (gadgetForm) gadgetForm.addEventListener('submit', function (event) {
    event.preventDefault();
    if (apply({ kind: 'addWidget', sectionId: dialog('le-gadget-section').value, widgetType: dialog('le-gadget-type').value })) dialog('le-gadget-dialog').close();
  });
  var widgetForm = dialog('le-widget-form');
  if (widgetForm) widgetForm.addEventListener('submit', function (event) {
    event.preventDefault();
    var ok = apply({ kind: 'editWidget', widgetId: dialog('le-widget-id').value, changes: {
      title: dialog('le-widget-title').value,
      locked: dialog('le-widget-locked').checked,
      visible: dialog('le-widget-visible').checked,
      version: dialog('le-widget-version').value
    } });
    if (ok) dialog('le-widget-dialog').close();
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
