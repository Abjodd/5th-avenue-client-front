import { Link } from "react-router-dom";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-bg text-ink">
      <p className="font-mono text-eyebrow uppercase tracking-[0.12em] text-ink-3">
        404 — Not found
      </p>
      <h1 className="font-serif text-display-lg">Nothing on this corner.</h1>
      <Link
        to="/"
        className="rounded-md border border-line px-4 py-2 text-label text-ink-2 transition-colors hover:border-line-strong hover:text-ink"
      >
        Back to Fifth Avenue
      </Link>
    </div>
  );
}
