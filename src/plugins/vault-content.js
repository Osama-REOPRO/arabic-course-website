// Vite plugin: turn the Obsidian vault (_Lessons/) into site content.
//
// At build time (and on the fly in dev) it:
//   1. walks the vault and reads every .md file's frontmatter
//   2. keeps only notes marked `publish: true`
//   3. copies every referenced image into public/attachments/ (basename-resolved)
//   4. renders each published note to HTML with our Obsidian-aware markdown-it
//   5. exposes the result to the app as the virtual module `virtual:content`:
//        export const categories = { grammar: { en: [...], de: [...] }, ... }
//        export const pages      = { <slug>: { title, category, lang, group, lesson, html } }
//
// In dev it watches _Lessons/ and reloads the page when a note changes, so a
// typo fix is visible instantly.

import fs from 'node:fs';
import path from 'node:path';
import matter from 'gray-matter';
import { createMd, applyDirectives, expandEmbeds } from './obsidian.js';

const VIRTUAL_ID = 'virtual:content';
const RESOLVED_ID = '\0' + VIRTUAL_ID;

const CATEGORIES = ['grammar', 'explanations', 'vocabulary', 'exercises'];
const CATEGORY_ALIASES = {
  grammar: 'grammar', grammatik: 'grammar',
  explanation: 'explanations', explanations: 'explanations', erklärung: 'explanations', erklärungen: 'explanations',
  vocab: 'vocabulary', vocabulary: 'vocabulary', wortschatz: 'vocabulary', vokabeln: 'vocabulary',
  exercise: 'exercises', exercises: 'exercises', übung: 'exercises', übungen: 'exercises', hausaufgabe: 'exercises',
};
const IMAGE_RE = /\.(png|jpe?g|gif|svg|webp|avif|bmp)$/i;

export function vaultContent({ vaultDir = '_Lessons' } = {}) {
  let root = process.cwd();
  let base = '/';
  let publicAttachmentsDir = '';

  function build() {
    const vaultPath = path.resolve(root, vaultDir);
    const files = walk(vaultPath).filter((f) => f.endsWith('.md'));

    // (a) index every image file by basename, and note all notes' raw content
    //     (embeds can transclude any note, published or not).
    const imageFiles = walk(vaultPath).filter((f) => IMAGE_RE.test(f));
    const imageIndex = copyImages(imageFiles, publicAttachmentsDir, base);

    const notesByName = new Map(); // basename -> { content } for embed expansion
    const parsed = [];
    for (const file of files) {
      const rawFile = fs.readFileSync(file, 'utf8');
      const { data, content } = matter(rawFile);
      const baseName = path.basename(file, '.md');
      notesByName.set(baseName.toLowerCase(), { content });
      parsed.push({ file, data, content, baseName });
    }

    // (b) assign slugs + build the wikilink target index for PUBLISHED notes.
    const usedSlugs = new Set();
    const noteIndex = new Map(); // name/title -> { slug, category }
    const published = [];
    for (const p of parsed) {
      // Obsidian's property editor often stores values as single-item YAML lists
      // (e.g. `order:\n  - "5"`), so unwrap arrays and coerce types defensively.
      const d = p.data;
      if (!isTrue(first(d.publish))) continue;
      const category = normalizeCategory(first(d.category));
      if (!category) {
        warn(`"${p.baseName}" has publish:true but no valid category — skipped.`);
        continue;
      }
      const titleVal = first(d.title);
      const title = (titleVal != null && titleVal !== '' ? titleVal : p.baseName).toString();
      const slug = uniqueSlug(title, usedSlugs);
      const lang = String(first(d.lang) || 'de').toLowerCase() === 'en' ? 'en' : 'de';
      const groupVal = first(d.group);
      const note = {
        slug,
        title,
        category,
        lang,
        group: groupVal != null && groupVal !== '' ? String(groupVal) : null,
        order: toOrder(first(d.order)),
        lesson: lektionLabel(first(d.lektion)),
        content: p.content,
        file: p.file,
      };
      published.push(note);
      noteIndex.set(p.baseName.toLowerCase(), { slug, category });
      noteIndex.set(note.title.toLowerCase(), { slug, category });
    }

    // (c) render each published note.
    const md = createMd();
    const pages = {};
    const categories = Object.fromEntries(CATEGORIES.map((c) => [c, { en: [], de: [] }]));
    for (const note of published) {
      const expanded = expandEmbeds(note.content, notesByName);
      const withDirectives = applyDirectives(expanded);
      const html = md.render(withDirectives, { noteIndex, imageIndex });
      pages[note.slug] = {
        title: note.title,
        category: note.category,
        lang: note.lang,
        group: note.group,
        lesson: note.lesson,
        html,
      };
      categories[note.category][note.lang].push({
        slug: note.slug,
        title: note.title,
        lesson: note.lesson,
        group: note.group,
        order: note.order,
      });
    }

    // (d) order each list: explicit `order` first, then lesson number, then title.
    for (const cat of CATEGORIES) {
      for (const lang of ['en', 'de']) {
        categories[cat][lang].sort(compareEntries);
        categories[cat][lang].forEach((e) => delete e.order);
      }
    }

    return { categories, pages };
  }

  return {
    name: 'vault-content',
    enforce: 'pre',

    configResolved(config) {
      root = config.root;
      base = config.base || '/';
      publicAttachmentsDir = path.resolve(root, 'public/attachments');
    },

    resolveId(id) {
      if (id === VIRTUAL_ID) return RESOLVED_ID;
    },

    load(id) {
      if (id !== RESOLVED_ID) return;
      const { categories, pages } = build();
      return (
        `export const categories = ${JSON.stringify(categories)};\n` +
        `export const pages = ${JSON.stringify(pages)};\n`
      );
    },

    configureServer(server) {
      const vaultPath = path.resolve(root, vaultDir);
      server.watcher.add(vaultPath);
      const reload = (file) => {
        if (!file.startsWith(vaultPath)) return;
        const mod = server.moduleGraph.getModuleById(RESOLVED_ID);
        if (mod) server.moduleGraph.invalidateModule(mod);
        server.ws.send({ type: 'full-reload' });
      };
      server.watcher.on('change', reload);
      server.watcher.on('add', reload);
      server.watcher.on('unlink', reload);
    },
  };
}

// --- helpers ---------------------------------------------------------------

function walk(dir) {
  const out = [];
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const entry of entries) {
    if (entry.name.startsWith('.')) continue; // skip .obsidian, .git, etc.
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(full));
    else out.push(full);
  }
  return out;
}

function copyImages(imageFiles, destDir, base) {
  const index = new Map(); // basename(lower) -> url
  fs.rmSync(destDir, { recursive: true, force: true });
  if (imageFiles.length) fs.mkdirSync(destDir, { recursive: true });
  const usedNames = new Set();
  for (const file of imageFiles) {
    const baseName = path.basename(file);
    const key = baseName.toLowerCase();
    if (index.has(key)) {
      warn(`duplicate image basename "${baseName}" — keeping the first, ignoring ${file}`);
      continue;
    }
    const safe = uniqueName(sanitizeFileName(baseName), usedNames);
    fs.copyFileSync(file, path.join(destDir, safe));
    index.set(key, `${base}attachments/${encodeURIComponent(safe)}`);
  }
  return index;
}

function sanitizeFileName(name) {
  const ext = path.extname(name);
  const stem = path.basename(name, ext).replace(/[^\w.-]+/g, '_').replace(/_+/g, '_');
  return (stem || 'image') + ext.toLowerCase();
}

function uniqueName(name, used) {
  const ext = path.extname(name);
  const stem = path.basename(name, ext);
  let candidate = name;
  let i = 1;
  while (used.has(candidate.toLowerCase())) candidate = `${stem}-${i++}${ext}`;
  used.add(candidate.toLowerCase());
  return candidate;
}

function slugify(s) {
  return (
    String(s)
      .toLowerCase()
      .normalize('NFKD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'note'
  );
}

function uniqueSlug(s, used) {
  const base = slugify(s);
  let candidate = base;
  let i = 2;
  while (used.has(candidate)) candidate = `${base}-${i++}`;
  used.add(candidate);
  return candidate;
}

function normalizeCategory(value) {
  if (!value) return null;
  const key = String(value).trim().toLowerCase();
  return CATEGORY_ALIASES[key] || (CATEGORIES.includes(key) ? key : null);
}

// Unwrap Obsidian's single-item list properties; leave scalars as-is.
function first(v) {
  return Array.isArray(v) ? v[0] : v;
}

function isTrue(v) {
  return v === true || v === 'true';
}

function toOrder(v) {
  if (v == null || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

// The displayed "Lektion N" label comes from the optional `lektion` frontmatter
// property (folder names are just organisation and don't map to real lessons).
function lektionLabel(v) {
  if (v == null || v === '') return '';
  return `Lektion ${v}`;
}

function lessonNumber(label) {
  const m = /(\d+)/.exec(label || '');
  return m ? Number(m[1]) : Infinity;
}

function compareEntries(a, b) {
  const ao = a.order ?? Infinity;
  const bo = b.order ?? Infinity;
  if (ao !== bo) return ao - bo;
  const al = lessonNumber(a.lesson);
  const bl = lessonNumber(b.lesson);
  if (al !== bl) return al - bl;
  return a.title.localeCompare(b.title);
}

function warn(msg) {
  console.warn(`[vault-content] ${msg}`);
}
