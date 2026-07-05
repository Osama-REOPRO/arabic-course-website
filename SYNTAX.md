# Authoring guide

Everything on the site comes from your notes in `_Lessons/`. This page explains how to
control what gets published and the custom syntax you can use.

## 1. Publishing a note

Add YAML frontmatter to the very top of a note. Only notes with `publish: true` appear on
the site.

```yaml
---
publish: true
title: The Definite Article (al-)   # shown in lists and the browser tab
category: grammar                    # grammar | explanations | vocabulary | exercises
lang: en                             # en | de
group: al-tarif                      # optional: links the EN & DE versions (see below)
order: 10                            # optional: sort order within its category
---
```

- **category** is how the site groups pages (the four links in the top-right). German
  words work too: `Grammatik`, `Erklärungen`, `Vokabeln`, `Übungen`, `Hausaufgabe`.
- **lang** decides whether the note shows when the site is in Deutsch or English mode.
- Notes without `publish: true` (your `prep`, `thinking`, drafts, …) are ignored — they
  never reach students.

### Linking a German and English version

Give both files the **same `group`** value. The 🌐 language switch will then jump between
them:

```yaml
# Al-Ta3rif (english).md          # Der bestimmte Artikel.md
---                               ---
publish: true                     publish: true
title: The Definite Article       title: Der bestimmte Artikel
category: grammar                 category: grammar
lang: en                          lang: de
group: al-tarif                   group: al-tarif
---                               ---
```

If a note has no translation, the switch just shows a small "only available in …" note.

> Notes that currently hold **both** languages in one file (e.g. English and German
> sections stacked together) should be split into two files — an `en` one and a `de` one —
> sharing a `group`.

## 2. Obsidian syntax that already works

- **Wikilinks** `[[Note]]`, `[[Note|shown text]]` → link to that note **if it is
  published**; otherwise the text is shown plainly (never a broken link).
- **Note embeds** `![[Note]]` → the other note's content is inlined here.
- **Image embeds** `![[picture.png]]`, `![[picture.png|300]]` (300 = width in px). Images
  are found by filename anywhere in the vault (e.g. in `attachments/` folders).
- **Callouts** `> [!note] Title`, `> [!tip] …`, `> [!warning] …` → styled boxes.
- **Definitions** `Term :: Meaning` → the `::` is styled as a separator.
- **Math** `$a + b$` and `$$ … $$` (rendered with KaTeX).
- Tables, bold/italic, lists, blockquotes, emoji, and Arabic (RTL) all render normally.

## 3. Custom syntax (for PDF layout)

These are written as HTML comments, so they stay **invisible in Obsidian's own preview**
but are interpreted by the website:

| You write | Effect |
| --- | --- |
| `<!-- pagebreak -->` | Forces a page break when the page is saved as PDF. |
| `<!-- gap:2rem -->` | Inserts vertical space (`2rem`, `12px`, `1.5em`, `40%`, …). |

Your existing `<div style="page-break-after: always;"></div>` blocks keep working too.

### Adding your own directive

Open `src/plugins/obsidian.js` and add an entry to the `directives` map. For example, a
directive that draws a divider:

```js
export const directives = {
  pagebreak: () => '<div class="pagebreak" aria-hidden="true"></div>',
  gap: (arg) => `<div class="gap" style="height:${sanitizeLength(arg) || '1rem'}"></div>`,
  // your new one — used in a note as <!-- divider -->
  divider: () => '<hr class="fancy-divider">',
};
```

Then style it (if needed) in `src/styles.css`. That's the whole extension point — one
function per custom syntax.
