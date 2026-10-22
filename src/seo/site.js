/**
 * Fifth Avenue — search & social metadata for the public site.
 * ─────────────────────────────────────────────────────────────────
 * One table of every public page's title, description, headline and intro,
 * read in two places:
 *
 *   · at BUILD time by the prerender plugin in vite.config.js, which writes a
 *     real HTML file per page (dist/regional.html, …) with these tags in the
 *     <head> and the page's real headline + copy inside #root — so Google's
 *     first crawl, Bing, AI answer engines and link previews all see actual
 *     content instead of an empty <div id="root">. React replaces that markup
 *     the moment the app boots (createRoot clears the container);
 *
 *   · at RUN time by <RouteSeo/> (./RouteSeo.jsx), which keeps the title and
 *     tags right as people click between pages, and marks the portal, pitch
 *     links and 404s noindex.
 *
 * Copy is lifted from the pages themselves (landing-copy.ts, services.ts and
 * each page's own <h1>) so what a crawler reads is what a visitor sees.
 * Titles stay under ~60 characters and lead with the service, not just
 * "Fifth Avenue" — that name alone is owned in search by the New York street.
 */
import { HERO, NETWORK, CTA_BAND } from "../lib/marketing/data/landing-copy.ts";
import { SERVICE_GROUPS, ALL_SERVICES } from "../lib/marketing/data/services.ts";

export const SITE = {
  url: "https://www.fifth-avenue.in",
  name: "Fifth Avenue",
  legalName: "Fifth Avenue Marketing Agency",
  email: "contact@fifth-avenue.in",
  locale: "en_IN",
  ogImage: "/og-image.png",
  logo: "/logo-512.png",
  defaultDescription:
    "Fifth Avenue is a full-service marketing agency in India — influencer and regional creator campaigns, AI search (AEO), SEO and performance marketing on one live dashboard.",
};

/**
 * Every public, indexable page. `sitemap: false` keeps a page crawlable but
 * out of sitemap.xml (the two "coming soon" pages — thin until they launch).
 */
export const PAGES = {
  "/": {
    title: "Fifth Avenue | Influencer Marketing Agency in India",
    description:
      "Full-service marketing agency in India: influencer and regional creator campaigns, AI search (AEO), SEO and performance marketing — tracked on one live dashboard.",
    eyebrow: "Fifth Avenue — Full-service marketing agency",
    h1: HERO.headline.join(" "),
    intro: HERO.lede,
    priority: 1.0,
    changefreq: "weekly",
    home: true,
  },
  "/regional": {
    title: "Regional Creator Network Across India | Fifth Avenue",
    description:
      "Regional influencers in every Indian state and language — matched to brand campaigns by region, niche and audience. National creators buy attention; regional creators buy trust.",
    eyebrow: "Regional creator network",
    h1: NETWORK.title,
    intro: NETWORK.body,
    priority: 0.9,
    changefreq: "weekly",
  },
  "/tech": {
    title: "Marketing Tech, Data & Analytics | Fifth Avenue",
    description:
      "Data science, analytics, live dashboards and AI-enabled operations behind every Fifth Avenue campaign — marketing run like an engineering team.",
    eyebrow: "Tech & Data",
    h1: "Marketing, run like an engineering team.",
    intro:
      "Data science, analytics, dashboards and AI-enabled operations — the machinery underneath the campaigns. Everything is measured, everything compounds, and the numbers arrive before you ask.",
    priority: 0.8,
    changefreq: "monthly",
  },
  "/portfolio": {
    title: "Portfolio — Campaigns, Films & Branding | Fifth Avenue",
    description:
      "Integrated campaigns, short films, reel series and identity systems from Fifth Avenue, a full-service marketing agency in India.",
    eyebrow: "Portfolio",
    h1: "Work worth watching twice.",
    intro: "Integrated campaigns, films, social series and branding work.",
    priority: 0.8,
    changefreq: "monthly",
  },
  "/careers": {
    title: "Careers at Fifth Avenue — Marketing Jobs in Bangalore",
    description:
      "Join Fifth Avenue in Bangalore. We're hiring across growth, brand, creators and operations — real budgets and real client relationships from week one.",
    eyebrow: "Careers · Bangalore · Now hiring",
    h1: "Come build with us.",
    intro: "We're hiring across growth, brand, creators and ops.",
    priority: 0.6,
    changefreq: "weekly",
  },
  "/apply": {
    title: "Apply as a Creator | Fifth Avenue Creator Network",
    description:
      "Creators across India: apply to join the Fifth Avenue network. We match creators to brand campaigns by region, language and niche — it takes a minute.",
    eyebrow: "Creators",
    h1: "Apply as a creator.",
    intro: "We match creators to brand campaigns by region, language and niche. Tell us about you — it takes a minute.",
    priority: 0.7,
    changefreq: "monthly",
  },
  "/start": {
    title: "Start a Project | Fifth Avenue Marketing Agency",
    description:
      "Tell us the goal and we'll bring the plan, the creators and the dashboard. Start an influencer, performance, SEO or branding project with Fifth Avenue.",
    eyebrow: "Start a project",
    h1: CTA_BAND.statement,
    intro: CTA_BAND.sub,
    priority: 0.8,
    changefreq: "monthly",
  },
  "/international": {
    title: "International Marketing | Fifth Avenue",
    description: "Fifth Avenue's international markets practice — coming soon.",
    eyebrow: "International",
    h1: "International",
    intro: "Our global markets experience is on the way.",
    sitemap: false,
  },
  "/creatives": {
    title: "Creative Studio | Fifth Avenue",
    description: "Fifth Avenue's creative studio — design, content and video production. Coming soon.",
    eyebrow: "Creatives",
    h1: "Creatives",
    intro: "Our creative studio is on the way.",
    sitemap: false,
  },
  "/legal/privacy": { title: "Privacy Policy | Fifth Avenue", description: "How Fifth Avenue collects, uses and protects personal data.", h1: "Privacy Policy", priority: 0.2, changefreq: "yearly" },
  "/legal/terms": { title: "Terms of Service | Fifth Avenue", description: "The terms that govern Fifth Avenue's website, client dashboard and marketing services.", h1: "Terms of Service", priority: 0.2, changefreq: "yearly" },
  "/legal/security": { title: "Security | Fifth Avenue", description: "The controls Fifth Avenue operates to protect client campaign and billing data.", h1: "Security", priority: 0.2, changefreq: "yearly" },
  "/legal/gst": { title: "GST & Billing | Fifth Avenue", description: "GST and billing information for Fifth Avenue clients.", h1: "GST & Billing", priority: 0.2, changefreq: "yearly" },
};

// Private or one-off surfaces: never indexed (also Disallowed in robots.txt).
export const NOINDEX_PREFIXES = ["/portal", "/login", "/pitch", "/pitch-draft", "/overview", "/campaigns", "/profile", "/styleguide"];

export const absUrl = (path) => SITE.url + (path === "/" ? "/" : path);

export function seoFor(pathname) {
  const path = pathname.length > 1 ? pathname.replace(/\/+$/, "") : pathname;
  if (PAGES[path]) return { path, ...PAGES[path], index: true };
  if (path === "/legal") return { path, ...PAGES["/legal/privacy"], index: true, canonicalPath: "/legal/privacy" };
  const priv = NOINDEX_PREFIXES.some((p) => path === p || path.startsWith(p + "/"));
  return { path, title: priv ? "Fifth Avenue" : "Page not found | Fifth Avenue", description: SITE.defaultDescription, index: false };
}

// ── structured data ──────────────────────────────────────────────────────────
// Organization + WebSite on the home page. WebSite.name is what Google uses for
// the "site name" shown above a result; Organization.logo must be a raster
// image (≥112px), which is why logo-512.png exists alongside favicon.svg.
export function structuredData() {
  return [
    {
      "@context": "https://schema.org",
      "@type": "Organization",
      "@id": `${SITE.url}/#organization`,
      name: SITE.name,
      alternateName: SITE.legalName,
      url: `${SITE.url}/`,
      logo: `${SITE.url}${SITE.logo}`,
      image: `${SITE.url}${SITE.ogImage}`,
      email: SITE.email,
      description: SITE.defaultDescription,
      areaServed: { "@type": "Country", name: "India" },
      knowsAbout: ALL_SERVICES.map((s) => s.name),
      contactPoint: [{ "@type": "ContactPoint", contactType: "sales", email: SITE.email, areaServed: "IN", availableLanguage: ["English", "Hindi"] }],
    },
    {
      "@context": "https://schema.org",
      "@type": "WebSite",
      "@id": `${SITE.url}/#website`,
      name: SITE.name,
      alternateName: [SITE.legalName, "fifth-avenue.in"],
      url: `${SITE.url}/`,
      publisher: { "@id": `${SITE.url}/#organization` },
      inLanguage: "en-IN",
    },
    {
      "@context": "https://schema.org",
      "@type": "ItemList",
      name: "Fifth Avenue services",
      itemListElement: ALL_SERVICES.map((s, i) => ({
        "@type": "ListItem",
        position: i + 1,
        item: { "@type": "Service", name: s.name, description: s.blurb, provider: { "@id": `${SITE.url}/#organization` }, areaServed: "IN" },
      })),
    },
  ];
}

// ── build-time HTML ──────────────────────────────────────────────────────────
const esc = (s) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export function renderHead(path) {
  const p = seoFor(path);
  const url = absUrl(p.canonicalPath || p.path);
  const img = `${SITE.url}${SITE.ogImage}`;
  const tags = [
    `<title>${esc(p.title)}</title>`,
    `<meta name="description" content="${esc(p.description)}" />`,
    `<meta name="robots" content="${p.index ? "index, follow, max-image-preview:large" : "noindex, follow"}" />`,
    `<link rel="canonical" href="${esc(url)}" />`,
    `<meta property="og:type" content="website" />`,
    `<meta property="og:site_name" content="${esc(SITE.name)}" />`,
    `<meta property="og:locale" content="${SITE.locale}" />`,
    `<meta property="og:title" content="${esc(p.title)}" />`,
    `<meta property="og:description" content="${esc(p.description)}" />`,
    `<meta property="og:url" content="${esc(url)}" />`,
    `<meta property="og:image" content="${img}" />`,
    `<meta property="og:image:width" content="1200" />`,
    `<meta property="og:image:height" content="630" />`,
    `<meta property="og:image:alt" content="Fifth Avenue — full-service marketing agency" />`,
    `<meta name="twitter:card" content="summary_large_image" />`,
    `<meta name="twitter:title" content="${esc(p.title)}" />`,
    `<meta name="twitter:description" content="${esc(p.description)}" />`,
    `<meta name="twitter:image" content="${img}" />`,
  ];
  if (p.home) {
    for (const block of structuredData()) {
      tags.push(`<script type="application/ld+json">${JSON.stringify(block).replace(/</g, "\\u003c")}</script>`);
    }
  }
  return tags.join("\n    ");
}

const NAV = [
  ["/", "Home"], ["/regional", "Regional creator network"], ["/tech", "Tech & data"], ["/portfolio", "Portfolio"],
  ["/careers", "Careers"], ["/apply", "Apply as a creator"], ["/start", "Start a project"],
];

// The page's real headline and copy, inside #root, for anything that reads
// HTML without running JavaScript. Layout-only inline styles: colours and
// fonts come from the site stylesheet, which is already linked in <head>.
export function renderBody(path) {
  const p = seoFor(path);
  const parts = [];
  if (p.eyebrow) parts.push(`<p>${esc(p.eyebrow)}</p>`);
  parts.push(`<h1>${esc(p.h1 || p.title)}</h1>`);
  if (p.intro) parts.push(`<p>${esc(p.intro)}</p>`);
  if (p.home) {
    for (const g of SERVICE_GROUPS) {
      parts.push(`<h2>${esc(g.label)}</h2><ul>${g.services.map((s) => `<li><strong>${esc(s.name)}</strong> — ${esc(s.blurb)}</li>`).join("")}</ul>`);
    }
    parts.push(`<h2>${esc(NETWORK.title)}</h2><p>${esc(NETWORK.body)}</p>`);
  }
  parts.push(`<nav aria-label="Site"><ul>${NAV.map(([href, label]) => `<li><a href="${href}">${esc(label)}</a></li>`).join("")}</ul></nav>`);
  parts.push(`<p>Contact: <a href="mailto:${SITE.email}">${SITE.email}</a></p>`);
  return `<div data-prerender style="max-width:880px;margin:0 auto;padding:72px 24px;line-height:1.6">${parts.join("")}</div>`;
}

export function renderSitemap(today) {
  const urls = Object.entries(PAGES)
    .filter(([, p]) => p.sitemap !== false)
    .map(([path, p]) =>
      `  <url>\n    <loc>${absUrl(path)}</loc>\n    <lastmod>${today}</lastmod>\n    <changefreq>${p.changefreq || "monthly"}</changefreq>\n    <priority>${(p.priority ?? 0.5).toFixed(1)}</priority>\n  </url>`)
    .join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;
}
