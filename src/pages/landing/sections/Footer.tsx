import { Link } from "react-router-dom";

const COLS = [
  {
    title: "Platform",
    links: [
      { label: "Overview", to: "/portal/overview" },
      { label: "Campaigns", to: "/portal/campaigns" },
      { label: "Regional map", to: "/portal/regional" },
      { label: "Profile", to: "/portal/profile" },
    ],
  },
  {
    title: "Services",
    links: [
      { label: "Tech & Data", to: "/tech" },
      { label: "Creatives", to: "/creatives" },
      { label: "Regional network", to: "/regional" },
      { label: "International", to: "/international" },
    ],
  },
  {
    title: "Company",
    links: [
      { label: "Portfolio", to: "/portfolio" },
      { label: "Careers", to: "/careers" },
      { label: "Creators", to: "/apply" },
      { label: "Start a project", to: "/start" },
      { label: "Client login", to: "/login" },
    ],
  },
  {
    title: "Legal",
    links: [
      { label: "Privacy", to: "/legal/privacy" },
      { label: "Terms", to: "/legal/terms" },
      { label: "Security", to: "/legal/security" },
      { label: "GST", to: "/legal/gst" },
    ],
  },
];

export function Footer() {
  return (
    <footer className="border-t border-line">
      <div className="mx-auto max-w-[1200px] px-6 py-16 md:px-10">
        <div className="grid gap-10 md:grid-cols-[1.4fr_repeat(4,1fr)]">
          <div>
            <Link to="/" className="font-sans text-[15px] font-light uppercase tracking-[0.3em] text-ink">
              Fifth Avenue
            </Link>
            <p className="mt-3 max-w-xs text-caption text-ink-3">
              Full-service marketing, engineered. Influencer, AI-search,
              performance and regional creator campaigns across India.
            </p>
            <p className="mt-4 font-mono text-[10px] uppercase tracking-[0.12em] text-ink-3">
              contact@fifth-avenue.in
            </p>
          </div>
          {COLS.map((c) => (
            <div key={c.title}>
              <p className="mb-3 font-mono text-eyebrow uppercase tracking-[0.12em] text-ink-3">
                {c.title}
              </p>
              <ul className="flex flex-col gap-2">
                {c.links.map((l) => (
                  <li key={l.label}>
                    <Link to={l.to} className="text-caption text-ink-2 transition-colors hover:text-ink">
                      {l.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>

      {/* oversized ghosted wordmark */}
      <div className="overflow-hidden border-t border-line">
        <div className="mx-auto flex max-w-[1200px] items-center justify-between px-6 py-6 md:px-10">
          <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-ink-3">
            India · Est. MMXXVI
          </p>
          <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-ink-3">
            © 2026 5th Avenue Marketing
          </p>
        </div>
        <div
          aria-hidden
          className="select-none whitespace-nowrap px-6 pb-2 font-sans font-light uppercase tracking-[0.02em] text-[clamp(48px,18vw,240px)] leading-none text-ink"
          style={{ opacity: 0.04 }}
        >
          Fifth Avenue
        </div>
      </div>
    </footer>
  );
}
