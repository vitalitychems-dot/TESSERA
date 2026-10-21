import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import Dashboard from "@/pages/Dashboard";
import Chat from "@/pages/Chat";
import { useState } from "react";
import { MessageSquare, LayoutDashboard } from "lucide-react";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 2,
      staleTime: 8000,
    },
  },
});

type Tab = "chat" | "dashboard";

function BottomNav({ activeTab, onTabChange }: { activeTab: Tab; onTabChange: (tab: Tab) => void }) {
  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 border-t border-violet-500/20 bg-[hsl(224,71%,4%)]/95 backdrop-blur-xl lg:hidden">
      <div className="flex">
        <button
          onClick={() => onTabChange("chat")}
          className={`flex-1 flex flex-col items-center gap-1 py-2.5 transition-colors ${
            activeTab === "chat" ? "text-violet-400" : "text-slate-600 hover:text-slate-400"
          }`}
        >
          <MessageSquare size={18} />
          <span className="text-[10px] font-mono">Chat</span>
        </button>
        <button
          onClick={() => onTabChange("dashboard")}
          className={`flex-1 flex flex-col items-center gap-1 py-2.5 transition-colors ${
            activeTab === "dashboard" ? "text-violet-400" : "text-slate-600 hover:text-slate-400"
          }`}
        >
          <LayoutDashboard size={18} />
          <span className="text-[10px] font-mono">Dashboard</span>
        </button>
      </div>
    </div>
  );
}

function DesktopNav({ activeTab, onTabChange }: { activeTab: Tab; onTabChange: (tab: Tab) => void }) {
  return (
    <div className="hidden lg:flex fixed top-0 left-0 right-0 z-50 border-b border-violet-500/20 bg-[hsl(224,71%,4%)]/95 backdrop-blur-xl px-4 py-2">
      <div className="flex gap-1">
        <button
          onClick={() => onTabChange("chat")}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono transition-all ${
            activeTab === "chat"
              ? "bg-violet-700/50 border border-violet-500/40 text-violet-200"
              : "text-slate-500 hover:text-slate-300 hover:bg-violet-950/40"
          }`}
        >
          <MessageSquare size={12} />
          Chat
        </button>
        <button
          onClick={() => onTabChange("dashboard")}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono transition-all ${
            activeTab === "dashboard"
              ? "bg-violet-700/50 border border-violet-500/40 text-violet-200"
              : "text-slate-500 hover:text-slate-300 hover:bg-violet-950/40"
          }`}
        >
          <LayoutDashboard size={12} />
          Dashboard
        </button>
      </div>
    </div>
  );
}

function AppContent() {
  const [activeTab, setActiveTab] = useState<Tab>("chat");

  return (
    <div className="min-h-screen bg-[hsl(224,71%,4%)]">
      <DesktopNav activeTab={activeTab} onTabChange={setActiveTab} />

      <div className={`${activeTab === "chat" ? "block" : "hidden"} lg:pt-[44px]`}>
        <Chat />
      </div>

      <div className={`${activeTab === "dashboard" ? "block" : "hidden"} lg:pt-[44px] pb-16 lg:pb-0`}>
        <Dashboard />
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
