import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { PAGES, renderHead, renderBody, renderSitemap } from './src/seo/site.js';

const SEO_START = '<!--seo:start-->';
const SEO_END = '<!--seo:end-->';

/**
 * After the build, write one real HTML file per public page (see
 * src/seo/site.js): its own <title>, description, canonical, social tags and
 * structured data, plus the page's real headline and copy inside #root, so
 * search engines and link previews get content without running JavaScript.
 *
 *   dist/index.html      the home page
 *   dist/regional.html   …served at /regional (vercel.json cleanUrls)
 *   dist/legal/privacy.html, …
 *   dist/app-shell.html  the untouched shell — what the SPA rewrite serves for
 *                        the portal, pitch links and unknown URLs
 *   dist/sitemap.xml
 */
function seoPages() {
  let outDir = 'dist';
  return {
    name: 'fifth-avenue-seo-pages',
    apply: 'build',
    configResolved(config) {
      outDir = resolve(config.root, config.build.outDir);
    },
    closeBundle() {
      const shell = readFileSync(resolve(outDir, 'index.html'), 'utf8');
      const a = shell.indexOf(SEO_START);
      const b = shell.indexOf(SEO_END);
      if (a < 0 || b < 0) throw new Error('[seo] index.html is missing the <!--seo:start--> / <!--seo:end--> markers');

      writeFileSync(resolve(outDir, 'app-shell.html'), shell);

      for (const path of Object.keys(PAGES)) {
        const head = shell.slice(0, a + SEO_START.length) + '\n    ' + renderHead(path) + '\n    ';
        const rest = shell.slice(b).replace('<div id="root"></div>', `<div id="root">${renderBody(path)}</div>`);
        const file = path === '/' ? 'index.html' : `${path.slice(1)}.html`;
        mkdirSync(dirname(resolve(outDir, file)), { recursive: true });
        writeFileSync(resolve(outDir, file), head + rest);
      }

      writeFileSync(resolve(outDir, 'sitemap.xml'), renderSitemap(new Date().toISOString().slice(0, 10)));
      console.log(`[seo] wrote ${Object.keys(PAGES).length} page(s), app-shell.html and sitemap.xml`);
    },
  };
}

export default defineConfig({
  plugins: [react(), tailwindcss(), seoPages()],
  server: {
    port: 3000,
    open: true,
  },
});
