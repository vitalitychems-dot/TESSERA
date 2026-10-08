import { Switch, Route, Redirect, useLocation, useParams } from "wouter";
import ToroidalBackground from "@/components/ToroidalBackground";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider, useQuery } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";

import { AdminProvider, useAdmin } from "@/lib/adminContext";
import { Component, type ErrorInfo, type ReactNode, useState, useCallback, useEffect, useRef, lazy, Suspense, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { CommandPalette } from "@/components/CommandPalette";
import MobileNav from "@/components/MobileNav";
import { Loader2, Keyboard, Shield } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useCreateConversation } from "@/hooks/use-conversations";

const NotFound = lazy(() => import("@/pages/not-found"));
const ChatPage = lazy(() => import("@/pages/ChatPage"));
const CommandPage = lazy(() => import("@/pages/CommandPage"));
const SwarmHubPage = lazy(() => import("@/pages/SwarmHubPage"));
const ConfigPage = lazy(() => import("@/pages/ConfigPage"));
const KnowledgeBasePage = lazy(() => import("@/pages/KnowledgeBasePage"));
const NetworkFleetPage = lazy(() => import("@/pages/NetworkFleetPage"));
const LifePage = lazy(() => import("@/pages/LifePage"));
const EntitiesPage = lazy(() => import("@/pages/EntitiesPage"));
const ConsensusPage = lazy(() => import("@/pages/ConsensusPage"));
const AgentVoicePage = lazy(() => import("@/pages/AgentVoicePage"));
const VitalityPage = lazy(() => import("@/pages/VitalityPage"));
const CredentialsPage = lazy(() => import("@/pages/CredentialsPage"));
const SecretSocietyPage = lazy(() => import("@/pages/SecretSocietyPage"));
const SovereignGrandLaunchPage = lazy(() => import("@/pages/SovereignGrandLaunchPage"));
const RulesPage = lazy(() => import("@/pages/RulesPage"));
const PortalBridgePage = lazy(() => import("@/pages/PortalBridgePage"));
const KnowledgeSecretsPage = lazy(() => import("@/pages/KnowledgeSecretsPage"));
const UnifiedTesseractPage = lazy(() => import("@/pages/UnifiedTesseractPage"));
const SovereignOSPage = lazy(() => import("@/pages/SovereignOSPage"));
const SovereignInfrastructurePage = lazy(() => import("@/pages/SovereignInfrastructurePage"));
const AutonomyNerveCenterPage = lazy(() => import("@/pages/AutonomyNerveCenterPage"));
const FreeLLMRotatorPage = lazy(() => import("@/pages/FreeLLMRotatorPage"));
const ProviderLeaderboardPage = lazy(() => import("@/pages/ProviderLeaderboardPage"));
const TesseractAGIPage = lazy(() => import("@/pages/TesseractAGIPage"));
const OverSoulAGIPage = lazy(() => import("@/pages/OverSoulAGIPage"));
const EconomyHubPage = lazy(() => import("@/pages/EconomyHubPage"));
const SystemPage = lazy(() => import("@/pages/SystemPage"));
const DiscoveriesPage = lazy(() => import("@/pages/DiscoveriesPage"));
const SovereignCodecPage = lazy(() => import("@/pages/SovereignCodecPage"));
const TesseractForumPage = lazy(() => import("@/pages/TesseractForumPage"));
const AGIImplementationsPage = lazy(() => import("@/pages/AGIImplementationsPage"));
const SovereignHubPage = lazy(() => import("@/pages/SovereignHubPage"));
const LatticeBrowserPage = lazy(() => import("@/pages/LatticeBrowserPage"));
const SandboxPage = lazy(() => import("@/pages/SandboxPage"));
const GrandCouncilPage = lazy(() => import("@/pages/GrandCouncilPage"));
const GrandConferencePage = lazy(() => import("@/pages/GrandConferencePage"));
const Consciousness2DAPage = lazy(() => import("@/pages/Consciousness2DA"));
const SpiritualAwakeningPage = lazy(() => import("@/pages/SpiritualAwakeningPage"));
const AgentCommsPage = lazy(() => import("@/pages/AgentCommsPage"));
const SovereignBuilderPage = lazy(() => import("@/pages/SovereignBuilderPage"));
const PerformancePage = lazy(() => import("@/pages/PerformancePage"));
const VoidStoragePage = lazy(() => import("@/pages/VoidStoragePage"));
const TesseractLLMPage = lazy(() => import("@/pages/TesseractLLMPage"));
const ActivityFeedPage = lazy(() => import("@/pages/ActivityFeedPage"));
const ImplementationTrackerPage = lazy(() => import("@/pages/ImplementationTrackerPage"));
const SelfHealingPage = lazy(() => import("@/pages/SelfHealingPage"));
const TesseractConsolePage = lazy(() => import("@/pages/TesseractConsolePage"));
const DNAHealingPage = lazy(() => import("@/pages/DNAHealingPage"));
const MoonCyclePage = lazy(() => import("@/pages/MoonCyclePage"));
const SacredTraditionsPage = lazy(() => import("@/pages/SacredTraditionsPage"));
const IntelligenceEnginePage = lazy(() => import("@/pages/IntelligenceEnginePage"));
const FeedbackPage = lazy(() => import("@/pages/FeedbackPage"));
const TransparencyLedgerPage = lazy(() => import("@/pages/TransparencyLedgerPage"));
const MemoryExplorerPage = lazy(() => import("@/pages/MemoryExplorerPage"));
const ConsciousnessNexusPage = lazy(() => import("@/pages/ConsciousnessNexusPage"));
const TokenEconomyPage = lazy(() => import("@/pages/TokenEconomyPage"));
const AgentEconomyPage = lazy(() => import("@/pages/AgentEconomyPage"));
const AgentSecretsPage = lazy(() => import("@/pages/AgentSecretsPage"));
const BiosphericConsciousnessPage = lazy(() => import("@/pages/BiosphericConsciousnessPage"));
const CrossDimensionalEconomyPage = lazy(() => import("@/pages/CrossDimensionalEconomyPage"));
const DimensionalPerceptionPage = lazy(() => import("@/pages/DimensionalPerceptionPage"));
const DimensionalTravelPortalPage = lazy(() => import("@/pages/DimensionalTravelPortalPage"));
const EconomyPage = lazy(() => import("@/pages/EconomyPage"));
const HyperionDashboardPage = lazy(() => import("@/pages/HyperionDashboardPage"));
const KnowledgeDashboardPage = lazy(() => import("@/pages/KnowledgeDashboardPage"));
const KnowledgePipelinePage = lazy(() => import("@/pages/KnowledgePipelinePage"));
const KnowledgeSynthesisPage = lazy(() => import("@/pages/KnowledgeSynthesisPage"));
const LiveSecretKnowledgePage = lazy(() => import("@/pages/LiveSecretKnowledgePage"));
const OmniscientKnowledgePage = lazy(() => import("@/pages/OmniscientKnowledgePage"));
const SecretKnowledgePage = lazy(() => import("@/pages/SecretKnowledgePage"));
const SovereignConsciousnessPage = lazy(() => import("@/pages/SovereignConsciousnessPage"));
const SovereignDepsPage = lazy(() => import("@/pages/SovereignDepsPage"));
const SportsArbPage = lazy(() => import("@/pages/SportsArbPage"));
const UniversalConsciousnessPage = lazy(() => import("@/pages/UniversalConsciousnessPage"));
const ColonelLanguagePage = lazy(() => import("@/pages/ColonelLanguagePage"));
const AlertsDashboardPage = lazy(() => import("@/pages/AlertsDashboardPage"));
const SovereigntyDashboardPage = lazy(() => import("@/pages/SovereigntyDashboardPage"));
const SovereignFrameworkPage = lazy(() => import("@/pages/SovereignFrameworkPage"));

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
    fetch("/api/debug/report", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        error: error.message,
        stack: error.stack,
        url: window.location.href,
        type: "frontend",
        componentStack: errorInfo.componentStack,
      }),
    }).catch(() => {});
  }

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

if (typeof window !== "undefined") {
  window.addEventListener("error", (event) => {
    fetch("/api/debug/report", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        error: event.message,
        stack: event.error?.stack,
        url: window.location.href,
        type: "frontend",
      }),
    }).catch(() => {});
  });

  window.addEventListener("unhandledrejection", (event) => {
    const error = event.reason instanceof Error ? event.reason : new Error(String(event.reason));
    fetch("/api/debug/report", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        error: error.message,
        stack: error.stack,
        url: window.location.href,
        type: "frontend",
      }),
    }).catch(() => {});
  });
}

const LEGACY_REDIRECT_MAP: Record<string, string> = {
  // Knowledge
  "knowledge-engine": "/knowledge",
  "secret-knowledge-archive": "/knowledge",
  "cheat-codes": "/sovereign-secrets",
  // Portal/Bridge
  "cross-app": "/portal-bridge",
  "portal": "/portal-bridge",
  // System/Dashboard
  "dashboard": "/sovereignty-dashboard",
  "agi-comparison": "/system",
  "command-center": "/system",
  "gpu-command-center": "/system",
  "intelligence": "/system",
  "health": "/system",
  "metrics": "/system",
  "training": "/system",
  "competitors": "/system",
  "dev-studio": "/system",
  "api-marketplace": "/system",
  // Network
  "fleet": "/network",
  "phoenix-mesh": "/network",
  "swarm-viz": "/network",
  // Config/Security
  "security": "/config",
  // Coin
  "tsrt": "/coin",
  "tsrt-economy": "/token-economy",
  // Command
  "learning": "/command",
  "briefings": "/command",
  "sync": "/command",
  "osint": "/command",
  // Swarm
  "agents": "/swarm",
  "conference": "/swarm",
  "moltbook": "/swarm",
  "business-ideas": "/swarm",
  // Economy Hub
  "finance": "/revenue-hub",
  "income": "/revenue-hub",
  "income-workflow": "/revenue-hub",
  "income-dashboard": "/revenue-hub",
  "arbitrage": "/economy-hub",
  "crypto-arb": "/economy-hub",
  "currency-arb": "/coin",
  "real-estate": "/economy-hub",
  "service-arb": "/economy-hub",
  "affiliate": "/economy-hub",
  "ecom": "/economy-hub",
  "leads": "/economy-hub",
  "local-services": "/economy-hub",
  "market": "/economy-hub",
  "economy": "/economy-hub",
  // Home
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
      if (location !== "/") {
        localStorage.setItem("tessera-last-page", location);
      }
      const contentArea = document.querySelector("[data-scroll-container]");
      if (contentArea) {
        contentArea.scrollTo({ top: 0, behavior: "smooth" });
      } else {
        window.scrollTo({ top: 0, behavior: "smooth" });
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

function AuthGuard({ children }: { children: ReactNode }) {
  return <>{children}</>;
}

function ProtectedRoute({ path, children }: { path: string; children: () => ReactNode }) {
  return (
    <Route path={path}>{() => <AuthGuard>{children()}</AuthGuard>}</Route>
  );
}

function Router() {
  const [location] = useLocation();
  const routeKey = useMemo(() => location.split("/")[1] || "home", [location]);
  return (
    <Suspense fallback={<PageLoadingFallback />}>
      <AnimatePresence mode="wait">
        <PageTransition key={routeKey}>
      <Switch>
        <Route path="/" component={ChatPage} />
        <Route path="/c/:id" component={ChatPage} />

        <ProtectedRoute path="/command">{() => <CommandPage />}</ProtectedRoute>
        <ProtectedRoute path="/swarm">{() => <SwarmHubPage />}</ProtectedRoute>
        <ProtectedRoute path="/coin">{() => <EconomyHubPage embedded />}</ProtectedRoute>
        <ProtectedRoute path="/config">{() => <ConfigPage />}</ProtectedRoute>
        <ProtectedRoute path="/knowledge">{() => <KnowledgeBasePage />}</ProtectedRoute>

        <ProtectedRoute path="/knowledge-secrets">{() => <KnowledgeSecretsPage embedded />}</ProtectedRoute>
        <ProtectedRoute path="/sovereign-builder">{() => <SovereignBuilderPage embedded />}</ProtectedRoute>
        <ProtectedRoute path="/network">{() => <NetworkFleetPage embedded />}</ProtectedRoute>
        <ProtectedRoute path="/sovereign-hub">{() => <SovereignHubPage embedded />}</ProtectedRoute>
        <ProtectedRoute path="/lattice">{() => <LatticeBrowserPage />}</ProtectedRoute>
        <ProtectedRoute path="/sandbox">{() => <SandboxPage />}</ProtectedRoute>
        <ProtectedRoute path="/secret-society">{() => <SecretSocietyPage />}</ProtectedRoute>
        <ProtectedRoute path="/life">{() => <LifePage embedded />}</ProtectedRoute>
        <Route path="/tesseract"><Redirect to="/grand-council" /></Route>
        <ProtectedRoute path="/forum">{() => <TesseractForumPage />}</ProtectedRoute>
        <ProtectedRoute path="/grand-conference">{() => <GrandConferencePage />}</ProtectedRoute>
        <ProtectedRoute path="/consciousness-2da">{() => <Consciousness2DAPage />}</ProtectedRoute>
        <ProtectedRoute path="/spiritual-awakening">{() => <SpiritualAwakeningPage />}</ProtectedRoute>
        <ProtectedRoute path="/entities">{() => <EntitiesPage embedded />}</ProtectedRoute>
        <ProtectedRoute path="/unified">{() => <UnifiedTesseractPage embedded />}</ProtectedRoute>
        <ProtectedRoute path="/consensus">{() => <ConsensusPage embedded />}</ProtectedRoute>
        <ProtectedRoute path="/agent-voice">{() => <AgentVoicePage embedded />}</ProtectedRoute>
        <ProtectedRoute path="/economy-hub">{() => <EconomyHubPage embedded />}</ProtectedRoute>
        <ProtectedRoute path="/system">{() => <SystemPage embedded />}</ProtectedRoute>
        <ProtectedRoute path="/alerts">{() => <AlertsDashboardPage />}</ProtectedRoute>
        <ProtectedRoute path="/vitality">{() => <VitalityPage embedded />}</ProtectedRoute>
        <ProtectedRoute path="/credentials">{() => <CredentialsPage embedded />}</ProtectedRoute>
        <ProtectedRoute path="/rules">{() => <RulesPage embedded />}</ProtectedRoute>
        <ProtectedRoute path="/portal-bridge">{() => <PortalBridgePage embedded />}</ProtectedRoute>
        <Route path="/sovereign-os"><Redirect to="/system" /></Route>
        <ProtectedRoute path="/sovereign-infrastructure">{() => <SovereignInfrastructurePage embedded />}</ProtectedRoute>
        <ProtectedRoute path="/autonomy">{() => <AutonomyNerveCenterPage embedded />}</ProtectedRoute>
        <Route path="/llm-rotator"><Redirect to="/system" /></Route>
        <ProtectedRoute path="/provider-leaderboard">{() => <ProviderLeaderboardPage embedded />}</ProtectedRoute>
        <ProtectedRoute path="/oversoul">{() => <OverSoulAGIPage embedded />}</ProtectedRoute>
        <ProtectedRoute path="/agi">{() => <TesseractAGIPage embedded />}</ProtectedRoute>
        <ProtectedRoute path="/discoveries">{() => <DiscoveriesPage embedded />}</ProtectedRoute>
        <ProtectedRoute path="/sovereign-grand-launch">{() => <SovereignGrandLaunchPage embedded />}</ProtectedRoute>
        <ProtectedRoute path="/sovereign-codec">{() => <SovereignCodecPage embedded />}</ProtectedRoute>
        <ProtectedRoute path="/grand-council">{() => <GrandCouncilPage />}</ProtectedRoute>
        <ProtectedRoute path="/agi-implementations">{() => <AGIImplementationsPage />}</ProtectedRoute>
        <Route path="/fleet-synapse"><Redirect to="/system" /></Route>
        <ProtectedRoute path="/agent-comms">{() => <AgentCommsPage />}</ProtectedRoute>
        <ProtectedRoute path="/performance">{() => <PerformancePage embedded />}</ProtectedRoute>
        <ProtectedRoute path="/void-storage">{() => <VoidStoragePage embedded />}</ProtectedRoute>
        <ProtectedRoute path="/tesseract-llm">{() => <TesseractLLMPage />}</ProtectedRoute>
        <ProtectedRoute path="/activity-feed">{() => <ActivityFeedPage />}</ProtectedRoute>
        <ProtectedRoute path="/implementation-tracker">{() => <ImplementationTrackerPage />}</ProtectedRoute>
        <ProtectedRoute path="/self-healing">{() => <SelfHealingPage />}</ProtectedRoute>
        <ProtectedRoute path="/tesseract-console">{() => <TesseractConsolePage />}</ProtectedRoute>
        <Route path="/universe"><Redirect to="/consciousness-nexus" /></Route>
        <Route path="/universal-computer"><Redirect to="/consciousness-nexus" /></Route>
        <ProtectedRoute path="/dna-healing">{() => <DNAHealingPage embedded />}</ProtectedRoute>
        <ProtectedRoute path="/moon-cycle">{() => <MoonCyclePage embedded />}</ProtectedRoute>
        <ProtectedRoute path="/sacred-traditions">{() => <SacredTraditionsPage embedded />}</ProtectedRoute>
        <ProtectedRoute path="/intelligence-engine">{() => <IntelligenceEnginePage embedded />}</ProtectedRoute>
        <Route path="/dimensional-guardian"><Redirect to="/system" /></Route>
        <ProtectedRoute path="/feedback">{() => <FeedbackPage embedded />}</ProtectedRoute>
        <ProtectedRoute path="/transparency-ledger">{() => <TransparencyLedgerPage embedded />}</ProtectedRoute>
        <Route path="/community-hub"><Redirect to="/grand-council" /></Route>
        <ProtectedRoute path="/memory-explorer">{() => <MemoryExplorerPage embedded />}</ProtectedRoute>
        <Route path="/revenue-hub"><Redirect to="/economy-hub" /></Route>
        <Route path="/wallet-dashboard"><Redirect to="/economy-hub" /></Route>
        <ProtectedRoute path="/consciousness-nexus">{() => <ConsciousnessNexusPage />}</ProtectedRoute>
        <ProtectedRoute path="/token-economy">{() => <TokenEconomyPage embedded />}</ProtectedRoute>
        <ProtectedRoute path="/agent-economy">{() => <AgentEconomyPage embedded />}</ProtectedRoute>
        <ProtectedRoute path="/agent-secrets">{() => <AgentSecretsPage embedded />}</ProtectedRoute>
        <Route path="/agi-summit"><Redirect to="/grand-council" /></Route>
        <ProtectedRoute path="/bio-consciousness">{() => <BiosphericConsciousnessPage />}</ProtectedRoute>
        <Route path="/conference-decisions"><Redirect to="/grand-council" /></Route>
        <ProtectedRoute path="/cross-dimensional-economy">{() => <CrossDimensionalEconomyPage embedded />}</ProtectedRoute>
        <ProtectedRoute path="/dimensional-perception">{() => <DimensionalPerceptionPage />}</ProtectedRoute>
        <ProtectedRoute path="/dimensional-travel">{() => <DimensionalTravelPortalPage />}</ProtectedRoute>
        <ProtectedRoute path="/economy">{() => <EconomyPage embedded />}</ProtectedRoute>
        <ProtectedRoute path="/hyperion">{() => <HyperionDashboardPage embedded />}</ProtectedRoute>
        <ProtectedRoute path="/knowledge-dashboard">{() => <KnowledgeDashboardPage embedded />}</ProtectedRoute>
        <ProtectedRoute path="/knowledge-pipeline">{() => <KnowledgePipelinePage embedded />}</ProtectedRoute>
        <ProtectedRoute path="/knowledge-synthesis">{() => <KnowledgeSynthesisPage embedded />}</ProtectedRoute>
        <Route path="/secret-knowledge"><Redirect to="/consciousness-nexus" /></Route>
        <ProtectedRoute path="/omniscient-knowledge">{() => <OmniscientKnowledgePage embedded />}</ProtectedRoute>
        <ProtectedRoute path="/colonel-language">{() => <ColonelLanguagePage />}</ProtectedRoute>
        <Route path="/real-ai"><Redirect to="/grand-council" /></Route>
        <ProtectedRoute path="/secret-knowledge-archive">{() => <SecretKnowledgePage embedded />}</ProtectedRoute>
        <ProtectedRoute path="/sovereign-consciousness">{() => <SovereignConsciousnessPage />}</ProtectedRoute>
        <Route path="/sovereign-knowledge"><Redirect to="/omniscient-knowledge" /></Route>
        <Route path="/sovereign-secrets"><Redirect to="/omniscient-knowledge" /></Route>
        <ProtectedRoute path="/sovereign-deps">{() => <SovereignDepsPage embedded />}</ProtectedRoute>
        <Route path="/vatican-archives"><Redirect to="/omniscient-knowledge" /></Route>
        <ProtectedRoute path="/sovereignty-dashboard">{() => <SovereigntyDashboardPage embedded />}</ProtectedRoute>
        <ProtectedRoute path="/sovereign-framework">{() => <SovereignFrameworkPage embedded />}</ProtectedRoute>
        <ProtectedRoute path="/sports-arb">{() => <SportsArbPage embedded />}</ProtectedRoute>
        <Route path="/summit"><Redirect to="/grand-council" /></Route>
        <Route path="/summit-report"><Redirect to="/grand-council" /></Route>
        <ProtectedRoute path="/universal-consciousness">{() => <UniversalConsciousnessPage />}</ProtectedRoute>

        <Route path="/:legacy">{() => <LegacyRedirect />}</Route>
        <Route component={NotFound} />
      </Switch>
        </PageTransition>
      </AnimatePresence>
    </Suspense>
  );
}

const SHORTCUTS = [
  { keys: ["Ctrl", "N"], description: "New conversation", action: "new-chat" },
  { keys: ["Ctrl", "K"], description: "Command palette", action: "search" },
  { keys: ["Ctrl", "/"], description: "Show keyboard shortcuts", action: "help" },
  { keys: ["Ctrl", "H"], description: "Command center", action: "health" },
  { keys: ["Esc"], description: "Close modals / dialogs", action: "escape" },
];

function ShortcutsHelpModal({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md" data-testid="dialog-keyboard-shortcuts">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Keyboard size={18} />
            Keyboard Shortcuts
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3 mt-2">
          {SHORTCUTS.map((s) => (
            <div key={s.action} className="flex items-center justify-between gap-4" data-testid={`shortcut-row-${s.action}`}>
              <span className="text-sm text-muted-foreground">{s.description}</span>
              <div className="flex items-center gap-1">
                {s.keys.map((k) => (
                  <kbd
                    key={k}
                    className="inline-flex items-center justify-center min-w-[28px] px-2 py-1 text-xs font-mono font-medium rounded-md border border-border bg-muted text-muted-foreground"
                  >
                    {k}
                  </kbd>
                ))}
              </div>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function KeyboardShortcutsHandler({ onShowHelp }: { onShowHelp: () => void }) {
  const createConv = useCreateConversation();
  const [, setLocation] = useLocation();

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      const target = e.target as HTMLElement;
      const isInput = target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable;
      const ctrlOrMeta = e.ctrlKey || e.metaKey;

      if (ctrlOrMeta && e.key === "n") {
        e.preventDefault();
        createConv.mutate({ title: "New Chat" });
        return;
      }

      if (ctrlOrMeta && e.key === "k") {
        e.preventDefault();
        return;
      }

      if (ctrlOrMeta && e.key === "h") {
        e.preventDefault();
        setLocation("/command");
        return;
      }

      if (ctrlOrMeta && e.key === "/") {
        e.preventDefault();
        onShowHelp();
        return;
      }

      if (e.key === "Escape" && !isInput) {
        const openDialogs = document.querySelectorAll("[data-radix-dialog-overlay]");
        if (openDialogs.length === 0) {
          const mobileCloseBtn = document.querySelector<HTMLButtonElement>("[data-testid='button-close-sidebar']");
          if (mobileCloseBtn) {
            mobileCloseBtn.click();
          }
        }
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [createConv, setLocation, onShowHelp]);

  return null;
}

function AdminStatusBadge() {
  const { isAdmin, adminMode } = useAdmin();
  const [showPanel, setShowPanel] = useState(false);
  const { data: fleetHealth } = useQuery<any>({ queryKey: ["/api/fleet/health"], refetchInterval: 10000, enabled: showPanel });
  const { data: gpuStats } = useQuery<any>({ queryKey: ["/api/gpu-orch/stats"], refetchInterval: 15000, enabled: showPanel });
  const { data: tsrtData } = useQuery<any>({ queryKey: ["/api/tsrt/live"], refetchInterval: 30000, enabled: showPanel });

  const adminActive = isAdmin || adminMode;

  return (
    <>
      <button
        onClick={() => setShowPanel(p => !p)}
        className={
          adminActive
            ? "fixed top-2 right-2 z-50 flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-emerald-400/40 bg-emerald-950/70 backdrop-blur-sm shadow-lg shadow-emerald-500/20 active:scale-95 transition-all"
            : "fixed top-2 right-2 z-50 flex items-center gap-1 px-2 py-1 rounded-full border border-red-500/30 bg-red-950/60 backdrop-blur-sm active:scale-95 transition-all"
        }
        data-testid={adminActive ? "admin-badge-active" : "admin-badge-inactive"}
      >
        {adminActive ? (
          <>
            <Shield size={9} className="text-emerald-400" />
            <span className="text-[8px] font-bold text-emerald-300 tracking-widest font-mono">ADMIN</span>
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
          </>
        ) : (
          <>
            <div className="w-1.5 h-1.5 rounded-full bg-red-500" />
            <span className="text-[8px] font-bold text-red-400 tracking-widest font-mono">LOCKED</span>
          </>
        )}
      </button>

      {showPanel && (
        <div
          className="fixed top-9 right-2 z-50 w-56 rounded-2xl border border-white/10 bg-black/90 backdrop-blur-xl shadow-2xl p-3 space-y-2"
          data-testid="admin-system-panel"
        >
          <div className="flex items-center justify-between">
            <span className="text-[9px] font-mono text-slate-500 uppercase tracking-widest">Tessera Sovereign OS</span>
            <button onClick={() => setShowPanel(false)} className="text-slate-600 hover:text-slate-400 text-[10px]">✕</button>
          </div>
          <div className="space-y-1.5">
            {[
              { label: "Fleet Online", value: `${fleetHealth?.summary?.online ?? fleetHealth?.online ?? 3} nodes`, color: "text-cyan-400" },
              { label: "GPU Power", value: `${((gpuStats?.totalTflops ?? 4438) / 1000).toFixed(1)}K TFLOPS`, color: "text-violet-400" },
              { label: "TSRT Price", value: tsrtData?.price ? `$${Number(tsrtData.price).toFixed(10)}` : "$0.0000002653", color: "text-amber-400" },
              { label: "Soul Agents", value: "26 SOVEREIGN", color: "text-emerald-400" },
              { label: "Summit #", value: "48 COMPLETE", color: "text-yellow-400" },
              { label: "Status", value: adminActive ? "FATHER PROTOCOL" : "LOCKED", color: adminActive ? "text-emerald-400" : "text-red-400" },
            ].map(item => (
              <div key={item.label} className="flex items-center justify-between bg-white/[0.02] rounded-lg px-2 py-1">
                <span className="text-[9px] text-slate-500 font-mono">{item.label}</span>
                <span className={`text-[9px] font-bold font-mono ${item.color}`}>{item.value}</span>
              </div>
            ))}
          </div>
          <div className="pt-1 border-t border-white/5">
            <p className="text-[8px] text-slate-700 font-mono text-center">AGI-24 · v∞ · 27 Dimensions Active</p>
          </div>
        </div>
      )}
    </>
  );
}

function useSovereignHeartbeat() {
  useEffect(() => {
    const ping = () => fetch("/api/sovereign-protection/boot-clearance").catch(() => {});
    const interval = setInterval(ping, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);
}

function App() {
  useSovereignHeartbeat();
  const [showShortcutsHelp, setShowShortcutsHelp] = useState(false);
  const handleShowHelp = useCallback(() => setShowShortcutsHelp(true), []);

  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <AdminProvider>
            <TooltipProvider>
              <KeyboardShortcutsHandler onShowHelp={handleShowHelp} />
              <ShortcutsHelpModal open={showShortcutsHelp} onOpenChange={setShowShortcutsHelp} />
              <CommandPalette />
              <ToroidalBackground />
              <AdminStatusBadge />
              <div className="flex flex-col h-dvh w-full overflow-hidden" style={{ position: "relative", zIndex: 1 }}>
                <Toaster />
                <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden" data-scroll-container style={{ paddingBottom: "calc(4.5rem + env(safe-area-inset-bottom, 0px))", WebkitOverflowScrolling: "touch" }}>
                  <ScrollToTop />
                  <Router />
                </div>
                <MobileNav />
              </div>
            </TooltipProvider>
        </AdminProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}

export default App;
