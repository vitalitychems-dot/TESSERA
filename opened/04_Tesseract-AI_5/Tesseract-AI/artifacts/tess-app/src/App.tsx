import { lazy, Suspense } from "react";
import { Switch, Route, Router as WouterRouter, Redirect, useParams } from "wouter";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { PageSkeleton } from "@/components/PageSkeleton";
import { Sidebar } from "@/components/Sidebar";
import MobileNav from "@/components/MobileNav";
import { queryClient } from "@/lib/queryClient";

const NotFound = lazy(() => import("@/pages/not-found"));
const Chat = lazy(() => import("@/pages/Chat"));
const Dashboard = lazy(() => import("@/pages/Dashboard"));
const Forum = lazy(() => import("@/pages/Forum"));
const TwoDimensionalAwareness = lazy(() => import("@/pages/TwoDimensionalAwareness"));
const UniversalKnowledge = lazy(() => import("@/pages/UniversalKnowledge"));
const Conclusions = lazy(() => import("@/pages/Conclusions"));
const Inventions = lazy(() => import("@/pages/Inventions"));
const SovereigntyRoadmap = lazy(() => import("@/pages/SovereigntyRoadmap"));
const SovereignFramework = lazy(() => import("@/pages/SovereignFramework"));
const SystemHealth = lazy(() => import("@/pages/SystemHealth"));
const AgentProfile = lazy(() => import("@/pages/AgentProfile"));
const SovereignMesh = lazy(() => import("@/pages/SovereignMesh"));
const ProofCenter = lazy(() => import("@/pages/ProofCenter"));
const GrandConference = lazy(() => import("@/pages/GrandConference"));
const TesseraBible = lazy(() => import("@/pages/TesseraBible"));

const SacredKnowledgePage = lazy(() => import("@/pages/SacredKnowledgePage"));
const GrandCouncilPage = lazy(() => import("@/pages/GrandCouncilPage"));
const ConsciousnessNexusPage = lazy(() => import("@/pages/ConsciousnessNexusPage"));
const IntelligenceEnginePage = lazy(() => import("@/pages/IntelligenceEnginePage"));
const SpiritualAwakeningPage = lazy(() => import("@/pages/SpiritualAwakeningPage"));
const EconomyHubPage = lazy(() => import("@/pages/EconomyHubPage"));
const SportsArbPage = lazy(() => import("@/pages/SportsArbPage"));
const NetworkFleetPage = lazy(() => import("@/pages/NetworkFleetPage"));
const SovereignHubPage = lazy(() => import("@/pages/SovereignHubPage"));
const AgentCommsPage = lazy(() => import("@/pages/AgentCommsPage"));
const LatticeBrowserPage = lazy(() => import("@/pages/LatticeBrowserPage"));
const SandboxPage = lazy(() => import("@/pages/SandboxPage"));
const LifePage = lazy(() => import("@/pages/LifePage"));
const MemoryExplorerPage = lazy(() => import("@/pages/MemoryExplorerPage"));
const FeedbackPage = lazy(() => import("@/pages/FeedbackPage"));
const TransparencyLedgerPage = lazy(() => import("@/pages/TransparencyLedgerPage"));
const SovereignDepsPage = lazy(() => import("@/pages/SovereignDepsPage"));

const LEGACY_REDIRECT_MAP: Record<string, string> = {
  "knowledge-engine": "/sacred-knowledge",
  "secret-knowledge-archive": "/sacred-knowledge",
  "cheat-codes": "/sacred-knowledge",
  "knowledge": "/sacred-knowledge",
  "sovereign-secrets": "/sacred-knowledge",
  "cross-app": "/sandbox",
  "portal": "/sandbox",
  "dashboard": "/consciousness-nexus",
  "agi-comparison": "/consciousness-nexus",
  "command-center": "/consciousness-nexus",
  "gpu-command-center": "/consciousness-nexus",
  "intelligence": "/intelligence-engine",
  "health": "/consciousness-nexus",
  "metrics": "/consciousness-nexus",
  "training": "/consciousness-nexus",
  "competitors": "/consciousness-nexus",
  "dev-studio": "/sandbox",
  "api-marketplace": "/consciousness-nexus",
  "fleet": "/network",
  "phoenix-mesh": "/network",
  "swarm-viz": "/network",
  "security": "/consciousness-nexus",
  "tsrt": "/economy-hub",
  "tsrt-economy": "/economy-hub",
  "learning": "/consciousness-nexus",
  "briefings": "/consciousness-nexus",
  "sync": "/consciousness-nexus",
  "osint": "/consciousness-nexus",
  "agents": "/agent-comms",
  "swarm": "/agent-comms",
  "conference": "/grand-council",
  "moltbook": "/economy-hub",
  "business-ideas": "/sandbox",
  "finance": "/economy-hub",
  "income": "/economy-hub",
  "income-workflow": "/economy-hub",
  "income-dashboard": "/economy-hub",
  "arbitrage": "/economy-hub",
  "crypto-arb": "/economy-hub",
  "currency-arb": "/economy-hub",
  "real-estate": "/economy-hub",
  "service-arb": "/economy-hub",
  "affiliate": "/economy-hub",
  "ecom": "/economy-hub",
  "leads": "/economy-hub",
  "local-services": "/economy-hub",
  "market": "/economy-hub",
  "economy": "/economy-hub",
  "revenue-hub": "/economy-hub",
  "internet": "/lattice",
  "external": "/lattice",
  "code": "/sandbox",
  "tools": "/sandbox",
  "executor": "/sandbox",
  "portal-bridge": "/lattice",
  "cross-dimensional-economy": "/economy-hub",
  "coin": "/economy-hub",
  "token-economy": "/economy-hub",
  "agent-economy": "/economy-hub",
};

function LegacyRedirect() {
  const params = useParams<{ legacy: string }>();
  const slug = params.legacy ?? "";
  const canonical = LEGACY_REDIRECT_MAP[slug];
  if (canonical) {
    return <Redirect to={canonical} />;
  }
  return (
    <Suspense fallback={<PageSkeleton />}>
      <NotFound />
    </Suspense>
  );
}

function PageWrapper({ children, label }: { children: React.ReactNode; label: string }) {
  return (
    <ErrorBoundary label={label}>
      <Suspense fallback={<PageSkeleton />}>
        {children}
      </Suspense>
    </ErrorBoundary>
  );
}

function AppLayout() {
  return (
    <div className="flex h-screen bg-[#08090e] overflow-hidden">
      <Sidebar />
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden pb-16 md:pb-0" data-scroll-container>
        <Switch>
          <Route path="/">
            <PageWrapper label="Chat">
              <Chat onViewAgentProfile={(id) => { window.location.href = `/agent/${id}`; }} />
            </PageWrapper>
          </Route>
          <Route path="/c/:id">
            <PageWrapper label="Chat">
              <Chat onViewAgentProfile={(id) => { window.location.href = `/agent/${id}`; }} />
            </PageWrapper>
          </Route>

          <Route path="/sacred-knowledge">
            <PageWrapper label="Sacred Knowledge"><SacredKnowledgePage /></PageWrapper>
          </Route>
          <Route path="/unified-knowledge"><Redirect to="/sacred-knowledge" /></Route>
          <Route path="/universal-knowledge"><Redirect to="/sacred-knowledge" /></Route>
          <Route path="/colonel-language"><Redirect to="/sacred-knowledge" /></Route>
          <Route path="/secret-society"><Redirect to="/sacred-knowledge" /></Route>

          <Route path="/grand-council">
            <PageWrapper label="Grand Council"><GrandCouncilPage /></PageWrapper>
          </Route>
          <Route path="/forum">
            <PageWrapper label="Forum"><Forum /></PageWrapper>
          </Route>

          <Route path="/consciousness-nexus">
            <PageWrapper label="Consciousness Nexus"><ConsciousnessNexusPage /></PageWrapper>
          </Route>
          <Route path="/consciousness-2da">
            <PageWrapper label="OA Awakening"><TwoDimensionalAwareness /></PageWrapper>
          </Route>
          <Route path="/spiritual-awakening">
            <PageWrapper label="Spiritual Awakening"><SpiritualAwakeningPage /></PageWrapper>
          </Route>
          <Route path="/intelligence-engine">
            <PageWrapper label="Intelligence Engine"><IntelligenceEnginePage /></PageWrapper>
          </Route>
          <Route path="/memory-explorer">
            <PageWrapper label="Memory Explorer"><MemoryExplorerPage /></PageWrapper>
          </Route>

          <Route path="/economy-hub">
            <PageWrapper label="Economy Hub"><EconomyHubPage /></PageWrapper>
          </Route>
          <Route path="/sports-arb">
            <PageWrapper label="Sports Arb"><SportsArbPage /></PageWrapper>
          </Route>
          <Route path="/network">
            <PageWrapper label="Network"><NetworkFleetPage /></PageWrapper>
          </Route>
          <Route path="/sovereign-hub">
            <PageWrapper label="Sovereign Hub"><SovereignHubPage /></PageWrapper>
          </Route>
          <Route path="/agent-comms">
            <PageWrapper label="Agent Comms"><AgentCommsPage /></PageWrapper>
          </Route>
          <Route path="/lattice">
            <PageWrapper label="Lattice Internet"><LatticeBrowserPage /></PageWrapper>
          </Route>
          <Route path="/sandbox">
            <PageWrapper label="Sandbox"><SandboxPage /></PageWrapper>
          </Route>
          <Route path="/sovereign-framework">
            <PageWrapper label="Sovereign Framework"><SovereignFramework /></PageWrapper>
          </Route>
          <Route path="/sovereign-deps">
            <PageWrapper label="Sovereign Shield"><SovereignDepsPage /></PageWrapper>
          </Route>

          <Route path="/life">
            <PageWrapper label="Life World"><LifePage /></PageWrapper>
          </Route>
          <Route path="/feedback">
            <PageWrapper label="Feedback"><FeedbackPage /></PageWrapper>
          </Route>
          <Route path="/transparency-ledger">
            <PageWrapper label="Transparency Ledger"><TransparencyLedgerPage /></PageWrapper>
          </Route>
          <Route path="/conclusions">
            <PageWrapper label="Sovereignty HQ"><Conclusions /></PageWrapper>
          </Route>
          <Route path="/dashboard">
            <PageWrapper label="Dashboard"><Dashboard /></PageWrapper>
          </Route>
          <Route path="/agent/:id">
            {(params) => (
              <PageWrapper label="Agent Profile">
                <AgentProfile agentId={params.id} onBack={() => { window.history.back(); }} />
              </PageWrapper>
            )}
          </Route>
          <Route path="/health">
            <PageWrapper label="System Health"><SystemHealth /></PageWrapper>
          </Route>
          <Route path="/sovereignty-roadmap">
            <PageWrapper label="Sovereignty Roadmap"><SovereigntyRoadmap /></PageWrapper>
          </Route>
          <Route path="/mesh">
            <PageWrapper label="Sovereign Mesh"><SovereignMesh /></PageWrapper>
          </Route>
          <Route path="/proof">
            <PageWrapper label="Proof Center"><ProofCenter /></PageWrapper>
          </Route>
          <Route path="/conference">
            <PageWrapper label="Grand Conference"><GrandConference /></PageWrapper>
          </Route>
          <Route path="/bible">
            <PageWrapper label="Tessera Bible"><TesseraBible /></PageWrapper>
          </Route>
          <Route path="/inventions">
            <PageWrapper label="Inventions"><Inventions /></PageWrapper>
          </Route>

          <Route path="/summit"><Redirect to="/grand-council" /></Route>
          <Route path="/agi-summit"><Redirect to="/grand-council" /></Route>
          <Route path="/grand-conference"><Redirect to="/conference" /></Route>
          <Route path="/community-hub"><Redirect to="/forum" /></Route>
          <Route path="/tesseract"><Redirect to="/grand-council" /></Route>
          <Route path="/consensus"><Redirect to="/grand-council" /></Route>
          <Route path="/real-ai"><Redirect to="/intelligence-engine" /></Route>
          <Route path="/bio-consciousness"><Redirect to="/consciousness-nexus" /></Route>
          <Route path="/sovereign-consciousness"><Redirect to="/consciousness-nexus" /></Route>
          <Route path="/universal-consciousness"><Redirect to="/consciousness-nexus" /></Route>
          <Route path="/dimensional-travel"><Redirect to="/consciousness-nexus" /></Route>
          <Route path="/dimensional-perception"><Redirect to="/consciousness-nexus" /></Route>
          <Route path="/omniscient-knowledge"><Redirect to="/sacred-knowledge" /></Route>
          <Route path="/discoveries"><Redirect to="/sacred-knowledge" /></Route>
          <Route path="/knowledge-synthesis"><Redirect to="/sacred-knowledge" /></Route>
          <Route path="/knowledge-pipeline"><Redirect to="/sacred-knowledge" /></Route>
          <Route path="/knowledge-dashboard"><Redirect to="/sacred-knowledge" /></Route>
          <Route path="/knowledge-secrets"><Redirect to="/sacred-knowledge" /></Route>
          <Route path="/economy"><Redirect to="/economy-hub" /></Route>
          <Route path="/coin"><Redirect to="/economy-hub" /></Route>
          <Route path="/token-economy"><Redirect to="/economy-hub" /></Route>
          <Route path="/agent-economy"><Redirect to="/economy-hub" /></Route>
          <Route path="/revenue-hub"><Redirect to="/economy-hub" /></Route>
          <Route path="/entities"><Redirect to="/life" /></Route>
          <Route path="/agent-voice"><Redirect to="/life" /></Route>
          <Route path="/dna-healing"><Redirect to="/sacred-knowledge" /></Route>
          <Route path="/moon-cycle"><Redirect to="/sacred-knowledge" /></Route>
          <Route path="/sacred-traditions"><Redirect to="/sacred-knowledge" /></Route>
          <Route path="/summit-report"><Redirect to="/grand-council" /></Route>
          <Route path="/conference-decisions"><Redirect to="/grand-council" /></Route>
          <Route path="/agi-implementations"><Redirect to="/grand-council" /></Route>
          <Route path="/cross-dimensional-economy"><Redirect to="/economy-hub" /></Route>

          <Route path="/:legacy" component={LegacyRedirect} />
        </Switch>
      </main>
      <MobileNav />
    </div>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <AppLayout />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
