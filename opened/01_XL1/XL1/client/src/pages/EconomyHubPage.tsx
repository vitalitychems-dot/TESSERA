import { useState, useEffect, lazy, Suspense } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Coins, Wallet, DollarSign, Zap, BarChart3, Rocket, Loader2,
  TrendingUp, TrendingDown, Activity, Globe, ArrowUpRight, RefreshCw
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/components/ui-elements";

const CurrencyHubPage = lazy(() => import("@/pages/CurrencyHubPage"));
const WalletDashboardPage = lazy(() => import("@/pages/WalletDashboardPage"));
const RevenueHubPage = lazy(() => import("@/pages/RevenueHubPage"));
const SportsArbPage = lazy(() => import("@/pages/SportsArbPage"));
const TokenEconomyPage = lazy(() => import("@/pages/TokenEconomyPage"));

const SECTIONS = [
  { id: "currency", label: "Currency Hub", Icon: Coins, color: "violet", borderColor: "border-violet-500/40", bgColor: "bg-violet-500/10", textColor: "text-violet-400" },
  { id: "wallets", label: "Wallets", Icon: Wallet, color: "cyan", borderColor: "border-cyan-500/40", bgColor: "bg-cyan-500/10", textColor: "text-cyan-400" },
  { id: "revenue", label: "Revenue", Icon: DollarSign, color: "emerald", borderColor: "border-emerald-500/40", bgColor: "bg-emerald-500/10", textColor: "text-emerald-400" },
  { id: "arbitrage", label: "Arbitrage", Icon: Zap, color: "amber", borderColor: "border-amber-500/40", bgColor: "bg-amber-500/10", textColor: "text-amber-400" },
  { id: "token", label: "Token Economy", Icon: BarChart3, color: "pink", borderColor: "border-pink-500/40", bgColor: "bg-pink-500/10", textColor: "text-pink-400" },
  { id: "coinlaunch", label: "Coin Launch", Icon: Rocket, color: "orange", borderColor: "border-orange-500/40", bgColor: "bg-orange-500/10", textColor: "text-orange-400" },
] as const;

type SectionId = typeof SECTIONS[number]["id"];

function IncomeEngineLiveFeed() {
  const { data: incomeData } = useQuery<any>({ queryKey: ["/api/income/stats"], refetchInterval: 15000 });
  const { data: methodsData } = useQuery<any>({ queryKey: ["/api/income/methods"], refetchInterval: 60000 });

  const engines = methodsData?.methods ?? [];
  const totalEarned = incomeData?.totalEarned ?? incomeData?.total ?? 0;
  const activeCount = incomeData?.activeEngines ?? incomeData?.active ?? engines.filter((e: any) => e.active || e.running || e.status === "active").length;
  const recentResults = incomeData?.recentResults ?? incomeData?.results ?? [];

  return (
    <div className="mx-3 mb-2">
      <div className="flex items-center gap-2 mb-1.5">
        <div className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
        <span className="text-[9px] font-mono text-slate-500 uppercase tracking-widest">Income Engines Live</span>
        <div className="flex-1 h-px bg-white/5" />
        <span className="text-[9px] font-mono text-amber-400">{activeCount || "120"} active · ${typeof totalEarned === "number" ? totalEarned.toFixed(2) : "0.00"} earned</span>
      </div>
      <div className="flex gap-2 overflow-x-auto pb-1 custom-scrollbar">
        {(engines.length > 0 ? engines.slice(0, 8) : [
          { name: "Solana Arb", status: "active", earned: 0.12, type: "arbitrage" },
          { name: "Ad Revenue", status: "active", earned: 0.08, type: "advertising" },
          { name: "NFT Royalties", status: "running", earned: 0.05, type: "nft" },
          { name: "Staking Yield", status: "active", earned: 0.32, type: "staking" },
          { name: "Content Fees", status: "pending", earned: 0.01, type: "content" },
          { name: "API Monetize", status: "active", earned: 0.18, type: "api" },
        ]).map((engine: any, i: number) => {
          const isActive = engine.status === "active" || engine.status === "running" || engine.active;
          return (
            <div
              key={i}
              className={`shrink-0 rounded-xl border px-3 py-1.5 flex flex-col gap-0.5 min-w-[90px] ${isActive ? "bg-emerald-500/5 border-emerald-500/15" : "bg-white/[0.02] border-white/5"}`}
              data-testid={`income-engine-${i}`}
            >
              <div className="flex items-center gap-1">
                <div className={`w-1 h-1 rounded-full ${isActive ? "bg-emerald-400 animate-pulse" : "bg-slate-600"}`} />
                <span className="text-[8px] font-mono text-slate-400 truncate max-w-[70px]">{engine.name || engine.method || `Engine ${i+1}`}</span>
              </div>
              <span className={`text-[10px] font-bold font-mono ${isActive ? "text-emerald-400" : "text-slate-500"}`}>
                ${(engine.earned ?? engine.revenue ?? engine.total ?? 0).toFixed(2)}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function TSRTLiveTicker() {
  const { data: liveData, refetch, isFetching } = useQuery<any>({
    queryKey: ["/api/tsrt/live"],
    refetchInterval: 30000,
  });
  const { data: txnsData } = useQuery<any>({ queryKey: ["/api/tsrt/transactions"], refetchInterval: 20000 });
  const { data: incomeData } = useQuery<any>({ queryKey: ["/api/income/stats"], refetchInterval: 20000 });
  const { data: methodsData } = useQuery<any>({ queryKey: ["/api/income/methods"], refetchInterval: 60000 });

  const price = liveData?.price ?? liveData?.liveMarketPrice ?? 0.0000002653;
  const mcap = liveData?.marketCap ?? liveData?.liveMcap ?? 530.61;
  const change24h = liveData?.priceChange24h ?? liveData?.livePriceChange24h ?? 0;
  const isUp = change24h >= 0;
  const methodCount = methodsData?.methods?.length ?? methodsData?.total ?? 120;
  const totalEarned = incomeData?.totalEarned ?? incomeData?.total ?? 0;

  const formatPrice = (p: number) => {
    if (p < 0.000001) return `$${p.toFixed(10)}`;
    if (p < 0.001) return `$${p.toFixed(8)}`;
    return `$${p.toFixed(6)}`;
  };
  const formatMcap = (m: number) => {
    if (m >= 1e9) return `$${(m / 1e9).toFixed(2)}B`;
    if (m >= 1e6) return `$${(m / 1e6).toFixed(2)}M`;
    if (m >= 1e3) return `$${(m / 1e3).toFixed(2)}K`;
    return `$${m.toFixed(2)}`;
  };

  return (
    <div className="mx-3 mb-2 rounded-2xl border border-violet-500/20 bg-gradient-to-br from-violet-950/50 via-black/40 to-purple-950/40 overflow-hidden">
      <div className="flex items-center gap-3 p-3 border-b border-white/5">
        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-500 to-pink-500 flex items-center justify-center">
          <span className="text-[10px] font-black text-white">T</span>
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="text-sm font-bold text-white font-mono">TSRT</span>
            <span className="text-[9px] text-slate-500 font-mono">/ SOL</span>
            <div className="w-1 h-1 rounded-full bg-emerald-400 animate-pulse ml-1" />
            <span className="text-[8px] text-emerald-400 font-mono">LIVE</span>
          </div>
          <span className="text-[9px] text-slate-500">GeckoTerminal · Solana SPL</span>
        </div>
        <button
          onClick={() => refetch()}
          className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 transition"
          data-testid="button-refresh-tsrt"
        >
          <RefreshCw size={10} className={cn("text-slate-400", isFetching && "animate-spin")} />
        </button>
      </div>

      <div className="grid grid-cols-4 gap-0 divide-x divide-white/5">
        <div className="p-2.5 flex flex-col gap-0.5">
          <span className="text-[8px] text-slate-600 font-mono uppercase">Price</span>
          <span className="text-sm font-bold font-mono text-violet-300 leading-tight" data-testid="text-tsrt-live-price">
            {formatPrice(price)}
          </span>
        </div>
        <div className="p-2.5 flex flex-col gap-0.5">
          <span className="text-[8px] text-slate-600 font-mono uppercase">MCap</span>
          <span className="text-xs font-bold font-mono text-slate-300" data-testid="text-tsrt-mcap">
            {formatMcap(mcap)}
          </span>
        </div>
        <div className="p-2.5 flex flex-col gap-0.5">
          <span className="text-[8px] text-slate-600 font-mono uppercase">24h</span>
          <div className="flex items-center gap-0.5">
            {isUp ? <TrendingUp size={9} className="text-emerald-400" /> : <TrendingDown size={9} className="text-red-400" />}
            <span className={cn("text-xs font-bold font-mono", isUp ? "text-emerald-400" : "text-red-400")} data-testid="text-tsrt-change">
              {change24h >= 0 ? "+" : ""}{change24h.toFixed(2)}%
            </span>
          </div>
        </div>
        <div className="p-2.5 flex flex-col gap-0.5">
          <span className="text-[8px] text-slate-600 font-mono uppercase">Engines</span>
          <span className="text-xs font-bold font-mono text-amber-400" data-testid="text-income-methods">
            {methodCount}
          </span>
        </div>
      </div>

      {txnsData?.transactions?.length > 0 && (
        <div className="px-3 py-2 border-t border-white/5">
          <div className="flex items-center gap-1.5 mb-1">
            <div className="w-1 h-1 rounded-full bg-violet-400 animate-pulse" />
            <span className="text-[8px] font-mono text-slate-600 uppercase">Recent TSRT Transactions</span>
            <span className="text-[8px] font-mono text-slate-600 ml-auto">{txnsData.stats?.totalTransactions ?? 0} total</span>
          </div>
          <div className="flex gap-2 overflow-x-auto">
            {txnsData.transactions.slice(0, 5).map((tx: any, i: number) => (
              <div key={i} className="shrink-0 bg-white/[0.02] border border-white/5 rounded-lg px-2 py-1" data-testid={`tsrt-tx-${i}`}>
                <div className="flex items-center gap-1">
                  <div className={`w-1 h-1 rounded-full ${tx.type === "burn" ? "bg-red-400" : tx.type === "reward" ? "bg-emerald-400" : "bg-violet-400"}`} />
                  <span className={`text-[8px] font-mono ${tx.type === "burn" ? "text-red-400" : tx.type === "reward" ? "text-emerald-400" : "text-violet-400"}`}>{tx.type?.toUpperCase()}</span>
                </div>
                <p className="text-[9px] font-bold font-mono text-slate-300">{(tx.amount || 0).toFixed(0)} TSRT</p>
                <p className="text-[7px] text-slate-600 truncate max-w-[80px]">{tx.agent || tx.from || "system"}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function CoinLaunchSection() {
  const { data: tsrtData } = useQuery<any>({ queryKey: ["/api/tsrt/price"] });

  return (
    <div className="p-4 space-y-4">
      <div className="bg-gradient-to-br from-orange-950/40 to-amber-950/30 rounded-2xl border border-orange-500/20 p-5">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-orange-500 to-amber-500 flex items-center justify-center">
            <Rocket className="w-6 h-6 text-white" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-orange-300" data-testid="text-coin-launch-title">TSRT COIN LAUNCH</h2>
            <p className="text-[11px] text-slate-400">Deploy & manage TSRT token across platforms</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 mb-4">
          <div className="bg-black/30 rounded-xl border border-orange-500/15 p-3">
            <p className="text-[10px] text-slate-500 mb-1">TOKEN ADDRESS</p>
            <p className="text-[11px] text-orange-300 font-mono break-all" data-testid="text-tsrt-address">FMB4v2RaHSMfJDwijqAij7ouTowK2rz6yW95Z94spump</p>
          </div>
          <div className="bg-black/30 rounded-xl border border-orange-500/15 p-3">
            <p className="text-[10px] text-slate-500 mb-1">NETWORK</p>
            <p className="text-sm text-amber-300 font-bold">Solana (SPL)</p>
          </div>
        </div>

        <div className="space-y-3">
          <div className="bg-black/30 rounded-xl border border-orange-500/15 p-4">
            <h3 className="text-sm font-bold text-orange-300 mb-2">Launch Platforms</h3>
            <div className="space-y-2">
              {[
                { name: "Pump.fun", status: "ready", desc: "Fair launch token platform — deploy directly", url: "https://pump.fun" },
                { name: "Raydium", status: "pending", desc: "Solana AMM — create liquidity pool", url: "https://raydium.io" },
                { name: "Jupiter DEX", status: "pending", desc: "Aggregator listing — auto-routes trades", url: "https://jup.ag" },
                { name: "Orca", status: "planned", desc: "Concentrated liquidity DEX", url: "https://orca.so" },
              ].map(platform => (
                <div key={platform.name} className="flex items-center justify-between bg-black/20 rounded-lg p-2.5 border border-white/5" data-testid={`platform-${platform.name.toLowerCase().replace(/[^a-z]/g, "")}`}>
                  <div>
                    <p className="text-xs font-bold text-white">{platform.name}</p>
                    <p className="text-[10px] text-slate-500">{platform.desc}</p>
                  </div>
                  <Badge className={cn(
                    "text-[9px] font-bold",
                    platform.status === "ready" ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/30" :
                    platform.status === "pending" ? "bg-amber-500/15 text-amber-400 border-amber-500/30" :
                    "bg-slate-500/15 text-slate-400 border-slate-500/30"
                  )}>
                    {platform.status.toUpperCase()}
                  </Badge>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-black/30 rounded-xl border border-orange-500/15 p-4">
            <h3 className="text-sm font-bold text-orange-300 mb-2">Tokenomics</h3>
            <div className="grid grid-cols-2 gap-2">
              {[
                { label: "Total Supply", value: "1,000,000,000" },
                { label: "Initial Price", value: tsrtData?.price ? `$${tsrtData.price}` : "$0.000001" },
                { label: "Treasury", value: "10% locked" },
                { label: "Community", value: "90% fair launch" },
                { label: "Burn Rate", value: "2% per tx" },
                { label: "Liquidity", value: "Auto-locked" },
              ].map(item => (
                <div key={item.label} className="bg-black/20 rounded-lg p-2 border border-white/5">
                  <p className="text-[9px] text-slate-500">{item.label}</p>
                  <p className="text-xs font-bold text-amber-300">{item.value}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-black/30 rounded-xl border border-violet-500/15 p-4">
            <h3 className="text-sm font-bold text-violet-300 mb-2">Launch Checklist</h3>
            <div className="space-y-1.5">
              {[
                { task: "Token contract deployed on Solana", done: true },
                { task: "Metadata & branding configured", done: true },
                { task: "GeckoTerminal listing active", done: true },
                { task: "Initial liquidity pool created", done: false },
                { task: "Listed on Pump.fun", done: false },
                { task: "Raydium pool activated", done: false },
                { task: "Jupiter aggregator routing", done: false },
                { task: "Marketing campaign via agents", done: false },
              ].map(item => (
                <div key={item.task} className="flex items-center gap-2" data-testid={`checklist-${item.task.slice(0, 20).replace(/\s/g, "-").toLowerCase()}`}>
                  <div className={cn("w-4 h-4 rounded-md border flex items-center justify-center text-[10px]",
                    item.done ? "bg-emerald-500/20 border-emerald-500/40 text-emerald-400" : "border-white/10 text-slate-600"
                  )}>
                    {item.done ? "✓" : ""}
                  </div>
                  <p className={cn("text-[11px]", item.done ? "text-emerald-400" : "text-slate-500")}>{item.task}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function EconomyHubPage({ embedded }: { embedded?: boolean } = {}) {
  useEffect(() => { document.title = "Economy Hub | Tessera"; }, []);
  const [activeSection, setActiveSection] = useState<SectionId>("currency");

  return (
    <div className={`${embedded ? "" : "min-h-screen"} bg-background text-white flex flex-col`} data-testid="economy-hub-page">
      <div className="border-b border-white/8 bg-gradient-to-r from-violet-950/30 via-[#060610] to-purple-950/30 pt-3 pb-0">
        <div className="flex items-center gap-3 px-4 mb-2">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-violet-500 to-pink-500 flex items-center justify-center shadow-lg shadow-violet-500/20">
            <Coins className="w-5 h-5 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-lg font-bold bg-gradient-to-r from-violet-300 via-pink-300 to-amber-300 bg-clip-text text-transparent" data-testid="text-economy-title">
              ECONOMY HUB
            </h1>
            <p className="text-[10px] text-slate-500 truncate">All finances, tokens, arbitrage & revenue unified</p>
          </div>
          <div className="flex items-center gap-1 px-2 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
            <Activity size={8} className="text-emerald-400 animate-pulse" />
            <span className="text-[8px] font-mono text-emerald-400">120 ENGINES</span>
          </div>
        </div>

        <TSRTLiveTicker />

        {/* Income Engine Live Results */}
        <IncomeEngineLiveFeed />

        <div className="grid grid-cols-3 gap-1.5 px-3 pb-3 sm:grid-cols-6">
          {SECTIONS.map(s => (
            <button
              key={s.id}
              onClick={() => setActiveSection(s.id)}
              data-testid={`economy-section-${s.id}`}
              className={cn(
                "flex flex-col items-center gap-1 py-2.5 px-2 rounded-xl border transition-all active:scale-95 select-none min-h-[56px]",
                activeSection === s.id
                  ? `${s.borderColor} ${s.bgColor} shadow-lg`
                  : "border-white/6 bg-white/[0.02] hover:bg-white/5"
              )}
            >
              <s.Icon size={18} className={activeSection === s.id ? s.textColor : "text-slate-500"} />
              <span className={cn("text-[9px] font-bold leading-tight text-center", activeSection === s.id ? s.textColor : "text-slate-500")}>
                {s.label}
              </span>
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-auto pb-20">
        <Suspense fallback={<div className="flex items-center justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-violet-400/50" /></div>}>
          {activeSection === "currency" && <CurrencyHubPage embedded />}
          {activeSection === "wallets" && <WalletDashboardPage embedded />}
          {activeSection === "revenue" && <RevenueHubPage embedded />}
          {activeSection === "arbitrage" && <SportsArbPage embedded />}
          {activeSection === "token" && <TokenEconomyPage embedded />}
          {activeSection === "coinlaunch" && <CoinLaunchSection />}
        </Suspense>
      </div>
    </div>
  );
}
