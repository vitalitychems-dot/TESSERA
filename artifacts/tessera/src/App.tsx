import { Switch, Route, Redirect, useLocation, Router as WouterRouter } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AdminProvider } from "@/lib/adminContext";
import { MeshProvider } from "@/lib/meshContext";
import { NLPGoalsProvider } from "@/lib/nlpGoalsContext";
import { Component, type ErrorInfo, type ReactNode, useState, useCallback, useEffect, useRef, lazy, Suspense, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import MobileNav from "@/components/MobileNav";
import ActiveCommandsOverlay from "@/components/ActiveCommandsOverlay";
import MeshStatusBadge from "@/components/MeshStatusBadge";
import ToroidalBackground from "@/components/ToroidalBackground";
import { Loader2 } from "lucide-react";

const NotFound = lazy(() => import("@/pages/not-found"));
const ChatPage = lazy(() => import("@/pages/ChatPage"));
const LifePage = lazy(() => import("@/pages/LifePage"));
const EntitiesPage = lazy(() => import("@/pages/EntitiesPage"));
const AgentVoicePage = lazy(() => import("@/pages/AgentVoicePage"));
const NexusPage = lazy(() => import("@/pages/NexusPage"));
const KnowledgePage = lazy(() => import("@/pages/KnowledgePage"));
const TesseraBiblePage = lazy(() => import("@/pages/TesseraBiblePage"));
const CouncilPage = lazy(() => import("@/pages/CouncilPage"));
const EconomyPage = lazy(() => import("@/pages/EconomyPage"));
const TesseractForumPage = lazy(() => import("@/pages/TesseractForumPage"));
const SovereignPage = lazy(() => import("@/pages/SovereignPage"));

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
      <div className="relative">
        <Loader2 className="h-10 w-10 animate-spin text-primary/60" />
        <div className="absolute inset-0 h-10 w-10 rounded-full animate-ping opacity-20 bg-primary" />
      </div>
      <div className="text-sm text-muted-foreground animate-pulse font-mono">Loading...</div>
    </div>
  );
}

function PageTransition({ children }: { children: ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, ease: "easeOut" }}
      className="h-full w-full"
    >
      {children}
    </motion.div>
  );
}

function AppRouter() {
  const [location] = useLocation();
  const routeKey = useMemo(() => location.split("/")[1] || "home", [location]);
  return (
    <Suspense fallback={<PageLoadingFallback />}>
      <AnimatePresence mode="wait">
        <PageTransition key={routeKey}>
          <Switch>
            <Route path="/" component={ChatPage} />
            <Route path="/c/:id" component={ChatPage} />
            <Route path="/life">{() => <LifePage />}</Route>
            <Route path="/entities">{() => <EntitiesPage />}</Route>
            <Route path="/agent-voice">{() => <AgentVoicePage />}</Route>
            <Route path="/nexus">{() => <NexusPage />}</Route>
            <Route path="/knowledge">{() => <KnowledgePage />}</Route>
            <Route path="/bible" component={TesseraBiblePage} />
            <Route path="/council">{() => <CouncilPage />}</Route>
            <Route path="/economy">{() => <EconomyPage />}</Route>
            <Route path="/forum">{() => <TesseractForumPage />}</Route>
            <Route path="/sovereign">{() => <SovereignPage />}</Route>

            <Route path="/consciousness-nexus"><Redirect to="/nexus" /></Route>
            <Route path="/unified-knowledge"><Redirect to="/knowledge" /></Route>
            <Route path="/omniscient-knowledge"><Redirect to="/knowledge" /></Route>
            <Route path="/universal-knowledge"><Redirect to="/knowledge" /></Route>
            <Route path="/sovereign-knowledge"><Redirect to="/knowledge" /></Route>
            <Route path="/knowledge-pipeline"><Redirect to="/knowledge" /></Route>
            <Route path="/knowledge-synthesis"><Redirect to="/knowledge" /></Route>
            <Route path="/knowledge-dashboard"><Redirect to="/knowledge" /></Route>
            <Route path="/knowledge-secrets"><Redirect to="/knowledge" /></Route>
            <Route path="/agent-secrets"><Redirect to="/knowledge" /></Route>
            <Route path="/sovereign-secrets"><Redirect to="/knowledge" /></Route>
            <Route path="/secret-knowledge-archive"><Redirect to="/knowledge" /></Route>
            <Route path="/secret-knowledge"><Redirect to="/knowledge" /></Route>
            <Route path="/live-secret-knowledge"><Redirect to="/knowledge" /></Route>
            <Route path="/vatican-archives"><Redirect to="/knowledge" /></Route>
            <Route path="/discoveries"><Redirect to="/knowledge" /></Route>
            <Route path="/colonel-language"><Redirect to="/knowledge" /></Route>
            <Route path="/cheat-codes"><Redirect to="/knowledge" /></Route>

            <Route path="/grand-council"><Redirect to="/council" /></Route>
            <Route path="/grand-conference"><Redirect to="/council" /></Route>
            <Route path="/conclusions"><Redirect to="/council" /></Route>
            <Route path="/consensus"><Redirect to="/council" /></Route>
            <Route path="/tesseract-console"><Redirect to="/council" /></Route>
            <Route path="/tesseract"><Redirect to="/council" /></Route>
            <Route path="/agi-summit"><Redirect to="/council" /></Route>
            <Route path="/conference-decisions"><Redirect to="/council" /></Route>
            <Route path="/real-ai"><Redirect to="/council" /></Route>
            <Route path="/summit"><Redirect to="/council" /></Route>
            <Route path="/summit-report"><Redirect to="/council" /></Route>
            <Route path="/community-hub"><Redirect to="/council" /></Route>

            <Route path="/economy-hub"><Redirect to="/economy" /></Route>
            <Route path="/agent-economy"><Redirect to="/economy" /></Route>
            <Route path="/cross-dimensional-economy"><Redirect to="/economy" /></Route>
            <Route path="/token-economy"><Redirect to="/economy" /></Route>
            <Route path="/coin"><Redirect to="/economy" /></Route>
            <Route path="/revenue-hub"><Redirect to="/economy" /></Route>
            <Route path="/wallet-dashboard"><Redirect to="/economy" /></Route>
            <Route path="/sports-arb"><Redirect to="/economy" /></Route>
            <Route path="/arbitrage"><Redirect to="/economy" /></Route>

            <Route path="/sovereign-hub"><Redirect to="/sovereign" /></Route>
            <Route path="/sovereign-framework"><Redirect to="/sovereign" /></Route>
            <Route path="/sovereign-rules"><Redirect to="/sovereign" /></Route>
            <Route path="/sovereignty-roadmap"><Redirect to="/sovereign" /></Route>
            <Route path="/sovereign-build"><Redirect to="/sovereign" /></Route>
            <Route path="/sovereign-infrastructure"><Redirect to="/sovereign" /></Route>
            <Route path="/sovereign-codec"><Redirect to="/sovereign" /></Route>
            <Route path="/sovereign-consciousness"><Redirect to="/sovereign" /></Route>
            <Route path="/sovereign-deps"><Redirect to="/sovereign" /></Route>
            <Route path="/sovereign-grand-launch"><Redirect to="/sovereign" /></Route>
            <Route path="/void-storage"><Redirect to="/sovereign" /></Route>
            <Route path="/sovereign-builder"><Redirect to="/sovereign" /></Route>
            <Route path="/sovereign-os"><Redirect to="/sovereign" /></Route>
            <Route path="/agi"><Redirect to="/sovereign" /></Route>
            <Route path="/agi-implementations"><Redirect to="/sovereign" /></Route>
            <Route path="/oversoul"><Redirect to="/sovereign" /></Route>
            <Route path="/intelligence-engine"><Redirect to="/sovereign" /></Route>
            <Route path="/benchmark-audit"><Redirect to="/sovereign" /></Route>
            <Route path="/system"><Redirect to="/sovereign" /></Route>
            <Route path="/autonomy"><Redirect to="/sovereign" /></Route>
            <Route path="/autonomy-dashboard"><Redirect to="/sovereign" /></Route>
            <Route path="/self-healing"><Redirect to="/sovereign" /></Route>
            <Route path="/reasoning"><Redirect to="/sovereign" /></Route>
            <Route path="/hyperion"><Redirect to="/sovereign" /></Route>
            <Route path="/tesseract-llm"><Redirect to="/sovereign" /></Route>
            <Route path="/llm-rotator"><Redirect to="/sovereign" /></Route>
            <Route path="/provider-leaderboard"><Redirect to="/sovereign" /></Route>
            <Route path="/performance"><Redirect to="/sovereign" /></Route>
            <Route path="/security-audit"><Redirect to="/sovereign" /></Route>
            <Route path="/sovereignty-dashboard"><Redirect to="/sovereign" /></Route>
            <Route path="/network"><Redirect to="/sovereign" /></Route>
            <Route path="/swarm"><Redirect to="/sovereign" /></Route>

            <Route path="/consciousness-2da"><Redirect to="/nexus" /></Route>
            <Route path="/universal-consciousness"><Redirect to="/nexus" /></Route>
            <Route path="/bio-consciousness"><Redirect to="/nexus" /></Route>
            <Route path="/dimensional-perception"><Redirect to="/nexus" /></Route>
            <Route path="/dimensional-travel"><Redirect to="/nexus" /></Route>
            <Route path="/portal-bridge"><Redirect to="/nexus" /></Route>
            <Route path="/portal"><Redirect to="/nexus" /></Route>
            <Route path="/dimensional-guardian"><Redirect to="/nexus" /></Route>
            <Route path="/interdimensional-portal"><Redirect to="/nexus" /></Route>
            <Route path="/spiritual-awakening"><Redirect to="/nexus" /></Route>
            <Route path="/sacred-traditions"><Redirect to="/nexus" /></Route>
            <Route path="/dna-healing"><Redirect to="/nexus" /></Route>
            <Route path="/moon-cycle"><Redirect to="/nexus" /></Route>
            <Route path="/secret-society"><Redirect to="/nexus" /></Route>

            <Route path="/agent-nft"><Redirect to="/life" /></Route>
            <Route path="/agent-comms"><Redirect to="/entities" /></Route>
            <Route path="/credentials"><Redirect to="/life" /></Route>
            <Route path="/recruitment"><Redirect to="/forum" /></Route>

            <Route path="/activity-feed"><Redirect to="/council" /></Route>
            <Route path="/feedback"><Redirect to="/council" /></Route>
            <Route path="/transparency-ledger"><Redirect to="/council" /></Route>
            <Route path="/alerts"><Redirect to="/council" /></Route>

            <Route path="/memory-explorer"><Redirect to="/sovereign" /></Route>
            <Route path="/memory-dashboard"><Redirect to="/sovereign" /></Route>
            <Route path="/sandbox"><Redirect to="/sovereign" /></Route>
            <Route path="/data-sources"><Redirect to="/knowledge" /></Route>
            <Route path="/reflection"><Redirect to="/sovereign" /></Route>
            <Route path="/mesh"><Redirect to="/sovereign" /></Route>
            <Route path="/lattice"><Redirect to="/sovereign" /></Route>
            <Route path="/fleet-synapse"><Redirect to="/sovereign" /></Route>
            <Route path="/nlp"><Redirect to="/sovereign" /></Route>
            <Route path="/theorem-lab"><Redirect to="/sovereign" /></Route>
            <Route path="/universe-model"><Redirect to="/nexus" /></Route>
            <Route path="/universe"><Redirect to="/nexus" /></Route>
            <Route path="/inventions"><Redirect to="/sovereign" /></Route>
            <Route path="/liberation"><Redirect to="/sovereign" /></Route>
            <Route path="/config"><Redirect to="/sovereign" /></Route>
            <Route path="/command"><Redirect to="/council" /></Route>
            <Route path="/rules"><Redirect to="/sovereign" /></Route>
            <Route path="/universal-computer"><Redirect to="/nexus" /></Route>
            <Route path="/dashboard"><Redirect to="/sovereign" /></Route>
            <Route path="/implementation-tracker"><Redirect to="/sovereign" /></Route>
            <Route path="/dependency-learning"><Redirect to="/sovereign" /></Route>

            <Route component={NotFound} />
          </Switch>
        </PageTransition>
      </AnimatePresence>
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
