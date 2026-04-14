import { useState, useEffect, lazy, Suspense } from "react";
import {
  BarChart3, Loader2, ChevronDown, ChevronUp, DollarSign, Wallet,
  ArrowRightLeft, Globe, Target, TrendingUp, Coins, Activity, Search
} from "lucide-react";
import { Badge } from "@/components/ui/badge";

const EconomyHubPage = lazy(() => import("./EconomyHubPage"));
const AgentEconomyPage = lazy(() => import("./AgentEconomyPage"));
const CrossDimensionalEconomyPage = lazy(() => import("./CrossDimensionalEconomyPage"));
const TokenEconomyPage = lazy(() => import("./TokenEconomyPage"));
const CurrencyHubPage = lazy(() => import("./CurrencyHubPage"));
const RevenueHubPage = lazy(() => import("./RevenueHubPage"));
const WalletDashboardPage = lazy(() => import("./WalletDashboardPage"));
const SportsArbPage = lazy(() => import("./SportsArbPage"));
const SEOPage = lazy(() => import("./SEOPage"));

const Loading = () => <div className="flex items-center justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-emerald-400/60" /></div>;

function Section({ title, icon: Icon, iconColor, children, defaultOpen = false, badge }: {
  title: string; icon: any; iconColor: string; children: React.ReactNode; defaultOpen?: boolean; badge?: string;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border border-emerald-500/10 rounded-xl overflow-hidden">
      <button onClick={() => setOpen(o => !o)} className="w-full flex items-center justify-between px-4 py-3 hover:bg-white/[0.02] transition-colors">
        <div className="flex items-center gap-2">
          <Icon size={15} className={iconColor} />
          <span className="text-sm font-bold text-white">{title}</span>
          {badge && <Badge className="text-[8px] bg-emerald-500/10 border-emerald-500/20 text-emerald-400">{badge}</Badge>}
        </div>
        {open ? <ChevronUp size={13} className="text-gray-500" /> : <ChevronDown size={13} className="text-gray-500" />}
      </button>
      {open && <div className="border-t border-emerald-500/10 p-2">{children}</div>}
    </div>
  );
}

export default function EconomyPage() {
  useEffect(() => { document.title = "Economy | Tessera"; }, []);

  return (
    <div className="min-h-screen text-white p-4 pb-24 space-y-3" data-testid="economy-page">
      <div>
        <div className="flex items-center gap-3 mb-1">
          <h1 className="text-xl font-bold bg-gradient-to-r from-emerald-400 via-cyan-400 to-blue-400 bg-clip-text text-transparent">Economy</h1>
          <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20">
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-[10px] text-emerald-400 font-mono">TSOV</span>
          </div>
        </div>
        <p className="text-xs text-gray-500">TSOV economy, wallets, bridges, arbitrage, revenue engines</p>
      </div>

      <Section title="Economy Hub (TSOV)" icon={Coins} iconColor="text-cyan-400" defaultOpen={true} badge="CORE">
        <Suspense fallback={<Loading />}><EconomyHubPage embedded /></Suspense>
      </Section>

      <Section title="Agent Economy" icon={Activity} iconColor="text-violet-400">
        <Suspense fallback={<Loading />}><AgentEconomyPage embedded /></Suspense>
      </Section>

      <Section title="Token Economy" icon={DollarSign} iconColor="text-amber-400">
        <Suspense fallback={<Loading />}><TokenEconomyPage embedded /></Suspense>
      </Section>

      <Section title="Cross-Dimensional Economy" icon={Globe} iconColor="text-blue-400">
        <Suspense fallback={<Loading />}><CrossDimensionalEconomyPage embedded /></Suspense>
      </Section>

      <Section title="Currency Hub" icon={ArrowRightLeft} iconColor="text-green-400">
        <Suspense fallback={<Loading />}><CurrencyHubPage embedded /></Suspense>
      </Section>

      <Section title="Revenue Hub" icon={TrendingUp} iconColor="text-emerald-400">
        <Suspense fallback={<Loading />}><RevenueHubPage embedded /></Suspense>
      </Section>

      <Section title="Wallet Dashboard" icon={Wallet} iconColor="text-purple-400">
        <Suspense fallback={<Loading />}><WalletDashboardPage embedded /></Suspense>
      </Section>

      <Section title="Sports Arbitrage" icon={Target} iconColor="text-orange-400">
        <Suspense fallback={<Loading />}><SportsArbPage embedded /></Suspense>
      </Section>

      <Section title="SEO Engine" icon={Search} iconColor="text-sky-400">
        <Suspense fallback={<Loading />}><SEOPage embedded /></Suspense>
      </Section>
    </div>
  );
}
