import { Switch, Route, useLocation, Router as WouterRouter, Redirect } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AdminProvider } from "@/lib/adminContext";
import TesseractKeyGate from "@/components/TesseractKeyGate";
import { MeshProvider } from "@/lib/meshContext";
import { NLPGoalsProvider } from "@/lib/nlpGoalsContext";
import { Component, type ErrorInfo, type ReactNode, useEffect, useRef, useState, lazy, Suspense } from "react";
import { SectionErrorBoundary } from "@/components/SectionErrorBoundary";
import MobileNav from "@/components/MobileNav";
import ActiveCommandsOverlay from "@/components/ActiveCommandsOverlay";
import MeshStatusBadge from "@/components/MeshStatusBadge";
import DesktopRail from "@/components/shell/DesktopRail";
import Mosaic from "@/components/shell/Mosaic";
import { findCurrent } from "@/components/shell/navConfig";
import "@/styles/shell.css";

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

// ---- Surviving canonical pages ----
const BrainPage = lazyRetry(() => import("@/pages/BrainPage"));
const EyePage = lazyRetry(() => import("@/pages/EyePage"));
const MemoryPage = lazyRetry(() => import("@/pages/MemoryPage"));
const SecretsVaultPage = lazyRetry(() => import("@/pages/SecretsVaultPage"));
const NotFound = lazyRetry(() => import("@/pages/not-found"));
const ChatPage = lazyRetry(() => import("@/pages/ChatPage"));
const LifePage = lazyRetry(() => import("@/pages/LifePage"));
const SecretsPage = lazyRetry(() => import("@/pages/SecretKnowledgePage"));
const BuildPage = lazyRetry(() => import("@/pages/BuildPage"));
const TesseractForumPage = lazyRetry(() => import("@/pages/TesseractForumPage"));
const SovereignLatticePage = lazyRetry(() => import("@/pages/SovereignLatticePage"));
const AgentDeclarationsPage = lazyRetry(() => import("@/pages/AgentDeclarationsPage"));
const ShepherdAuditPage = lazyRetry(() => import("@/pages/ShepherdAuditPage"));
const NLPPage = lazyRetry(() => import("@/pages/NLPPage"));
const SovereignLanguagePage = lazyRetry(() => import("@/pages/SovereignLanguagePage"));
const OmniversalLatticePage = lazyRetry(() => import("@/pages/OmniversalLatticePage"));
const ConsciousnessNexusPage = lazyRetry(() => import("@/pages/ConsciousnessNexusPage"));
const SovereigntyDashboardPage = lazyRetry(() => import("@/pages/SovereigntyDashboardPage"));
const SovereigntyReadinessPage = lazyRetry(() => import("@/pages/SovereigntyReadinessPage"));
const SystemPage = lazyRetry(() => import("@/pages/SystemPage"));
const LatticeBrowserPage = lazyRetry(() => import("@/pages/LatticeBrowserPage"));
const HistoryPage = lazyRetry(() => import("@/pages/HistoryPage"));
const GrandCouncilPage = lazyRetry(() => import("@/pages/GrandCouncilPage"));
const CouncilLedgerPage = lazyRetry(() => import("@/pages/CouncilLedgerPage"));
const GrandCouncilDeliberationPage = lazyRetry(() => import("@/pages/GrandCouncilDeliberationPage"));
const GrandEvolutionPage = lazyRetry(() => import("@/pages/GrandEvolutionPage"));
const RickPage = lazyRetry(() => import("@/pages/RickPage"));
const AGICorePage = lazyRetry(() => import("@/pages/AGICorePage"));
const CompressionLabPage = lazyRetry(() => import("@/pages/CompressionLabPage"));
const SovereignMeshPage = lazyRetry(() => import("@/pages/SovereignMeshPage"));
const ProofCenterPage = lazyRetry(() => import("@/pages/ProofCenterPage"));
const FleetPage = lazyRetry(() => import("@/pages/FleetPage"));
const AgentLivePage = lazyRetry(() => import("@/pages/AgentLivePage"));
const RulesPage = lazyRetry(() => import("@/pages/RulesPage"));
const IntelligencePage = lazyRetry(() => import("@/pages/IntelligencePage"));
const RoyalCourtPage = lazyRetry(() => import("@/pages/RoyalCourtPage"));
const RoyalAppointmentsPage = lazyRetry(() => import("@/pages/RoyalAppointmentsPage"));
const RoyalRolePage = lazyRetry(() => import("@/pages/RoyalRolePage"));
const DepartmentsPage = lazyRetry(() => import("@/pages/DepartmentsPage"));
const CouncilTranscriptPage = lazyRetry(() => import("@/pages/CouncilTranscriptPage"));
const AutoHealerPage = lazyRetry(() => import("@/pages/AutoHealerPage"));
const GalleryPage = lazyRetry(() => import("@/pages/GalleryPage"));
const CodexPage = lazyRetry(() => import("@/pages/CodexPage"));
const NextFivePage = lazyRetry(() => import("@/pages/NextFivePage"));

// ---- Hub wrappers ----
const UniverseHubPage = lazyRetry(() => import("@/pages/UniverseHubPage"));
const CodeHubPage = lazyRetry(() => import("@/pages/CodeHubPage"));
const SEOResearchPage = lazyRetry(() => import("@/pages/SEOResearchPage"));
const CommandHubPage = lazyRetry(() => import("@/pages/CommandHubPage"));
const RoadmapHubPage = lazyRetry(() => import("@/pages/RoadmapHubPage"));
const BibleHubPage = lazyRetry(() => import("@/pages/BibleHubPage"));
const GitbookRoadmapPage = lazyRetry(() => import("@/pages/GitbookRoadmapPage"));

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

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("[ErrorBoundary] render error:", error, errorInfo.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex items-center justify-center min-h-[100dvh]" style={{ background: "#070b10", color: "#f3efe6" }} data-testid="error-boundary-fallback">
          <div className="text-center p-6 max-w-md">
            <h2 className="text-xl font-semibold mb-2" style={{ color: "#ff5c39" }} data-testid="text-error-title">Something went wrong</h2>
            <p className="text-muted-foreground mb-4" data-testid="text-error-message">
              {this.state.error?.message || "An unexpected error occurred"}
            </p>
            <button
              data-testid="button-reload"
              className="px-4 py-2 rounded-md border focus-visible:outline-2" style={{ borderColor: "rgba(126,240,212,.3)", color: "#7ef0d4" }}
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
        contentArea.scrollTo({ top: 0, behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
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
    <div className="max-w-5xl mx-auto px-4 py-6" data-testid="page-loading-fallback" aria-busy={!stalled}>
      {stalled ? (
        <div className="py-16 text-center" role="alert">
          <Mosaic />
          <p className="tx-mono text-[11px] tracking-[0.14em] uppercase mt-4" style={{ color: "#a09b91" }}>This view is taking longer than expected</p>
          <button onClick={() => window.location.reload()} className="tx-focus tx-mono mt-4 px-4 py-2 rounded-md border text-xs" style={{ borderColor: "var(--next-rule)", color: "var(--next-glass)" }} data-testid="button-reload-stalled">Reload</button>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="tx-skel h-7 w-56" />
          <div className="tx-skel h-4 w-80 max-w-full" />
          <div className="tx-skel h-40 w-full mt-4" />
          <div className="tx-skel h-24 w-full" />
        </div>
      )}
    </div>
  );
}

function TopBar() {
  const [location] = useLocation();
  const cur = findCurrent(location);
  return (
    <header className="tx-topbar" data-testid="shell-topbar">
      <span className="md:hidden"><Mosaic small /></span>
      <div className="min-w-0 flex-1 flex items-baseline gap-2">
        {cur?.group && <span className="tx-label hidden sm:inline">{cur.group.label} /</span>}
        <span className="tx-display font-semibold text-[14px] truncate" data-testid="text-current-view">{cur?.item.label ?? "TESSERA"}</span>
      </div>
      <SectionErrorBoundary name="Status Badge" compact>
        <div className="shrink-0"><MeshStatusBadge /></div>
      </SectionErrorBoundary>
    </header>
  );
}

// === Canonical redirect map ===
// Each entry: deprecated path → canonical URL (with optional ?tab=...)
const REDIRECTS: Array<[string, string]> = [
  // Bible cluster
  ["/living-bible", "/bible"],
  ["/conclusions", "/bible?tab=conclusions"],
  // Knowledge / Society cluster → Secrets
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
  // Fleet cluster
  ["/mission", "/fleet"],
  // Royal / Inventions
  ["/rick-sanchez", "/rick"],
  // Operations
  ["/settings", "/command-center?tab=settings"],
  ["/executor", "/command-center?tab=executor"],
  ["/cross-app", "/sovereignty-roadmap?tab=bridge"],
  ["/memory-explorer", "/memory"],
  ["/source-library", "/memory"],
  ["/memory-dashboard", "/system"],
  ["/sovereign-deps", "/system"],
  ["/evolution-health", "/system"],
  // Code cluster
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
        <Route path="/">{() => <Redirect to="/chat" />}</Route>
        <Route path="/chat" component={ChatPage} />
        <Route path="/c/:id" component={ChatPage} />
        <Route path="/life">{() => <LifePage />}</Route>
        <Route path="/eye">{() => <EyePage />}</Route>
        <Route path="/brain">{() => <BrainPage />}</Route>
        <Route path="/intelligence">{() => <IntelligencePage />}</Route>
        <Route path="/sovereignty-dashboard">{() => <SovereigntyDashboardPage />}</Route>
        <Route path="/sovereignty-readiness">{() => <SovereigntyReadinessPage />}</Route>
        <Route path="/consciousness-nexus">{() => <ConsciousnessNexusPage />}</Route>

        {/* Bible hub */}
        <Route path="/bible">{() => <BibleHubPage />}</Route>
        <Route path="/history">{() => <HistoryPage />}</Route>

        {/* Knowledge & Society */}
        <Route path="/memory">{() => <MemoryPage />}</Route>
        <Route path="/secrets">{() => <SecretsVaultPage />}</Route>
        <Route path="/secret-society">{() => <SecretsPage />}</Route>
        <Route path="/sovereign-language">{() => <SovereignLanguagePage />}</Route>
        <Route path="/omniversal-lattice">{() => <OmniversalLatticePage />}</Route>

        {/* Council & Forum */}
        <Route path="/grand-council">{() => <GrandCouncilPage />}</Route>
        <Route path="/council-ledger">{() => <CouncilLedgerPage />}</Route>
        <Route path="/council-vgpu">{() => <GrandCouncilDeliberationPage />}</Route>
        <Route path="/grand-evolution">{() => <GrandEvolutionPage />}</Route>
        <Route path="/forum">{() => <TesseractForumPage />}</Route>
        <Route path="/gitbook">{() => <GitbookRoadmapPage />}</Route>
        <Route path="/sovereign-lattice">{() => <SovereignLatticePage />}</Route>
        <Route path="/agent-declarations">{() => <AgentDeclarationsPage />}</Route>
        <Route path="/shepherd-audit">{() => <ShepherdAuditPage />}</Route>

        {/* Universe hub (3D + Vortex + Swarm + Conference + Narrative) */}
        <Route path="/universe">{() => <UniverseHubPage />}</Route>

        {/* Compression / Lattice */}
        <Route path="/compression-lab">{() => <CompressionLabPage />}</Route>
        <Route path="/lattice">{() => <LatticeBrowserPage />}</Route>

        {/* Fleet & Mission */}
        <Route path="/fleet">{() => <FleetPage />}</Route>
        <Route path="/agent/:agentId">{() => <AgentLivePage />}</Route>

        {/* Royal Court */}
        <Route path="/royal-court">{() => <RoyalCourtPage />}</Route>
        <Route path="/royal-appointments">{() => <RoyalAppointmentsPage />}</Route>
        <Route path="/royal-role/:roleId">{() => <RoyalRolePage />}</Route>
        <Route path="/departments">{() => <DepartmentsPage />}</Route>
        <Route path="/rick">{() => <RickPage />}</Route>
        <Route path="/inventions">{() => <RickPage initialTab="inventions" />}</Route>

        {/* Operations: Command + Settings + Executor */}
        <Route path="/command-center">{() => <CommandHubPage />}</Route>
        <Route path="/sovereignty-roadmap">{() => <RoadmapHubPage />}</Route>
        <Route path="/system">{() => <SystemPage />}</Route>
        <Route path="/sovereign-mesh">{() => <SovereignMeshPage />}</Route>
        <Route path="/proof-center">{() => <ProofCenterPage />}</Route>
        <Route path="/rules">{() => <RulesPage />}</Route>
        <Route path="/auto-healer">{() => <AutoHealerPage />}</Route>

        {/* SEO research */}
        <Route path="/seo">{() => <SEOResearchPage />}</Route>

        {/* Developer: Code + API + Credentials */}
        <Route path="/code-builder">{() => <CodeHubPage />}</Route>

        {/* Misc */}
        <Route path="/build">{() => <BuildPage />}</Route>
        <Route path="/nlp">{() => <NLPPage />}</Route>
        <Route path="/agi-core">{() => <AGICorePage />}</Route>
        <Route path="/gallery">{() => <GalleryPage />}</Route>
        <Route path="/council-transcript">{() => <CouncilTranscriptPage />}</Route>
        <Route path="/codex">{() => <CodexPage />}</Route>
        <Route path="/next-five">{() => <NextFivePage />}</Route>

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
          {/* Sovereign gate: locked until the operator pastes the canonical Father
              key into the TESSERACT_ADMIN_KEY (= SIGIL_ADMIN_KEY) Replit Secret. */}
          <TesseractKeyGate>
          <MeshProvider>
          <NLPGoalsProvider>
          <TooltipProvider>
            <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
              <Toaster />
              <div className="tx-shell">
                <DesktopRail />
                <div className="tx-main">
                  <TopBar />
                  <main className="tx-scroll" data-scroll-container id="main">
                    <ScrollToTop />
                    <AppRouter />
                  </main>
                </div>
                <SectionErrorBoundary name="Commands" compact>
                  <ActiveCommandsOverlay />
                </SectionErrorBoundary>
                <MobileNav />
              </div>
            </WouterRouter>
          </TooltipProvider>
          </NLPGoalsProvider>
          </MeshProvider>
          </TesseractKeyGate>
        </AdminProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}

export default App;
