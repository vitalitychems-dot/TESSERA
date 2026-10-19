import { Link, useLocation } from "wouter";
import { useState } from "react";
import { ChevronRight } from "lucide-react";
import { PRIMARY, GROUPS, isActive } from "./navConfig";
import Mosaic from "./Mosaic";
import AdminKeyInput from "@/components/AdminKeyInput";

export default function DesktopRail() {
  const [location] = useLocation();
  const [open, setOpen] = useState<Record<string, boolean>>(() => {
    const init: Record<string, boolean> = {};
    for (const g of GROUPS) init[g.id] = g.items.some((i) => isActive(i, location));
    return init;
  });

  return (
    <aside className="tx-rail" aria-label="Workspace navigation" data-testid="desktop-rail">
      <Link href="/" className="tx-focus flex items-center gap-3 px-5 h-[60px] border-b" style={{ borderColor: "var(--next-rule)" }} data-testid="link-home">
        <Mosaic small />
        <span className="tx-display font-bold tracking-[0.2em] text-[15px]">TESSERA</span>
      </Link>
      <nav className="flex-1 overflow-y-auto tx-scrollbar-none px-4 py-4" aria-label="Primary">
        <div className="tx-label px-2.5 mb-2">Workspace</div>
        <ul className="space-y-0.5 mb-5">
          {PRIMARY.map((i) => (
            <li key={i.href}>
              <Link href={i.href} className="tx-link" aria-current={isActive(i, location) ? "page" : undefined} data-testid={`rail-${i.label.toLowerCase()}`}>
                <i.Icon size={16} strokeWidth={1.7} /> {i.label}
              </Link>
            </li>
          ))}
        </ul>
        {GROUPS.map((g) => {
          const expanded = !!open[g.id];
          return (
            <div key={g.id} className="mb-1">
              <button
                type="button"
                className="tx-focus w-full flex items-center justify-between px-2.5 py-1.5 rounded tx-label hover:text-[#b9b4aa]"
                aria-expanded={expanded}
                onClick={() => setOpen((o) => ({ ...o, [g.id]: !expanded }))}
                data-testid={`rail-group-${g.id}`}
              >
                {g.label}
                <ChevronRight size={12} style={{ transform: expanded ? "rotate(90deg)" : "none", transition: "transform .15s" }} />
              </button>
              {expanded && (
                <ul className="space-y-0.5 mt-0.5 mb-3 tx-fade-enter">
                  {g.items.map((i) => (
                    <li key={i.href}>
                      <Link href={i.href} className="tx-link" aria-current={isActive(i, location) ? "page" : undefined} data-testid={`rail-link-${i.href.slice(1)}`}>
                        <i.Icon size={15} strokeWidth={1.6} /> {i.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          );
        })}
      </nav>
      <div className="p-3 border-t" style={{ borderColor: "var(--next-rule)" }}>
        <AdminKeyInput compact />
      </div>
    </aside>
  );
}
