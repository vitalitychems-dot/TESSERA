import { useState, useEffect, useMemo, Suspense, lazy, type LazyExoticComponent, type ComponentType } from "react";
import { useLocation } from "wouter";

export interface PageTabSpec {
  id: string;
  label: string;
  load: () => Promise<{ default: ComponentType<any> }>;
  /** Routes that should land on this tab */
  matchPaths?: string[];
}

interface PageTabsProps {
  hubKey: string;
  title: string;
  subtitle?: string;
  /** Kept for API compatibility; the shell applies one accent. */
  iconColor?: string;
  tabs: PageTabSpec[];
  defaultTab?: string;
}

const lazyCache = new Map<string, LazyExoticComponent<ComponentType<any>>>();

function getLazy(hubKey: string, spec: PageTabSpec): LazyExoticComponent<ComponentType<any>> {
  const cacheKey = `${hubKey}:${spec.id}`;
  let c = lazyCache.get(cacheKey);
  if (!c) {
    c = lazy(spec.load);
    lazyCache.set(cacheKey, c);
  }
  return c;
}

function TabSkeleton() {
  return (
    <div className="max-w-5xl mx-auto px-4 py-6 space-y-3" aria-busy="true" aria-label="Loading section">
      <div className="tx-skel h-6 w-48" />
      <div className="tx-skel h-24 w-full" />
      <div className="tx-skel h-24 w-full" />
    </div>
  );
}

/** Hub sub-navigation. Not sticky (the shell owns the only sticky bar), so nested bars never stack. */
export default function PageTabs({ hubKey, title, subtitle, tabs, defaultTab }: PageTabsProps) {
  const [location] = useLocation();

  const matched = useMemo(() => {
    const params = new URLSearchParams(typeof window !== "undefined" ? window.location.search : "");
    const queryTab = params.get("tab");
    if (queryTab && tabs.some(t => t.id === queryTab)) return queryTab;
    for (const t of tabs) {
      if (t.matchPaths?.some(p => location === p || location.startsWith(p + "/"))) return t.id;
    }
    return null;
  }, [location, tabs]);

  const initial = matched || defaultTab || tabs[0]?.id;
  const [active, setActive] = useState<string>(initial);

  useEffect(() => {
    if (matched && matched !== active) setActive(matched);
  }, [matched]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const stored = sessionStorage.getItem(`hub:${hubKey}`);
    if (stored && !matched && tabs.some(t => t.id === stored)) setActive(stored);
  }, [hubKey, matched, tabs]);

  useEffect(() => {
    sessionStorage.setItem(`hub:${hubKey}`, active);
  }, [hubKey, active]);

  const ActiveComp = useMemo(() => {
    const spec = tabs.find(t => t.id === active) || tabs[0];
    return spec ? getLazy(hubKey, spec) : null;
  }, [active, tabs, hubKey]);

  const showTabs = tabs.length > 1;

  return (
    <div className="flex flex-col w-full">
      <header className="border-b" style={{ borderColor: "var(--next-rule)" }}>
        <div className="px-4 pt-4 max-w-5xl mx-auto">
          <h1 className="tx-display text-xl font-bold leading-tight" style={{ color: "var(--next-bone)" }}>{title}</h1>
          {subtitle && <p className="tx-mono text-[11px] mt-1 truncate" style={{ color: "#858078" }}>{subtitle}</p>}
          {showTabs ? (
            <div
              role="tablist"
              aria-label={`${title} sections`}
              className="flex gap-4 overflow-x-auto tx-scrollbar-none mt-3 -mb-px"
            >
              {tabs.map(t => {
                const sel = active === t.id;
                return (
                  <button
                    key={t.id}
                    role="tab"
                    type="button"
                    aria-selected={sel}
                    onClick={() => setActive(t.id)}
                    data-testid={`hub-tab-${hubKey}-${t.id}`}
                    className="tx-focus tx-mono shrink-0 py-2.5 text-[12px] whitespace-nowrap border-b-2 transition-colors"
                    style={{
                      color: sel ? "var(--next-bone)" : "#858078",
                      borderColor: sel ? "var(--next-glass)" : "transparent",
                    }}
                  >
                    {t.label}
                  </button>
                );
              })}
            </div>
          ) : <div className="h-4" />}
        </div>
      </header>
      <div className="flex-1 min-h-0" role={showTabs ? "tabpanel" : undefined}>
        <Suspense fallback={<TabSkeleton />}>
          {ActiveComp ? <ActiveComp /> : null}
        </Suspense>
      </div>
    </div>
  );
}
