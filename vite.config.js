import { defineConfig } from 'vite';
import { vaultContent } from './src/plugins/vault-content.js';

// The site is served from https://<user>.github.io/<repo>/ on GitHub Pages,
// so the base path must match the repository name. Override with BASE_PATH
// (e.g. set BASE_PATH=/ when using a custom domain).
const base = process.env.BASE_PATH || '/arabic-course-website/';

export default defineConfig({
  base,
  plugins: [vaultContent({ vaultDir: 'Arabic Website' })],
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
});
