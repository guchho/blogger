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

  function sectionHtml(section, index) {
    var label = section.name || section.id;
    var meta = [];
    if (section.className) meta.push('class=' + section.className);
    if (section.maxwidgets !== undefined && section.maxwidgets !== null) meta.push('maxwidgets=' + section.maxwidgets);
    if (!section.showaddelement) meta.push('showaddelement=false');
    if (section.growth) meta.push('growth=' + section.growth);
    if (section.widgets.length > 0) meta.push(section.widgets.length + (section.widgets.length === 1 ? ' widget' : ' widgets'));
    var chips = '';
    for (var m = 0; m < meta.length; m++) chips += '<span class="le-chip">' + esc(meta[m]) + '</span>';
    var widgets = '';
    for (var i = 0; i < section.widgets.length; i++) {
      var widget = section.widgets[i];
      widgets += widgetHtml(widget, section.id);
    }
    var empty = section.widgets.length === 0 ? '<p class="le-empty">No widgets in this section yet.</p>' : '';
    var canAdd = section.showaddelement !== false &&
      (section.maxwidgets === undefined || section.maxwidgets === null || section.widgets.length < section.maxwidgets);
    var add = canAdd
      ? '<button type="button" class="le-add" data-action="add-gadget" data-section-id="' + esc(section.id) + '">' + icon('plus') + '<span>+ Add a Gadget</span></button>'
      : '<span class="le-add-disabled">+ Add a Gadget (disabled by section settings)</span>';
    return '<section class="le-section ' + esc(section.className || '') + '" data-section-id="' + esc(section.id) + '">' +
      '<div class="le-section-header">' +
      '<span class="le-section-index">' + (index < 9 ? '0' : '') + (index + 1) + '</span>' +
      '<span class="le-section-title-wrap"><span class="le-section-title">' + esc(label) + '</span>' +
      '<span class="le-section-subtitle">id: ' + esc(section.id) + '</span></span>' +
      '<span class="le-section-meta">' + chips + '</span><span class="le-spacer"></span>' +
      '<button type="button" class="le-icon-btn" data-action="section-settings" data-section-id="' + esc(section.id) + '">' +
      icon('settings') + '<span>Settings</span></button></div>' +
      '<div class="le-widgets" data-section-id="' + esc(section.id) + '">' + widgets + empty + add + '</div></section>';
  }

  function widgetHtml(widget, sectionId) {
    var initials = (widget.type || 'W').replace(/[^A-Za-z0-9]/g, '').slice(0, 2).toUpperCase() || 'W';
    var badges = '<span class="le-pill">' + esc(widget.type) + '</span>';
    if (widget.locked) badges += '<span class="le-pill le-locked">Locked</span>';
    if (!widget.visible) badges += '<span class="le-pill le-hidden">Hidden</span>';
    var remove = widget.locked ? '' : '<button type="button" class="le-btn le-danger" data-action="remove-widget" data-widget-id="' + esc(widget.id) + '">' + icon('trash') + '<span>Remove</span></button>';
    return '<article class="le-widget ' + esc(widget.type) + '" draggable="' + (widget.locked ? 'false' : 'true') + '"' +
      ' data-widget-id="' + esc(widget.id) + '" data-section-id="' + esc(sectionId) + '">' +
      '<span class="le-grip" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i><i></i></span>' +
      '<span class="le-widget-icon">' + esc(initials) + '</span>' +
      '<span class="le-widget-body"><span class="le-widget-title">' + esc(widget.title || widget.type) + '</span>' +
      '<span class="le-widget-meta">' + esc(widget.id) + ' · ' + esc(widget.version || '') + '</span></span>' +
      '<span class="le-widget-badges">' + badges + '</span>' +
      '<span class="le-actions"><button type="button" class="le-btn" data-action="edit-widget" data-widget-id="' + esc(widget.id) + '">' +
      icon('edit') + '<span>Edit</span></button>' + remove + '</span>' +
      '</article>';
  }

  function editorCss() {
    return '.le-canvas{--le-bg:#fff;--le-line:#dbe3ee;--le-ink:#0f172a;--le-muted:#64748b;--le-accent:#1a73e8;--le-radius:10px;font:13px/1.45 -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;color:var(--le-ink)}.le-canvas-head{display:flex;align-items:center;justify-content:space-between;gap:12px;margin:0 2px 14px}.le-canvas-title{font-weight:700;font-size:14px;letter-spacing:-.01em}.le-canvas-hint{color:var(--le-muted);font-size:11px}.le-section{display:block;margin:0 0 16px;border:1px solid var(--le-line);border-radius:var(--le-radius);background:var(--le-bg);box-shadow:0 1px 2px rgba(15,23,42,.05);overflow:hidden;position:relative}.le-section:before{content:"";position:absolute;left:0;top:0;bottom:0;width:3px;background:var(--le-accent);opacity:.65}.le-section.le-drop-active{border-color:var(--le-accent);box-shadow:0 0 0 3px rgba(26,115,232,.14)}.le-section-header{display:flex;align-items:center;gap:10px;flex-wrap:wrap;padding:12px 14px;border-bottom:1px solid #eef1f5;background:linear-gradient(180deg,#fbfcfe,#f7f9fc)}.le-section-index{display:inline-flex;align-items:center;justify-content:center;width:24px;height:24px;border-radius:7px;background:#e8f0fe;color:var(--le-accent);font-size:10px;font-weight:700;letter-spacing:.04em}.le-section-title-wrap{display:flex;flex-direction:column;min-width:0}.le-section-title{font-weight:700;font-size:14px;color:var(--le-ink)}.le-section-subtitle{color:var(--le-muted);font-size:10px}.le-section-meta{display:flex;gap:6px;flex-wrap:wrap}.le-chip{display:inline-block;padding:3px 8px;border:1px solid #e2e8f0;border-radius:999px;background:#fff;color:#475569;font-size:10px;font-weight:600}.le-spacer{flex:1;min-width:12px}.le-icon-btn{display:inline-flex;align-items:center;gap:6px;padding:5px 9px;border:1px solid #dbe3ee;border-radius:6px;background:#fff;color:#475569;cursor:pointer;font:11px/1.4 inherit;font-weight:600}.le-icon-btn svg{width:13px;height:13px;fill:none;stroke:currentColor;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round}.le-icon-btn:hover{border-color:var(--le-accent);color:var(--le-accent)}.le-widgets{display:flex;flex-direction:column;gap:8px;min-height:52px;padding:12px}.le-widget{display:flex;align-items:center;gap:10px;padding:10px 12px;border:1px solid #e2e8f0;border-radius:8px;background:#fff;box-shadow:0 1px 1px rgba(15,23,42,.03);cursor:grab;position:relative}.le-widget:hover{border-color:#b8c7db;box-shadow:0 3px 10px rgba(15,23,42,.06)}.le-widget[draggable="false"]{cursor:not-allowed;opacity:.72}.le-widget.le-dragging{opacity:.4}.le-widget.le-drop-before:before{content:"";position:absolute;left:8px;right:8px;top:-6px;height:3px;border-radius:2px;background:var(--le-accent)}.le-widget.le-drop-after:after{content:"";position:absolute;left:8px;right:8px;bottom:-6px;height:3px;border-radius:2px;background:var(--le-accent)}.le-grip{display:grid;grid-template-columns:repeat(2,3px);gap:2px;flex:none;opacity:.7}.le-grip i{width:3px;height:3px;border-radius:50%;background:#94a3b8}.le-widget-icon{display:inline-flex;align-items:center;justify-content:center;width:30px;height:30px;flex:none;border-radius:8px;background:#eef4ff;color:var(--le-accent);font-size:10px;font-weight:800;letter-spacing:.04em}.le-widget-body{display:flex;flex-direction:column;flex:1;min-width:0}.le-widget-title{font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.le-widget-meta{color:var(--le-muted);font-size:10px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.le-widget-badges{display:flex;gap:5px;flex-wrap:wrap;justify-content:flex-end}.le-pill{display:inline-block;padding:2px 7px;border-radius:999px;background:#e8f0fe;color:var(--le-accent);font-size:9px;font-weight:700;letter-spacing:.02em}.le-pill.le-locked{background:#fff7e6;color:#b54708}.le-pill.le-hidden{background:#f1f5f9;color:#475569}.le-actions{display:flex;gap:6px;flex:none}.le-btn{display:inline-flex;align-items:center;gap:5px;padding:5px 9px;border:1px solid #dbe3ee;border-radius:6px;background:#fff;color:#334155;cursor:pointer;font:11px/1.4 inherit;font-weight:600}.le-btn svg{width:12px;height:12px;fill:none;stroke:currentColor;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round}.le-btn:hover{border-color:var(--le-accent);color:var(--le-accent)}.le-btn.le-danger:hover{border-color:#dc2626;color:#dc2626}.le-add{display:inline-flex;align-items:center;gap:6px;align-self:flex-start;padding:7px 11px;border:1px dashed #94a3b8;border-radius:7px;background:#f8fbff;color:var(--le-accent);cursor:pointer;font:11px/1.4 inherit;font-weight:700}.le-add svg{width:13px;height:13px;fill:none;stroke:currentColor;stroke-width:2;stroke-linecap:round;stroke-linejoin:round}.le-add:hover{border-color:var(--le-accent);background:#e8f0fe}.le-add-disabled{color:#94a3b8;font:11px/1.4 inherit;padding:7px 0}.le-empty{margin:2px 0 6px;color:var(--le-muted);font-size:11px;font-style:italic}.le-empty-state{padding:32px 16px;text-align:center;color:var(--le-muted);font-size:12px}@media(max-width:640px){.le-canvas-head{align-items:flex-start;flex-direction:column}.le-widget{flex-wrap:wrap}.le-actions{width:100%;justify-content:flex-end}.le-widget-badges{justify-content:flex-start}}';
  }

  function render() {
    shadow.textContent = '';
    var style = document.createElement('style');
    style.textContent = (model.css.combined || '') + '\\n' + editorCss();
    shadow.appendChild(style);
    var canvas = document.createElement('div');
    canvas.className = 'le-canvas';
    var html = '';
    for (var i = 0; i < model.sections.length; i++) html += sectionHtml(model.sections[i], i);
    var head = '<div class="le-canvas-head"><span class="le-canvas-title">Page structure</span>' +
      '<span class="le-canvas-hint">Drag widgets to reorder or move them between sections</span></div>';
    var body = html === '' ? '<p class="le-empty-state">No b:section elements were found in template.xml.</p>' : html;
    canvas.innerHTML = head + body;
    shadow.appendChild(canvas);
  }

  function simulate(operation) {
    var next = clone(model);
    var target, section, widget, index;
    switch (operation.kind) {
      case 'addWidget':
        section = byId(next.sections, operation.sectionId);
        if (!section) return { error: 'Section not found' };
        if (section.showaddelement === false) return { error: 'This section does not allow adding widgets' };
        if (section.maxwidgets !== undefined && section.maxwidgets !== null && section.widgets.length >= section.maxwidgets) return { error: 'Section widget limit reached' };
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
        if (section.maxwidgets !== undefined && section.maxwidgets !== null &&
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
