import {
  createContext,
  useCallback,
  useContext,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { Check, Info, X } from "lucide-react";
import { cx } from "../../lib/cx";
import { Icon } from "./Icon";

type ToastTone = "default" | "success" | "danger";
interface ToastItem {
  id: number;
  message: string;
  tone: ToastTone;
}

interface ToastCtx {
  toast: (message: string, tone?: ToastTone) => void;
}

const Ctx = createContext<ToastCtx | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const seq = useRef(0);

  const toast = useCallback((message: string, tone: ToastTone = "default") => {
    const id = ++seq.current;
    setItems((l) => [...l, { id, message, tone }]);
    setTimeout(() => setItems((l) => l.filter((t) => t.id !== id)), 3200);
  }, []);

  return (
    <Ctx.Provider value={{ toast }}>
      {children}
      <div className="pointer-events-none fixed bottom-5 left-1/2 z-[60] flex -translate-x-1/2 flex-col items-center gap-2">
        {items.map((t) => (
          <div
            key={t.id}
            className={cx(
              "fa-toast pointer-events-auto flex items-center gap-2.5 rounded-lg border border-line bg-modal px-3.5 py-2.5 text-label text-ink shadow-modal",
            )}
          >
            {t.tone !== "default" && (
              <span
                className={cx(
                  "flex h-4 w-4 items-center justify-center rounded-full",
                  t.tone === "success" && "text-success",
                  t.tone === "danger" && "text-danger",
                )}
              >
                <Icon icon={t.tone === "success" ? Check : t.tone === "danger" ? X : Info} size={14} />
              </span>
            )}
            {t.message}
          </div>
        ))}
      </div>
    </Ctx.Provider>
  );
}

export function useToast() {
  const ctx = useContext(Ctx);
  if (!ctx) return { toast: () => {} };
  return ctx;
}
