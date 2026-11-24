(function () {
  var root = document.querySelector('[data-guchho-preview="comments-studio"]');
  if (!root) return;
  var search = root.querySelector('[data-comment-search]');
  var tabs = Array.prototype.slice.call(root.querySelectorAll('[data-comment-tab]'));
  var rows = Array.prototype.slice.call(root.querySelectorAll('[data-comment-row]'));
  var checks = Array.prototype.slice.call(root.querySelectorAll('[data-comment-check]'));
  var selectAll = root.querySelector('[data-comment-select-all]');
  var deleteSelected = root.querySelector('[data-comment-delete-selected]');
  var exportButton = root.querySelector('[data-comment-export]');
  var summary = root.querySelector('[data-comment-summary]');
  var selectedLabel = root.querySelector('[data-comment-selected]');
  var empty = root.querySelector('[data-comment-empty]');
  var active = 'all';
  var labels = {
    published: 'Published',
    awaiting: 'Awaiting moderation',
    spam: 'Spam'
  };

  function status(row) {
    return row.getAttribute('data-status') || 'published';
  }

  function removed(row) {
    return row.getAttribute('data-removed') === 'true';
  }

  function checked() {
    return checks.filter(function (box) {
      var row = box.closest('[data-comment-row]');
      return box.checked && row && !removed(row);
    });
  }

  function updateSummary(shown) {
    var counts = { all: 0, published: 0, awaiting: 0, spam: 0 };
    for (var i = 0; i < rows.length; i++) {
      if (removed(rows[i])) continue;
      var value = status(rows[i]);
      counts.all++;
      if (counts[value] === undefined) counts[value] = 0;
      counts[value]++;
    }
    var counters = root.querySelectorAll('[data-comment-count]');
    for (var j = 0; j < counters.length; j++) {
      var key = counters[j].getAttribute('data-comment-count') || 'all';
      counters[j].textContent = String(counts[key] === undefined ? 0 : counts[key]);
    }
    var count = checked().length;
    if (selectedLabel) selectedLabel.textContent = count + ' selected';
    if (summary) {
      summary.textContent = count
        ? count + ' comment' + (count === 1 ? '' : 's') + ' selected'
        : shown + ' comment' + (shown === 1 ? '' : 's') + ' shown';
    }
  }

  function apply() {
    var query = (search && search.value || '').trim().toLowerCase();
    var shown = 0;
    for (var i = 0; i < rows.length; i++) {
      var row = rows[i];
      var matchesStatus = active === 'all' || status(row) === active;
      var text = (row.textContent || '').toLowerCase();
      var show = matchesStatus && !removed(row) && (query === '' || text.indexOf(query) !== -1);
      row.hidden = !show;
      if (show) shown++;
    }
    if (empty) empty.hidden = shown !== 0;
    if (selectAll) {
      var visibleBoxes = checks.filter(function (box) {
        var row = box.closest('[data-comment-row]');
        return row && !row.hidden && !removed(row);
      });
      selectAll.checked = visibleBoxes.length > 0 && visibleBoxes.every(function (box) {
        return box.checked;
      });
      selectAll.indeterminate = visibleBoxes.some(function (box) {
        return box.checked;
      }) && !selectAll.checked;
    }
    updateSummary(shown);
  }

  function setStatus(row, value) {
    row.setAttribute('data-status', value);
    var pill = row.querySelector('[data-comment-status]');
    if (pill) {
      pill.textContent = labels[value] || value;
      pill.className = 'comment-status comment-status-' + value;
    }
    var box = row.querySelector('[data-comment-check]');
    if (box) box.checked = false;
  }

  function remove(row) {
    row.setAttribute('data-removed', 'true');
    row.hidden = true;
    var box = row.querySelector('[data-comment-check]');
    if (box) box.checked = false;
  }

  function message(text) {
    if (summary) summary.textContent = text;
  }

  for (var i = 0; i < tabs.length; i++) {
    tabs[i].addEventListener('click', function () {
      active = this.getAttribute('data-comment-tab') || 'all';
      for (var j = 0; j < tabs.length; j++) {
        tabs[j].setAttribute('aria-selected', String(tabs[j] === this));
      }
      apply();
    });
  }
  if (search) search.addEventListener('input', apply);
  if (selectAll) {
    selectAll.addEventListener('change', function () {
      for (var k = 0; k < checks.length; k++) {
        var row = checks[k].closest('[data-comment-row]');
        if (row && !row.hidden && !removed(row)) checks[k].checked = selectAll.checked;
      }
      apply();
    });
  }
  for (var m = 0; m < checks.length; m++) {
    checks[m].addEventListener('change', apply);
  }
  for (var n = 0; n < rows.length; n++) {
    var actions = rows[n].querySelectorAll('[data-comment-action]');
    for (var a = 0; a < actions.length; a++) {
      actions[a].addEventListener('click', function () {
        var row = this.closest('[data-comment-row]');
        if (!row) return;
        var action = this.getAttribute('data-comment-action');
        if (action === 'approve') {
          setStatus(row, 'published');
          message('Comment approved');
        } else if (action === 'spam') {
          setStatus(row, 'spam');
          message('Comment marked as spam');
        } else if (action === 'delete') {
          remove(row);
          message('Comment deleted');
        }
        apply();
      });
    }
  }
  if (deleteSelected) {
    deleteSelected.addEventListener('click', function () {
      var selected = checked();
      for (var s = 0; s < selected.length; s++) {
        var row = selected[s].closest('[data-comment-row]');
        if (row) remove(row);
      }
      message(selected.length + ' comment' + (selected.length === 1 ? '' : 's') + ' deleted');
      apply();
    });
  }
  if (exportButton) {
    exportButton.addEventListener('click', function () {
      var lines = ['Status,Author,Comment,Post'];
      for (var e = 0; e < rows.length; e++) {
        if (removed(rows[e])) continue;
        var cells = [
          rows[e].querySelector('[data-comment-status]'),
          rows[e].querySelector('[data-comment-author]'),
          rows[e].querySelector('[data-comment-body]'),
          rows[e].querySelector('[data-comment-post]')
        ].map(function (cell) {
          return '"' + (cell && cell.textContent || '').trim().replace(/"/g, '""') + '"';
        });
        lines.push(cells.join(','));
      }
      var blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8' });
      var link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = 'preview-comments.csv';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(link.href);
      message('Comments exported');
    });
  }

  apply();
})();