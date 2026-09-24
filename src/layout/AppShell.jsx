// Mirrors 5th-internal-front's AppShell: floating glass navbar, Newsreader italic
// wordmark, Sora nav tabs. The active tab is a shared motion pill (layoutId) that
// slides between tabs; the navbar shadow deepens once the page scrolls.
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "motion/react";
import { useApp } from "../context";
import { useAuth } from "../context/AuthContext";
import { AccountAPI } from "../lib/api";
import { profileCompletion } from "../lib/profileCompletion";
import ThemeToggle from "../components/ThemeToggle";

const NAV_ITEMS = [
  { id: "overview",  label: "Overview",     icon: "◎" },
  { id: "campaigns", label: "Campaigns",    icon: "▤" },
  { id: "insights",  label: "Insights",     icon: "✦" },
  { id: "assets",    label: "Assets",       icon: "⚙" },
  { id: "regional",  label: "Regional Map", icon: "◯" },
  // After Regional Map deliberately: the tabs run from what the account IS
  // doing to what it has cost, and money is the thing you check last and
  // least often.
  { id: "billing",   label: "Billing",      icon: "₹" },
];

// The signed-in user's photo in the nav pill, ringed by profile completion.
//
// The ring is the pending signal: it draws only while something is still
// missing, so a finished profile leaves the chip exactly as it was. It reads
// the same profileCompletion() the Settings panel does, so the two can never
// disagree about what is outstanding.
//
// Photo order: their own if they've set one,
// otherwise the brand's logo, otherwise their initials. Both URL builders
// return null when there is nothing to fetch, so no request is fired that is
// certain to 404; an image that fails to decode degrades to initials rather
// than leaving a broken-image glyph in the navbar.
//
// Same order as the Settings page's avatar, so the picture a member sees of
// themselves is the same one in both places.
function NavAvatar({ user, completion }) {
  const [broken, setBroken] = useState(false);
  const own = AccountAPI.avatarUrl(user);
  const url = own || AccountAPI.brandLogoUrl(user);
  const show = url && !broken;

  // done === total, not pct === 100 — see lib/profileCompletion for why.
  const pending = completion.done < completion.total;
  const R = 15.5;
  const C = 2 * Math.PI * R;

  return (
    // The wrapper stays the size of the avatar and the ring is painted into the
    // pill's own padding, so showing or hiding it never changes the navbar's
    // height. It also has to sit outside the overflow-hidden below, or the
    // avatar's clip would cut it off.
    <div className="relative shrink-0">
      {pending && (
        <svg viewBox="0 0 34 34" aria-hidden="true"
          className="pointer-events-none absolute -inset-[3px] -rotate-90">
          <circle cx="17" cy="17" r={R} fill="none" stroke="var(--well)" strokeWidth="2" />
          <circle cx="17" cy="17" r={R} fill="none" stroke="var(--green)" strokeWidth="2" strokeLinecap="round"
            strokeDasharray={`${(completion.pct / 100) * C} ${C}`} />
        </svg>
      )}
      <div className="relative flex size-7 items-center justify-center overflow-hidden rounded-full bg-gradient-to-br from-accent to-purple text-[12px] font-semibold text-white shadow-[0_2px_8px_rgba(44,62,126,0.35)]">
        {/* Own photo or brand-logo fallback, either way cropped to fill the
            circle — no padding, no white backing square peeking out around
            a logo that isn't already round. */}
        {show
          ? <img src={url} alt="" onError={() => setBroken(true)}
              className="absolute inset-0 size-full object-cover" />
          : user?.avatar}
      </div>
    </div>
  );
}

// The brand's logo next to its name in the navbar's client-identity block —
// shown only when the brand actually has one and it loads; a brand with no
// logo (or one whose URL 404s) shows its name alone rather than a broken
// image or a placeholder standing in for a photo that doesn't exist. Same
// URL builder and null-safe contract as NavAvatar's brand-logo fallback
// above, just rendered on its own instead of as a fallback for a person's
// own photo.
function ClientBrandLogo({ user }) {
  const [broken, setBroken] = useState(false);
  const url = AccountAPI.brandLogoUrl(user);
  if (!url || broken) return null;
  return (
    <span className="flex size-7 shrink-0 items-center justify-center overflow-hidden rounded-full">
      <img src={url} alt="" onError={() => setBroken(true)} className="size-full object-cover" />
    </span>
  );
}

export default function AppShell({ children }) {
  const { page, setPage } = useApp();
  const { user, logout, updateUser } = useAuth();
  const navigate = useNavigate();
  const [scrolled, setScrolled] = useState(false);

  // Re-checks this session's own brand once per mount — name, hasAvatar,
  // avatarUpdatedAt — since the login payload only snapshots those at
  // sign-in. Without this, a logo (or a rename) an internal admin makes
  // after the member's last login never shows up here until they sign out
  // and back in. Best-effort: a failed refresh just leaves the session's
  // existing (possibly stale) data in place rather than breaking the shell.
  useEffect(() => {
    if (!user?.brandId) return;
    AccountAPI.brand(user.brandId)
      .then(fresh => updateUser({
        clientName: fresh.name,
        brandHasLogo: fresh.hasAvatar,
        brandLogoUpdatedAt: fresh.avatarUpdatedAt,
      }))
      .catch(() => {});
    // Only the brandId identifies which brand to re-check; re-running this
    // every time `user` itself changes (e.g. right after the merge above)
    // would refetch in a loop.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.brandId]);

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

  // Computed here rather than inside NavAvatar so the ring and the tooltip that
  // explains it are driven by one reading.
  const completion = profileCompletion(user);
  const left = completion.total - completion.done;

  return (
    <div className="flex min-h-screen flex-col bg-page font-sans text-ink">
      {/* Floating glass navbar */}
      <div className="sticky top-0 z-40 px-3 pt-3 sm:px-5">
        <div
          className={`mx-auto flex h-[72px] max-w-[1600px] items-stretch rounded-2xl border border-line pl-[22px] backdrop-blur-[20px] transition-shadow duration-300 ${
            scrolled ? "shadow-[0_16px_40px_rgba(25,22,17,0.12)]" : "shadow-[0_8px_30px_rgba(25,22,17,0.06)]"
          }`}
          style={{ background: "var(--color-glass)" }}
        >
          {/* Wordmark */}
          <div className="flex items-center border-r border-line pr-7">
            <span className="font-sans text-[15px] font-light uppercase tracking-[0.28em] text-ink">
              Fifth <span className="text-accent">Avenue</span>
            </span>
          </div>

          {/* Client identity — scoped to the logged-in brand */}
          <div className="hidden shrink-0 items-center gap-2.5 border-r border-line px-5 sm:flex">
            <ClientBrandLogo user={user} />
            <span className="whitespace-nowrap text-[19px] font-bold text-ink">{user?.clientName}</span>
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

          {/* Theme + user pill + logout */}
          <div className="flex items-center gap-2.5 border-l border-line pl-4 pr-[18px]">
            <ThemeToggle />
            <button
              onClick={() => setPage("profile")}
              title={left
                ? `Account settings — profile ${completion.pct}% complete, ${left} item${left === 1 ? "" : "s"} left`
                : "Account settings"}
              aria-current={page === "profile" ? "page" : undefined}
              className={`flex items-center gap-[9px] rounded-full border bg-glass-soft py-[5px] pl-[5px] pr-3.5 text-[12.5px] text-ink shadow-sm backdrop-blur-sm transition-all duration-200 hover:-translate-y-[1px] hover:shadow-md ${
                page === "profile" ? "border-accent/40 ring-1 ring-accent/20" : "border-line hover:border-accent/25"
              }`}
            >
              <NavAvatar user={user} completion={completion} />
              <div className="hidden text-left sm:block">
                <div className="text-[13px] font-semibold leading-tight text-ink">{user?.name?.split(" ")[0]}</div>
                <div className="text-[11px] leading-tight text-sub">{user?.title}</div>
              </div>
            </button>
            <button
              onClick={handleLogout}
              title="Sign out"
              className="group flex items-center gap-1.5 rounded-full border border-line bg-glass-soft px-3 py-[9px] text-[11.5px] font-medium text-sub backdrop-blur-sm transition-all duration-200 hover:-translate-y-[1px] hover:border-red/25 hover:bg-red/[0.05] hover:text-red hover:shadow-sm"
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
