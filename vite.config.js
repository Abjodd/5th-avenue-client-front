import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { PAGES, renderHead, renderBody, renderSitemap, renderShellHead } from './src/seo/site.js';

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
 *   dist/app-shell.html  the app shell (noindex) — what vercel.json rewrites the
 *                        portal, sign-in and pitch links to
 *   dist/404.html        the same shell titled "Page not found" — Vercel serves it
 *                        with a real 404 status for any URL that matches no page
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

      // Non-page shells: the private app routes (app-shell) and real 404s.
      const shellWith = (headTags) => shell.slice(0, a + SEO_START.length) + '\n    ' + headTags + '\n    ' + shell.slice(b);
      writeFileSync(resolve(outDir, 'app-shell.html'), shellWith(renderShellHead(false)));
      writeFileSync(resolve(outDir, '404.html'), shellWith(renderShellHead(true)));

      for (const path of Object.keys(PAGES)) {
        const head = shell.slice(0, a + SEO_START.length) + '\n    ' + renderHead(path) + '\n    ';
        const rest = shell.slice(b).replace('<div id="root"></div>', `<div id="root">${renderBody(path)}</div>`);
        const file = path === '/' ? 'index.html' : `${path.slice(1)}.html`;
        mkdirSync(dirname(resolve(outDir, file)), { recursive: true });
        writeFileSync(resolve(outDir, file), head + rest);
      }

      writeFileSync(resolve(outDir, 'sitemap.xml'), renderSitemap(new Date().toISOString().slice(0, 10)));
      console.log(`[seo] wrote ${Object.keys(PAGES).length} page(s), app-shell.html, 404.html and sitemap.xml`);
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
