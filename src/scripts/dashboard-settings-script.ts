import { DEFAULT_FAVICON_URL } from "../defaults.js";

export const DASHBOARD_SETTINGS_SCRIPT = `(function () {
  'use strict';
  var storageKey = 'guchho-preview-settings-v1';
  var fields = [
    'settings-title',
    'settings-description',
    'settings-favicon',
    'settings-blog-address',
    'settings-language',
    'settings-timezone',
    'settings-posts-per-page',
    'settings-comment-moderation',
    'settings-who-can-comment',
    'settings-enable-profile-images',
    'settings-accent',
    'settings-radius',
    'settings-show-title',
    'settings-show-description',
    'settings-show-sharing',
    'settings-analytics'
  ];

  function element(id) {
    return document.getElementById(id);
  }

  function defaultsFromForm() {
    var defaults = {};
    fields.forEach(function (id) {
      var input = element(id);
      if (!input) return;
      defaults[id] = input.type === 'checkbox' ? input.checked : input.value;
    });
    return defaults;
  }

  function readSaved() {
    try {
      var raw = window.localStorage.getItem(storageKey);
      return raw ? JSON.parse(raw) : {};
    } catch (error) {
      return {};
    }
  }

  function writeSaved(value) {
    try {
      window.localStorage.setItem(storageKey, JSON.stringify(value));
      return true;
    } catch (error) {
      return false;
    }
  }

  function faviconSrc(value) {
    var source = String(value === null || value === undefined ? '' : value).trim();
    if (!source) return ${JSON.stringify(DEFAULT_FAVICON_URL)};
    if (/^(data:image\\/(png|jpeg|gif|webp|svg\\+xml);|https?:\\/\\/|\\/)/i.test(source)) return source;
    return '/' + source.replace(/^\\.\\//, '');
  }

  function setStatus(text, state) {
    var status = element('settings-status');
    if (!status) return;
    status.textContent = text;
    status.setAttribute('data-state', state || 'saved');
  }

  var defaults = defaultsFromForm();
  var state = {};
  var saved = readSaved();
  Object.keys(defaults).forEach(function (id) {
    state[id] = Object.prototype.hasOwnProperty.call(saved, id) ? saved[id] : defaults[id];
  });

  function applyToForm() {
    fields.forEach(function (id) {
      var input = element(id);
      if (!input) return;
      var value = state[id];
      if (input.type === 'checkbox') input.checked = value === true;
      else input.value = value === null || value === undefined ? '' : String(value);
    });
  }

  function syncFromForm() {
    fields.forEach(function (id) {
      var input = element(id);
      if (!input) return;
      state[id] = input.type === 'checkbox' ? input.checked : input.value;
    });
  }

  function setText(id, text) {
    var node = element(id);
    if (node) node.textContent = text;
  }

  function updatePreview() {
    var title = String(state['settings-title'] || 'Untitled blog');
    var description = String(state['settings-description'] || 'Add a short description for your blog.');
    setText('settings-preview-title', title);
    setText('settings-preview-description', description);
    setText('settings-preview-url', String(state['settings-blog-address'] || location.host));
    setText(
      'settings-preview-meta',
      String(state['settings-posts-per-page'] || '10') + ' posts per page · ' +
      String(state['settings-language'] || 'English')
    );
    var favicon = element('settings-preview-favicon');
    if (favicon) favicon.setAttribute('src', faviconSrc(state['settings-favicon']));
    var headIcon = document.querySelector('link[rel="icon"]');
    if (headIcon) headIcon.setAttribute('href', faviconSrc(state['settings-favicon']));
    var sharing = element('settings-preview-sharing');
    if (sharing) sharing.hidden = state['settings-show-sharing'] !== true;
    var previewTitle = element('settings-preview-title');
    if (previewTitle) previewTitle.hidden = state['settings-show-title'] === false;
    var previewDescription = element('settings-preview-description');
    if (previewDescription) previewDescription.hidden = state['settings-show-description'] === false;
    var preview = element('settings-preview');
    if (preview) {
      preview.style.setProperty('--settings-accent', String(state['settings-accent'] || '#1a73e8'));
      preview.style.setProperty('--settings-radius', String(state['settings-radius'] || '12') + 'px');
    }
  }

  fields.forEach(function (id) {
    var input = element(id);
    if (!input) return;
    input.addEventListener('input', function () {
      syncFromForm();
      updatePreview();
      setStatus('Unsaved changes', 'dirty');
    });
    input.addEventListener('change', function () {
      syncFromForm();
      updatePreview();
      setStatus('Unsaved changes', 'dirty');
    });
  });

  var file = element('settings-favicon-file');
  if (file && window.FileReader) {
    file.addEventListener('change', function () {
      var image = file.files && file.files[0];
      if (!image) return;
      if (!/^image\\//.test(image.type)) {
        setStatus('Choose an image file', 'error');
        return;
      }
      var reader = new FileReader();
      reader.onload = function () {
        var input = element('settings-favicon');
        if (input) input.value = String(reader.result || '');
        syncFromForm();
        updatePreview();
        setStatus('Favicon ready to save', 'dirty');
      };
      reader.readAsDataURL(image);
    });
  }

  var save = element('settings-save');
  if (save) save.addEventListener('click', function () {
    syncFromForm();
    var stored = writeSaved(state);
    setStatus(stored ? 'Saved in this browser' : 'Saved for this session', 'saved');
  });

  var reset = element('settings-reset');
  if (reset) reset.addEventListener('click', function () {
    try { window.localStorage.removeItem(storageKey); } catch (error) {}
    state = Object.assign({}, defaults);
    applyToForm();
    updatePreview();
    setStatus('Defaults restored', 'saved');
  });

  applyToForm();
  updatePreview();
  if (Object.keys(saved).length > 0) setStatus('Saved draft loaded', 'saved');
})();`;
