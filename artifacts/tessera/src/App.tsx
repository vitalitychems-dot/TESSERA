import { Switch, Route, useLocation, Router as WouterRouter } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AdminProvider } from "@/lib/adminContext";
import { MeshProvider } from "@/lib/meshContext";
import { NLPGoalsProvider } from "@/lib/nlpGoalsContext";
import { Component, type ErrorInfo, type ReactNode, useEffect, useRef, lazy, Suspense, type FC } from "react";
import MobileNav from "@/components/MobileNav";
import ActiveCommandsOverlay from "@/components/ActiveCommandsOverlay";
import MeshStatusBadge from "@/components/MeshStatusBadge";
import ToroidalBackground from "@/components/ToroidalBackground";
import { Loader2 } from "lucide-react";

const NotFound = lazy(() => import("@/pages/not-found"));
const ChatPage = lazy(() => import("@/pages/ChatPage"));
const LifePage = lazy(() => import("@/pages/LifePage"));
const UniversePage = lazy(() => import("@/pages/UniversePage"));
const MembersPage = lazy(() => import("@/pages/MembersPage"));
const SecretsPage = lazy(() => import("@/pages/SecretKnowledgePage"));
const TesseraBiblePage = lazy(() => import("@/pages/TesseraBiblePage"));
const BuildPage = lazy(() => import("@/pages/BuildPage"));
const TesseractForumPage = lazy(() => import("@/pages/TesseractForumPage"));
const NLPPage = lazy(() => import("@/pages/NLPPage"));
const SettingsPage = lazy(() => import("@/pages/SettingsPage"));
const SovereignLanguagePage = lazy(() => import("@/pages/SovereignLanguagePage"));
const ConsciousnessNexusPage = lazy(() => import("@/pages/ConsciousnessNexusPage"));
const SovereigntyDashboardPage = lazy(() => import("@/pages/SovereigntyDashboardPage"));
const SystemPage = lazy(() => import("@/pages/SystemPage"));
const TokenEconomyPage = lazy(() => import("@/pages/TokenEconomyPage"));
const LatticeBrowserPage = lazy(() => import("@/pages/LatticeBrowserPage"));
const GrandCouncilPage = lazy(() => import("@/pages/GrandCouncilPage"));
const RecruitmentPage = lazy(() => import("@/pages/RecruitmentPage"));
const AgentNFTPage = lazy(() => import("@/pages/AgentNFTPage"));

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
  return (
    <div className="flex flex-col items-center justify-center min-h-[50vh] gap-4" data-testid="page-loading-fallback">
      <Loader2 className="h-8 w-8 animate-spin text-primary/60" />
      <div className="text-sm text-muted-foreground font-mono">Loading...</div>
    </div>
  );
}

function AppRouter() {
  return (
    <Suspense fallback={<PageLoadingFallback />}>
      <Switch>
        <Route path="/" component={ChatPage} />
        <Route path="/c/:id" component={ChatPage} />
        <Route path="/life">{() => <LifePage />}</Route>
        <Route path="/universe">{() => <UniversePage />}</Route>
        <Route path="/unified-knowledge">{() => <SecretsPage />}</Route>
        <Route path="/omniscient-knowledge">{() => <SecretsPage />}</Route>
        <Route path="/members">{() => <MembersPage />}</Route>
        <Route path="/secrets">{() => <SecretsPage />}</Route>
        <Route path="/secret-knowledge">{() => <SecretsPage />}</Route>
        <Route path="/secret-society">{() => <SecretsPage />}</Route>
        <Route path="/bible" component={TesseraBiblePage} />
        <Route path="/build">{() => <BuildPage />}</Route>
        <Route path="/forum">{() => <TesseractForumPage />}</Route>
        <Route path="/nlp">{() => <NLPPage />}</Route>
        <Route path="/sovereign-language">{() => <SovereignLanguagePage />}</Route>
        <Route path="/colonel-language">{() => <SovereignLanguagePage />}</Route>
        <Route path="/consciousness-nexus">{() => <ConsciousnessNexusPage />}</Route>
        <Route path="/sovereignty-dashboard">{() => <SovereigntyDashboardPage />}</Route>
        <Route path="/system">{() => <SystemPage />}</Route>
        <Route path="/token-economy">{() => <TokenEconomyPage />}</Route>
        <Route path="/economy-hub">{() => <TokenEconomyPage />}</Route>
        <Route path="/lattice">{() => <LatticeBrowserPage />}</Route>
        <Route path="/grand-council">{() => <GrandCouncilPage />}</Route>
        <Route path="/grand-conference">{() => <GrandCouncilPage />}</Route>
        <Route path="/conference-decisions">{() => <GrandCouncilPage />}</Route>
        <Route path="/consensus">{() => <GrandCouncilPage />}</Route>
        <Route path="/settings">{() => <SettingsPage />}</Route>
        <Route path="/consciousness">{() => <ConsciousnessNexusPage />}</Route>
        <Route path="/consciousness-2da">{() => <ConsciousnessNexusPage />}</Route>
        <Route path="/sovereignty">{() => <SovereigntyDashboardPage />}</Route>
        <Route path="/tokens">{() => <TokenEconomyPage />}</Route>
        <Route path="/recruitment">{() => <RecruitmentPage />}</Route>
        <Route path="/conclusions">{() => <GrandCouncilPage />}</Route>
        <Route path="/feedback">{() => <GrandCouncilPage />}</Route>
        <Route path="/transparency-ledger">{() => <GrandCouncilPage />}</Route>
        <Route path="/sports-arb">{() => <TokenEconomyPage />}</Route>
        <Route path="/inventions">{() => <BuildPage />}</Route>
        <Route path="/agent-nft">{() => <AgentNFTPage />}</Route>
        <Route path="/universe-model">{() => <UniversePage />}</Route>
        <Route path="/agent-comms">{() => <SystemPage />}</Route>
        <Route path="/memory-explorer">{() => <SystemPage />}</Route>
        <Route path="/memory-dashboard">{() => <SystemPage />}</Route>
        <Route path="/sovereign-deps">{() => <SystemPage />}</Route>
        <Route path="/intelligence-engine">{() => <ConsciousnessNexusPage />}</Route>
        <Route path="/sovereign-framework">{() => <SovereigntyDashboardPage />}</Route>
        <Route path="/spiritual-awakening">{() => <ConsciousnessNexusPage />}</Route>
        <Route path="/sacred-traditions">{() => <SecretsPage />}</Route>
        <Route path="/sovereign-hub">{() => <SovereigntyDashboardPage />}</Route>
        <Route path="/vatican-archives">{() => <SecretsPage />}</Route>
        <Route path="/knowledge-dashboard">{() => <SecretsPage />}</Route>
        <Route path="/live-secret-knowledge">{() => <SecretsPage />}</Route>
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
          <MeshProvider>
          <NLPGoalsProvider>
          <TooltipProvider>
            <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
              <ToroidalBackground />
              <div className="flex flex-col h-dvh w-full overflow-hidden" style={{ position: "relative", zIndex: 1 }}>
                <Toaster />
                <div className="fixed top-2 right-2 z-50">
                  <MeshStatusBadge />
                </div>
                <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden" data-scroll-container style={{ paddingBottom: "calc(52px + env(safe-area-inset-bottom, 0px))", WebkitOverflowScrolling: "touch" }}>
                  <ScrollToTop />
                  <AppRouter />
                </div>
                <ActiveCommandsOverlay />
                <MobileNav />
              </div>
            </WouterRouter>
          </TooltipProvider>
          </NLPGoalsProvider>
          </MeshProvider>
        </AdminProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}

export default App;
