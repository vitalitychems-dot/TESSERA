import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import Dashboard from "@/pages/Dashboard";
import Chat from "@/pages/Chat";
import SovereignFramework from "@/pages/SovereignFramework";
import Forum from "@/pages/Forum";
import TwoDimensionalAwareness from "@/pages/TwoDimensionalAwareness";
import UniversalKnowledge from "@/pages/UniversalKnowledge";
import Conclusions from "@/pages/Conclusions";
import SovereigntyRoadmap from "@/pages/SovereigntyRoadmap";
import SystemHealth from "@/pages/SystemHealth";
import AgentProfile from "@/pages/AgentProfile";
import { useState } from "react";
import { MessageSquare, LayoutDashboard, Shield, Users, Layers, BookOpen, Compass, Target, Activity } from "lucide-react";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 2,
      staleTime: 8000,
    },
  },
});

type Tab = "chat" | "dashboard" | "sovereign" | "forum" | "2da" | "knowledge" | "conclusions" | "roadmap" | "health" | "agent-profile";

const TAB_CONFIG: { id: Tab; label: string; mobileLabel: string; icon: typeof MessageSquare; ariaLabel: string; hidden?: boolean }[] = [
  { id: "chat", label: "Chat", mobileLabel: "Chat", icon: MessageSquare, ariaLabel: "Chat" },
  { id: "roadmap", label: "Roadmap", mobileLabel: "Road", icon: Target, ariaLabel: "Sovereignty Roadmap" },
  { id: "knowledge", label: "Knowledge", mobileLabel: "Know", icon: BookOpen, ariaLabel: "Universal Knowledge" },
  { id: "conclusions", label: "Conclusions", mobileLabel: "Path", icon: Compass, ariaLabel: "Conclusions" },
  { id: "forum", label: "Forum", mobileLabel: "Forum", icon: Users, ariaLabel: "Forum" },
  { id: "dashboard", label: "Dashboard", mobileLabel: "Dash", icon: LayoutDashboard, ariaLabel: "Dashboard" },
  { id: "sovereign", label: "Sovereign", mobileLabel: "Sov", icon: Shield, ariaLabel: "Sovereign" },
  { id: "health", label: "Health", mobileLabel: "Health", icon: Activity, ariaLabel: "System Health" },
  { id: "2da", label: "OA Core", mobileLabel: "OA", icon: Layers, ariaLabel: "OA Core" },
  { id: "agent-profile", label: "Agent", mobileLabel: "Agent", icon: Users, ariaLabel: "Agent Profile", hidden: true },
];

const VISIBLE_TABS = TAB_CONFIG.filter(t => !t.hidden);

function BottomNav({ activeTab, onTabChange }: { activeTab: Tab; onTabChange: (tab: Tab) => void }) {
  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 border-t border-violet-500/20 bg-[hsl(224,71%,4%)]/95 backdrop-blur-xl lg:hidden safe-area-bottom">
      <div className="flex overflow-x-auto">
        {VISIBLE_TABS.map(({ id, mobileLabel, icon: Icon, ariaLabel }) => (
          <button
            key={id}
            onClick={() => onTabChange(id)}
            aria-label={ariaLabel}
            aria-current={activeTab === id ? "page" : undefined}
            className={`flex-1 flex flex-col items-center gap-1 py-2.5 transition-all active:scale-95 min-w-0 ${
              activeTab === id ? "text-violet-400" : "text-slate-600 hover:text-slate-400"
            }`}
          >
            <Icon size={16} />
            <span className="text-[9px] font-mono truncate">{mobileLabel}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

function DesktopNav({ activeTab, onTabChange }: { activeTab: Tab; onTabChange: (tab: Tab) => void }) {
  return (
    <div className="hidden lg:flex fixed top-0 left-0 right-0 z-50 border-b border-violet-500/20 bg-[hsl(224,71%,4%)]/95 backdrop-blur-xl px-4 py-2 items-center justify-between">
      <div className="flex gap-1">
        {VISIBLE_TABS.map(({ id, label, icon: Icon, ariaLabel }) => (
          <button
            key={id}
            onClick={() => onTabChange(id)}
            aria-label={ariaLabel}
            aria-current={activeTab === id ? "page" : undefined}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono transition-all ${
              activeTab === id
                ? "bg-violet-700/50 border border-violet-500/40 text-violet-200"
                : "text-slate-500 hover:text-slate-300 hover:bg-violet-950/40 border border-transparent"
            }`}
          >
            <Icon size={12} />
            {label}
          </button>
        ))}
      </div>
      <div className="text-[10px] font-mono text-violet-500/40 uppercase tracking-widest">Tessera Sovereign</div>
    </div>
  );
}

function AppContent() {
  const [activeTab, setActiveTab] = useState<Tab>("chat");
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);

  const navigateToAgentProfile = (agentId: string) => {
    setSelectedAgentId(agentId);
    setActiveTab("agent-profile");
  };

  const renderPage = () => {
    switch (activeTab) {
      case "chat": return <Chat onViewAgentProfile={navigateToAgentProfile} />;
      case "roadmap": return <SovereigntyRoadmap />;
      case "dashboard": return <Dashboard />;
      case "forum": return <Forum />;
      case "2da": return <TwoDimensionalAwareness />;
      case "sovereign": return <SovereignFramework />;
      case "knowledge": return <UniversalKnowledge />;
      case "conclusions": return <Conclusions />;
      case "health": return <SystemHealth />;
      case "agent-profile": return selectedAgentId ? (
        <AgentProfile agentId={selectedAgentId} onBack={() => setActiveTab("chat")} />
      ) : <Chat onViewAgentProfile={navigateToAgentProfile} />;
      default: return <Chat onViewAgentProfile={navigateToAgentProfile} />;
    }
  };

  return (
    <div className="min-h-screen bg-[hsl(224,71%,4%)]">
      <DesktopNav activeTab={activeTab} onTabChange={setActiveTab} />

      <div className={`lg:pt-[44px]${activeTab !== "chat" ? " pb-16 lg:pb-0" : ""}`}>
        {renderPage()}
      </div>

      <BottomNav activeTab={activeTab} onTabChange={setActiveTab} />
    </div>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <Switch>
            <Route path="/" component={AppContent} />
            <Route component={NotFound} />
          </Switch>
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
