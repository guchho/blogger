(function () {
  'use strict';
  var layout = document.querySelector('[data-guchho-preview="dashboard-screen"]');
  var toggle = document.querySelector('[data-guchho-preview="nav-toggle"]');
  var backdrop = document.querySelector('[data-guchho-preview="nav-backdrop"]');
  if (!layout || !toggle) return;

  var query = window.matchMedia ? window.matchMedia('(max-width:760px)') : null;

  function isMobile() {
    return !!(query && query.matches);
  }

  function setOpen(open) {
    layout.setAttribute('data-nav', open ? 'open' : 'closed');
    toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
  }

  setOpen(!isMobile());

  toggle.addEventListener('click', function () {
    setOpen(layout.getAttribute('data-nav') !== 'open');
  });

  if (backdrop) {
    backdrop.addEventListener('click', function () { setOpen(false); });
  }

  document.addEventListener('keydown', function (event) {
    if (event.key === 'Escape' && layout.getAttribute('data-nav') === 'open') {
      setOpen(false);
      toggle.focus();
    }
  });

  var links = Array.prototype.slice.call(layout.querySelectorAll('.nav-item'));
  links.forEach(function (link) {
    link.addEventListener('click', function () {
      if (isMobile()) setOpen(false);
    });
  });

  if (query && query.addEventListener) {
    query.addEventListener('change', function () { setOpen(!query.matches); });
  } else if (query && query.addListener) {
    query.addListener(function () { setOpen(!query.matches); });
  }
})();