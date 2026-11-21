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

  function byId(id) { return document.getElementById(id); }
  function statusNode() { return byId('content-editor-status'); }

  function setStatus(text, state) {
    var node = statusNode();
    if (!node) return;
    node.textContent = text;
    node.setAttribute('data-state', state || 'saved');
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
    var node = byId(name);
    if (node && typeof value === 'boolean') node.checked = value;
  }

  function fill() {
    var title = byId('content-title');
    var slug = byId('content-slug');
    var source = byId('content-body-source');
    var preview = byId('content-body-preview');
    var excerpt = byId('content-excerpt');
    var author = byId('content-author');
    var featured = byId('content-featured');
    var status = byId('content-status');
    var publishAt = byId('content-publish-at');
    if (title) title.value = current.title || '';
    if (slug) slug.value = current.slug || '';
    if (source) source.value = current.content || '';
    if (preview) preview.innerHTML = current.content || '<p>Start writing...</p>';
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
    dirty = false;
  }

  function collect() {
    var source = byId('content-body-source');
    var preview = byId('content-body-preview');
    var title = byId('content-title');
    var slug = byId('content-slug');
    var status = byId('content-status');
    var publishAt = byId('content-publish-at');
    var patch = {
      title: title ? title.value : '',
      slug: slug ? slug.value : '',
      content: source ? source.value : (preview ? preview.innerHTML : ''),
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

  function markDirty() {
    if (saving) return;
    dirty = true;
    setStatus('Unsaved changes', 'dirty');
    if (timer) clearTimeout(timer);
    if (collect().status === 'draft') timer = setTimeout(function () { save('draft', true); }, 1200);
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

  function toggleSource() {
    var source = byId('content-body-source');
    var preview = byId('content-body-preview');
    var label = byId('content-source-label');
    if (!source || !preview) return;
    var showingSource = source.hidden === false;
    if (showingSource) {
      preview.innerHTML = source.value || '<p>Start writing...</p>';
      source.hidden = true;
      preview.hidden = false;
      if (label) label.textContent = 'HTML source';
    } else {
      source.value = preview.innerHTML === '<p>Start writing...</p>' ? '' : preview.innerHTML;
      preview.hidden = true;
      source.hidden = false;
      if (label) label.textContent = 'Visual editor';
      source.focus();
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
  if (form) form.addEventListener('input', markDirty);
  var slug = byId('content-slug');
  if (slug) slug.addEventListener('input', function () { slugTouched = true; });
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
  window.addEventListener('beforeunload', function (event) {
    if (!dirty) return undefined;
    event.preventDefault();
    event.returnValue = '';
    return '';
  });
  setInterval(poll, 15000);
  loadExisting().then(function () { if (!payload.existing) fill(); });
})();`;
