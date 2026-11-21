export const CONTENT_DASHBOARD_SCRIPT = `(function () {
  'use strict';
  var node = document.getElementById('content-dashboard-payload');
  if (!node) return;
  var payload;
  try { payload = JSON.parse(node.textContent || '{}'); } catch (error) { return; }
  var kind = payload.kind === 'page' ? 'page' : 'post';
  var base = payload.apiBase + '/api/' + (kind === 'post' ? 'posts' : 'pages');
  var rows = Array.isArray(payload.items) ? payload.items : [];
  var search = document.getElementById('content-search');
  var sort = document.getElementById('content-sort');
  var body = document.getElementById('content-rows');
  var bulkAction = document.getElementById('content-bulk-action');
  var bulkApply = document.getElementById('content-bulk-apply');
  var statusText = document.getElementById('content-status-text');
  var tabs = Array.prototype.slice.call(document.querySelectorAll('[data-content-status]'));
  var active = 'all';

  function esc(value) {
    return String(value === null || value === undefined ? '' : value)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function effective(item) {
    if (item.trashedAt) return 'trash';
    var status = item.status;
    if (status === 'scheduled' && item.publishAt && Date.parse(item.publishAt) <= Date.now()) return 'published';
    return status;
  }

  function matches(item) {
    if (active === 'trash' ? !item.trashedAt : !!item.trashedAt) return false;
    if (active !== 'all' && active !== 'trash' && effective(item) !== active) return false;
    var query = search ? search.value.trim().toLowerCase() : '';
    if (query === '') return true;
    var haystack = [item.title, item.slug, item.content];
    if (kind === 'post') haystack.push(item.excerpt, item.author, (item.labels || []).join(' '));
    return haystack.join(' ').toLowerCase().indexOf(query) !== -1;
  }

  function sorted(items) {
    var mode = sort ? sort.value : 'date-desc';
    return items.slice().sort(function (a, b) {
      if (mode === 'title-asc') return String(a.title).localeCompare(String(b.title));
      if (mode === 'title-desc') return String(b.title).localeCompare(String(a.title));
      var left = Date.parse(a.createdAt) || 0;
      var right = Date.parse(b.createdAt) || 0;
      return mode === 'date-asc' ? left - right : right - left;
    });
  }

  function row(item) {
    var status = effective(item);
    var label = status.charAt(0).toUpperCase() + status.slice(1);
    var trash = !!item.trashedAt;
    var cells = '<td><input type="checkbox" class="content-check" value="' + esc(item.id) + '" aria-label="Select ' + esc(item.title) + '"></td>' +
      '<td><a href="' + esc(item.path) + '">' + esc(item.title) + '</a><div class="recent-meta">/' + esc(item.slug) + '</div></td>';
    if (kind === 'post') {
      cells += '<td>' + esc(item.author) + '</td><td>' + esc((item.labels || []).join(', ')) + '</td>';
    }
    cells += '<td>' + esc(String(item.createdAt).slice(0, 10)) + '</td>' +
      '<td><span class="pill' + (status === 'draft' || status === 'trash' ? ' draft' : '') + '">' + esc(label) + '</span></td>' +
      '<td><div class="actions"><a href="/__preview/dashboard/' + kind + 's/new/?id=' + encodeURIComponent(item.id) + '">Edit</a>';
    if (trash) {
      cells += '<button type="button" class="btn" data-content-action="restore" data-id="' + esc(item.id) + '">Restore</button>' +
        '<button type="button" class="btn" data-content-action="delete" data-id="' + esc(item.id) + '">Delete forever</button>';
    } else {
      cells += '<a href="' + esc(item.path) + '">View</a>' +
        '<button type="button" class="btn" data-content-action="trash" data-id="' + esc(item.id) + '">Trash</button>';
    }
    return '<tr data-content-row="' + esc(item.id) + '">' + cells + '</div></td></tr>';
  }

  function render() {
    if (!body) return;
    var visible = sorted(rows.filter(matches));
    body.innerHTML = visible.map(row).join('');
    if (statusText) statusText.textContent = visible.length + ' of ' + rows.length + ' ' + kind + 's';
  }

  function message(text, error) {
    if (!statusText) return;
    statusText.textContent = text;
    statusText.setAttribute('data-state', error ? 'error' : 'saved');
  }

  function request(url, options) {
    message('Saving...', false);
    return fetch(url, Object.assign({ credentials: 'same-origin' }, options || {})).then(function (response) {
      if (!response.ok) return response.json().catch(function () { return {}; }).then(function (body) {
        var error = new Error(body.message || ('Request failed (' + response.status + ')'));
        error.payload = body;
        throw error;
      });
      return response.json();
    });
  }

  function json(method, path, value) {
    return request(base + path, {
      method: method,
      headers: { 'content-type': 'application/json' },
      body: value === undefined ? undefined : JSON.stringify(value)
    });
  }

  function reload() { window.location.reload(); }

  function act(button) {
    var id = button.getAttribute('data-id');
    var action = button.getAttribute('data-content-action');
    if (!id || !action) return;
    if (action === 'delete' && !window.confirm('Delete this ' + kind + ' permanently?')) return;
    if (action === 'trash' && !window.confirm('Move this ' + kind + ' to trash?')) return;
    var path = action === 'delete' ? '/' + encodeURIComponent(id) : '/' + encodeURIComponent(id) + '/' + action;
    var promise = action === 'delete' ? json('DELETE', path) : json('POST', path, {});
    promise.then(reload).catch(function (error) { message(error.message, true); });
  }

  if (body) {
    body.addEventListener('click', function (event) {
      var target = event.target;
      var button = target && target.closest ? target.closest('[data-content-action]') : null;
      if (button) act(button);
    });
  }
  for (var i = 0; i < tabs.length; i++) {
    tabs[i].addEventListener('click', function () {
      active = this.getAttribute('data-content-status') || 'all';
      for (var j = 0; j < tabs.length; j++) tabs[j].classList.toggle('active', tabs[j] === this);
      render();
    });
  }
  if (search) search.addEventListener('input', render);
  if (sort) sort.addEventListener('change', render);
  if (bulkApply) {
    bulkApply.addEventListener('click', function () {
      var checks = Array.prototype.slice.call(document.querySelectorAll('.content-check:checked'));
      var ids = checks.map(function (check) { return check.value; });
      if (ids.length === 0) { message('Select at least one ' + kind + '.', true); return; }
      var action = bulkAction ? bulkAction.value : 'publish';
      json('POST', '/bulk', { ids: ids, action: action }).then(reload).catch(function (error) { message(error.message, true); });
    });
  }
  render();
})();`;
