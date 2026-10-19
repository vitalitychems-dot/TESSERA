import { Link, useLocation } from "wouter";
import { useEffect, useState } from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { LayoutGrid, X } from "lucide-react";
import { PRIMARY, GROUPS, isActive } from "@/components/shell/navConfig";
import AdminKeyInput from "@/components/AdminKeyInput";

/** Mobile bottom bar: four workspace destinations plus an Index sheet listing every other route once. */
export default function MobileNav() {
  const [location] = useLocation();
  const [open, setOpen] = useState(false);
  useEffect(() => { setOpen(false); }, [location]);
  useEffect(() => {
    const desktop = window.matchMedia("(min-width: 768px)");
    const closeOnDesktop = () => { if (desktop.matches) setOpen(false); };
    desktop.addEventListener("change", closeOnDesktop);
    return () => desktop.removeEventListener("change", closeOnDesktop);
  }, []);

  const indexActive = GROUPS.some((g) => g.items.some((i) => isActive(i, location)));

  return (
    <DialogPrimitive.Root open={open} onOpenChange={setOpen}>
      {open && (
        <DialogPrimitive.Portal>
          <DialogPrimitive.Overlay className="fixed inset-0 z-[60] tx-fade-enter" style={{ background: "rgba(7,11,16,.78)" }} />
          <DialogPrimitive.Content
            aria-label="All destinations"
            aria-describedby={undefined}
            data-testid="mobile-more-sheet"
            className="fixed z-[61] left-0 right-0 bottom-0 tx-sheet-enter flex flex-col rounded-t-2xl border-t"
            style={{ background: "#0a1118", borderColor: "var(--next-rule)", maxHeight: "82dvh", paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
          >
            <div className="flex items-center justify-between px-5 h-12 shrink-0 border-b" style={{ borderColor: "var(--next-rule)" }}>
              <DialogPrimitive.Title className="tx-label">Index</DialogPrimitive.Title>
              <button type="button" onClick={() => setOpen(false)} className="tx-focus min-h-11 min-w-11 grid place-items-center -mr-2 rounded" aria-label="Close index" data-testid="button-close-index">
                <X size={18} />
              </button>
            </div>
            <div className="overflow-y-auto overscroll-contain px-4 py-3">
              {GROUPS.map((g) => (
                <section key={g.id} className="mb-4">
                  <h2 className="tx-label px-1 mb-1.5">{g.label}</h2>
                  <ul className="grid grid-cols-2 gap-1">
                    {g.items.map((i) => (
                      <li key={i.href}>
                        <Link href={i.href} className="tx-link min-h-[44px] pl-3" aria-current={isActive(i, location) ? "page" : undefined} data-testid={`index-link-${i.href.slice(1)}`}>
                          <i.Icon size={15} strokeWidth={1.6} className="shrink-0" /> <span className="truncate">{i.label}</span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </section>
              ))}
              <div className="pb-2"><AdminKeyInput compact /></div>
            </div>
          </DialogPrimitive.Content>
        </DialogPrimitive.Portal>
      )}

      <nav
        className="tx-bottombar fixed bottom-0 left-0 right-0 z-50 border-t md:hidden"
        style={{ background: "#0a1118", borderColor: "var(--next-rule)", paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
        aria-label="Primary navigation"
        data-testid="mobile-nav"
      >
        <ul className="flex h-[60px]">
          {PRIMARY.map((t) => {
            const active = isActive(t, location);
            return (
              <li key={t.href} className="flex-1">
                <Link
                  href={t.href}
                  aria-current={active ? "page" : undefined}
                  className="tx-focus h-full flex flex-col items-center justify-center gap-1 touch-manipulation"
                  style={{ color: active ? "var(--next-glass)" : "#858078", WebkitTapHighlightColor: "transparent" }}
                  data-testid={`mobile-tab-${t.label.toLowerCase()}`}
                >
                  <t.Icon size={19} strokeWidth={active ? 2 : 1.6} />
                  <span className="tx-mono text-[10px] tracking-wider">{t.label}</span>
                </Link>
              </li>
            );
          })}
          <li className="flex-1">
            <DialogPrimitive.Trigger asChild>
            <button
              type="button"
              aria-expanded={open}
              aria-haspopup="dialog"
              className="tx-focus w-full h-full flex flex-col items-center justify-center gap-1 touch-manipulation"
              style={{ color: open || indexActive ? "var(--next-return)" : "#858078", WebkitTapHighlightColor: "transparent" }}
              data-testid="mobile-tab-more"
            >
              <LayoutGrid size={19} strokeWidth={1.6} />
              <span className="tx-mono text-[10px] tracking-wider">Index</span>
            </button>
            </DialogPrimitive.Trigger>
          </li>
        </ul>
      </nav>
    </DialogPrimitive.Root>
  );
}
