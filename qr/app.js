// ═══════════════════════════════════════════════════════
// gencod · QR code generator
// ═══════════════════════════════════════════════════════

// ═══ Constants ═══
const HISTORY_MAX = 50;
const HISTORY_KEY = 'gencod_history';
const LANG_KEY = 'gencod_lang';
const COOKIE_KEY = 'gencod_cookies_accepted';
const SENSITIVE_TYPES = new Set(['wifi', 'vcard']);
const DEBOUNCE_MS = 150;
const LOGO_MAX_BYTES = 500 * 1024;

const TYPE_ICONS = {
  url: '🔗', text: '✎', wifi: '📶', vcard: '👤',
  email: '✉', sms: '💬', geo: '📍',
};

// ═══ State ═══
let lang = 'sk';
let currentType = 'url';
let qrInstance = null;
let qrCurrentlyValid = false;
let logoDataUrl = null;
let logoFileName = '';
let debounceTimer = null;
let history = [];

// ═══ Init ═══
document.addEventListener('DOMContentLoaded', () => {
  loadHistory();
  bindEvents();

  // If user previously selected a language, skip the picker
  const savedLang = localStorage.getItem(LANG_KEY);
  if (savedLang && window.I18N[savedLang]) {
    lang = savedLang;
    enterApp(false);
  }
});

function bindEvents() {
  // All input fields trigger debounced regenerate
  document.querySelectorAll('#inputs-container input, #inputs-container textarea, #inputs-container select')
    .forEach(el => {
      el.addEventListener('input', debouncedRegenerate);
      el.addEventListener('change', debouncedRegenerate);
    });

  // Styling controls
  document.getElementById('opt-size').addEventListener('input', (e) => {
    document.getElementById('size-value').textContent = `${e.target.value} px`;
    debouncedRegenerate();
  });
  document.getElementById('opt-ecc').addEventListener('change', debouncedRegenerate);
  document.getElementById('opt-fg').addEventListener('input', (e) => {
    document.getElementById('fg-hex').textContent = e.target.value;
    debouncedRegenerate();
  });
  document.getElementById('opt-bg').addEventListener('input', (e) => {
    document.getElementById('bg-hex').textContent = e.target.value;
    debouncedRegenerate();
  });

  // Logo upload
  document.getElementById('logo-input').addEventListener('change', onLogoSelected);
}

// ═══════════════════════════════════════════════════════
// Language selection / switching
// ═══════════════════════════════════════════════════════
function selectLang(l) {
  lang = l;
  localStorage.setItem(LANG_KEY, l);
  enterApp(true);
}

function enterApp(animate) {
  const langScreen = document.getElementById('lang-screen');
  const app = document.getElementById('app');

  if (animate) {
    langScreen.classList.add('leaving');
    setTimeout(() => {
      langScreen.style.display = 'none';
      app.style.display = 'flex';
      setTimeout(() => {
        app.classList.add('visible');
        initApp();
      }, 20);
    }, 600);
  } else {
    langScreen.style.display = 'none';
    app.style.display = 'flex';
    app.classList.add('visible');
    initApp();
  }
}

function initApp() {
  applyLang();
  renderHistory();
  maybeShowCookieBanner();

  // Trigger initial generate if there's a value (e.g., after page refresh)
  regenerate();
}

function switchLang() {
  const app = document.getElementById('app');
  const langScreen = document.getElementById('lang-screen');
  app.style.opacity = '0';
  setTimeout(() => {
    app.style.display = 'none';
    langScreen.style.display = 'flex';
    langScreen.classList.remove('leaving');
    langScreen.style.opacity = '1';
    langScreen.style.transform = 'none';
    app.classList.remove('visible');
    app.style.opacity = '';
  }, 300);
}

function applyLang() {
  const c = window.I18N[lang];
  document.documentElement.lang = lang;

  // Header
  document.getElementById('curr-flag').textContent = c.flag;
  document.getElementById('lang-btn-label').textContent = c.switchBtn;

  // History panel
  document.getElementById('history-title').textContent = c.historyTitle;
  document.getElementById('history-clear-label').textContent = c.historyClear;


  // Tools panel (header only - links are bilingual by design)
  document.getElementById('tools-title').textContent = c.toolsTitle;

  // Main panel labels
  document.getElementById('type-label').textContent = c.typeLabel;
  document.getElementById('sensitive-warning-text').textContent = c.sensitiveWarning;
  document.getElementById('styling-title').textContent = c.stylingTitle;
  document.getElementById('size-label').textContent = c.sizeLabel;
  document.getElementById('ecc-label').textContent = c.eccLabel;
  document.getElementById('ecc-hint').textContent = c.eccHint;
  document.getElementById('colors-label').textContent = c.colorsLabel;
  document.getElementById('fg-label').textContent = c.fgColor;
  document.getElementById('bg-label').textContent = c.bgColor;
  document.getElementById('logo-label').textContent = c.logoLabel;
  document.getElementById('logo-upload-label').textContent = c.logoUpload;
  document.getElementById('preview-empty-text').textContent = c.outputEmpty;
  document.getElementById('dl-png-label').textContent = c.dlPng;
  document.getElementById('dl-svg-label').textContent = c.dlSvg;
  document.getElementById('copy-label').textContent = c.copyClipboard;

  // Type select options
  document.querySelectorAll('#qr-type option').forEach(opt => {
    const key = opt.dataset.i18nType;
    if (key && c.types[key]) opt.textContent = c.types[key];
  });

  // Per-type input labels
  document.querySelectorAll('[data-i18n-input]').forEach(el => {
    const key = el.dataset.i18nInput;
    if (c.inputs[key]) el.textContent = c.inputs[key];
  });

  // Placeholders
  document.querySelectorAll('[data-placeholder]').forEach(el => {
    const key = el.dataset.placeholder;
    if (c.inputs[key]) el.placeholder = c.inputs[key];
  });

  // Cookie banner
  document.getElementById('cookie-text').innerHTML = c.cookieText;
  document.getElementById('cookie-btn').textContent = c.cookieBtn;

  // Update history count and items
  renderHistory();
}

// ═══════════════════════════════════════════════════════
// Type switching
// ═══════════════════════════════════════════════════════
function onTypeChange() {
  currentType = document.getElementById('qr-type').value;

  // Show only the relevant input group
  document.querySelectorAll('.input-group').forEach(g => {
    g.style.display = g.dataset.type === currentType ? '' : 'none';
  });

  // Show sensitive warning for wifi/vcard
  const warn = document.getElementById('sensitive-warning');
  warn.style.display = SENSITIVE_TYPES.has(currentType) ? '' : 'none';

  regenerate();
}

// ═══════════════════════════════════════════════════════
// Data builders per type
// ═══════════════════════════════════════════════════════
function buildData() {
  const v = (id) => document.getElementById(id).value.trim();

  switch (currentType) {
    case 'url': {
      const url = v('in-url');
      return url || null;
    }
    case 'text': {
      const text = document.getElementById('in-text').value;
      return text.trim() ? text : null;
    }
    case 'wifi': {
      const ssid = v('in-wifi-ssid');
      if (!ssid) return null;
      const pass = v('in-wifi-pass');
      const enc = document.getElementById('in-wifi-enc').value;
      const hidden = document.getElementById('in-wifi-hidden').checked;
      // WIFI format: WIFI:T:<auth>;S:<ssid>;P:<pass>;H:<true|false>;;
      const esc = (s) => s.replace(/([\\;,":])/g, '\\$1');
      return `WIFI:T:${enc};S:${esc(ssid)};P:${esc(pass)};H:${hidden ? 'true' : 'false'};;`;
    }
    case 'vcard': {
      const name = v('in-vcard-name');
      if (!name) return null;
      const phone = v('in-vcard-phone');
      const email = v('in-vcard-email');
      const org = v('in-vcard-org');
      const url = v('in-vcard-url');
      const lines = ['BEGIN:VCARD', 'VERSION:3.0', `FN:${name}`];
      if (org) lines.push(`ORG:${org}`);
      if (phone) lines.push(`TEL;TYPE=CELL:${phone}`);
      if (email) lines.push(`EMAIL:${email}`);
      if (url) lines.push(`URL:${url}`);
      lines.push('END:VCARD');
      return lines.join('\n');
    }
    case 'email': {
      const to = v('in-email-to');
      if (!to) return null;
      const subj = v('in-email-subject');
      const body = document.getElementById('in-email-body').value;
      const params = [];
      if (subj) params.push(`subject=${encodeURIComponent(subj)}`);
      if (body) params.push(`body=${encodeURIComponent(body)}`);
      return `mailto:${to}${params.length ? '?' + params.join('&') : ''}`;
    }
    case 'sms': {
      const phone = v('in-sms-phone');
      if (!phone) return null;
      const body = document.getElementById('in-sms-body').value;
      return `SMSTO:${phone}${body ? ':' + body : ''}`;
    }
    case 'geo': {
      const lat = v('in-geo-lat');
      const lng = v('in-geo-lng');
      if (!lat || !lng) return null;
      return `geo:${lat},${lng}`;
    }
  }
  return null;
}

// ═══════════════════════════════════════════════════════
// QR generation (debounced)
// ═══════════════════════════════════════════════════════
function debouncedRegenerate() {
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(regenerate, DEBOUNCE_MS);
}

function regenerate() {
  const data = buildData();
  const card = document.getElementById('preview-card');
  const emptyText = document.getElementById('preview-empty-text');
  const container = document.getElementById('qr-canvas');

  if (!data) {
    qrCurrentlyValid = false;
    card.classList.add('empty');
    emptyText.style.display = '';
    container.style.display = 'none';
    updateDownloadButtons();
    return;
  }

  if (typeof QRCodeStyling === 'undefined') {
    console.warn('qr-code-styling not loaded yet');
    return;
  }

  const size = parseInt(document.getElementById('opt-size').value, 10);
  // If logo present, force H regardless of UI select (auto-rule)
  const eccSelected = document.getElementById('opt-ecc').value;
  const ecc = logoDataUrl ? 'H' : eccSelected;
  const fg = document.getElementById('opt-fg').value;
  const bg = document.getElementById('opt-bg').value;

  const options = {
    width: size,
    height: size,
    type: 'canvas',
    data,
    image: logoDataUrl || undefined,
    qrOptions: {
      errorCorrectionLevel: ecc,
    },
    dotsOptions: {
      color: fg,
      type: 'square',
    },
    backgroundOptions: {
      color: bg,
    },
    cornersSquareOptions: {
      color: fg,
      type: 'square',
    },
    cornersDotOptions: {
      color: fg,
      type: 'square',
    },
    imageOptions: {
      crossOrigin: 'anonymous',
      margin: 4,
      imageSize: 0.35,
      hideBackgroundDots: true,
    },
  };

  if (!qrInstance) {
    qrInstance = new QRCodeStyling(options);
    container.innerHTML = '';
    qrInstance.append(container);
  } else {
    qrInstance.update(options);
  }

  qrCurrentlyValid = true;
  card.classList.remove('empty');
  emptyText.style.display = 'none';
  container.style.display = '';
  updateDownloadButtons();
}

function updateDownloadButtons() {
  ['dl-png-btn', 'dl-svg-btn', 'copy-btn'].forEach(id => {
    document.getElementById(id).disabled = !qrCurrentlyValid;
  });
}

// ═══════════════════════════════════════════════════════
// Logo handling
// ═══════════════════════════════════════════════════════
function onLogoSelected(e) {
  const file = e.target.files[0];
  if (!file) return;

  const c = window.I18N[lang];
  if (file.size > LOGO_MAX_BYTES) {
    alert(c.err.logoTooLarge);
    e.target.value = '';
    return;
  }
  if (!file.type.startsWith('image/')) {
    alert(c.err.logoInvalid);
    e.target.value = '';
    return;
  }

  const reader = new FileReader();
  reader.onload = (ev) => {
    logoDataUrl = ev.target.result;
    logoFileName = file.name;

    document.getElementById('logo-zone-empty').style.display = 'none';
    document.getElementById('logo-preview').style.display = 'flex';
    document.getElementById('logo-img').src = logoDataUrl;
    document.getElementById('logo-name').textContent = file.name;

    regenerate();
  };
  reader.readAsDataURL(file);
}

function removeLogo(e) {
  e.stopPropagation();
  logoDataUrl = null;
  logoFileName = '';
  document.getElementById('logo-input').value = '';
  document.getElementById('logo-zone-empty').style.display = '';
  document.getElementById('logo-preview').style.display = 'none';
  regenerate();
}

// ═══════════════════════════════════════════════════════
// Downloads & clipboard
// ═══════════════════════════════════════════════════════
function downloadQr(extension) {
  if (!qrInstance || !qrCurrentlyValid) return;

  // For SVG, qr-code-styling requires the instance type = svg.
  // Rebuild a one-off SVG instance to export.
  if (extension === 'svg') {
    const data = buildData();
    if (!data) return;
    const size = parseInt(document.getElementById('opt-size').value, 10);
    const ecc = logoDataUrl ? 'H' : document.getElementById('opt-ecc').value;
    const fg = document.getElementById('opt-fg').value;
    const bg = document.getElementById('opt-bg').value;

    const svgInstance = new QRCodeStyling({
      width: size, height: size, type: 'svg', data,
      image: logoDataUrl || undefined,
      qrOptions: { errorCorrectionLevel: ecc },
      dotsOptions: { color: fg, type: 'square' },
      backgroundOptions: { color: bg },
      cornersSquareOptions: { color: fg, type: 'square' },
      cornersDotOptions: { color: fg, type: 'square' },
      imageOptions: { crossOrigin: 'anonymous', margin: 4, imageSize: 0.35, hideBackgroundDots: true, saveAsBlob: true },
    });
    svgInstance.download({ name: `gencod-${currentType}`, extension: 'svg' });
    saveToHistory();
    return;
  }

  qrInstance.download({ name: `gencod-${currentType}`, extension: 'png' });
  saveToHistory();
}

async function copyQrToClipboard() {
  if (!qrInstance || !qrCurrentlyValid) return;
  const c = window.I18N[lang];
  try {
    const blob = await qrInstance.getRawData('png');
    if (!navigator.clipboard || !navigator.clipboard.write) {
      throw new Error('Clipboard API not available');
    }
    await navigator.clipboard.write([
      new ClipboardItem({ 'image/png': blob }),
    ]);
    saveToHistory();
    const btn = document.getElementById('copy-btn');
    const label = document.getElementById('copy-label');
    label.textContent = c.copied;
    btn.classList.add('copied');
    setTimeout(() => {
      label.textContent = c.copyClipboard;
      btn.classList.remove('copied');
    }, 1800);
  } catch (err) {
    console.warn('Clipboard copy failed', err);
    alert(c.err.copyFail);
  }
}

// ═══════════════════════════════════════════════════════
// History
// ═══════════════════════════════════════════════════════
function saveToHistory() {
  const data = buildData();
  if (!data) return;
  if (SENSITIVE_TYPES.has(currentType)) return;

  // Snapshot current settings (variant B from our plan)
  const entry = {
    id: Date.now() + '-' + Math.random().toString(36).slice(2, 7),
    type: currentType,
    data,
    inputs: snapshotInputs(),
    options: {
      size: parseInt(document.getElementById('opt-size').value, 10),
      ecc: document.getElementById('opt-ecc').value,
      fg: document.getElementById('opt-fg').value,
      bg: document.getElementById('opt-bg').value,
      hasLogo: !!logoDataUrl,
      logo: logoDataUrl,
      logoName: logoFileName,
    },
    ts: Date.now(),
  };

  // Avoid duplicating the most recent entry if it has the same data string
  if (history.length > 0 && history[0].data === data && history[0].type === currentType) {
    history[0] = entry; // refresh timestamp & options
  } else {
    history.unshift(entry);
  }

  if (history.length > HISTORY_MAX) history.length = HISTORY_MAX;
  persistHistory();
  renderHistory();
}

function snapshotInputs() {
  // Save raw values of all input fields so we can fully restore
  const ids = [
    'in-url', 'in-text',
    'in-wifi-ssid', 'in-wifi-pass', 'in-wifi-enc', 'in-wifi-hidden',
    'in-vcard-name', 'in-vcard-phone', 'in-vcard-email', 'in-vcard-org', 'in-vcard-url',
    'in-email-to', 'in-email-subject', 'in-email-body',
    'in-sms-phone', 'in-sms-body',
    'in-geo-lat', 'in-geo-lng',
  ];
  const snap = {};
  ids.forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    if (el.type === 'checkbox') snap[id] = el.checked;
    else snap[id] = el.value;
  });
  return snap;
}

function loadHistory() {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    if (raw) history = JSON.parse(raw);
  } catch (e) {
    console.warn('Failed to load history', e);
    history = [];
  }
}

function persistHistory() {
  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
  } catch (e) {
    // localStorage might be full
    console.warn('Failed to persist history', e);
  }
}

function renderHistory() {
  const c = window.I18N[lang];
  const list = document.getElementById('history-list');
  const countEl = document.getElementById('history-count');
  const clearBtn = document.getElementById('history-clear-btn');

  countEl.textContent = c.historyCount(history.length, HISTORY_MAX);
  clearBtn.disabled = history.length === 0;

  list.innerHTML = '';

  if (history.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'history-empty';
    empty.textContent = c.historyEmpty;
    list.appendChild(empty);
    return;
  }

  history.forEach(entry => {
    const item = document.createElement('div');
    item.className = 'history-item';
    item.title = entry.data;
    item.onclick = () => restoreFromHistory(entry.id);

    const icon = document.createElement('div');
    icon.className = 'history-item-icon';
    icon.textContent = TYPE_ICONS[entry.type] || '◇';

    const body = document.createElement('div');
    body.className = 'history-item-body';

    const text = document.createElement('div');
    text.className = 'history-item-text';
    text.textContent = previewText(entry);

    const time = document.createElement('div');
    time.className = 'history-item-time';
    time.textContent = relativeTime(entry.ts);

    body.appendChild(text);
    body.appendChild(time);

    const del = document.createElement('button');
    del.className = 'history-item-delete';
    del.textContent = '×';
    del.title = c.historyItemDelete;
    del.onclick = (e) => {
      e.stopPropagation();
      deleteHistoryItem(entry.id);
    };

    item.appendChild(icon);
    item.appendChild(body);
    item.appendChild(del);
    list.appendChild(item);
  });
}

function previewText(entry) {
  // Short, human-readable summary per type
  const inp = entry.inputs || {};
  switch (entry.type) {
    case 'url': return inp['in-url'] || entry.data;
    case 'text': return (inp['in-text'] || entry.data).slice(0, 60);
    case 'email': return inp['in-email-to'] || entry.data;
    case 'sms': return inp['in-sms-phone'] || entry.data;
    case 'geo': return `${inp['in-geo-lat']}, ${inp['in-geo-lng']}`;
    default: return entry.data.slice(0, 60);
  }
}

function relativeTime(ts) {
  const c = window.I18N[lang];
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return c.historyJustNow;
  if (mins < 60) return c.historyMinAgo(mins);
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return c.historyHourAgo(hrs);
  const days = Math.floor(hrs / 24);
  return c.historyDayAgo(days);
}

function restoreFromHistory(id) {
  const entry = history.find(e => e.id === id);
  if (!entry) return;

  // Restore type
  document.getElementById('qr-type').value = entry.type;
  onTypeChange();

  // Restore inputs
  if (entry.inputs) {
    Object.entries(entry.inputs).forEach(([elId, val]) => {
      const el = document.getElementById(elId);
      if (!el) return;
      if (el.type === 'checkbox') el.checked = !!val;
      else el.value = val;
    });
  }

  // Restore options
  if (entry.options) {
    document.getElementById('opt-size').value = entry.options.size;
    document.getElementById('size-value').textContent = `${entry.options.size} px`;
    document.getElementById('opt-ecc').value = entry.options.ecc;
    document.getElementById('opt-fg').value = entry.options.fg;
    document.getElementById('fg-hex').textContent = entry.options.fg;
    document.getElementById('opt-bg').value = entry.options.bg;
    document.getElementById('bg-hex').textContent = entry.options.bg;

    if (entry.options.hasLogo && entry.options.logo) {
      logoDataUrl = entry.options.logo;
      logoFileName = entry.options.logoName || 'logo';
      document.getElementById('logo-zone-empty').style.display = 'none';
      document.getElementById('logo-preview').style.display = 'flex';
      document.getElementById('logo-img').src = logoDataUrl;
      document.getElementById('logo-name').textContent = logoFileName;
    } else if (logoDataUrl) {
      // History entry had no logo but we currently do - clear it
      logoDataUrl = null;
      logoFileName = '';
      document.getElementById('logo-input').value = '';
      document.getElementById('logo-zone-empty').style.display = '';
      document.getElementById('logo-preview').style.display = 'none';
    }
  }

  regenerate();
}

function deleteHistoryItem(id) {
  history = history.filter(e => e.id !== id);
  persistHistory();
  renderHistory();
}

function clearHistory() {
  if (history.length === 0) return;
  const c = window.I18N[lang];
  if (!confirm(c.historyClearConfirm)) return;
  history = [];
  persistHistory();
  renderHistory();
}

// ═══════════════════════════════════════════════════════
// Cookie banner
// ═══════════════════════════════════════════════════════
function maybeShowCookieBanner() {
  if (!localStorage.getItem(COOKIE_KEY)) {
    document.getElementById('cookie-banner').classList.add('visible');
  }
}
function acceptCookies() {
  localStorage.setItem(COOKIE_KEY, '1');
  document.getElementById('cookie-banner').classList.remove('visible');
}



