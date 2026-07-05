# Arabic Course Website

A very simple website that renders your Obsidian course notes (`_Lessons/`) as web
pages, organized by category, with a Deutsch/English switch, per-student font & spacing
controls, and one-click **Save as PDF**. Fix a typo, push, and everyone sees the update —
no re-sending PDFs.

## How it works

- Your markdown lives in `_Lessons/` (your Obsidian vault *is* this repo).
- A note appears on the site only if its frontmatter says `publish: true`.
- On build, every published note is rendered to HTML (wikilinks, embeds, callouts,
  `::` definitions and `$math$` all handled) and grouped into four categories.
- The site is fully static, so it runs on GitHub Pages for free.

See **[SYNTAX.md](SYNTAX.md)** for how to tag notes and use the custom syntax.

## Run locally

```bash
npm install
npm run dev      # open the printed http://localhost:5173/... URL
```

Edit any note in `_Lessons/` and the page reloads automatically.

```bash
npm run build    # produces dist/
npm run preview  # serves the production build locally
```

## Publish to GitHub Pages

1. Create a GitHub repo and push this project to the `main` branch.
2. In the repo, go to **Settings → Pages → Build and deployment → Source** and choose
   **GitHub Actions**.
3. Every push to `main` now rebuilds and deploys automatically (see
   `.github/workflows/deploy.yml`). Your site will be at
   `https://<your-username>.github.io/<repo-name>/`.

The build sets the base path from the repo name automatically. If you later add a custom
domain, set `BASE_PATH: /` in the workflow (and locally: `BASE_PATH=/ npm run build`).

## Project layout

| Path | What it is |
| --- | --- |
| `_Lessons/` | Your Obsidian notes (source of truth). |
| `src/plugins/vault-content.js` | Scans the vault, filters by `publish`, renders notes. |
| `src/plugins/obsidian.js` | Obsidian syntax: wikilinks, embeds, callouts, `::`, directives. |
| `src/main.js` | The site UI: categories, list/note views, language switch, settings, PDF. |
| `src/styles.css` | Theme, reading controls, and print/PDF rules. |
| `src/i18n.js` | UI text in Deutsch and English. |
