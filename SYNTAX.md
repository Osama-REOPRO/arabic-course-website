# Authoring guide

Everything on the site comes from your notes in the `Arabic Website/` folder. This page
explains how to control what gets published, the frontmatter to add, and the custom syntax
you can use.

## 1. Publishing a note

Add YAML frontmatter to the very top of a note. **Only notes with `publish: true` appear
on the site.** Everything else (`prep`, `thinking`, drafts, `todo`, …) is ignored and never
reaches students.

### The fields

| Field | Required | Value | What it does |
| --- | --- | --- | --- |
| `publish` | **yes** | `true` | Publishes the note. Omit it (or set `false`) to keep a note private. |
| `title` | recommended | text | Shown in the category list and the browser tab. If it contains a colon `:`, a dash at the start, or other punctuation, **wrap it in double quotes**. When in doubt, always quote. |
| `category` | **yes** | `grammar` \| `explanations` \| `vocabulary` \| `exercises` | Which of the four top-right sections the note lands in. German words also work: `Grammatik`, `Erklärungen`, `Vokabeln`/`Wortschatz`, `Übungen`/`Hausaufgabe`. |
| `lang` | **yes** | `de` \| `en` | Which language mode shows the note. (If omitted, defaults to `de`.) |
| `group` | optional | any short id | Links the German and English versions of the same page — see below. Leave it out if the note has no translation. |
| `order` | optional | number | **Sort position** inside the category (top → bottom). Notes without it sort last. |
| `lektion` | optional | number | The **lesson number shown** as a small "Lektion N" label. This is display only — it does *not* affect sorting, and it is independent of the folder name. Leave it out to show no label. |

### What goes in which category

- **grammar** — the bare, condensed rules only: a reference sheet you could print. No long
  prose. Tables and short rule statements.
- **explanations** — the same grammar but expanded with the full explanation, examples, and
  reasoning.
- **vocabulary** — just the vocabulary words.
- **exercises** — practice tasks and homework.

### Templates — copy the one you need

**Grammar** (condensed reference sheet):
```yaml
---
publish: true
title: "al- / Bestimmtheit – Referenz"
category: grammar
lang: de
group: gref-al          # omit if there is no English version
order: 14               # sort position within the category
lektion: 14             # the "Lektion N" label (optional, display only)
---
```

**Explanation**:
```yaml
---
publish: true
title: "Bestimmtheit"
category: explanations
lang: de
group: definiteness     # omit if there is no English version
order: 14
lektion: 14
---
```

**Vocabulary**:
```yaml
---
publish: true
title: "Berufe"
category: vocabulary
lang: de
order: 11
lektion: 11
---
```

**Exercise / homework**:
```yaml
---
publish: true
title: "Hausaufgabe: al- & Idafeh"
category: exercises
lang: de
order: 15
lektion: 15
---
```

### Linking a German and English version

Give both files the **same `group`** value. The language switch then jumps straight to the
translation instead of just filtering the list:

```yaml
# Grammatik – al- (Referenz).md     # Grammar – al- (reference).md
---                                 ---
publish: true                       publish: true
title: "al- / Bestimmtheit …"       title: "al- / Definiteness …"
category: grammar                   category: grammar
lang: de                            lang: en
group: gref-al                      group: gref-al      ← same id
order: 14                           order: 14
---                                 ---
```

Pick any short, unique id — just use the **same string** in both files. Conventions already
in use: a topic slug for explanations/vocab (`definiteness`, `l11-berufe`) and a `gref-…`
prefix for grammar reference sheets (`gref-al`, `gref-idafeh`, `gref-plural`). If a note has
no translation, omit `group`; the switch then shows a small "only available in …" note.

> A note that currently holds **both** languages in one file should be split into two files —
> a `lang: de` one and a `lang: en` one — sharing the same `group`.

### Naming files (optional convention)

Filenames aren't shown to students, but a consistent scheme keeps the vault tidy and makes
`[[wikilinks]]` predictable. The reference sheets follow
`Grammatik – <Thema> (Referenz).md` / `Grammar – <topic> (reference).md`.

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
