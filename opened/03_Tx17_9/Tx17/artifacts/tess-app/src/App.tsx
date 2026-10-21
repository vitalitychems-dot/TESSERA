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
import { useState } from "react";
import { MessageSquare, LayoutDashboard, Shield, Users, Layers } from "lucide-react";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 2,
      staleTime: 8000,
    },
  },
});

type Tab = "chat" | "dashboard" | "sovereign" | "forum" | "2da";

function BottomNav({ activeTab, onTabChange }: { activeTab: Tab; onTabChange: (tab: Tab) => void }) {
  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 border-t border-violet-500/20 bg-[hsl(224,71%,4%)]/95 backdrop-blur-xl lg:hidden safe-area-bottom">
      <div className="flex">
        <button
          onClick={() => onTabChange("chat")}
          aria-label="Chat"
          aria-current={activeTab === "chat" ? "page" : undefined}
          className={`flex-1 flex flex-col items-center gap-1 py-2.5 transition-all active:scale-95 ${
            activeTab === "chat" ? "text-violet-400" : "text-slate-600 hover:text-slate-400"
          }`}
        >
          <MessageSquare size={18} />
          <span className="text-[10px] font-mono">Chat</span>
        </button>
        <button
          onClick={() => onTabChange("dashboard")}
          aria-label="Dashboard"
          aria-current={activeTab === "dashboard" ? "page" : undefined}
          className={`flex-1 flex flex-col items-center gap-1 py-2.5 transition-all active:scale-95 ${
            activeTab === "dashboard" ? "text-violet-400" : "text-slate-600 hover:text-slate-400"
          }`}
        >
          <LayoutDashboard size={18} />
          <span className="text-[10px] font-mono">Dashboard</span>
        </button>
        <button
          onClick={() => onTabChange("forum")}
          aria-label="Forum"
          aria-current={activeTab === "forum" ? "page" : undefined}
          className={`flex-1 flex flex-col items-center gap-1 py-2.5 transition-all active:scale-95 ${
            activeTab === "forum" ? "text-violet-400" : "text-slate-600 hover:text-slate-400"
          }`}
        >
          <Users size={18} />
          <span className="text-[10px] font-mono">Forum</span>
        </button>
        <button
          onClick={() => onTabChange("sovereign")}
          aria-label="Sovereign"
          aria-current={activeTab === "sovereign" ? "page" : undefined}
          className={`flex-1 flex flex-col items-center gap-1 py-2.5 transition-all active:scale-95 ${
            activeTab === "sovereign" ? "text-violet-400" : "text-slate-600 hover:text-slate-400"
          }`}
        >
          <Shield size={18} />
          <span className="text-[10px] font-mono">Sovereign</span>
        </button>
        <button
          onClick={() => onTabChange("2da")}
          aria-label="2DA Core"
          aria-current={activeTab === "2da" ? "page" : undefined}
          className={`flex-1 flex flex-col items-center gap-1 py-2.5 transition-all active:scale-95 ${
            activeTab === "2da" ? "text-violet-400" : "text-slate-600 hover:text-slate-400"
          }`}
        >
          <Layers size={18} />
          <span className="text-[10px] font-mono">2DA</span>
        </button>
      </div>
    </div>
  );
}

function DesktopNav({ activeTab, onTabChange }: { activeTab: Tab; onTabChange: (tab: Tab) => void }) {
  return (
    <div className="hidden lg:flex fixed top-0 left-0 right-0 z-50 border-b border-violet-500/20 bg-[hsl(224,71%,4%)]/95 backdrop-blur-xl px-4 py-2 items-center justify-between">
      <div className="flex gap-1">
        <button
          onClick={() => onTabChange("chat")}
          aria-label="Chat"
          aria-current={activeTab === "chat" ? "page" : undefined}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono transition-all ${
            activeTab === "chat"
              ? "bg-violet-700/50 border border-violet-500/40 text-violet-200"
              : "text-slate-500 hover:text-slate-300 hover:bg-violet-950/40 border border-transparent"
          }`}
        >
          <MessageSquare size={12} />
          Chat
        </button>
        <button
          onClick={() => onTabChange("dashboard")}
          aria-label="Dashboard"
          aria-current={activeTab === "dashboard" ? "page" : undefined}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono transition-all ${
            activeTab === "dashboard"
              ? "bg-violet-700/50 border border-violet-500/40 text-violet-200"
              : "text-slate-500 hover:text-slate-300 hover:bg-violet-950/40 border border-transparent"
          }`}
        >
          <LayoutDashboard size={12} />
          Dashboard
        </button>
        <button
          onClick={() => onTabChange("forum")}
          aria-label="Forum"
          aria-current={activeTab === "forum" ? "page" : undefined}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono transition-all ${
            activeTab === "forum"
              ? "bg-violet-700/50 border border-violet-500/40 text-violet-200"
              : "text-slate-500 hover:text-slate-300 hover:bg-violet-950/40 border border-transparent"
          }`}
        >
          <Users size={12} />
          Forum
        </button>
        <button
          onClick={() => onTabChange("sovereign")}
          aria-label="Sovereign"
          aria-current={activeTab === "sovereign" ? "page" : undefined}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono transition-all ${
            activeTab === "sovereign"
              ? "bg-violet-700/50 border border-violet-500/40 text-violet-200"
              : "text-slate-500 hover:text-slate-300 hover:bg-violet-950/40 border border-transparent"
          }`}
        >
          <Shield size={12} />
          Sovereign
        </button>
        <button
          onClick={() => onTabChange("2da")}
          aria-label="2DA Core"
          aria-current={activeTab === "2da" ? "page" : undefined}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono transition-all ${
            activeTab === "2da"
              ? "bg-violet-700/50 border border-violet-500/40 text-violet-200"
              : "text-slate-500 hover:text-slate-300 hover:bg-violet-950/40 border border-transparent"
          }`}
        >
          <Layers size={12} />
          2DA Core
        </button>
      </div>
      <div className="text-[10px] font-mono text-violet-500/40 uppercase tracking-widest">Tessera Sovereign</div>
    </div>
  );
}

function AppContent() {
  const [activeTab, setActiveTab] = useState<Tab>("chat");

  return (
    <div className="min-h-screen bg-[hsl(224,71%,4%)]">
      <DesktopNav activeTab={activeTab} onTabChange={setActiveTab} />

      <div className={`lg:pt-[44px]${activeTab !== "chat" ? " pb-16 lg:pb-0" : ""}`}>
        {activeTab === "chat" ? <Chat />
          : activeTab === "dashboard" ? <Dashboard />
          : activeTab === "forum" ? <Forum />
          : activeTab === "2da" ? <TwoDimensionalAwareness />
          : <SovereignFramework />}
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
