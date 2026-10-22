/**
 * Keeps <title>, description, canonical, robots and social tags in step with
 * the current route as people navigate client-side. The prerendered HTML for
 * each public page (see site.js + vite.config.js) already carries the right
 * tags for a fresh load; this covers every navigation after that, and marks
 * the portal, pitch links and unknown URLs (404s) `noindex`.
 *
 * Imperative on purpose: the static tags already exist in index.html, and
 * React 19's hoisted <title>/<meta> would ADD a second copy rather than
 * replace them — the browser then keeps showing the first one.
 */
import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { seoFor, absUrl } from "./site";

function setTag(selector, create, attr, value) {
  let el = document.head.querySelector(selector);
  if (!el) { el = create(); document.head.appendChild(el); }
  el.setAttribute(attr, value);
}
const meta = (key, keyAttr = "name") => () => { const m = document.createElement("meta"); m.setAttribute(keyAttr, key); return m; };

export default function RouteSeo() {
  const { pathname } = useLocation();
  useEffect(() => {
    const p = seoFor(pathname);
    const url = absUrl(p.canonicalPath || p.path);
    document.title = p.title;
    setTag('meta[name="description"]', meta("description"), "content", p.description);
    setTag('meta[name="robots"]', meta("robots"), "content", p.index ? "index, follow, max-image-preview:large" : "noindex, follow");
    setTag('link[rel="canonical"]', () => { const l = document.createElement("link"); l.rel = "canonical"; return l; }, "href", url);
    setTag('meta[property="og:title"]', meta("og:title", "property"), "content", p.title);
    setTag('meta[property="og:description"]', meta("og:description", "property"), "content", p.description);
    setTag('meta[property="og:url"]', meta("og:url", "property"), "content", url);
    setTag('meta[name="twitter:title"]', meta("twitter:title"), "content", p.title);
    setTag('meta[name="twitter:description"]', meta("twitter:description"), "content", p.description);
  }, [pathname]);
  return null;
}
