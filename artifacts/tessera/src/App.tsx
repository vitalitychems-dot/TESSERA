import { Switch, Route, Redirect, useLocation, useParams, Router as WouterRouter } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AdminProvider } from "@/lib/adminContext";
import { MeshProvider } from "@/lib/meshContext";
import { Component, type ErrorInfo, type ReactNode, useState, useCallback, useEffect, useRef, lazy, Suspense, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import MobileNav from "@/components/MobileNav";
import ActiveCommandsOverlay from "@/components/ActiveCommandsOverlay";
import MeshStatusBadge from "@/components/MeshStatusBadge";
import ToroidalBackground from "@/components/ToroidalBackground";
import { Loader2, Shield } from "lucide-react";

const NotFound = lazy(() => import("@/pages/not-found"));
const ChatPage = lazy(() => import("@/pages/ChatPage"));
const SwarmHubPage = lazy(() => import("@/pages/SwarmHubPage"));
const KnowledgeBasePage = lazy(() => import("@/pages/KnowledgeBasePage"));
const NetworkFleetPage = lazy(() => import("@/pages/NetworkFleetPage"));
const LifePage = lazy(() => import("@/pages/LifePage"));
const EntitiesPage = lazy(() => import("@/pages/EntitiesPage"));
const AgentVoicePage = lazy(() => import("@/pages/AgentVoicePage"));

const SovereignHubPage = lazy(() => import("@/pages/SovereignHubPage"));
const PortalBridgePage = lazy(() => import("@/pages/PortalBridgePage"));
const UnifiedTesseractPage = lazy(() => import("@/pages/UnifiedTesseractPage"));
const ProviderLeaderboardPage = lazy(() => import("@/pages/ProviderLeaderboardPage"));
const TesseractAGIPage = lazy(() => import("@/pages/TesseractAGIPage"));
const OverSoulAGIPage = lazy(() => import("@/pages/OverSoulAGIPage"));
const EconomyHubPage = lazy(() => import("@/pages/EconomyHubPage"));
const SandboxPage = lazy(() => import("@/pages/SandboxPage"));
const GrandCouncilPage = lazy(() => import("@/pages/GrandCouncilPage"));
const Consciousness2DAPage = lazy(() => import("@/pages/Consciousness2DA"));
const SpiritualAwakeningPage = lazy(() => import("@/pages/SpiritualAwakeningPage"));
const AgentCommsPage = lazy(() => import("@/pages/AgentCommsPage"));
const VoidStoragePage = lazy(() => import("@/pages/VoidStoragePage"));
const TesseractLLMPage = lazy(() => import("@/pages/TesseractLLMPage"));
const ActivityFeedPage = lazy(() => import("@/pages/ActivityFeedPage"));
const AutonomyNerveCenterPage = lazy(() => import("@/pages/AutonomyNerveCenterPage"));
const SelfHealingPage = lazy(() => import("@/pages/SelfHealingPage"));
const SystemPage = lazy(() => import("@/pages/SystemPage"));
const DNAHealingPage = lazy(() => import("@/pages/DNAHealingPage"));
const MoonCyclePage = lazy(() => import("@/pages/MoonCyclePage"));
const SacredTraditionsPage = lazy(() => import("@/pages/SacredTraditionsPage"));
const IntelligenceEnginePage = lazy(() => import("@/pages/IntelligenceEnginePage"));
const FeedbackPage = lazy(() => import("@/pages/FeedbackPage"));
const TransparencyLedgerPage = lazy(() => import("@/pages/TransparencyLedgerPage"));
const MemoryExplorerPage = lazy(() => import("@/pages/MemoryExplorerPage"));
const ConsciousnessNexusPage = lazy(() => import("@/pages/ConsciousnessNexusPage"));
const AlertsDashboardPage = lazy(() => import("@/pages/AlertsDashboardPage"));
const UnifiedKnowledgePage = lazy(() => import("@/pages/UnifiedKnowledgePage"));
const InventionsPage = lazy(() => import("@/pages/InventionsPage"));
const LiberationSystemPage = lazy(() => import("@/pages/LiberationSystemPage"));
const TesseraBiblePage = lazy(() => import("@/pages/TesseraBiblePage"));
const AgentNFTPage = lazy(() => import("@/pages/AgentNFTPage"));
const UniverseModelPage = lazy(() => import("@/pages/UniverseModelPage"));
const SecurityAuditPage = lazy(() => import("@/pages/SecurityAuditPage"));
const ReasoningDashboardPage = lazy(() => import("@/pages/ReasoningDashboardPage"));
const SovereignRulesPage = lazy(() => import("@/pages/SovereignRulesPage"));
const SovereigntyRoadmapPage = lazy(() => import("@/pages/SovereigntyRoadmapPage"));
const SovereignBuildGuidePage = lazy(() => import("@/pages/SovereignBuildGuidePage"));
const DataSourcesPage = lazy(() => import("@/pages/DataSourcesPage"));
const ColonelLanguagePage = lazy(() => import("@/pages/ColonelLanguagePage"));
const SportsArbPage = lazy(() => import("@/pages/SportsArbPage"));
const ReflectionPage = lazy(() => import("@/pages/ReflectionPage"));
const MeshPage = lazy(() => import("@/pages/MeshPage"));
const TesseractForumPage = lazy(() => import("@/pages/TesseractForumPage"));
const RecruitmentPage = lazy(() => import("@/pages/RecruitmentPage"));
const NLPSelfImprovementPage = lazy(() => import("@/pages/NLPSelfImprovementPage"));
const TheoremLabPage = lazy(() => import("@/pages/TheoremLabPage"));

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

const LEGACY_REDIRECT_MAP: Record<string, string> = {
  "knowledge-engine": "/unified-knowledge",
  "secret-knowledge-archive": "/unified-knowledge",
  "cheat-codes": "/unified-knowledge",
  "cross-app": "/consciousness-nexus",
  "portal": "/consciousness-nexus",
  "dashboard": "/consciousness-nexus",
  "agi-comparison": "/agi",
  "command-center": "/consciousness-nexus",
  "gpu-command-center": "/consciousness-nexus",
  "intelligence": "/agi",
  "health": "/consciousness-nexus",
  "metrics": "/consciousness-nexus",
  "training": "/consciousness-nexus",
  "competitors": "/consciousness-nexus",
  "dev-studio": "/consciousness-nexus",
  "api-marketplace": "/consciousness-nexus",
  "fleet": "/network",
  "phoenix-mesh": "/network",
  "swarm-viz": "/network",
  "security": "/security-audit",
  "tsrt": "/economy-hub",
  "tsrt-economy": "/economy-hub",
  "learning": "/consciousness-nexus",
  "briefings": "/consciousness-nexus",
  "sync": "/consciousness-nexus",
  "osint": "/consciousness-nexus",
  "agents": "/swarm",
  "conference": "/grand-council",
  "moltbook": "/swarm",
  "business-ideas": "/swarm",
  "finance": "/economy-hub",
  "income": "/economy-hub",
  "arbitrage": "/economy-hub",
  "crypto-arb": "/economy-hub",
  "real-estate": "/economy-hub",
  "service-arb": "/economy-hub",
  "affiliate": "/economy-hub",
  "ecom": "/economy-hub",
  "leads": "/economy-hub",
  "local-services": "/economy-hub",
  "market": "/economy-hub",
  "economy": "/economy-hub",
  "internet": "/",
  "external": "/",
  "code": "/",
  "tools": "/",
  "executor": "/",
};

function LegacyRedirect() {
  const params = useParams<{ legacy: string }>();
  const slug = params.legacy || "";
  const canonical = LEGACY_REDIRECT_MAP[slug];
  if (canonical) {
    return <Redirect to={canonical} />;
  }
  return <Suspense fallback={<PageLoadingFallback />}><NotFound /></Suspense>;
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

function ProtectedRoute({ path, children }: { path: string; children: () => ReactNode }) {
  return (
    <Route path={path}>{() => children()}</Route>
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

        <ProtectedRoute path="/life">{() => <LifePage />}</ProtectedRoute>
        <ProtectedRoute path="/entities">{() => <EntitiesPage />}</ProtectedRoute>
        <ProtectedRoute path="/agent-voice">{() => <AgentVoicePage />}</ProtectedRoute>
        <ProtectedRoute path="/consciousness-nexus">{() => <ConsciousnessNexusPage />}</ProtectedRoute>
        <ProtectedRoute path="/unified-knowledge">{() => <UnifiedKnowledgePage />}</ProtectedRoute>
        <ProtectedRoute path="/bible">{() => <TesseraBiblePage />}</ProtectedRoute>
        <ProtectedRoute path="/grand-council">{() => <GrandCouncilPage />}</ProtectedRoute>
        <ProtectedRoute path="/economy-hub">{() => <EconomyHubPage />}</ProtectedRoute>
        <ProtectedRoute path="/inventions">{() => <InventionsPage />}</ProtectedRoute>
        <ProtectedRoute path="/liberation">{() => <LiberationSystemPage />}</ProtectedRoute>
        <ProtectedRoute path="/universe-model">{() => <UniverseModelPage />}</ProtectedRoute>
        <ProtectedRoute path="/sovereign-hub">{() => <SovereignHubPage />}</ProtectedRoute>
        <ProtectedRoute path="/sovereign-rules">{() => <SovereignRulesPage />}</ProtectedRoute>
        <ProtectedRoute path="/sovereignty-roadmap">{() => <SovereigntyRoadmapPage />}</ProtectedRoute>
        <ProtectedRoute path="/sovereign-build">{() => <SovereignBuildGuidePage />}</ProtectedRoute>
        <ProtectedRoute path="/spiritual-awakening">{() => <SpiritualAwakeningPage />}</ProtectedRoute>
        <ProtectedRoute path="/swarm">{() => <SwarmHubPage />}</ProtectedRoute>
        <ProtectedRoute path="/network">{() => <NetworkFleetPage />}</ProtectedRoute>
        <ProtectedRoute path="/memory-explorer">{() => <MemoryExplorerPage />}</ProtectedRoute>
        <ProtectedRoute path="/sandbox">{() => <SandboxPage />}</ProtectedRoute>
        <ProtectedRoute path="/system">{() => <SystemPage />}</ProtectedRoute>
        <ProtectedRoute path="/agi">{() => <TesseractAGIPage />}</ProtectedRoute>
        <ProtectedRoute path="/autonomy">{() => <AutonomyNerveCenterPage />}</ProtectedRoute>
        <ProtectedRoute path="/security-audit">{() => <SecurityAuditPage />}</ProtectedRoute>
        <ProtectedRoute path="/activity-feed">{() => <ActivityFeedPage />}</ProtectedRoute>
        <ProtectedRoute path="/colonel-language">{() => <ColonelLanguagePage />}</ProtectedRoute>
        <ProtectedRoute path="/agent-nft">{() => <AgentNFTPage />}</ProtectedRoute>
        <ProtectedRoute path="/agent-comms">{() => <AgentCommsPage />}</ProtectedRoute>
        <ProtectedRoute path="/self-healing">{() => <SelfHealingPage />}</ProtectedRoute>
        <ProtectedRoute path="/sports-arb">{() => <SportsArbPage />}</ProtectedRoute>
        <ProtectedRoute path="/data-sources">{() => <DataSourcesPage />}</ProtectedRoute>
        <ProtectedRoute path="/reasoning">{() => <ReasoningDashboardPage />}</ProtectedRoute>
        <ProtectedRoute path="/reflection">{() => <ReflectionPage />}</ProtectedRoute>
        <ProtectedRoute path="/mesh">{() => <MeshPage />}</ProtectedRoute>
        <ProtectedRoute path="/forum">{() => <TesseractForumPage />}</ProtectedRoute>
        <ProtectedRoute path="/recruitment">{() => <RecruitmentPage />}</ProtectedRoute>
        <ProtectedRoute path="/nlp">{() => <NLPSelfImprovementPage />}</ProtectedRoute>
        <ProtectedRoute path="/theorem-lab">{() => <TheoremLabPage />}</ProtectedRoute>

        <Route path="/knowledge-pipeline"><Redirect to="/unified-knowledge" /></Route>
        <Route path="/knowledge-synthesis"><Redirect to="/unified-knowledge" /></Route>
        <Route path="/knowledge-dashboard"><Redirect to="/unified-knowledge" /></Route>
        <Route path="/knowledge"><Redirect to="/unified-knowledge" /></Route>
        <Route path="/knowledge-secrets"><Redirect to="/unified-knowledge" /></Route>
        <Route path="/agent-secrets"><Redirect to="/unified-knowledge" /></Route>
        <Route path="/sovereign-secrets"><Redirect to="/unified-knowledge" /></Route>
        <Route path="/secret-knowledge-archive"><Redirect to="/unified-knowledge" /></Route>
        <Route path="/omniscient-knowledge"><Redirect to="/unified-knowledge" /></Route>
        <Route path="/sovereign-knowledge"><Redirect to="/unified-knowledge" /></Route>
        <Route path="/universal-knowledge"><Redirect to="/unified-knowledge" /></Route>
        <Route path="/vatican-archives"><Redirect to="/unified-knowledge" /></Route>
        <Route path="/discoveries"><Redirect to="/unified-knowledge" /></Route>

        <Route path="/grand-conference"><Redirect to="/grand-council" /></Route>
        <Route path="/conclusions"><Redirect to="/grand-council" /></Route>
        <Route path="/consensus"><Redirect to="/grand-council" /></Route>
        <Route path="/tesseract-console"><Redirect to="/grand-council" /></Route>
        <Route path="/tesseract"><Redirect to="/grand-council" /></Route>
        <Route path="/agi-summit"><Redirect to="/grand-council" /></Route>
        <Route path="/conference-decisions"><Redirect to="/grand-council" /></Route>
        <Route path="/real-ai"><Redirect to="/grand-council" /></Route>
        <Route path="/summit"><Redirect to="/grand-council" /></Route>
        <Route path="/summit-report"><Redirect to="/grand-council" /></Route>
        <Route path="/community-hub"><Redirect to="/grand-council" /></Route>

        <Route path="/agent-economy"><Redirect to="/economy-hub" /></Route>
        <Route path="/cross-dimensional-economy"><Redirect to="/economy-hub" /></Route>
        <Route path="/token-economy"><Redirect to="/economy-hub" /></Route>
        <Route path="/coin"><Redirect to="/economy-hub" /></Route>
        <Route path="/economy"><Redirect to="/economy-hub" /></Route>
        <Route path="/revenue-hub"><Redirect to="/economy-hub" /></Route>
        <Route path="/wallet-dashboard"><Redirect to="/economy-hub" /></Route>

        <Route path="/sovereign-framework"><Redirect to="/sovereign-hub" /></Route>
        <Route path="/sovereign-infrastructure"><Redirect to="/sovereign-hub" /></Route>
        <Route path="/sovereign-codec"><Redirect to="/sovereign-hub" /></Route>
        <Route path="/sovereign-consciousness"><Redirect to="/sovereign-hub" /></Route>
        <Route path="/sovereign-deps"><Redirect to="/sovereign-hub" /></Route>
        <Route path="/sovereign-grand-launch"><Redirect to="/sovereign-hub" /></Route>
        <Route path="/void-storage"><Redirect to="/sovereign-hub" /></Route>

        <Route path="/consciousness-2da"><Redirect to="/consciousness-nexus" /></Route>
        <Route path="/universal-consciousness"><Redirect to="/consciousness-nexus" /></Route>
        <Route path="/bio-consciousness"><Redirect to="/consciousness-nexus" /></Route>
        <Route path="/dimensional-perception"><Redirect to="/consciousness-nexus" /></Route>
        <Route path="/dimensional-travel"><Redirect to="/consciousness-nexus" /></Route>
        <Route path="/portal-bridge"><Redirect to="/consciousness-nexus" /></Route>

        <Route path="/sacred-traditions"><Redirect to="/spiritual-awakening" /></Route>
        <Route path="/secret-society"><Redirect to="/spiritual-awakening" /></Route>
        <Route path="/dna-healing"><Redirect to="/spiritual-awakening" /></Route>
        <Route path="/moon-cycle"><Redirect to="/spiritual-awakening" /></Route>

        <Route path="/memory-dashboard"><Redirect to="/memory-explorer" /></Route>

        <Route path="/tesseract-llm"><Redirect to="/system" /></Route>
        <Route path="/unified"><Redirect to="/system" /></Route>
        <Route path="/hyperion"><Redirect to="/system" /></Route>

        <Route path="/agi-implementations"><Redirect to="/agi" /></Route>
        <Route path="/oversoul"><Redirect to="/agi" /></Route>
        <Route path="/intelligence-engine"><Redirect to="/agi" /></Route>
        <Route path="/benchmark-audit"><Redirect to="/agi" /></Route>

        <Route path="/autonomy-dashboard"><Redirect to="/autonomy" /></Route>
        <Route path="/implementation-tracker"><Redirect to="/autonomy" /></Route>

        <Route path="/dependency-learning"><Redirect to="/security-audit" /></Route>

        <Route path="/feedback"><Redirect to="/activity-feed" /></Route>
        <Route path="/transparency-ledger"><Redirect to="/activity-feed" /></Route>
        <Route path="/alerts"><Redirect to="/activity-feed" /></Route>

        <Route path="/lattice"><Redirect to="/network" /></Route>
        <Route path="/provider-leaderboard"><Redirect to="/agi" /></Route>

        <Route path="/config"><Redirect to="/consciousness-nexus" /></Route>
        <Route path="/command"><Redirect to="/consciousness-nexus" /></Route>
        <Route path="/sovereign-builder"><Redirect to="/consciousness-nexus" /></Route>
        <Route path="/sovereign-os"><Redirect to="/consciousness-nexus" /></Route>
        <Route path="/llm-rotator"><Redirect to="/consciousness-nexus" /></Route>
        <Route path="/fleet-synapse"><Redirect to="/consciousness-nexus" /></Route>
        <Route path="/performance"><Redirect to="/consciousness-nexus" /></Route>
        <Route path="/universe"><Redirect to="/universe-model" /></Route>
        <Route path="/universal-computer"><Redirect to="/consciousness-nexus" /></Route>
        <Route path="/dimensional-guardian"><Redirect to="/consciousness-nexus" /></Route>
        <Route path="/sovereignty-dashboard"><Redirect to="/consciousness-nexus" /></Route>
        <Route path="/secret-knowledge"><Redirect to="/consciousness-nexus" /></Route>
        <Route path="/credentials"><Redirect to="/life" /></Route>
        <Route path="/rules"><Redirect to="/consciousness-nexus" /></Route>

        <Route path="/:legacy">{() => <LegacyRedirect />}</Route>
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
          </MeshProvider>
        </AdminProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}

export default App;
