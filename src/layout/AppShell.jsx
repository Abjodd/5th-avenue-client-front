// Mirrors 5th-internal-front's AppShell: floating glass navbar, Newsreader italic
// wordmark, Sora nav tabs. The active tab is a shared motion pill (layoutId) that
// slides between tabs; the navbar shadow deepens once the page scrolls.
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "motion/react";
import { useApp } from "../context";
import { useAuth } from "../context/AuthContext";

const NAV_ITEMS = [
  { id: "overview",  label: "Overview",     icon: "◎" },
  { id: "campaigns", label: "Campaigns",    icon: "▤" },
  { id: "regional",  label: "Regional Map", icon: "◯" },
];

export default function AppShell({ children }) {
  const { page, setPage } = useApp();
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const handleLogout = () => {
    logout();
    navigate("/login", { replace: true });
  };

  return (
    <div className="flex min-h-screen flex-col bg-page font-sans text-ink">
      {/* Floating glass navbar */}
      <div className="sticky top-0 z-40 px-3 pt-3 sm:px-5">
        <div
          className={`mx-auto flex h-[72px] max-w-[1600px] items-stretch overflow-hidden rounded-2xl border border-line pl-[22px] backdrop-blur-[20px] transition-shadow duration-300 ${
            scrolled ? "shadow-[0_16px_40px_rgba(25,22,17,0.12)]" : "shadow-[0_8px_30px_rgba(25,22,17,0.06)]"
          }`}
          style={{ background: "var(--color-glass)" }}
        >
          {/* Wordmark */}
          <div className="flex items-center border-r border-line pr-7">
            <span className="font-serif text-[21px] italic font-semibold tracking-[-0.01em] text-ink">
              5th <span className="text-accent">Avenue</span>
            </span>
          </div>

          {/* Client identity — scoped to the logged-in brand */}
          <div className="hidden shrink-0 items-center gap-2.5 border-r border-line px-5 sm:flex">
            <span className="whitespace-nowrap rounded-full bg-white/60 px-2.5 py-1 text-[10.5px] font-semibold uppercase tracking-[0.08em] text-mute shadow-sm ring-1 ring-line">
              Client
            </span>
            <span className="whitespace-nowrap text-[13.5px] font-semibold text-ink">{user?.clientName}</span>
          </div>

          {/* Nav tabs — active pill slides between tabs via layoutId */}
          <div className="flex flex-1 items-stretch overflow-x-auto px-1">
            {NAV_ITEMS.map(item => {
              const isActive = page === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setPage(item.id)}
                  className="group relative flex h-full items-center px-4"
                >
                  <span className="relative flex items-center gap-[7px] whitespace-nowrap rounded-full px-3.5 py-[7px] text-[13px]">
                    {isActive && (
                      <motion.span
                        layoutId="nav-active"
                        transition={{ type: "spring", stiffness: 420, damping: 34 }}
                        className="absolute inset-0 rounded-full bg-accent/[0.09] shadow-[0_0_0_1px_rgba(44,62,126,0.14)]"
                      />
                    )}
                    <span
                      className={`relative text-[13px] transition-transform duration-200 ${
                        isActive ? "scale-110 text-accent" : "text-mute group-hover:scale-105"
                      }`}
                    >
                      {item.icon}
                    </span>
                    <span
                      className={`relative transition-colors duration-200 ${
                        isActive ? "font-semibold text-accent" : "font-medium text-sub group-hover:text-ink"
                      }`}
                    >
                      {item.label}
                    </span>
                  </span>
                  {isActive && (
                    <motion.span
                      layoutId="nav-underline"
                      transition={{ type: "spring", stiffness: 420, damping: 34 }}
                      className="pointer-events-none absolute bottom-[14px] left-1/2 h-[2px] w-6 -translate-x-1/2 rounded-full bg-accent shadow-[0_0_8px_rgba(44,62,126,0.5)]"
                    />
                  )}
                </button>
              );
            })}
          </div>

          {/* User pill + logout */}
          <div className="flex items-center gap-2.5 border-l border-line pl-4 pr-[18px]">
            <div className="flex items-center gap-[9px] rounded-full border border-line bg-white/50 py-[5px] pl-[5px] pr-3.5 text-[12.5px] text-ink shadow-sm backdrop-blur-sm transition-all duration-200 hover:-translate-y-[1px] hover:shadow-md">
              <div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-accent to-purple text-[12px] font-semibold text-white shadow-[0_2px_8px_rgba(44,62,126,0.35)]">
                {user?.avatar}
              </div>
              <div className="hidden text-left sm:block">
                <div className="text-[13px] font-semibold leading-tight text-ink">{user?.name?.split(" ")[0]}</div>
                <div className="text-[11px] leading-tight text-sub">{user?.title}</div>
              </div>
            </div>
            <button
              onClick={handleLogout}
              title="Sign out"
              className="group flex items-center gap-1.5 rounded-full border border-line bg-white/40 px-3 py-[9px] text-[11.5px] font-medium text-sub backdrop-blur-sm transition-all duration-200 hover:-translate-y-[1px] hover:border-red/25 hover:bg-red/[0.05] hover:text-red hover:shadow-sm"
            >
              <span className="text-[12px] transition-transform duration-200 group-hover:translate-x-[1px]">⏻</span>
              <span className="hidden sm:inline">Sign out</span>
            </button>
          </div>
        </div>
      </div>

      <main className="flex min-w-0 flex-1 flex-col">{children}</main>
    </div>
  );
}
