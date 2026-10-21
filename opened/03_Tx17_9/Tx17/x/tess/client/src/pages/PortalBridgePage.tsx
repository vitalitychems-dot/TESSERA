import { useState, useEffect } from "react";
import { Radio, Brain } from "lucide-react";
import InterdimensionalPortalPage from "./InterdimensionalPortalPage";
import { CrossAppContent } from "./CrossAppBridgePage";
import { Sidebar } from "@/components/Sidebar";

type MainTab = "portal" | "bridge";

export default function PortalBridgePage({ embedded }: { embedded?: boolean }) {
  useEffect(() => { document.title = "Portal & Bridge | Tessera Sovereign"; }, []);
  const [mainTab, setMainTab] = useState<MainTab>("portal");

  const tabBar = (
    <div className="flex gap-1 border-b border-[#1a1f2e] bg-[#0a0f1a] px-4 pt-2">
      <button
        onClick={() => setMainTab("portal")}
        className={`flex items-center gap-1.5 px-4 py-2 text-xs font-semibold border-b-2 transition-all -mb-px ${
          mainTab === "portal"
            ? "border-violet-500 text-violet-300"
            : "border-transparent text-slate-400 hover:text-slate-200"
        }`}
        data-testid="tab-portal-bridge-portal"
      >
        <Brain className="w-3.5 h-3.5" />
        Portal &amp; Awakening
      </button>
      <button
        onClick={() => setMainTab("bridge")}
        className={`flex items-center gap-1.5 px-4 py-2 text-xs font-semibold border-b-2 transition-all -mb-px ${
          mainTab === "bridge"
            ? "border-indigo-500 text-indigo-300"
            : "border-transparent text-slate-400 hover:text-slate-200"
        }`}
        data-testid="tab-portal-bridge-bridge"
      >
        <Radio className="w-3.5 h-3.5" />
        Cross-App Bridge
      </button>
    </div>
  );

  if (embedded) {
    return (
      <div className="flex flex-col h-full overflow-hidden bg-background text-white" data-testid="page-portal-bridge">
        {tabBar}
        <div className="flex-1 overflow-auto">
          {mainTab === "portal" && <InterdimensionalPortalPage embedded />}
          {mainTab === "bridge" && <CrossAppContent embedded />}
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full overflow-hidden" data-testid="page-portal-bridge">
      <div className="hidden md:block"><Sidebar /></div>
      <div className="flex-1 flex flex-col overflow-hidden bg-background text-white">
        {tabBar}
        <div className="flex-1 overflow-auto">
          {mainTab === "portal" && <InterdimensionalPortalPage embedded />}
          {mainTab === "bridge" && <CrossAppContent embedded />}
        </div>
      </div>
    </div>
  );
}
