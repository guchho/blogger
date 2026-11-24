(function () {
  var root = document.querySelector('[data-guchho-preview="widget-showcase"]');
  if (!root) return;
  var cards = Array.prototype.slice.call(root.querySelectorAll('[data-widget-card]'));
  var search = root.querySelector('[data-widget-search]');
  var status = root.querySelector('[data-widget-status]');
  var empty = root.querySelector('[data-widget-empty]');
  var filters = Array.prototype.slice.call(root.querySelectorAll('[data-widget-filter]'));
  var active = 'All';

  function sync() {
    var query = (search && search.value || '').trim().toLowerCase();
    var visible = 0;
    for (var i = 0; i < cards.length; i++) {
      var card = cards[i];
      var matchesGroup = active === 'All' || card.getAttribute('data-group') === active;
      var text = (card.getAttribute('data-search') || '').toLowerCase();
      var matchesQuery = query === '' || text.indexOf(query) !== -1;
      var show = matchesGroup && matchesQuery;
      card.hidden = !show;
      if (show) visible++;
    }
    for (var j = 0; j < filters.length; j++) {
      filters[j].setAttribute('aria-pressed', String(filters[j].getAttribute('data-widget-filter') === active));
    }
    if (status) status.textContent = visible + ' of ' + cards.length + ' widgets';
    if (empty) empty.hidden = visible !== 0;
  }

  if (search) search.addEventListener('input', sync);
  for (var k = 0; k < filters.length; k++) {
    filters[k].addEventListener('click', function () {
      active = this.getAttribute('data-widget-filter') || 'All';
      sync();
    });
  }
  sync();
})();