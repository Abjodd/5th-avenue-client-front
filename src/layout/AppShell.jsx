// Mirrors 5th-internal-front's AppShell: 56px bar, Newsreader italic
// wordmark, Sora nav tabs with a 2px underline on the active tab.
// Brand identity + user pill come from the logged-in portal user.
import { useNavigate } from "react-router-dom";
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

  const handleLogout = () => {
    logout();
    navigate("/login", { replace: true });
  };

  return (
    <div className="flex min-h-screen flex-col bg-page font-sans text-ink">
      {/* Floating glass navbar */}
      <div className="sticky top-0 z-40 px-3 pt-3 sm:px-5">
        <div
          className="mx-auto flex h-[72px] max-w-[1600px] items-stretch overflow-hidden rounded-b-2xl rounded-t-2xl border pl-[22px] shadow-[0_8px_30px_rgba(15,23,42,0.06)] backdrop-blur-[20px] transition-shadow duration-300"
          style={{ background: "rgba(255,255,255,0.72)", borderColor: "rgba(15,23,42,0.08)" }}
        >
          {/* Wordmark */}
          <div className="flex items-center border-r border-[rgba(15,23,42,0.08)] pr-7">
            <span className="font-serif text-[21px] italic font-semibold tracking-[-0.01em] text-ink">
              5th <span className="text-accent">Avenue</span>
            </span>
          </div>

          {/* Client identity — scoped to the logged-in brand */}
          <div className="hidden shrink-0 items-center gap-2.5 border-r border-[rgba(15,23,42,0.08)] px-5 sm:flex">
            <span className="whitespace-nowrap rounded-full bg-white/60 px-2.5 py-1 text-[10.5px] font-semibold uppercase tracking-[0.08em] text-mute shadow-sm ring-1 ring-[rgba(15,23,42,0.06)]">
              Client
            </span>
            <span className="whitespace-nowrap text-[13.5px] font-semibold text-ink">{user?.clientName}</span>
          </div>

          {/* Nav tabs */}
          <div className="flex flex-1 items-stretch overflow-x-auto px-1">
            {NAV_ITEMS.map(item => {
              const isActive = page === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setPage(item.id)}
                  className="group relative flex h-full items-center px-4 transition-transform duration-200 ease-out hover:-translate-y-[1px]"
                >
                  <span
                    className={`flex items-center gap-[7px] whitespace-nowrap rounded-full px-3.5 py-[7px] text-[13px] transition-all duration-200 ease-out ${
                      isActive
                        ? "bg-accent/[0.08] font-semibold text-accent shadow-[0_0_0_1px_rgba(37,99,235,0.12)]"
                        : "font-medium text-sub group-hover:bg-black/[0.03] group-hover:text-ink"
                    }`}
                  >
                    <span
                      className={`text-[13px] transition-transform duration-200 ${
                        isActive ? "text-accent scale-110" : "text-mute group-hover:scale-105"
                      }`}
                    >
                      {item.icon}
                    </span>
                    {item.label}
                  </span>
                  <span
                    className={`pointer-events-none absolute bottom-[14px] left-1/2 h-[2px] -translate-x-1/2 rounded-full bg-accent transition-all duration-300 ease-out ${
                      isActive ? "w-6 opacity-100 shadow-[0_0_8px_rgba(37,99,235,0.5)]" : "w-0 opacity-0"
                    }`}
                  />
                </button>
              );
            })}
          </div>

          {/* User pill + logout */}
          <div className="flex items-center gap-2.5 border-l border-[rgba(15,23,42,0.08)] pl-4 pr-[18px]">
            <div className="flex items-center gap-[9px] rounded-full border border-[rgba(15,23,42,0.06)] bg-white/50 py-[5px] pl-[5px] pr-3.5 text-[12.5px] text-ink shadow-sm backdrop-blur-sm transition-all duration-200 hover:-translate-y-[1px] hover:shadow-md">
              <div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-accent to-[#1d4ed8] text-[12px] font-semibold text-white shadow-[0_2px_8px_rgba(37,99,235,0.35)]">
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
              className="group flex items-center gap-1.5 rounded-full border border-[rgba(15,23,42,0.08)] bg-white/40 px-3 py-[9px] text-[11.5px] font-medium text-sub backdrop-blur-sm transition-all duration-200 hover:-translate-y-[1px] hover:border-red/25 hover:bg-red/[0.05] hover:text-red hover:shadow-sm"
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