import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { BarChart3, TrendingUp, DollarSign, RefreshCw, Loader2, Coins, Activity, ArrowUpRight, ArrowDownRight } from "lucide-react";
import { cn } from "@/lib/utils";

type EconTab = "overview" | "trading" | "arbitrage" | "economy";

const TABS: { id: EconTab; label: string }[] = [
  { id: "overview", label: "Overview" },
  { id: "trading", label: "Trading" },
  { id: "arbitrage", label: "Arbitrage" },
  { id: "economy", label: "Economy" },
];

function OverviewTab() {
  const { data, isLoading } = useQuery<any>({
    queryKey: ["/api/economy/overview"],
    refetchInterval: 30000,
  });

  const { data: coinData } = useQuery<any>({
    queryKey: ["/api/tsrt/stats"],
    refetchInterval: 60000,
  });

  return (
    <div className="p-4 space-y-4">
      <div className="grid grid-cols-2 gap-3">
        {[
          { label: "Total Revenue", value: data?.totalRevenue ? `$${data.totalRevenue.toFixed(2)}` : "$0.00", icon: DollarSign, color: "text-green-400", trend: data?.revenueTrend },
          { label: "Active Strategies", value: data?.activeStrategies ?? "—", icon: Activity, color: "text-cyan-400" },
          { label: "TSRT Price", value: coinData?.price ? `$${coinData.price.toFixed(4)}` : "—", icon: Coins, color: "text-amber-400", trend: coinData?.priceTrend },
          { label: "Daily P&L", value: data?.dailyPnl != null ? `${data.dailyPnl >= 0 ? "+" : ""}$${data.dailyPnl.toFixed(2)}` : "—", icon: TrendingUp, color: data?.dailyPnl >= 0 ? "text-green-400" : "text-red-400" },
        ].map(({ label, value, icon: Icon, color, trend }) => (
          <div key={label} className="rounded-lg border border-border/30 bg-card/40 p-3">
            <div className="flex items-center gap-2 mb-1">
              <Icon size={12} className={color} />
              <span className="text-[10px] text-muted-foreground">{label}</span>
              {trend === "up" && <ArrowUpRight size={10} className="text-green-400 ml-auto" />}
              {trend === "down" && <ArrowDownRight size={10} className="text-red-400 ml-auto" />}
            </div>
            <div className={cn("text-lg font-bold font-mono", color)}>{value}</div>
          </div>
        ))}
      </div>

      {data?.recentTrades?.length > 0 && (
        <div>
          <h3 className="text-xs font-semibold text-muted-foreground mb-2">Recent Trades</h3>
          <div className="space-y-1.5">
            {data.recentTrades.slice(0, 5).map((t: any, i: number) => (
              <div key={i} className="flex items-center gap-2 rounded-md border border-border/30 bg-card/30 px-2.5 py-2">
                <div className={cn("w-1.5 h-1.5 rounded-full shrink-0", t.side === "buy" || t.pnl >= 0 ? "bg-green-400" : "bg-red-400")} />
                <span className="text-xs flex-1 truncate">{t.pair || t.asset || "Trade"}</span>
                <span className={cn("text-[10px] font-mono shrink-0", t.pnl >= 0 ? "text-green-400" : "text-red-400")}>
                  {t.pnl != null ? `${t.pnl >= 0 ? "+" : ""}$${t.pnl.toFixed(2)}` : t.side || ""}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function TradingTab() {
  const { data } = useQuery<any>({ queryKey: ["/api/economy/trading"], refetchInterval: 15000 });

  return (
    <div className="p-4 space-y-3">
      <h3 className="text-xs font-semibold text-muted-foreground">Trading Strategies</h3>
      {(data?.strategies || []).map((s: any, i: number) => (
        <div key={i} className="rounded-lg border border-border/30 bg-card/40 p-3">
          <div className="flex items-center gap-2">
            <div className={cn("w-1.5 h-1.5 rounded-full", s.active ? "bg-green-400 animate-pulse" : "bg-muted-foreground/40")} />
            <span className="text-sm font-semibold">{s.name}</span>
            <span className={cn("ml-auto text-[10px] font-mono", s.pnl >= 0 ? "text-green-400" : "text-red-400")}>
              {s.pnl != null ? `${s.pnl >= 0 ? "+" : ""}$${s.pnl.toFixed(2)}` : ""}
            </span>
          </div>
          {s.description && <p className="text-xs text-muted-foreground mt-1">{s.description}</p>}
        </div>
      ))}
      {(!data?.strategies?.length) && (
        <div className="text-center py-8 text-muted-foreground/40">
          <TrendingUp size={32} className="mx-auto mb-2" />
          <p className="text-sm">No active trading strategies</p>
        </div>
      )}
    </div>
  );
}

function ArbitrageTab() {
  const { data } = useQuery<any>({ queryKey: ["/api/economy/arbitrage"], refetchInterval: 15000 });

  return (
    <div className="p-4 space-y-3">
      <h3 className="text-xs font-semibold text-muted-foreground">Arbitrage Opportunities</h3>
      {(data?.opportunities || []).map((opp: any, i: number) => (
        <div key={i} className="rounded-lg border border-green-500/20 bg-green-500/5 p-3">
          <div className="flex items-center gap-2 mb-1">
            <ArrowUpRight size={12} className="text-green-400" />
            <span className="text-sm font-semibold">{opp.pair || opp.market}</span>
            <span className="ml-auto text-xs font-mono text-green-400">{opp.spread || opp.profit}</span>
          </div>
          {opp.description && <p className="text-xs text-muted-foreground">{opp.description}</p>}
        </div>
      ))}
      {(!data?.opportunities?.length) && (
        <div className="text-center py-8 text-muted-foreground/40">
          <BarChart3 size={32} className="mx-auto mb-2" />
          <p className="text-sm">Scanning for arbitrage opportunities...</p>
        </div>
      )}
    </div>
  );
}

function EconomyTab() {
  const { data } = useQuery<any>({ queryKey: ["/api/economy/global"], refetchInterval: 60000 });

  return (
    <div className="p-4 space-y-3">
      <h3 className="text-xs font-semibold text-muted-foreground">Global Economy</h3>
      <div className="rounded-lg border border-border/30 bg-card/40 p-4 text-center">
        <DollarSign size={32} className="mx-auto mb-3 text-amber-400/40" />
        <p className="text-sm text-muted-foreground">Economy module active</p>
      </div>
    </div>
  );
}

export default function EconomyHubPage({ embedded }: { embedded?: boolean }) {
  const [activeTab, setActiveTab] = useState<EconTab>("overview");
  const { isRefetching } = useQuery<any>({ queryKey: ["/api/economy/overview"], refetchInterval: 30000 });

  return (
    <div className="flex flex-col h-full overflow-hidden bg-[#08090e]">
      <div className="flex items-center gap-3 px-5 py-4 border-b border-border/30 bg-background/40 shrink-0">
        <div className="p-1.5 rounded-lg bg-orange-500/10 border border-orange-500/20">
          <BarChart3 size={16} className="text-orange-400" />
        </div>
        <div>
          <h1 className="text-base font-bold text-foreground">Economy Hub</h1>
          <p className="text-[10px] text-muted-foreground font-mono">Sovereign Financial Intelligence</p>
        </div>
        <div className="ml-auto flex items-center gap-1.5">
          <div className="w-1.5 h-1.5 rounded-full bg-orange-400 animate-pulse" />
          <span className="text-[10px] text-orange-400 font-mono">MARKETS LIVE</span>
        </div>
      </div>

      <div className="flex gap-0.5 border-b border-border/30 bg-background/20 shrink-0 px-2 overflow-x-auto">
        {TABS.map(({ id, label }) => (
          <button
            key={id}
            onClick={() => setActiveTab(id)}
            className={cn(
              "px-3 py-2.5 text-xs font-medium border-b-2 transition-colors whitespace-nowrap",
              activeTab === id
                ? "border-orange-400 text-orange-400"
                : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto">
        {activeTab === "overview" && <OverviewTab />}
        {activeTab === "trading" && <TradingTab />}
        {activeTab === "arbitrage" && <ArbitrageTab />}
        {activeTab === "economy" && <EconomyTab />}
      </div>
    </div>
  );
}
