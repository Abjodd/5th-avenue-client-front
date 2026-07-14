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
      <div className="sticky top-0 z-40 flex h-14 shrink-0 items-stretch border-b border-line bg-surface pl-[22px]">
        {/* Wordmark */}
        <div className="flex items-center border-r border-line pr-[22px]">
          <span className="font-serif text-[17px] italic font-semibold tracking-[-0.01em] text-ink">5th Avenue</span>
        </div>

        {/* Client identity — scoped to the logged-in brand */}
        <div className="hidden shrink-0 items-center gap-2 border-r border-line px-4 sm:flex">
          <span className="whitespace-nowrap text-[11px] font-semibold uppercase tracking-[0.07em] text-mute">Client</span>
          <span className="whitespace-nowrap text-[13px] font-semibold text-ink">{user?.clientName}</span>
        </div>

        {/* Nav tabs */}
        <div className="flex flex-1 items-stretch overflow-x-auto">
          {NAV_ITEMS.map(item => {
            const isActive = page === item.id;
            return (
              <button key={item.id} onClick={() => setPage(item.id)}
                className={`flex h-full items-center gap-[7px] whitespace-nowrap border-b-2 px-4 text-[13px] transition-colors ${
                  isActive ? "border-accent font-semibold text-ink" : "border-transparent font-medium text-sub hover:text-ink"
                }`}>
                <span className={`text-[13px] ${isActive ? "text-accent" : "text-mute"}`}>{item.icon}</span>
                {item.label}
              </button>
            );
          })}
        </div>

        {/* User pill + logout */}
        <div className="flex items-center gap-2 border-l border-line pl-3.5 pr-[18px]">
          <div className="flex items-center gap-[9px] rounded-[20px] border border-line bg-surface py-[5px] pl-[5px] pr-3 text-[12.5px] text-ink">
            <div className="flex size-[26px] shrink-0 items-center justify-center rounded-full bg-accent text-[12px] font-semibold text-white">{user?.avatar}</div>
            <div className="hidden text-left sm:block">
              <div className="text-[13px] font-semibold leading-tight text-ink">{user?.name?.split(" ")[0]}</div>
              <div className="text-[11px] leading-tight text-sub">{user?.title}</div>
            </div>
          </div>
          <button onClick={handleLogout} title="Sign out"
            className="rounded-md border border-line bg-well px-2.5 py-1.5 text-[11.5px] font-medium text-sub hover:text-ink">
            Sign out
          </button>
        </div>
      </div>

      <main className="flex min-w-0 flex-1 flex-col">{children}</main>
    </div>
  );
}
