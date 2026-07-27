import { useState } from "react";
import { Link, NavLink } from "react-router-dom";
import { Menu, X, Sun, Moon } from "lucide-react";
import { gsap, useGSAP } from "../../../motion/gsap";
import { useTheme } from "../../../context/ThemeContext";
import { Icon } from "../../../components/primitives/Icon";
import { cx } from "../../../lib/cx";

const LINKS = [
  { label: "Home", to: "/" },
  { label: "Regional", to: "/regional" },
  { label: "Tech", to: "/tech" },
];

export function Nav() {
  const { theme, toggleTheme } = useTheme();
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useGSAP(() => {
    const st = gsap.to({}, {
      scrollTrigger: {
        start: "24px top",
        end: "max",
        onToggle: (self) => setScrolled(self.isActive),
      },
    });
    return () => st.kill();
  });

  return (
    <header
      className={cx(
        "fixed inset-x-0 top-0 z-40 transition-[background-color,border-color,backdrop-filter] duration-300",
        scrolled
          ? "border-b border-line bg-bg/80 backdrop-blur-xl"
          : "border-b border-transparent bg-transparent",
      )}
    >
      <nav className="mx-auto flex h-16 max-w-[1200px] items-center justify-between px-6 md:px-10">
        <Link
          to="/"
          aria-label="Fifth Avenue — home"
          className="font-display text-[15px] font-light uppercase leading-none tracking-[0.32em] text-ink transition-opacity hover:opacity-70"
        >
          Fifth Avenue
        </Link>

        <div className="hidden items-center gap-8 md:flex">
          {LINKS.map((l) => (
            <NavLink
              key={l.to}
              to={l.to}
              className={({ isActive }) =>
                cx(
                  "text-label transition-colors hover:text-ink",
                  isActive ? "text-ink" : "text-ink-2",
                )
              }
            >
              {l.label}
            </NavLink>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={toggleTheme}
            aria-label="Toggle theme"
            className="hidden h-9 w-9 items-center justify-center rounded-md text-ink-2 transition-colors hover:bg-hover hover:text-ink md:inline-flex"
          >
            <Icon icon={theme === "dark" ? Sun : Moon} size={18} />
          </button>
          <Link
            to="/login"
            className="hidden h-9 items-center rounded-md px-3.5 text-label text-ink-2 transition-colors hover:text-ink md:inline-flex"
          >
            Client Login
          </Link>
          <Link
            to="/start"
            className="hidden h-9 items-center rounded-md bg-accent px-3.5 text-label font-medium text-on-accent transition-colors hover:bg-accent-hover md:inline-flex"
          >
            Start a project
          </Link>
          <button
            onClick={() => setOpen((o) => !o)}
            aria-label="Menu"
            className="inline-flex h-9 w-9 items-center justify-center rounded-md text-ink md:hidden"
          >
            <Icon icon={open ? X : Menu} size={20} />
          </button>
        </div>
      </nav>

      {open && (
        <div className="relative z-10 border-t border-line bg-bg px-6 py-4 md:hidden">
          <div className="flex flex-col gap-1">
            {LINKS.map((l) => (
              <Link
                key={l.to}
                to={l.to}
                onClick={() => setOpen(false)}
                className="rounded-md px-2 py-2.5 text-body text-ink-2 hover:bg-hover hover:text-ink"
              >
                {l.label}
              </Link>
            ))}
            <div className="mt-2 flex items-center gap-2">
              <Link to="/login" className="flex-1 rounded-md border border-line px-3 py-2.5 text-center text-label text-ink">
                Client Login
              </Link>
              <Link to="/start" onClick={() => setOpen(false)} className="flex-1 rounded-md bg-accent px-3 py-2.5 text-center text-label font-medium text-on-accent">
                Start a project
              </Link>
            </div>
            <button onClick={toggleTheme} className="mt-1 flex items-center gap-2 rounded-md px-2 py-2.5 text-label text-ink-2">
              <Icon icon={theme === "dark" ? Sun : Moon} size={18} /> Switch to {theme === "dark" ? "light" : "dark"}
            </button>
          </div>
        </div>
      )}
    </header>
  );
}
