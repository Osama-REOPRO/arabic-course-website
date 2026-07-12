import './styles.css';
import 'katex/dist/katex.min.css';
import { categories, pages } from 'virtual:content';

// Nav order, left to right. The first entry is also the landing page.
const CATEGORIES = ['explanations', 'vocabulary', 'exercises', 'grammar'];
const HOME_CATEGORY = 'explanations';

const CATEGORY_LABELS = {
  explanations: 'Erklärungen',
  vocabulary: 'Vokabeln',
  exercises: 'Übungen',
  grammar: 'Grammatik-Referenz',
};

// Optional intro text shown under a category's list title.
// `linkText` inside `text` becomes a link to `linkHash`.
const CATEGORY_INTROS = {
  grammar: {
    text: 'Das sind kompakte Referenzblätter zum schnellen Nachschlagen – nur die Regeln, ohne lange Erklärungen. Die vollständigen Erklärungen findest du unter Erklärungen.',
    linkText: 'Erklärungen',
    linkHash: '#/explanations',
  },
};

const UI = {
  brand: 'Arabisch-Kurs',
  download: 'Als PDF',
  downloadTitle: 'Diese Seite als PDF speichern',
  font: 'Schriftart',
  fontSans: 'Serifenlos',
  fontSerif: 'Serif',
  fontArabic: 'Arabisch optimiert',
  size: 'Textgröße',
  spacing: 'Zeilenabstand',
  width: 'Seitenbreite',
  theme: 'Design',
  light: 'Hell',
  dark: 'Dunkel',
  reset: 'Zurücksetzen',
  emptyCategory: 'Hier sind noch keine Seiten.',
};

// --- persisted settings ------------------------------------------------------
const DEFAULT_SETTINGS = { font: 'sans', size: 18, spacing: 1.65, width: 760, theme: 'light' };
const FONT_STACKS = {
  sans: "system-ui, 'Segoe UI', Roboto, Helvetica, Arial, 'Noto Sans Arabic', 'Segoe UI Arabic', sans-serif",
  serif: "Georgia, Cambria, 'Times New Roman', 'Noto Naskh Arabic', 'Amiri', serif",
  arabic: "'Noto Naskh Arabic', 'Amiri', 'Geeza Pro', 'Al Bayan', 'Segoe UI Arabic', 'Times New Roman', serif",
};

let settings = { ...DEFAULT_SETTINGS, ...load('settings', {}) };

// --- elements ----------------------------------------------------------------
const el = {
  brand: document.getElementById('brand'),
  categories: document.getElementById('categories'),
  downloadBtn: document.getElementById('downloadBtn'),
  settingsBtn: document.getElementById('settingsBtn'),
  settingsPanel: document.getElementById('settingsPanel'),
  app: document.getElementById('app'),
};

// --- init ----------------------------------------------------------------------
applySettings();
el.brand.textContent = UI.brand;
el.downloadBtn.textContent = UI.download;
el.downloadBtn.title = UI.downloadTitle;
el.settingsBtn.addEventListener('click', toggleSettings);
el.downloadBtn.addEventListener('click', () => window.print());
window.addEventListener('hashchange', render);
document.addEventListener('click', (e) => {
  if (!el.settingsPanel.hidden && !el.settingsPanel.contains(e.target) && e.target !== el.settingsBtn) {
    el.settingsPanel.hidden = true;
  }
});
render();

// --- rendering -----------------------------------------------------------------
function render() {
  const route = parseHash();
  renderCategories(route);

  if (route.view === 'note') {
    renderNote(route);
    el.downloadBtn.hidden = false;
  } else {
    renderList(route.category);
    el.downloadBtn.hidden = true;
  }
  window.scrollTo(0, 0);
}

function renderCategories(route) {
  el.categories.innerHTML = '';
  for (const cat of CATEGORIES) {
    const a = document.createElement('a');
    a.href = `#/${cat}`;
    a.textContent = CATEGORY_LABELS[cat];
    a.className = 'category-link';
    if (route.category === cat) a.classList.add('active');
    el.categories.appendChild(a);
  }
}

function renderList(category) {
  const items = categories[category] || [];
  const wrap = document.createElement('div');
  wrap.className = 'list-view';

  const h = document.createElement('h1');
  h.className = 'list-title';
  h.textContent = CATEGORY_LABELS[category];
  wrap.appendChild(h);

  const intro = CATEGORY_INTROS[category];
  if (intro) {
    const p = document.createElement('p');
    p.className = 'list-intro';
    // link the LAST occurrence of linkText (earlier ones are part of the prose)
    const i = intro.linkText ? intro.text.lastIndexOf(intro.linkText) : -1;
    if (i === -1) {
      p.textContent = intro.text;
    } else {
      p.append(intro.text.slice(0, i));
      const a = document.createElement('a');
      a.href = intro.linkHash;
      a.textContent = intro.linkText;
      p.appendChild(a);
      p.append(intro.text.slice(i + intro.linkText.length));
    }
    wrap.appendChild(p);
  }

  if (!items.length) {
    const p = document.createElement('p');
    p.className = 'empty';
    p.textContent = UI.emptyCategory;
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
  const page = pages[route.slug];
  if (!page) {
    renderList(HOME_CATEGORY);
    return;
  }
  const article = document.createElement('article');
  article.className = 'note';

  const meta = document.createElement('div');
  meta.className = 'note-meta';
  meta.textContent = [CATEGORY_LABELS[page.category], page.lesson].filter(Boolean).join(' · ');
  article.appendChild(meta);

  const body = document.createElement('div');
  body.className = 'note-body';
  body.innerHTML = page.html;
  article.appendChild(body);
  swap(article);
}

function swap(node) {
  el.app.replaceChildren(node);
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
  el.settingsPanel.innerHTML = '';
  const panel = el.settingsPanel;

  panel.appendChild(makeSelect(UI.font, settings.font, [
    ['sans', UI.fontSans], ['serif', UI.fontSerif], ['arabic', UI.fontArabic],
  ], (v) => { settings.font = v; commit(); }));

  panel.appendChild(makeRange(UI.size, settings.size, 14, 26, 1, (v) => { settings.size = v; commit(); }, (v) => v + 'px'));
  panel.appendChild(makeRange(UI.spacing, settings.spacing, 1.2, 2.2, 0.05, (v) => { settings.spacing = v; commit(); }, (v) => v.toFixed(2)));
  panel.appendChild(makeRange(UI.width, settings.width, 560, 1000, 20, (v) => { settings.width = v; commit(); }, (v) => v + 'px'));

  panel.appendChild(makeSelect(UI.theme, settings.theme, [
    ['light', UI.light], ['dark', UI.dark],
  ], (v) => { settings.theme = v; commit(); }));

  const reset = document.createElement('button');
  reset.type = 'button';
  reset.className = 'reset-btn';
  reset.textContent = UI.reset;
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
  const category = CATEGORIES.includes(parts[0]) ? parts[0] : null;
  if (!category) return { view: 'list', category: HOME_CATEGORY };
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
