export const CONTENT_EDITOR_SCRIPT = `(function () {
  'use strict';
  var node = document.getElementById('content-editor-payload');
  if (!node) return;
  var payload;
  try { payload = JSON.parse(node.textContent || '{}'); } catch (error) { return; }
  if (!payload || !payload.kind) return;
  var kind = payload.kind === 'page' ? 'page' : 'post';
  var base = payload.apiBase + '/api/' + (kind === 'post' ? 'posts' : 'pages');
  var listUrl = payload.listUrl || '/__preview/dashboard/' + kind + 's/';
  var current = payload.item || {};
  var hash = payload.hash || null;
  var dirty = false;
  var saving = false;
  var slugTouched = payload.existing === true;
  var timer = null;
  var remoteHash = hash;
  var placeholder = '<p>Start writing...</p>';
  var htmlHistory = [''];
  var historyIndex = 0;
  var suppressHistory = false;
  var savedRange = null;
  var pendingDialog = null;
  var editingLink = null;
  var inputLanguage = 'en';
  var fontSizes = { '12px': '2', '14px': '3', '16px': '4', '18px': '5', '24px': '6', '32px': '7', '48px': '7' };
  var legacySizes = { '1': '12px', '2': '13px', '3': '16px', '4': '18px', '5': '24px', '6': '32px', '7': '48px' };

  function byId(id) { return document.getElementById(id); }
  function statusNode() { return byId('content-editor-status'); }
  function previewNode() { return byId('content-body-preview'); }
  function sourceNode() { return byId('content-body-source'); }

  function setStatus(text, state) {
    var target = statusNode();
    if (!target) return;
    target.textContent = text;
    target.setAttribute('data-state', state || 'saved');
  }

  function syncActions() {
    var exists = payload.existing === true;
    ['content-trash', 'content-delete'].forEach(function (id) {
      var target = byId(id);
      if (target) target.disabled = !exists;
    });
  }

  function esc(value) {
    return String(value === null || value === undefined ? '' : value)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function slugify(value) {
    return String(value || '').toLowerCase().normalize('NFKD')
      .replace(/[\\u0300-\\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80).replace(/-+$/, '') || 'untitled';
  }

  function setChecked(name, value) {
    var target = byId(name);
    if (target && typeof value === 'boolean') target.checked = value;
  }

  function normalizeHtml(html) {
    return String(html === null || html === undefined ? '' : html)
      .replace(/<font\\b([^>]*)>/gi, function (all, attrs) {
        var color = /color\\s*=\\s*["']?([^"'\\s>]+)/i.exec(attrs);
        var size = /size\\s*=\\s*["']?([^"'\\s>]+)/i.exec(attrs);
        var styles = [];
        if (color) styles.push('color:' + color[1]);
        if (size && legacySizes[size[1]]) styles.push('font-size:' + legacySizes[size[1]]);
        return '<span' + (styles.length ? ' style="' + styles.join(';') + '"' : '') + '>';
      })
      .replace(/<\\/font>/gi, '</span>')
      .replace(/<strike\\b[^>]*>/gi, '<span style="text-decoration:line-through">')
      .replace(/<\\/strike>/gi, '</span>');
  }

  function cleanPastedHtml(html) {
    return normalizeHtml(String(html === null || html === undefined ? '' : html)
      .replace(/<(script|style)\\b[^>]*>[\\s\\S]*?<\\/\\1\\s*>/gi, '')
      .replace(/\\son[a-z]+\\s*=\\s*(?:"[^"]*"|'[^']*'|[^\\s>]+)/gi, '')
      .replace(/javascript:/gi, ''));
  }

  function bodyValue() {
    var source = sourceNode();
    var preview = previewNode();
    if (source && source.hidden === false) return normalizeHtml(source.value);
    if (preview) {
      var html = preview.innerHTML;
      return normalizeHtml(html === placeholder ? '' : html);
    }
    return source ? normalizeHtml(source.value) : '';
  }

  function setEditorHtml(html) {
    var value = normalizeHtml(html || '');
    var source = sourceNode();
    var preview = previewNode();
    if (source) source.value = value;
    if (preview) preview.innerHTML = value || placeholder;
  }

  function pushHistory() {
    if (suppressHistory) return;
    var html = bodyValue();
    if (htmlHistory[historyIndex] === html) return;
    htmlHistory = htmlHistory.slice(0, historyIndex + 1);
    htmlHistory.push(html);
    historyIndex = htmlHistory.length - 1;
    if (htmlHistory.length > 200) {
      htmlHistory.shift();
      historyIndex--;
    }
  }

  function scheduleAutosave() {
    if (timer) clearTimeout(timer);
    if (collect().status === 'draft') timer = setTimeout(function () { save('draft', true); }, 1200);
  }

  function markDirty() {
    if (saving) return;
    pushHistory();
    dirty = true;
    setStatus('Unsaved changes', 'dirty');
    scheduleAutosave();
  }

  function fill() {
    var title = byId('content-title');
    var slug = byId('content-slug');
    var excerpt = byId('content-excerpt');
    var author = byId('content-author');
    var featured = byId('content-featured');
    var status = byId('content-status');
    var publishAt = byId('content-publish-at');
    var html = current.content || '';
    suppressHistory = true;
    setEditorHtml(html);
    htmlHistory = [html];
    historyIndex = 0;
    suppressHistory = false;
    if (title) title.value = current.title || '';
    if (slug) slug.value = current.slug || '';
    if (excerpt) excerpt.value = current.excerpt || '';
    if (author) author.value = current.author || payload.defaultAuthor || '';
    if (featured) featured.value = current.featuredImage || '';
    if (status) status.value = current.status || 'draft';
    if (publishAt) publishAt.value = current.publishAt ? String(current.publishAt).slice(0, 16) : '';
    setChecked('content-allow-comments', current.allowComments !== false);
    var labels = document.querySelectorAll('[data-content-label]');
    for (var i = 0; i < labels.length; i++) {
      var label = labels[i].getAttribute('data-content-label');
      labels[i].checked = Array.isArray(current.labels) && current.labels.indexOf(label) !== -1;
    }
    var heading = byId('content-editor-heading');
    if (heading) heading.textContent = (payload.existing ? 'Edit ' : 'New ') + kind;
    setStatus(payload.existing ? 'All changes saved' : 'Not saved yet', payload.existing ? 'saved' : 'new');
    syncActions();
    syncViewButtons();
    syncActiveStates();
    dirty = false;
  }

  function collect() {
    var title = byId('content-title');
    var slug = byId('content-slug');
    var status = byId('content-status');
    var publishAt = byId('content-publish-at');
    var patch = {
      title: title ? title.value : '',
      slug: slug ? slug.value : '',
      content: bodyValue(),
      status: status ? status.value : 'draft',
      publishAt: publishAt && publishAt.value ? new Date(publishAt.value).toISOString() : null
    };
    if (kind === 'post') {
      var excerpt = byId('content-excerpt');
      var author = byId('content-author');
      var featured = byId('content-featured');
      var comments = byId('content-allow-comments');
      var chosen = document.querySelectorAll('[data-content-label]:checked');
      var names = [];
      for (var i = 0; i < chosen.length; i++) names.push(chosen[i].getAttribute('data-content-label'));
      patch.excerpt = excerpt ? excerpt.value : '';
      patch.author = author ? author.value : (payload.defaultAuthor || 'admin');
      patch.featuredImage = featured && featured.value !== '' ? featured.value : null;
      patch.allowComments = comments ? comments.checked : true;
      patch.labels = names;
    }
    if (!slugTouched && title) patch.slug = slugify(title.value);
    return patch;
  }

  function handleError(error) {
    var body = error && error.payload ? error.payload : {};
    if (body.error === 'BLOGGER_CONTENT_STALE') {
      remoteHash = body.hash || null;
      setStatus('Changed elsewhere — reload to use the latest version', 'error');
    } else if (body.suggested) {
      var slug = byId('content-slug');
      if (slug) slug.value = body.suggested;
      slugTouched = true;
      setStatus('Slug was taken — retry with ' + body.suggested, 'error');
    } else {
      setStatus(error.message || 'Unable to save', 'error');
    }
  }

  function request(url, method, value) {
    return fetch(url, {
      method: method,
      headers: { 'content-type': 'application/json' },
      credentials: 'same-origin',
      body: value === undefined ? undefined : JSON.stringify(value)
    }).then(function (response) {
      if (!response.ok) return response.json().catch(function () { return {}; }).then(function (body) {
        var error = new Error(body.message || 'Request failed (' + response.status + ')');
        error.payload = body;
        throw error;
      });
      return response.json();
    });
  }

  function save(nextStatus, automatic) {
    if (saving) return Promise.resolve(null);
    var patch = collect();
    if (nextStatus === 'draft') patch.status = 'draft';
    if (nextStatus === 'published' || nextStatus === 'scheduled') patch.status = nextStatus;
    if (patch.status === 'scheduled' && !patch.publishAt) {
      setStatus('Choose a publish date before scheduling', 'error');
      return Promise.resolve(null);
    }
    saving = true;
    setStatus(automatic ? 'Autosaving...' : 'Saving...', 'saving');
    var url = payload.existing ? base + '/' + encodeURIComponent(current.id) : base;
    if (payload.existing && hash) patch.hash = hash;
    var method = payload.existing ? 'PUT' : 'POST';
    return request(url, method, patch).then(function (result) {
      var saved = result.item || result;
      current = saved;
      hash = result.hash || hash;
      remoteHash = hash;
      payload.existing = true;
      var id = byId('content-id');
      if (id) id.textContent = current.id || '';
      if (window.history && window.history.replaceState) {
        window.history.replaceState(null, '', location.pathname + '?id=' + encodeURIComponent(current.id));
      }
      dirty = false;
      saving = false;
      syncActions();
      setStatus(automatic ? 'Draft autosaved' : 'All changes saved', 'saved');
      return saved;
    }).catch(function (error) {
      saving = false;
      handleError(error);
      return null;
    });
  }

  function action(name) {
    var afterSave = function () {
      if (!payload.existing) return save('draft', false).then(function (saved) { return saved ? run(name) : null; });
      return run(name);
    };
    var run = function (actionName) {
      var url = base + '/' + encodeURIComponent(current.id) + '/' + actionName;
      return request(url, 'POST', {}).then(function () {
        dirty = false;
        if (actionName === 'trash') window.location.assign(listUrl);
        else { fill(); setStatus('Status updated', 'saved'); }
      }).catch(handleError);
    };
    if (name === 'delete') {
      if (!window.confirm('Delete this ' + kind + ' permanently?')) return Promise.resolve(null);
      if (!payload.existing) return Promise.resolve(null);
      return request(base + '/' + encodeURIComponent(current.id), 'DELETE').then(function () {
        window.location.assign(listUrl);
      }).catch(handleError);
    }
    return afterSave();
  }

  function isCompose() {
    var source = sourceNode();
    return !source || source.hidden !== false;
  }

  function activeButtons() {
    return document.querySelectorAll('[data-editor-command]');
  }

  function syncViewButtons() {
    var compose = isCompose();
    var viewCompose = byId('content-view-compose');
    var viewHtml = byId('content-source-toggle');
    if (viewCompose) {
      viewCompose.classList.toggle('active', compose);
      viewCompose.setAttribute('aria-pressed', compose ? 'true' : 'false');
    }
    if (viewHtml) {
      viewHtml.classList.toggle('active', !compose);
      viewHtml.setAttribute('aria-pressed', compose ? 'false' : 'true');
    }
    var form = byId('content-editor-form');
    if (form) form.setAttribute('data-editor-view', compose ? 'compose' : 'html');
    var buttons = activeButtons();
    for (var i = 0; i < buttons.length; i++) {
      var command = buttons[i].getAttribute('data-editor-command');
      if (['undo', 'redo', 'copy', 'selectAll'].indexOf(command) === -1) buttons[i].disabled = !compose;
    }
    var selects = document.querySelectorAll('[data-editor-select],[data-editor-color]');
    for (var j = 0; j < selects.length; j++) selects[j].disabled = !compose;
    syncActiveStates();
  }

  function syncActiveStates() {
    var preview = previewNode();
    var direction = preview && preview.getAttribute ? (preview.getAttribute('dir') || '') : '';
    var buttons = activeButtons();
    for (var i = 0; i < buttons.length; i++) {
      var button = buttons[i];
      var command = button.getAttribute('data-editor-command');
      var active = false;
      if (command === 'undo') active = historyIndex > 0;
      else if (command === 'redo') active = historyIndex < htmlHistory.length - 1;
      else if (command === 'ltr') active = direction !== 'rtl';
      else if (command === 'rtl') active = direction === 'rtl';
      else if (document.queryCommandState && command !== 'copy' && command !== 'paste' && command !== 'cut' && command !== 'selectAll') {
        try { active = !!document.queryCommandState(command); } catch (error) { active = false; }
      }
      button.classList.toggle('active', active);
      button.setAttribute('aria-pressed', active ? 'true' : 'false');
    }
  }

  function saveSelection() {
    if (!window.getSelection) return;
    var selection = window.getSelection();
    if (!selection || !selection.rangeCount) return;
    var preview = previewNode();
    var anchor = selection.anchorNode || (selection.rangeCount ? null : null);
    if (preview && anchor && preview.contains && !preview.contains(anchor)) return;
    try { savedRange = selection.getRangeAt(0); } catch (error) { savedRange = null; }
    syncActiveStates();
  }

  function restoreSelection() {
    var preview = previewNode();
    if (preview && preview.focus) preview.focus();
    if (!savedRange || !window.getSelection) return;
    var selection = window.getSelection();
    if (!selection || !selection.removeAllRanges || !selection.addRange) return;
    try {
      selection.removeAllRanges();
      selection.addRange(savedRange);
    } catch (error) {
      savedRange = null;
    }
  }

  function selectedText() {
    if (!window.getSelection) return '';
    var selection = window.getSelection();
    return selection && selection.toString ? String(selection.toString()) : '';
  }

  function runCommand(command, value, changesContent) {
    if (!isCompose()) return false;
    restoreSelection();
    var done = false;
    try {
      if (document.execCommand) {
        if (command === 'fontName' || command === 'foreColor' || command === 'hiliteColor') {
          try { document.execCommand('styleWithCSS', false, 'true'); } catch (error) {}
        }
        done = !!document.execCommand(command, false, value);
      }
    } catch (error) {
      done = false;
    }
    if (!done && command === 'insertHTML') {
      var preview = previewNode();
      if (preview) {
        preview.innerHTML += String(value || '');
        done = true;
      }
    }
    if (done && changesContent !== false) {
      saveSelection();
      markDirty();
    }
    syncActiveStates();
    return done;
  }

  function insertHtml(html) {
    return runCommand('insertHTML', normalizeHtml(html), true);
  }

  function applyFont(which, value) {
    if (!value) return;
    if (which === 'fontFamily') runCommand('fontName', String(value), true);
    else runCommand('fontSize', fontSizes[String(value)] || '4', true);
  }

  function applyColor(which, value) {
    if (!value) return;
    runCommand(which === 'foreColor' ? 'foreColor' : 'hiliteColor', String(value), true);
  }

  function applyHistory(index) {
    if (index < 0 || index >= htmlHistory.length) return;
    historyIndex = index;
    suppressHistory = true;
    setEditorHtml(htmlHistory[index]);
    suppressHistory = false;
    syncViewButtons();
    dirty = true;
    setStatus('Unsaved changes', 'dirty');
    scheduleAutosave();
  }

  function undo() { applyHistory(historyIndex - 1); }
  function redo() { applyHistory(historyIndex + 1); }

  function showCompose(focus) {
    var source = sourceNode();
    var preview = previewNode();
    if (source && preview && source.hidden === false) {
      preview.innerHTML = normalizeHtml(source.value) || placeholder;
      source.hidden = true;
      preview.hidden = false;
    }
    syncViewButtons();
    if (focus && preview && preview.focus) preview.focus();
  }

  function showHtml(focus) {
    var source = sourceNode();
    var preview = previewNode();
    if (source && preview && preview.hidden === false) {
      source.value = normalizeHtml(preview.innerHTML === placeholder ? '' : preview.innerHTML);
      preview.hidden = true;
      source.hidden = false;
    }
    syncViewButtons();
    if (focus && source && source.focus) source.focus();
  }

  function toggleSource() {
    if (isCompose()) showHtml(true);
    else showCompose(true);
  }

  function normalizeUrl(value) {
    var url = String(value === null || value === undefined ? '' : value).trim();
    if (url === '') return '';
    if (/^(?:https?:|mailto:|\\/|#)/i.test(url)) return url;
    if (/^[\\w.-]+\\.[a-z]{2,}(?:[\\/?#]|$)/i.test(url)) return 'https://' + url;
    return url;
  }

  function findLink() {
    if (!window.getSelection) return null;
    var selection = window.getSelection();
    var anchor = selection && selection.anchorNode;
    var element = anchor && anchor.nodeType === 1 ? anchor : (anchor ? anchor.parentElement : null);
    var preview = previewNode();
    while (element && element !== preview) {
      if (element.tagName && String(element.tagName).toLowerCase() === 'a') return element;
      element = element.parentElement || null;
    }
    return null;
  }

  function openDialog(title, fields, confirmLabel, onConfirm) {
    pendingDialog = { fields: fields, onConfirm: onConfirm };
    var heading = byId('content-editor-dialog-title');
    if (heading) heading.textContent = title;
    var confirm = byId('content-editor-dialog-confirm');
    if (confirm) confirm.textContent = confirmLabel || 'Insert';
    var container = byId('content-editor-dialog-fields');
    if (container) {
      if (container.replaceChildren) container.replaceChildren();
      else container.innerHTML = '';
      fields.forEach(function (field) {
        var label = document.createElement('label');
        label.className = 'editor-dialog-field';
        var caption = document.createElement('span');
        caption.textContent = field.label;
        label.appendChild(caption);
        var input = document.createElement(field.type === 'textarea' ? 'textarea' : 'input');
        if (field.type !== 'textarea') input.setAttribute('type', field.type || 'text');
        input.setAttribute('data-dialog-field', field.name);
        if (field.value !== undefined && field.value !== null) input.value = String(field.value);
        if (field.placeholder) input.setAttribute('placeholder', field.placeholder);
        label.appendChild(input);
        container.appendChild(label);
      });
    }
    var dialog = byId('content-editor-dialog');
    if (dialog && dialog.showModal) dialog.showModal();
    var first = container && container.querySelectorAll ? container.querySelectorAll('[data-dialog-field]')[0] : null;
    if (first && first.focus) first.focus();
  }

  function closeDialog() {
    var dialog = byId('content-editor-dialog');
    if (dialog && dialog.close) dialog.close();
    pendingDialog = null;
    editingLink = null;
  }

  function dialogValues() {
    var container = byId('content-editor-dialog-fields');
    var values = {};
    if (!container || !container.querySelectorAll) return values;
    var inputs = container.querySelectorAll('[data-dialog-field]');
    for (var i = 0; i < inputs.length; i++) {
      values[inputs[i].getAttribute('data-dialog-field')] = inputs[i].value || '';
    }
    return values;
  }

  function confirmDialog(event) {
    if (event && event.preventDefault) event.preventDefault();
    if (!pendingDialog) { closeDialog(); return; }
    var values = dialogValues();
    var onConfirm = pendingDialog.onConfirm;
    closeDialog();
    onConfirm(values);
  }

  function videoMarkup(rawUrl, title) {
    var url = normalizeUrl(rawUrl);
    var youtube = /(?:youtube\\.com\\/(?:watch\\?v=|embed\\/|shorts\\/)|youtu\\.be\\/)([\\w-]+)/i.exec(url);
    var vimeo = /vimeo\\.com\\/(?:video\\/)?(\\d+)/i.exec(url);
    if (youtube) {
      return '<iframe src="https://www.youtube.com/embed/' + encodeURIComponent(youtube[1]) +
        '" width="640" height="360" title="' + esc(title || 'Embedded video') +
        '" allow="accelerometer; autoplay; encrypted-media; picture-in-picture" allowfullscreen loading="lazy"></iframe>';
    }
    if (vimeo) {
      return '<iframe src="https://player.vimeo.com/video/' + encodeURIComponent(vimeo[1]) +
        '" width="640" height="360" title="' + esc(title || 'Embedded video') +
        '" allow="autoplay; fullscreen; picture-in-picture" allowfullscreen loading="lazy"></iframe>';
    }
    return '<p><a href="' + esc(url) + '" target="_blank" rel="nofollow noopener">' + esc(title || 'Watch video') + '</a></p>';
  }

  function snippetMarkup(type, text) {
    var value = esc(text || '');
    if (type === 'note') return '<blockquote>' + value + '</blockquote>';
    if (type === 'code') return '<pre><code>' + value + '</code></pre>';
    if (type === 'button') return '<p><a class="guchho-button" href="' + esc(normalizeUrl(text) || '#') + '">Read more</a></p>';
    if (type === 'divider') return '<hr class="guchho-divider">';
    return '<div class="guchho-callout"><strong>Note</strong><p>' + value + '</p></div>';
  }

  function aiMarkup(topic, audience, tone) {
    var subject = esc(topic || 'New article');
    var readers = esc(audience || 'your readers');
    var style = esc(tone || 'clear');
    return '<h2>' + subject + '</h2><p>A ' + style + ' introduction to ' + subject +
      ' written for ' + readers + '.</p><h3>What to cover</h3><ul><li>Why ' + subject +
      ' matters</li><li>Key ideas for ' + readers + '</li><li>Practical next steps</li></ul>';
  }

  function handleInsert(kind) {
    if (kind === 'link') {
      var existing = findLink();
      editingLink = existing;
      openDialog(
        existing ? 'Edit link' : 'Insert link',
        [
          { name: 'text', label: 'Link text', value: existing ? existing.textContent || '' : selectedText() },
          { name: 'url', label: 'URL', value: existing && existing.getAttribute ? existing.getAttribute('href') || '' : '', placeholder: 'https://example.com' },
        ],
        existing ? 'Update link' : 'Insert link',
        function (values) {
          var url = normalizeUrl(values.url);
          if (url === '') return;
          var text = values.text || url;
          if (editingLink) {
            editingLink.setAttribute('href', url);
            editingLink.textContent = text;
            saveSelection();
            markDirty();
          } else {
            var external = /^https?:/i.test(url);
            insertHtml('<a href="' + esc(url) + '"' + (external ? ' target="_blank" rel="nofollow noopener"' : '') + '>' + esc(text) + '</a>');
          }
        }
      );
      return;
    }
    if (kind === 'image') {
      openDialog('Insert image', [
        { name: 'url', label: 'Image URL', placeholder: 'https://example.com/image.jpg' },
        { name: 'alt', label: 'Alt text' },
        { name: 'width', label: 'Width (px)', type: 'number' },
      ], 'Insert image', function (values) {
        var url = normalizeUrl(values.url);
        if (!/^(?:https?:|data:image\\/|\\/)/i.test(url)) return;
        var attrs = ' src="' + esc(url) + '" alt="' + esc(values.alt || '') + '"';
        if (values.width) attrs += ' width="' + esc(values.width) + '"';
        insertHtml('<img' + attrs + ' />');
      });
      return;
    }
    if (kind === 'video') {
      openDialog('Insert video', [
        { name: 'url', label: 'Video URL', placeholder: 'https://youtube.com/watch?v=...' },
        { name: 'title', label: 'Title', value: 'Embedded video' },
      ], 'Insert video', function (values) {
        var url = normalizeUrl(values.url);
        if (url === '') return;
        insertHtml(videoMarkup(url, values.title));
      });
      return;
    }
    if (kind === 'jump') {
      insertHtml('<hr class="jump-break">');
      return;
    }
    if (kind === 'widget') {
      openDialog('Insert widget block', [
        { name: 'name', label: 'Widget ID', value: 'html-1' },
        { name: 'title', label: 'Widget title', value: 'Custom widget' },
      ], 'Insert widget', function (values) {
        insertHtml('<div class="guchho-widget" title="Widget: ' + esc(values.name || 'widget') + '"><strong>' + esc(values.title || 'Custom widget') + '</strong></div>');
      });
      return;
    }
    if (kind === 'ai') {
      openDialog('Generate a draft', [
        { name: 'topic', label: 'Topic', placeholder: 'How to bake sourdough' },
        { name: 'audience', label: 'Audience', value: 'beginners' },
        { name: 'tone', label: 'Tone', value: 'friendly' },
      ], 'Generate draft', function (values) {
        insertHtml(aiMarkup(values.topic, values.audience, values.tone));
      });
    }
  }

  function applyDirection(code, direction) {
    inputLanguage = code;
    var preview = previewNode();
    if (preview && preview.setAttribute) {
      preview.setAttribute('lang', code);
      preview.setAttribute('dir', direction);
    }
    var html = bodyValue();
    var stripped = html.replace(/^<div dir="(?:ltr|rtl)">([\\s\\S]*)<\\/div>$/i, '$1');
    setEditorHtml(direction === 'rtl' ? '<div dir="rtl">' + stripped + '</div>' : stripped);
    markDirty();
  }

  function closeMenus() {
    var toggles = document.querySelectorAll('[data-editor-menu-toggle]');
    for (var i = 0; i < toggles.length; i++) toggles[i].setAttribute('aria-expanded', 'false');
    var menus = document.querySelectorAll('[data-editor-menu]');
    for (var j = 0; j < menus.length; j++) menus[j].hidden = true;
  }

  function toggleMenu(name, button) {
    var menus = document.querySelectorAll('[data-editor-menu]');
    var list = null;
    for (var i = 0; i < menus.length; i++) {
      if (menus[i].getAttribute('data-editor-menu') === name) list = menus[i];
    }
    if (!list) return;
    var expanded = list.hidden === false;
    closeMenus();
    if (!expanded) {
      list.hidden = false;
      button.setAttribute('aria-expanded', 'true');
    }
  }

  function handleKeydown(event) {
    if (!event || !(event.ctrlKey || event.metaKey) || event.altKey) return;
    var target = event.target;
    if (target && ['INPUT', 'TEXTAREA', 'SELECT'].indexOf(String(target.tagName || '').toUpperCase()) !== -1) return;
    var key = String(event.key || '').toLowerCase();
    var command = null;
    if (key === 'b') command = 'bold';
    else if (key === 'i') command = 'italic';
    else if (key === 'u') command = 'underline';
    else if (key === 'k') { event.preventDefault(); handleInsert('link'); return; }
    else if (key === 's') { event.preventDefault(); save('draft', false); return; }
    else if (key === 'z' && event.shiftKey) { event.preventDefault(); redo(); return; }
    else if (key === 'z') { event.preventDefault(); undo(); return; }
    else if (key === 'y') { event.preventDefault(); redo(); return; }
    else if (key === '7') command = 'insertOrderedList';
    else if (key === '8') command = 'insertUnorderedList';
    else if (key === 'enter') { event.preventDefault(); handleInsert('jump'); return; }
    if (command) {
      event.preventDefault();
      runCommand(command, undefined, true);
    }
  }

  function loadExisting() {
    var match = /[?&]id=([^&]+)/.exec(location.search);
    if (!match || payload.existing) return Promise.resolve(null);
    return request(base + '/' + decodeURIComponent(match[1]), 'GET').then(function (result) {
      current = result.item || result;
      hash = result.hash || null;
      remoteHash = hash;
      payload.existing = true;
      slugTouched = true;
      fill();
      return current;
    }).catch(function () { return null; });
  }

  function poll() {
    if (!payload.existing || dirty || saving) return;
    request(base + '/' + encodeURIComponent(current.id), 'GET').then(function (result) {
      if (result.hash && result.hash !== hash) {
        setStatus('Changed elsewhere — reload to use the latest version', 'error');
        remoteHash = result.hash;
      }
    }).catch(function () {});
  }

  var form = byId('content-editor-form');
  if (form) {
    form.addEventListener('input', markDirty);
    form.addEventListener('keydown', handleKeydown);
    form.addEventListener('submit', function (event) { if (event && event.preventDefault) event.preventDefault(); });
  }
  var slug = byId('content-slug');
  if (slug) slug.addEventListener('input', function () { slugTouched = true; });
  var viewCompose = byId('content-view-compose');
  if (viewCompose) viewCompose.addEventListener('click', function () { showCompose(true); });
  var sourceToggle = byId('content-source-toggle');
  if (sourceToggle) sourceToggle.addEventListener('click', toggleSource);
  var saveDraft = byId('content-save-draft');
  if (saveDraft) saveDraft.addEventListener('click', function () { save('draft', false); });
  var publish = byId('content-publish');
  if (publish) publish.addEventListener('click', function () { save('published', false); });
  var schedule = byId('content-schedule');
  if (schedule) schedule.addEventListener('click', function () { save('scheduled', false); });
  var trash = byId('content-trash');
  if (trash) trash.addEventListener('click', function () { action('trash'); });
  var remove = byId('content-delete');
  if (remove) remove.addEventListener('click', function () { action('delete'); });

  var commands = activeButtons();
  var preserve = document.querySelectorAll('[data-editor-command],[data-editor-insert],[data-editor-symbol],[data-editor-snippet],[data-editor-language]');
  for (var p = 0; p < preserve.length; p++) {
    preserve[p].addEventListener('mousedown', function (event) { if (event && event.preventDefault) event.preventDefault(); });
  }
  for (var c = 0; c < commands.length; c++) {
    commands[c].addEventListener('click', function () {
      var command = this.getAttribute('data-editor-command');
      var value = this.getAttribute('data-editor-value');
      if (command === 'undo') undo();
      else if (command === 'redo') redo();
      else if (command === 'ltr' || command === 'rtl') applyDirection(command === 'ltr' ? 'en' : 'ar', command);
      else runCommand(command, value, ['copy', 'selectAll'].indexOf(command) === -1);
      if (command === 'selectAll') saveSelection();
    });
  }
  var inserts = document.querySelectorAll('[data-editor-insert]');
  for (var n = 0; n < inserts.length; n++) {
    inserts[n].addEventListener('click', function () { handleInsert(this.getAttribute('data-editor-insert')); });
  }
  var symbols = document.querySelectorAll('[data-editor-symbol]');
  for (var s = 0; s < symbols.length; s++) {
    symbols[s].addEventListener('click', function () { insertHtml(esc(this.getAttribute('data-editor-symbol'))); closeMenus(); });
  }
  var snippets = document.querySelectorAll('[data-editor-snippet]');
  for (var sn = 0; sn < snippets.length; sn++) {
    snippets[sn].addEventListener('click', function () {
      var type = this.getAttribute('data-editor-snippet');
      openDialog('Insert ' + type, [
        { name: 'text', label: type === 'button' ? 'Button URL' : 'Text', value: type === 'divider' ? '' : selectedText(), type: type === 'divider' ? 'hidden' : 'text' },
      ], 'Insert', function (values) { insertHtml(snippetMarkup(type, values.text)); });
      closeMenus();
    });
  }
  var languages = document.querySelectorAll('[data-editor-language]');
  for (var l = 0; l < languages.length; l++) {
    languages[l].addEventListener('click', function () {
      applyDirection(this.getAttribute('data-editor-language'), this.getAttribute('data-editor-direction') || 'ltr');
      closeMenus();
    });
  }
  var toggles = document.querySelectorAll('[data-editor-menu-toggle]');
  for (var m = 0; m < toggles.length; m++) {
    toggles[m].addEventListener('click', function () { toggleMenu(this.getAttribute('data-editor-menu-toggle'), this); });
  }
  if (document.addEventListener) {
    document.addEventListener('click', function (event) {
      if (event && event.target && event.target.closest && event.target.closest('[data-editor-menu-root]')) return;
      closeMenus();
    });
  }
  var fonts = document.querySelectorAll('[data-editor-select]');
  for (var f = 0; f < fonts.length; f++) {
    fonts[f].addEventListener('change', function () { applyFont(this.getAttribute('data-editor-select'), this.value); });
  }
  var colors = document.querySelectorAll('[data-editor-color]');
  for (var col = 0; col < colors.length; col++) {
    colors[col].addEventListener('change', function () { applyColor(this.getAttribute('data-editor-color'), this.value); });
  }
  var dialogConfirm = byId('content-editor-dialog-confirm');
  if (dialogConfirm) dialogConfirm.addEventListener('click', confirmDialog);
  var dialogForm = byId('content-editor-dialog-form');
  if (dialogForm) dialogForm.addEventListener('submit', confirmDialog);
  var dialogCancel = byId('content-editor-dialog-cancel');
  if (dialogCancel) dialogCancel.addEventListener('click', closeDialog);

  var preview = previewNode();
  if (preview) {
    preview.addEventListener('mouseup', saveSelection);
    preview.addEventListener('keyup', saveSelection);
    preview.addEventListener('paste', function (event) {
      var data = event && event.clipboardData;
      var html = data && data.getData ? data.getData('text/html') : '';
      var text = data && data.getData ? data.getData('text/plain') : '';
      if (event && event.preventDefault) event.preventDefault();
      insertHtml(html ? cleanPastedHtml(html) : esc(text));
    });
  }

  window.addEventListener('beforeunload', function (event) {
    if (!dirty) return undefined;
    event.preventDefault();
    event.returnValue = '';
    return '';
  });
  setInterval(poll, 15000);
  loadExisting().then(function () { fill(); syncActions(); });
  syncViewButtons();
})();`;
