// Obsidian-flavoured markdown handling.
//
// This module turns the vault's Obsidian markdown into HTML the way *we* want,
// which is the whole point of building our own site instead of using a generic
// renderer. It exposes three things:
//
//   applyDirectives(raw)          - your custom, extensible syntax (page breaks, gaps, ...)
//   expandEmbeds(raw, notes, ...) - inline `![[Note]]` note transclusion
//   createMd()                    - a configured markdown-it (wikilinks, callouts, ::, math)
//
// The renderer reads per-note context from the `env` passed to `md.render(raw, env)`:
//   env.noteIndex  : Map<lowercased name, { slug, category }>   (for [[wikilinks]])
//   env.imageIndex : Map<lowercased basename, url>              (for ![[image.png]])

import { createRequire } from 'module';
import MarkdownIt from 'markdown-it';
import attrs from 'markdown-it-attrs';

const IMAGE_EXTS = ['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp', 'avif', 'bmp'];
const imageExtRe = new RegExp(`\\.(${IMAGE_EXTS.join('|')})$`, 'i');

// ---------------------------------------------------------------------------
// 1. Custom directives  —  THE place to define your own syntax.
//
// Each directive is written in a note as an HTML comment so it stays invisible
// in Obsidian's own preview but is interpreted here:
//
//     <!-- pagebreak -->        forces a page break when exported to PDF
//     <!-- gap:2rem -->         inserts 2rem of vertical space
//
// To add a new one, add a function to this registry. It receives the optional
// argument after the colon and returns the HTML to inject.
// ---------------------------------------------------------------------------
export const directives = {
  pagebreak: () => '<div class="pagebreak" aria-hidden="true"></div>',
  gap: (arg) => `<div class="gap" style="height:${sanitizeLength(arg) || '1rem'}" aria-hidden="true"></div>`,
};

function sanitizeLength(value) {
  if (!value) return '';
  // allow 2rem, 12px, 1.5em, 50% ... reject anything else.
  return /^\d*\.?\d+(px|rem|em|%|vh|pt)$/.test(value) ? value : '';
}

const directiveRe = /<!--\s*([a-zA-Z][\w-]*)(?::([^\s>-]+))?\s*-->/g;

export function applyDirectives(raw) {
  return raw.replace(directiveRe, (match, name, arg) => {
    const handler = directives[name];
    return handler ? handler(arg) : match; // leave unknown comments untouched
  });
}

// ---------------------------------------------------------------------------
// 2. Note embeds:  ![[Some Note]]  ->  the target note's content, inlined.
//    (Image embeds ![[pic.png]] are left alone here and handled by markdown-it.)
// ---------------------------------------------------------------------------
const embedRe = /!\[\[([^\]]+)\]\]/g;

export function expandEmbeds(raw, notesByName, seen = new Set(), depth = 0) {
  if (depth > 6) return raw; // hard stop against accidental cycles
  return raw.replace(embedRe, (match, target) => {
    const name = target.split('#')[0].split('|')[0].trim();
    if (imageExtRe.test(name)) return match; // an image embed — not a note
    const key = name.toLowerCase();
    const note = notesByName.get(key);
    if (!note) return match; // unresolved — leave as-is (renderer shows a hint)
    if (seen.has(key)) return `> ↻ *(embed of “${name}” skipped to avoid a loop)*`;
    const nextSeen = new Set(seen);
    nextSeen.add(key);
    return expandEmbeds(note.content, notesByName, nextSeen, depth + 1);
  });
}

// ---------------------------------------------------------------------------
// 3. markdown-it with our inline / block rules.
// ---------------------------------------------------------------------------
export function createMd() {
  const md = new MarkdownIt({
    html: true, // your notes use raw HTML (e.g. page-break divs) — keep it
    linkify: true,
    typographer: false,
    breaks: false,
  });

  md.use(attrs, { allowedAttributes: ['id', 'class', 'style'] });

  // Optional math ($...$). Nice-to-have; never let it break the build.
  try {
    const req = createRequire(import.meta.url);
    const mod = req('@vscode/markdown-it-katex');
    const katexPlugin = mod && (mod.default || mod);
    if (typeof katexPlugin === 'function') md.use(katexPlugin);
  } catch {
    /* math simply won't render if the plugin isn't installed */
  }

  md.inline.ruler.before('link', 'obsidian_wikilink', wikilinkRule);
  // callouts must run BEFORE inline tokenisation so we can rewrite the raw
  // blockquote text before it is parsed into child tokens.
  md.core.ruler.before('inline', 'obsidian_callouts', calloutsRule);
  // def-fields runs AFTER inline tokenisation, on the resulting text children.
  md.core.ruler.push('obsidian_deffields', defFieldsRule);

  md.renderer.rules.def_sep = () => '<span class="def-sep">::</span>';
  md.renderer.rules.wikilink_missing = (tokens, idx) =>
    `<span class="wikilink-missing" title="Not published">${escapeHtml(tokens[idx].content)}</span>`;

  return md;
}

// --- inline rule: [[wikilinks]] and ![[image embeds]] ----------------------
function wikilinkRule(state, silent) {
  const src = state.src;
  let pos = state.pos;
  let embed = false;
  if (src.charCodeAt(pos) === 0x21 /* ! */) {
    embed = true;
    pos++;
  }
  if (src.charCodeAt(pos) !== 0x5b || src.charCodeAt(pos + 1) !== 0x5b) return false; // need [[
  const close = src.indexOf(']]', pos + 2);
  if (close === -1) return false;
  const inner = src.slice(pos + 2, close);
  if (silent) {
    state.pos = close + 2;
    return true;
  }

  const env = state.env || {};
  const [linkPart, aliasPart] = splitOnce(inner, '|');
  const [namePart] = splitOnce(linkPart, '#');
  const name = namePart.trim();

  if (embed && imageExtRe.test(name)) {
    const url = env.imageIndex ? env.imageIndex.get(name.toLowerCase()) : null;
    if (url) {
      const token = state.push('image', 'img', 0);
      const size = aliasPart && /^\d+$/.test(aliasPart.trim()) ? aliasPart.trim() : null;
      token.attrs = [['src', url], ['alt', name]];
      if (size) token.attrs.push(['width', size]);
      token.content = name;
      token.children = [];
    } else {
      pushText(state, `⚠️ missing image: ${name}`);
    }
  } else if (embed) {
    // A note embed that survived expandEmbeds → target wasn't found/published.
    pushText(state, `⟦${name}⟧`);
  } else {
    const label = (aliasPart != null ? aliasPart : linkPart).trim();
    const note = env.noteIndex ? env.noteIndex.get(name.toLowerCase()) : null;
    if (note) {
      const open = state.push('link_open', 'a', 1);
      open.attrs = [
        ['href', `#/${note.category}/${note.slug}`],
        ['class', 'wikilink'],
      ];
      pushText(state, label);
      state.push('link_close', 'a', -1);
    } else {
      const t = state.push('wikilink_missing', '', 0);
      t.content = label;
    }
  }

  state.pos = close + 2;
  return true;
}

// --- core rule (pre-inline): Obsidian callouts  > [!note] Title ------------
const calloutHeadRe = /^\[!([\w-]+)\]([+-]?)\s?(.*)$/;

function calloutsRule(state) {
  const tokens = state.tokens;
  for (let i = 0; i < tokens.length; i++) {
    if (tokens[i].type !== 'blockquote_open') continue;
    const inlineIdx = tokens.findIndex((t, j) => j > i && t.type === 'inline');
    if (inlineIdx === -1) continue;
    const inline = tokens[inlineIdx];
    const nl = inline.content.indexOf('\n');
    const firstLine = nl === -1 ? inline.content : inline.content.slice(0, nl);
    const m = calloutHeadRe.exec(firstLine);
    if (!m) continue;

    const type = m[1].toLowerCase();
    const title = (m[3] || '').trim() || m[1];
    const rest = nl === -1 ? '' : inline.content.slice(nl + 1);

    // find matching blockquote_close
    let depth = 0;
    let closeIdx = -1;
    for (let j = i; j < tokens.length; j++) {
      if (tokens[j].type === 'blockquote_open') depth++;
      else if (tokens[j].type === 'blockquote_close') {
        if (--depth === 0) {
          closeIdx = j;
          break;
        }
      }
    }

    tokens[i].tag = 'div';
    tokens[i].attrSet('class', `callout callout-${type}`);
    if (closeIdx !== -1) tokens[closeIdx].tag = 'div';

    const titleToken = new state.Token('html_block', '', 0);
    titleToken.content = `<div class="callout-title">${escapeHtml(title)}</div>\n`;
    inline.content = rest; // safe: inline children not parsed yet at this stage
    tokens.splice(inlineIdx - 1, 0, titleToken); // insert before paragraph_open
  }
}

// --- core rule (post-inline): `Term :: Definition` separator styling --------
function defFieldsRule(state) {
  for (const token of state.tokens) {
    if (token.type !== 'inline' || !token.children) continue;
    if (!token.children.some((c) => c.type === 'text' && c.content.includes(' :: '))) continue;
    const out = [];
    for (const child of token.children) {
      if (child.type !== 'text' || !child.content.includes(' :: ')) {
        out.push(child);
        continue;
      }
      const parts = child.content.split(' :: ');
      parts.forEach((part, idx) => {
        if (idx > 0) out.push(new state.Token('def_sep', '', 0));
        if (part.length) {
          const t = new state.Token('text', '', 0);
          t.content = part;
          out.push(t);
        }
      });
    }
    token.children = out;
  }
}

// --- small helpers ---------------------------------------------------------
function splitOnce(str, sep) {
  const i = str.indexOf(sep);
  return i === -1 ? [str, null] : [str.slice(0, i), str.slice(i + 1)];
}

function pushText(state, content) {
  const t = state.push('text', '', 0);
  t.content = content;
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
