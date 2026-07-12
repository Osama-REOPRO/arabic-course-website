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
| `category` | **yes** | `explanations` \| `vocabulary` \| `exercises` \| `grammar` | Which of the four sections the note lands in. German words also work: `Erklärungen`, `Vokabeln`/`Wortschatz`, `Übungen`/`Hausaufgabe`, `Grammatik`. |
| `group` | optional | any short id | Free-form tag to relate notes that belong together (e.g. all notes of one topic). Not shown to students and currently unused by the site — reserved for future features. |
| `order` | optional | number | **Sort position** inside the category (top → bottom). Notes without it sort last. |
| `lektion` | optional | number | The **lesson number shown** as a small "Lektion N" label. This is display only — it does *not* affect sorting, and it is independent of the folder name. Leave it out to show no label. |

### The four sections (in nav order)

- **Erklärungen** (`explanations`) — the full explanation of a grammar topic, with examples
  and reasoning. **This is the landing page.**
- **Vokabeln** (`vocabulary`) — just the vocabulary words.
- **Übungen** (`exercises`) — practice tasks and homework.
- **Grammatik-Referenz** (`grammar`) — the bare, condensed rules only: a printable reference
  sheet. No long prose; tables and short rule statements.

### Templates — copy the one you need

**Grammatik-Referenz** (condensed reference sheet):
```yaml
---
publish: true
title: "al- / Bestimmtheit – Referenz"
category: grammar
group: al-tarif         # optional: relates notes of the same topic
order: 14               # sort position within the category
lektion: 14             # the "Lektion N" label (optional, display only)
---
```

**Erklärung**:
```yaml
---
publish: true
title: "Bestimmtheit"
category: explanations
group: al-tarif
order: 14
lektion: 14
---
```

**Vokabeln**:
```yaml
---
publish: true
title: "Berufe"
category: vocabulary
order: 11
lektion: 11
---
```

**Übung / Hausaufgabe**:
```yaml
---
publish: true
title: "Hausaufgabe: al- & Idafeh"
category: exercises
order: 15
lektion: 15
---
```

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
