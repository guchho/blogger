(function () {
  var root = document.querySelector('[data-guchho-preview="theme-studio"]');
  if (!root) return;
  var tabs = Array.prototype.slice.call(root.querySelectorAll('[data-theme-tab]'));
  var panels = Array.prototype.slice.call(root.querySelectorAll('[data-theme-panel]'));
  var search = root.querySelector('[data-theme-search]');
  var copy = root.querySelector('[data-theme-copy]');
  var status = root.querySelector('[data-theme-status]');
  var active = 'xml';

  function lines(panel) {
    return panel ? Array.prototype.slice.call(panel.querySelectorAll('.theme-code-text')) : [];
  }

  function updateStatus(message) {
    if (status) status.textContent = message;
  }

  function filter() {
    var query = (search && search.value || '').trim().toLowerCase();
    for (var i = 0; i < panels.length; i++) {
      var rows = panels[i].querySelectorAll('.theme-code-line');
      var visible = 0;
      for (var j = 0; j < rows.length; j++) {
        var row = rows[j];
        var text = row.textContent || '';
        var show = query === '' || text.toLowerCase().indexOf(query) !== -1;
        row.hidden = !show;
        if (show) visible++;
      }
      if (panels[i].getAttribute('data-theme-panel') === active) {
        updateStatus(query === '' ? visible + ' lines' : visible + ' matching lines');
      }
    }
  }

  function activate(name) {
    active = name;
    for (var i = 0; i < tabs.length; i++) {
      tabs[i].setAttribute('aria-selected', String(tabs[i].getAttribute('data-theme-tab') === name));
    }
    for (var j = 0; j < panels.length; j++) {
      panels[j].hidden = panels[j].getAttribute('data-theme-panel') !== name;
    }
    if (search) search.value = '';
    filter();
  }

  for (var k = 0; k < tabs.length; k++) {
    tabs[k].addEventListener('click', function () {
      activate(this.getAttribute('data-theme-tab') || 'xml');
    });
  }
  if (search) search.addEventListener('input', filter);

  if (copy) {
    copy.addEventListener('click', function () {
      var panel = root.querySelector('[data-theme-panel="' + active + '"]');
      var text = lines(panel).map(function (line) {
        return line.textContent || '';
      }).join('\n');
      function done() {
        copy.textContent = 'Copied';
        updateStatus('Copied to clipboard');
        window.setTimeout(function () {
          copy.textContent = 'Copy';
        }, 1400);
      }
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(done, function () {
          updateStatus('Copy is unavailable in this browser');
        });
        return;
      }
      var area = document.createElement('textarea');
      area.value = text;
      area.setAttribute('readonly', '');
      area.style.position = 'fixed';
      area.style.opacity = '0';
      document.body.appendChild(area);
      area.select();
      try {
        document.execCommand('copy');
        done();
      } catch (error) {
        updateStatus('Copy is unavailable in this browser');
      }
      document.body.removeChild(area);
    });
  }

  activate('xml');
})();