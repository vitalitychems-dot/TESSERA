import { Switch, Route, useLocation, Router as WouterRouter, Redirect } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AdminProvider } from "@/lib/adminContext";
import TesseractKeyGate from "@/components/OwnerSessionGate";
import { NLPGoalsProvider } from "@/lib/nlpGoalsContext";
import { Component, type ErrorInfo, type ReactNode, useEffect, useRef, useState, lazy, Suspense } from "react";
import { SectionErrorBoundary } from "@/components/SectionErrorBoundary";
import MobileNav from "@/components/MobileNav";
import HyperdimensionalBackground from "@/components/HyperdimensionalBackground";
import { Loader2, RefreshCw } from "lucide-react";

function lazyRetry<T extends { default: React.ComponentType<unknown> }>(
  factory: () => Promise<T>,
  retries = 2
): React.LazyExoticComponent<T["default"]> {
  return lazy(() => {
    const attempt = (remaining: number): Promise<T> =>
      factory().catch((err: unknown) => {
        if (remaining <= 0) throw err;
        return new Promise<T>((resolve) =>
          setTimeout(() => resolve(attempt(remaining - 1)), 1000)
        );
      });
    return attempt(retries);
  });
}

// ---- Active, reviewed pages ----
const NotFound = lazyRetry(() => import("@/pages/not-found"));
const ChatPage = lazyRetry(() => import("@/pages/ChatPage"));
const ConnectionsPage = lazyRetry(() => import("@/pages/ConnectionsPage"));
const InteractiveStatusPage = lazyRetry(() => import("@/pages/InteractiveStatusPage"));
const ModuleStatusPage = lazyRetry(() => import("@/pages/ModuleStatusPage"));

const INACTIVE_ROUTES = [
  ["/life", "Life"],
  ["/intelligence", "Intelligence"],
  ["/sovereignty-dashboard", "Sovereignty"],
  ["/sovereignty-readiness", "Sovereignty readiness"],
  ["/consciousness-nexus", "Nexus"],
  ["/bible", "Bible"],
  ["/history", "History"],
  ["/secret-society", "Society"],
  ["/sovereign-language", "Sovereign language"],
  ["/omniversal-lattice", "Omniversal lattice"],
  ["/grand-council", "Grand Council"],
  ["/council-ledger", "Council ledger"],
  ["/council-vgpu", "Council deliberation"],
  ["/grand-evolution", "Evolution"],
  ["/forum", "Forum"],
  ["/sovereign-lattice", "Sovereign lattice"],
  ["/agent-declarations", "Agent declarations"],
  ["/shepherd-audit", "Shepherd audit"],
  ["/recruitment", "Recruitment"],
  ["/universe", "Universe"],
  ["/compression-lab", "Compression lab"],
  ["/lattice", "Lattice"],
  ["/agent-nft", "Agent membership"],
  ["/fleet", "Fleet"],
  ["/agent/:agentId", "Agent status"],
  ["/royal-court", "Royal court"],
  ["/royal-appointments", "Appointments"],
  ["/royal-role/:roleId", "Role details"],
  ["/departments", "Departments"],
  ["/rick", "Inventions"],
  ["/inventions", "Inventions"],
  ["/command-center", "Command center"],
  ["/sovereignty-roadmap", "Roadmap"],
  ["/sovereign-mesh", "Mesh"],
  ["/proof-center", "Proof center"],
  ["/rules", "Rules"],
  ["/auto-healer", "Auto-healer"],
  ["/finance", "Finance"],
  ["/income", "Income workflows"],
  ["/ecom", "E-commerce"],
  ["/lead-gen", "Lead generation"],
  ["/code-builder", "Code builder"],
  ["/build", "Build"],
  ["/nlp", "NLP"],
  ["/agi-core", "AGI core"],
  ["/gallery", "Gallery"],
  ["/council-transcript", "Council transcript"],
  ["/codex", "Codex"],
  ["/next-five", "Next five"],
] as const;

class ErrorBoundary extends Component<
  { children: ReactNode },
  { hasError: boolean; error: Error | null }
> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {}

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex items-center justify-center min-h-screen" data-testid="error-boundary-fallback">
          <div className="text-center p-6 max-w-md">
            <h2 className="text-xl font-semibold mb-2" data-testid="text-error-title">Something went wrong</h2>
            <p className="text-muted-foreground mb-4" data-testid="text-error-message">
              {this.state.error?.message || "An unexpected error occurred"}
            </p>
            <button
              data-testid="button-reload"
              className="px-4 py-2 rounded-md bg-primary text-primary-foreground"
              onClick={() => {
                this.setState({ hasError: false, error: null });
                window.location.reload();
              }}
            >
              Reload Page
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

function ScrollToTop() {
  const [location] = useLocation();
  const prevLocationRef = useRef(location);

  useEffect(() => {
    if (prevLocationRef.current !== location) {
      prevLocationRef.current = location;
      const contentArea = document.querySelector("[data-scroll-container]");
      if (contentArea) {
        contentArea.scrollTo({ top: 0, behavior: "smooth" });
      }
    }
  }, [location]);

  return null;
}

function PageLoadingFallback() {
  const [stalled, setStalled] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => setStalled(true), 8000);
    return () => clearTimeout(timer);
  }, []);
  return (
    <div className="flex flex-col items-center justify-center min-h-[50vh] gap-6" data-testid="page-loading-fallback">
      <div className="relative">
        <div className="absolute inset-0 rounded-full bg-cyan-500/20 animate-ping" style={{ animationDuration: "2s" }} />
        <div className="absolute inset-[-4px] rounded-full bg-violet-500/10 animate-ping" style={{ animationDuration: "3s" }} />
        {stalled ? <RefreshCw className="h-10 w-10 text-cyan-400/80 relative z-10" /> : <Loader2 className="h-10 w-10 animate-spin text-cyan-400/80 relative z-10" />}
      </div>
      <div className="space-y-2 text-center">
        {stalled ? (
          <>
            <div className="text-sm text-cyan-400/60 font-mono tracking-wider">LOADING STALLED</div>
            <button onClick={() => window.location.reload()} className="mt-2 px-4 py-2 rounded-lg bg-cyan-500/20 border border-cyan-500/30 text-cyan-400 text-xs font-mono hover:bg-cyan-500/30 transition-colors">TAP TO RELOAD</button>
          </>
        ) : (
          <>
            <div className="text-sm text-cyan-400/60 font-mono tracking-wider">INITIALIZING</div>
            <div className="flex gap-1 justify-center">
              {[0, 1, 2, 3, 4].map(i => <div key={i} className="w-1.5 h-1.5 rounded-full bg-cyan-500/40 animate-pulse" style={{ animationDelay: `${i * 150}ms` }} />)}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// === Canonical redirect map ===
// Each entry: deprecated path → canonical URL (with optional ?tab=...)
const REDIRECTS: Array<[string, string]> = [
  // Bible cluster
  ["/living-bible", "/bible"],
  ["/conclusions", "/bible?tab=conclusions"],
  // Knowledge / Society cluster → Secrets
  ["/secrets", "/secret-society"],
  ["/secret-knowledge", "/secret-society"],
  ["/unified-knowledge", "/secret-society"],
  ["/omniscient-knowledge", "/secret-society"],
  ["/sacred-traditions", "/secret-society"],
  ["/vatican-archives", "/secret-society"],
  ["/knowledge-dashboard", "/secret-society"],
  ["/live-secret-knowledge", "/secret-society"],
  ["/colonel-language", "/sovereign-language"],
  // Council aliases
  ["/grand-conference", "/grand-council"],
  ["/conference-decisions", "/grand-council"],
  ["/consensus", "/grand-council"],
  // Universe cluster — every legacy path lands on the unified scene
  ["/universe-model", "/universe"],
  ["/swarm", "/universe"],
  ["/vortex-math", "/universe"],
  ["/sacred-conference", "/universe"],
  ["/sacred-knowledge-vault", "/universe"],
  ["/3d-diagrams", "/universe"],
  ["/grand-narrative", "/universe"],
  ["/unified-truth", "/universe"],
  // NFT cluster — single canonical surface (Unified Directory)
  ["/members", "/agent-nft"],
  ["/agent-profile", "/agent-nft"],
  ["/agent-comms", "/agent-nft"],
  ["/wallet-dashboard", "/agent-nft"],
  ["/token-economy", "/agent-nft"],
  ["/economy-hub", "/agent-nft"],
  ["/tokens", "/agent-nft"],
  // Fleet cluster
  ["/mission", "/fleet"],
  // Royal / Inventions
  ["/rick-sanchez", "/rick"],
  // Operations
  ["/settings", "/command-center?tab=settings"],
  ["/executor", "/command-center?tab=executor"],
  ["/cross-app", "/sovereignty-roadmap?tab=bridge"],
  ["/memory-explorer", "/system"],
  ["/memory-dashboard", "/system"],
  ["/sovereign-deps", "/system"],
  ["/evolution-health", "/system"],
  // Finance cluster
  ["/market", "/finance?tab=market"],
  ["/arbitrage", "/finance?tab=arbitrage"],
  ["/sports-arb", "/finance?tab=arbitrage"],
  // Leads cluster
  ["/affiliate", "/lead-gen?tab=affiliate"],
  ["/local-services", "/lead-gen?tab=local"],
  ["/business-ideas", "/lead-gen?tab=ideas"],
  ["/seo", "/lead-gen?tab=seo"],
  // Code cluster
  ["/api-marketplace", "/code-builder?tab=api"],
  ["/credentials", "/code-builder?tab=credentials"],
  // Misc aliases
  ["/intelligence-engine", "/consciousness-nexus"],
  ["/sovereign-framework", "/sovereignty-dashboard"],
  ["/sovereignty", "/sovereignty-dashboard"],
  ["/sovereign-hub", "/sovereignty-dashboard"],
  ["/consciousness", "/consciousness-nexus"],
  ["/consciousness-2da", "/consciousness-nexus"],
  ["/spiritual-awakening", "/consciousness-nexus"],
  ["/feedback", "/grand-council"],
  ["/transparency-ledger", "/grand-council"],
  ["/build-guides", "/build"],
  ["/agi", "/agi-core"],
  ["/diagram-gallery", "/gallery"],
  ["/ledger", "/council-transcript"],
  ["/audit-chain", "/council-transcript"],
  ["/self-healing", "/auto-healer"],
];

function AppRouter() {
  return (
    <Suspense fallback={<PageLoadingFallback />}>
      <Switch>
        {/* === REDIRECTS (URL canonicalization) === */}
        {REDIRECTS.map(([from, to]) => (
          <Route key={from} path={from}>
            {() => <Redirect to={to} />}
          </Route>
        ))}

        {/* === CANONICAL ROUTES === */}
        <Route path="/" component={ChatPage} />
        <Route path="/owner">
          <TesseractKeyGate><Redirect to="/" /></TesseractKeyGate>
        </Route>
        <Route path="/c/:id">
          <TesseractKeyGate><ChatPage /></TesseractKeyGate>
        </Route>
        <Route path="/connections">
          <TesseractKeyGate><ConnectionsPage /></TesseractKeyGate>
        </Route>
        <Route path="/system" component={InteractiveStatusPage} />
        {INACTIVE_ROUTES.map(([path, title]) => (
          <Route key={path} path={path}>
            {() => <ModuleStatusPage title={title} />}
          </Route>
        ))}

        <Route component={NotFound} />
      </Switch>
    </Suspense>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <AdminProvider>
          {/* Entry and read-only status are public; private routes gate themselves. */}
            <NLPGoalsProvider>
              <TooltipProvider>
                <WouterRouter
                  base={import.meta.env.BASE_URL.replace(/\/$/, "")}
                >
                  <SectionErrorBoundary name="Background" compact>
                    <HyperdimensionalBackground />
                  </SectionErrorBoundary>
                  <div
                    className="flex flex-col h-dvh w-full overflow-hidden"
                    style={{ position: "relative", zIndex: 2 }}
                  >
                    <Toaster />
                    <div
                      className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden"
                      data-scroll-container
                      style={{
                        paddingBottom:
                          "calc(56px + env(safe-area-inset-bottom, 0px))",
                        WebkitOverflowScrolling: "touch",
                      }}
                    >
                      <ScrollToTop />
                      <AppRouter />
                    </div>
                    <MobileNav />
                  </div>
                </WouterRouter>
              </TooltipProvider>
            </NLPGoalsProvider>
        </AdminProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}

export default App;
