import './styles.css';
import 'katex/dist/katex.min.css';
import { categories, pages } from 'virtual:content';
import { CATEGORY_LABELS, UI } from './i18n.js';

const CATEGORIES = ['grammar', 'explanations', 'vocabulary', 'exercises'];

// --- persisted state -------------------------------------------------------
const DEFAULT_SETTINGS = { font: 'sans', size: 18, spacing: 1.65, width: 760, theme: 'light' };
const FONT_STACKS = {
  sans: "system-ui, 'Segoe UI', Roboto, Helvetica, Arial, 'Noto Sans Arabic', 'Segoe UI Arabic', sans-serif",
  serif: "Georgia, Cambria, 'Times New Roman', 'Noto Naskh Arabic', 'Amiri', serif",
  arabic: "'Noto Naskh Arabic', 'Amiri', 'Geeza Pro', 'Al Bayan', 'Segoe UI Arabic', 'Times New Roman', serif",
};

let lang = load('lang', 'de');
if (!UI[lang]) lang = 'de';
let settings = { ...DEFAULT_SETTINGS, ...load('settings', {}) };

// group id -> { en?: slug, de?: slug } for the language switch
const groupIndex = {};
for (const [slug, page] of Object.entries(pages)) {
  if (!page.group) continue;
  (groupIndex[page.group] ||= {})[page.lang] = slug;
}

// --- elements --------------------------------------------------------------
const el = {
  brand: document.getElementById('brand'),
  categories: document.getElementById('categories'),
  langToggle: document.getElementById('langToggle'),
  downloadBtn: document.getElementById('downloadBtn'),
  settingsBtn: document.getElementById('settingsBtn'),
  settingsPanel: document.getElementById('settingsPanel'),
  app: document.getElementById('app'),
};

// --- init ------------------------------------------------------------------
applySettings();
el.settingsBtn.addEventListener('click', toggleSettings);
el.langToggle.addEventListener('click', switchLanguage);
el.downloadBtn.addEventListener('click', () => window.print());
window.addEventListener('hashchange', render);
document.addEventListener('click', (e) => {
  if (!el.settingsPanel.hidden && !el.settingsPanel.contains(e.target) && e.target !== el.settingsBtn) {
    el.settingsPanel.hidden = true;
  }
});
render();

// --- rendering -------------------------------------------------------------
function render() {
  const t = UI[lang];
  document.documentElement.lang = lang;
  el.brand.textContent = t.brand;
  el.langToggle.textContent = t.switchTo;
  el.langToggle.title = t.switchTo;
  el.downloadBtn.textContent = t.download;
  el.downloadBtn.title = t.downloadTitle;

  const route = parseHash();
  renderCategories(route);

  if (route.view === 'note') {
    renderNote(route);
    el.downloadBtn.hidden = false;
  } else if (route.view === 'list') {
    renderList(route.category);
    el.downloadBtn.hidden = true;
  } else {
    renderHome();
    el.downloadBtn.hidden = true;
  }
  window.scrollTo(0, 0);
}

function renderCategories(route) {
  const labels = CATEGORY_LABELS[lang];
  el.categories.innerHTML = '';
  for (const cat of CATEGORIES) {
    const a = document.createElement('a');
    a.href = `#/${cat}`;
    a.textContent = labels[cat];
    a.className = 'category-link';
    if (route.category === cat) a.classList.add('active');
    el.categories.appendChild(a);
  }
}

function renderHome() {
  const t = UI[lang];
  const div = document.createElement('div');
  div.className = 'home';
  div.textContent = t.home;
  swap(div);
}

function renderList(category) {
  const t = UI[lang];
  const items = (categories[category]?.[lang]) || [];
  const wrap = document.createElement('div');
  wrap.className = 'list-view';

  const h = document.createElement('h1');
  h.className = 'list-title';
  h.textContent = CATEGORY_LABELS[lang][category];
  wrap.appendChild(h);

  if (!items.length) {
    const p = document.createElement('p');
    p.className = 'empty';
    p.textContent = t.emptyCategory;
    wrap.appendChild(p);
  } else {
    const ul = document.createElement('ul');
    ul.className = 'page-list';
    for (const item of items) {
      const li = document.createElement('li');
      const a = document.createElement('a');
      a.href = `#/${category}/${item.slug}`;
      a.className = 'page-link';
      const title = document.createElement('span');
      title.className = 'page-link-title';
      title.textContent = item.title;
      a.appendChild(title);
      if (item.lesson) {
        const meta = document.createElement('span');
        meta.className = 'page-link-lesson';
        meta.textContent = item.lesson;
        a.appendChild(meta);
      }
      li.appendChild(a);
      ul.appendChild(li);
    }
    wrap.appendChild(ul);
  }
  swap(wrap);
}

function renderNote(route) {
  const t = UI[lang];
  const page = pages[route.slug];
  if (!page) {
    renderHome();
    return;
  }
  const article = document.createElement('article');
  article.className = 'note';

  const meta = document.createElement('div');
  meta.className = 'note-meta';
  meta.textContent = [CATEGORY_LABELS[lang][page.category], page.lesson].filter(Boolean).join(' · ');
  article.appendChild(meta);

  if (page.lang !== lang) {
    const banner = document.createElement('div');
    banner.className = 'lang-note';
    banner.textContent = UI[lang].onlyIn;
    article.appendChild(banner);
  }

  const body = document.createElement('div');
  body.className = 'note-body';
  body.innerHTML = page.html;
  article.appendChild(body);
  swap(article);
}

function swap(node) {
  el.app.replaceChildren(node);
}

// --- language switch -------------------------------------------------------
function switchLanguage() {
  const next = lang === 'de' ? 'en' : 'de';
  const route = parseHash();
  lang = next;
  save('lang', lang);

  // On a note with a translation, jump to the counterpart; otherwise re-render.
  if (route.view === 'note') {
    const page = pages[route.slug];
    const counterpart = page?.group ? groupIndex[page.group]?.[next] : null;
    if (counterpart && counterpart !== route.slug) {
      location.hash = `#/${pages[counterpart].category}/${counterpart}`;
      return; // hashchange triggers render
    }
  }
  render();
}

// --- settings --------------------------------------------------------------
function applySettings() {
  const root = document.documentElement;
  root.style.setProperty('--reading-font', FONT_STACKS[settings.font] || FONT_STACKS.sans);
  root.style.setProperty('--reading-size', settings.size + 'px');
  root.style.setProperty('--reading-lh', settings.spacing);
  root.style.setProperty('--reading-width', settings.width + 'px');
  root.dataset.theme = settings.theme;
}

function toggleSettings() {
  if (el.settingsPanel.hidden) {
    buildSettingsPanel();
    el.settingsPanel.hidden = false;
  } else {
    el.settingsPanel.hidden = true;
  }
}

function buildSettingsPanel() {
  const t = UI[lang];
  el.settingsPanel.innerHTML = '';
  const panel = el.settingsPanel;

  panel.appendChild(makeSelect(t.font, settings.font, [
    ['sans', t.fontSans], ['serif', t.fontSerif], ['arabic', t.fontArabic],
  ], (v) => { settings.font = v; commit(); }));

  panel.appendChild(makeRange(t.size, settings.size, 14, 26, 1, (v) => { settings.size = v; commit(); }, (v) => v + 'px'));
  panel.appendChild(makeRange(t.spacing, settings.spacing, 1.2, 2.2, 0.05, (v) => { settings.spacing = v; commit(); }, (v) => v.toFixed(2)));
  panel.appendChild(makeRange(t.width, settings.width, 560, 1000, 20, (v) => { settings.width = v; commit(); }, (v) => v + 'px'));

  panel.appendChild(makeSelect(t.theme, settings.theme, [
    ['light', t.light], ['dark', t.dark],
  ], (v) => { settings.theme = v; commit(); }));

  const reset = document.createElement('button');
  reset.type = 'button';
  reset.className = 'reset-btn';
  reset.textContent = t.reset;
  reset.addEventListener('click', () => {
    settings = { ...DEFAULT_SETTINGS };
    commit();
    buildSettingsPanel();
  });
  panel.appendChild(reset);

  function commit() {
    applySettings();
    save('settings', settings);
  }
}

function makeField(label, control) {
  const row = document.createElement('label');
  row.className = 'field';
  const span = document.createElement('span');
  span.className = 'field-label';
  span.textContent = label;
  row.appendChild(span);
  row.appendChild(control);
  return row;
}

function makeSelect(label, value, options, onChange) {
  const select = document.createElement('select');
  for (const [val, text] of options) {
    const opt = document.createElement('option');
    opt.value = val;
    opt.textContent = text;
    if (val === value) opt.selected = true;
    select.appendChild(opt);
  }
  select.addEventListener('change', () => onChange(select.value));
  return makeField(label, select);
}

function makeRange(label, value, min, max, step, onChange, fmt) {
  const container = document.createElement('div');
  container.className = 'range-wrap';
  const input = document.createElement('input');
  input.type = 'range';
  input.min = min; input.max = max; input.step = step; input.value = value;
  const out = document.createElement('span');
  out.className = 'range-value';
  out.textContent = fmt(value);
  input.addEventListener('input', () => {
    const v = Number(input.value);
    out.textContent = fmt(v);
    onChange(v);
  });
  container.appendChild(input);
  container.appendChild(out);
  return makeField(label, container);
}

// --- routing & storage -----------------------------------------------------
function parseHash() {
  const raw = location.hash.replace(/^#\/?/, '');
  const parts = raw.split('/').filter(Boolean).map(decodeURIComponent);
  if (parts.length === 0) return { view: 'home' };
  const category = CATEGORIES.includes(parts[0]) ? parts[0] : null;
  if (!category) return { view: 'home' };
  if (parts.length === 1) return { view: 'list', category };
  return { view: 'note', category, slug: parts[1] };
}

function load(key, fallback) {
  try {
    const v = localStorage.getItem(key);
    return v == null ? fallback : JSON.parse(v);
  } catch {
    return fallback;
  }
}

function save(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* ignore storage errors (private mode etc.) */
  }
}
