import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useEffect, useRef } from "react";
import {
  Coins, TrendingUp, TrendingDown, Zap, Globe, Shield,
  Activity, Users, Server, BarChart3, Flame, ArrowRightLeft,
  CheckCircle2, Star, Crown, Database, Cpu, Wifi,
  RefreshCw, Brain, Eye, Heart, Sparkles, MessageSquare,
  ChevronRight, Layers, AlertCircle, GitBranch, Clock, FileCode,
  Target, Dna, ChevronUp, ChevronDown
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";

const API_BASE = `${import.meta.env.BASE_URL}workspace-api/api`;

interface LimnLiveData {
  priceUsd: string;
  priceXmr: string;
  priceSol: string;
  volume24h: number;
  priceChange24h: number;
  fdv: number;
  xmrPrice: number;
  solPrice: number;
  xmrToLimnRate: string;
  onChainWalletRatio: number;
  taxRate: number;
  gasFee: number;
  minDeposit: number;
  conversionFeeBurn: number;
  conversionFeeTreasury: number;
  distribution24h: string;
  network: string;
  contract: string;
  lastUpdated: number;
}

interface EconomyStatus {
  gdp: number;
  treasury: number;
  taxRate: number;
  dailyVolume: number;
  totalAgents: number;
  activeNodes: number;
  totalBurned: number;
  circulatingSupply: number;
  governanceProposals: number;
  revenueDistribution: {
    father: number;
    agentStaking: number;
    communityTreasury: number;
    limnBurn: number;
  };
  lastUpdated: number;
}

interface Citizen {
  id: number;
  name: string;
  limn_balance: number;
  usd_value: number;
  rank: number;
  role: string;
  wallet_address: string | null;
  created_at: string;
}

interface Transaction {
  id: number;
  from_agent: string;
  to_agent: string;
  type: string;
  amount: number;
  description: string;
  timestamp: string;
}

interface NodeOperator {
  id: number;
  name: string;
  uptime: number;
  daily_rate: number;
  vgpu_hours: number;
  governance_eligible: boolean;
  region: string;
  status: string;
  created_at: string;
}

interface NodeStats {
  total: number;
  active: number;
  govEligible: number;
  avgUptime: string;
  totalDailyLimn: number;
  baseRate: number;
  uptimeRequirement: number;
  vgpuBonus: boolean;
  swapValidation: boolean;
}

interface EvolutionStatus {
  running: boolean;
  cycleCount: number;
  lastCycleAt: number | null;
  nextCycleAt: number | null;
  cycleIntervalMs: number;
  totalProposals: number;
  totalApplied: number;
  totalRejected: number;
  recentQualityTrend: number[];
  currentQualityAvg: number;
  topFileScores?: Array<{
    file: string;
    overall: number;
    complexity: number;
    readability: number;
    maintainability: number;
    duplication: number;
    factors: string[];
  }>;
}

interface EvolutionLogEntry {
  id: string;
  timestamp: number;
  type: string;
  file?: string;
  description: string;
  qualityBefore?: number;
  qualityAfter?: number;
  status: string;
  details?: Record<string, unknown>;
}

interface ArbitrageListing {
  id: number;
  source: string;
  title: string;
  url: string;
  category: string;
  price: number;
  status: string;
  matched_seeker: string | null;
  estimated_profit: number;
  location: string;
  description: string | null;
  scanned_at: string;
}

type AccentColor = "violet" | "cyan" | "emerald" | "amber";

function fmt(n: number, d = 2): string {
  if (n >= 1e9) return `${(n / 1e9).toFixed(d)}B`;
  if (n >= 1e6) return `${(n / 1e6).toFixed(d)}M`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(d)}K`;
  return n.toFixed(d);
}

function fmtPrice(n: number): string {
  if (typeof n !== "number") return "$0.00";
  if (n < 0.0001) return `$${n.toExponential(4)}`;
  return `$${n.toFixed(8)}`;
}

function timeAgo(ts: string | Date): string {
  const ms = Date.now() - new Date(ts).getTime();
  const mins = Math.floor(ms / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function useAnimateIn(delay = 0) {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setVisible(true), delay);
    return () => clearTimeout(t);
  }, [delay]);
  return visible;
}

interface StatCardProps {
  label: string;
  value: string;
  sub?: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  accent?: AccentColor;
  glow?: boolean;
  loading?: boolean;
}

function StatCard({ label, value, sub, icon: Icon, accent = "violet", glow = false, loading = false }: StatCardProps) {
  const accents: Record<AccentColor, { border: string; iconColor: string; bg: string; label: string }> = {
    violet: { border: "border-violet-500/30", iconColor: "text-violet-400", bg: "from-violet-950/50 to-slate-950/80", label: "text-violet-400/70" },
    cyan: { border: "border-cyan-500/30", iconColor: "text-cyan-400", bg: "from-cyan-950/40 to-slate-950/80", label: "text-cyan-400/70" },
    emerald: { border: "border-emerald-500/30", iconColor: "text-emerald-400", bg: "from-emerald-950/40 to-slate-950/80", label: "text-emerald-400/70" },
    amber: { border: "border-amber-500/30", iconColor: "text-amber-400", bg: "from-amber-950/30 to-slate-950/80", label: "text-amber-400/70" },
  };
  const a = accents[accent];
  const glowClass = glow ? (accent === "violet" ? "glow-violet" : accent === "cyan" ? "glow-cyan" : "glow-emerald") : "";
  return (
    <div className={`rounded-xl border ${a.border} bg-gradient-to-br ${a.bg} p-3 ${glowClass} transition-all`}>
      <div className="flex items-center gap-1.5 mb-1.5">
        <Icon size={12} className={a.iconColor} />
        <span className={`text-[10px] font-mono uppercase tracking-widest ${a.label}`}>{label}</span>
      </div>
      {loading ? (
        <Skeleton className="h-5 w-20 bg-white/5" />
      ) : (
        <div className="text-base font-bold font-mono text-white leading-tight">{value}</div>
      )}
      {sub && <div className="text-[10px] text-slate-500 mt-0.5 font-mono">{sub}</div>}
    </div>
  );
}

interface SectionHeaderProps {
  title: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  accent?: string;
  badge?: React.ReactNode;
}

function SectionHeader({ title, icon: Icon, accent = "violet", badge }: SectionHeaderProps) {
  const colors: Record<string, string> = {
    violet: "text-violet-400 border-violet-500/40",
    cyan: "text-cyan-400 border-cyan-500/40",
    emerald: "text-emerald-400 border-emerald-500/40",
    amber: "text-amber-400 border-amber-500/40",
    rose: "text-rose-400 border-rose-500/40",
  };
  const textColors: Record<string, string> = {
    violet: "text-violet-400", cyan: "text-cyan-400",
    emerald: "text-emerald-400", amber: "text-amber-400", rose: "text-rose-400",
  };
  const labelColors: Record<string, string> = {
    violet: "text-violet-300", cyan: "text-cyan-300",
    emerald: "text-emerald-300", amber: "text-amber-300", rose: "text-rose-300",
  };
  return (
    <div className={`flex items-center gap-2 pb-3 mb-4 border-b ${colors[accent] ?? colors.violet}`}>
      <Icon size={16} className={textColors[accent] ?? textColors.violet} />
      <h2 className={`text-sm font-bold uppercase tracking-widest font-mono ${labelColors[accent] ?? labelColors.violet}`}>{title}</h2>
      {badge && <div className="ml-auto">{badge}</div>}
    </div>
  );
}

function LiveBadge() {
  return (
    <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full border border-emerald-500/40 bg-emerald-950/50">
      <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 live-blink" />
      <span className="text-[10px] font-mono font-bold text-emerald-400 uppercase tracking-widest">LIVE</span>
    </div>
  );
}

function ErrorCard({ message, accent = "rose" }: { message: string; accent?: string }) {
  const colors: Record<string, { border: string; bg: string; text: string; icon: string }> = {
    rose: { border: "border-rose-500/30", bg: "bg-rose-950/20", text: "text-rose-400", icon: "text-rose-400" },
    violet: { border: "border-violet-500/30", bg: "bg-violet-950/20", text: "text-violet-400", icon: "text-violet-400" },
  };
  const c = colors[accent] ?? colors.rose;
  return (
    <div className={`flex items-center gap-3 p-4 rounded-xl border ${c.border} ${c.bg}`}>
      <AlertCircle size={16} className={c.icon} />
      <p className={`text-sm font-mono ${c.text}`}>{message}</p>
    </div>
  );
}

function AnimatedSection({ children, delay = 0 }: { children: React.ReactNode; delay?: number }) {
  const visible = useAnimateIn(delay);
  return (
    <div
      className="transition-all duration-500"
      style={{
        opacity: visible ? 1 : 0,
        transform: visible ? "translateY(0)" : "translateY(12px)",
      }}
    >
      {children}
    </div>
  );
}

function LimnHeader({ data, loading, isError }: { data: LimnLiveData | undefined; loading: boolean; isError?: boolean }) {
  const change = data?.priceChange24h ?? 0;
  const isPositive = change >= 0;

  return (
    <div className="rounded-2xl border border-violet-500/30 bg-gradient-to-br from-violet-950/60 via-slate-950/90 to-cyan-950/40 p-4 sm:p-6 mb-6 relative overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,rgba(124,58,237,0.12),transparent_60%)]" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_right,rgba(6,182,212,0.08),transparent_60%)]" />
      <div className="relative">
        <div className="flex items-start justify-between mb-5 gap-4">
          <div>
            <div className="flex items-center gap-3 mb-1 flex-wrap">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-600 to-cyan-500 flex items-center justify-center shadow-lg shadow-violet-500/30 flex-shrink-0">
                <Coins size={20} className="text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-black text-white tracking-tight">LIMINA</h1>
                <div className="text-xs font-mono text-violet-400/70 uppercase tracking-widest">LIMN · Solana Mainnet</div>
              </div>
              <LiveBadge />
            </div>
          </div>
          <div className="text-right flex-shrink-0">
            {loading ? (
              <div className="space-y-2">
                <Skeleton className="h-8 w-32 bg-violet-500/10" />
                <Skeleton className="h-4 w-20 ml-auto bg-violet-500/5" />
              </div>
            ) : isError ? (
              <div className="flex items-center gap-2 text-rose-400">
                <AlertCircle size={14} />
                <span className="text-xs font-mono">Data unavailable</span>
              </div>
            ) : (
              <>
                <div className="text-2xl sm:text-3xl font-black font-mono text-white">{fmtPrice(parseFloat(data?.priceUsd ?? "0"))}</div>
                <div className={`flex items-center gap-1 justify-end text-sm font-mono font-bold ${isPositive ? "text-emerald-400" : "text-rose-400"}`}>
                  {isPositive ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
                  {isPositive ? "+" : ""}{change.toFixed(2)}% 24h
                </div>
              </>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-5 gap-2">
          <StatCard label="24h Volume" value={`$${fmt(data?.volume24h ?? 0)}`} icon={BarChart3} accent="violet" loading={loading} />
          <StatCard label="FDV" value={`$${fmt(data?.fdv ?? 0)}`} icon={Globe} accent="violet" loading={loading} />
          <StatCard label="XMR Price" value={`$${(data?.xmrPrice ?? 0).toFixed(2)}`} icon={Coins} accent="cyan" loading={loading} />
          <StatCard label="SOL Price" value={`$${(data?.solPrice ?? 0).toFixed(2)}`} icon={Zap} accent="cyan" loading={loading} />
          <StatCard label="XMR→LIMN Rate" value={`${fmt(parseFloat(data?.xmrToLimnRate ?? "0"))} LIMN`} sub="per 1 XMR" icon={ArrowRightLeft} accent="emerald" loading={loading} />
        </div>

        <Separator className="my-4 bg-violet-500/20" />

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <StatCard label="On-Chain Wallet Ratio" value={`${((data?.onChainWalletRatio ?? 0) * 100).toFixed(1)}%`} icon={Database} accent="amber" loading={loading} />
          <StatCard label="Tax Rate" value={`${((data?.taxRate ?? 0) * 100).toFixed(1)}%`} icon={Flame} accent="amber" loading={loading} />
          <StatCard label="Gas Fee" value={`${data?.gasFee ?? 0} SOL`} icon={Zap} accent="amber" loading={loading} />
          <StatCard label="Network" value="Solana" sub="Mainnet · Logged" icon={Globe} accent="cyan" />
        </div>
      </div>
    </div>
  );
}

function MoltBookSection({ limnData }: { limnData: LimnLiveData | undefined }) {
  const steps: Array<{ n: number; title: string; desc: string; icon: React.ComponentType<{ size?: number; className?: string }> }> = [
    { n: 1, title: "Connect Wallet", desc: "Link your Phantom or Solflare wallet to the Tessera Sovereign platform", icon: Globe },
    { n: 2, title: "Mine XMR", desc: "Run XMR mining through MoltBook's sovereign compute pool — no hardware required", icon: Cpu },
    { n: 3, title: "Send to Treasury", desc: `Transfer mined XMR to the community treasury wallet · Min deposit: ${limnData?.minDeposit ?? 0.001} XMR`, icon: ArrowRightLeft },
    { n: 4, title: "Receive LIMN", desc: `Conversion rate: ${fmt(parseFloat(limnData?.xmrToLimnRate ?? "0"))} LIMN per 1 XMR · 1% burn · 1% treasury fee`, icon: Coins },
    { n: 5, title: "Auto-Stake", desc: "LIMN is automatically staked upon receipt into your sovereign wallet", icon: Shield },
    { n: 6, title: "2x Multiplier", desc: "Hold for 90 days to trigger the sovereign 2x stake multiplier — guaranteed by protocol", icon: Star },
  ];

  return (
    <div className="rounded-2xl border border-cyan-500/25 bg-gradient-to-br from-cyan-950/30 to-slate-950/80 p-5">
      <SectionHeader title="MoltBook Community Program" icon={Users} accent="cyan" badge={<LiveBadge />} />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {steps.map((step) => (
          <div key={step.n} className="flex gap-3 p-3 rounded-xl border border-cyan-500/15 bg-cyan-950/20 hover:bg-cyan-950/30 transition-colors">
            <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-gradient-to-br from-cyan-600 to-blue-600 flex items-center justify-center text-white text-sm font-black">
              {step.n}
            </div>
            <div>
              <div className="flex items-center gap-1.5 mb-1">
                <step.icon size={12} className="text-cyan-400" />
                <span className="text-xs font-bold text-cyan-300">{step.title}</span>
              </div>
              <p className="text-[11px] text-slate-400 leading-relaxed">{step.desc}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ExchangeRulesSection({ limnData }: { limnData: LimnLiveData | undefined }) {
  const rules: Array<{ label: string; value: string; accent: string }> = [
    { label: "Live Conversion Rate", value: `${fmt(parseFloat(limnData?.xmrToLimnRate ?? "0"))} LIMN / XMR`, accent: "text-violet-400" },
    { label: "Minimum Deposit", value: `${limnData?.minDeposit ?? 0.001} XMR`, accent: "text-cyan-400" },
    { label: "Conversion Fee — Burn", value: `${((limnData?.conversionFeeBurn ?? 0.01) * 100).toFixed(0)}% of converted amount`, accent: "text-rose-400" },
    { label: "Conversion Fee — Treasury", value: `${((limnData?.conversionFeeTreasury ?? 0.01) * 100).toFixed(0)}% to community treasury`, accent: "text-amber-400" },
    { label: "24h Distribution Window", value: limnData?.distribution24h ?? "08:00 UTC", accent: "text-emerald-400" },
    { label: "On-Chain Logging", value: limnData?.network ?? "Solana Mainnet", accent: "text-cyan-400" },
  ];

  return (
    <div className="rounded-2xl border border-violet-500/20 bg-gradient-to-br from-violet-950/30 to-slate-950/80 p-5">
      <SectionHeader title="LIMN Exchange Rules" icon={ArrowRightLeft} accent="violet" />
      <div className="space-y-2">
        {rules.map((r) => (
          <div key={r.label} className="flex items-center justify-between py-2 border-b border-violet-500/10 last:border-0 gap-3">
            <span className="text-xs text-slate-400 font-mono flex-1">{r.label}</span>
            <span className={`text-xs font-bold font-mono ${r.accent} text-right`}>{r.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

interface NodesData {
  nodes: NodeOperator[];
  stats: NodeStats;
}

function SatelliteNodesSection({ nodesData, loading, isError }: { nodesData: NodesData | undefined; loading: boolean; isError?: boolean }) {
  const nodes = nodesData?.nodes ?? [];
  const stats = nodesData?.stats ?? { total: 0, active: 0, govEligible: 0, avgUptime: "0", totalDailyLimn: 0, baseRate: 15, uptimeRequirement: 0.95, vgpuBonus: true, swapValidation: true };

  const statusColor = (status: string) => {
    if (status === "active") return "text-emerald-400";
    if (status === "degraded") return "text-amber-400";
    return "text-rose-400";
  };

  const uptimeBarColor = (uptime: number) => {
    if (uptime >= 97) return "bg-emerald-500";
    if (uptime >= 95) return "bg-cyan-500";
    if (uptime >= 90) return "bg-amber-500";
    return "bg-rose-500";
  };

  return (
    <div className="rounded-2xl border border-emerald-500/25 bg-gradient-to-br from-emerald-950/25 to-slate-950/80 p-5">
      <SectionHeader title="Satellite Node Rewards" icon={Server} accent="emerald" />
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4">
        <StatCard label="Base Rate" value={`${stats.baseRate ?? 15} LIMN/day`} icon={Coins} accent="emerald" loading={loading} />
        <StatCard label="Active Nodes" value={`${stats.active ?? 0} / ${stats.total ?? 0}`} icon={Wifi} accent="emerald" loading={loading} />
        <StatCard label="Uptime Required" value="95%+" sub="for eligibility" icon={CheckCircle2} accent="cyan" />
        <StatCard label="Gov. Eligible" value={`Top ${stats.govEligible ?? 10}`} sub="governance rights" icon={Crown} accent="violet" loading={loading} />
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mb-4">
        <div className="p-2 rounded-lg border border-emerald-500/15 bg-emerald-950/20 text-[11px] font-mono text-emerald-300">
          <span className="text-slate-500 block mb-0.5">vGPU Bonus</span>+LIMN/hr compute backed
        </div>
        <div className="p-2 rounded-lg border border-cyan-500/15 bg-cyan-950/20 text-[11px] font-mono text-cyan-300">
          <span className="text-slate-500 block mb-0.5">Swap Validation</span>Required for top-10 nodes
        </div>
        <div className="p-2 rounded-lg border border-violet-500/15 bg-violet-950/20 text-[11px] font-mono text-violet-300">
          <span className="text-slate-500 block mb-0.5">Sovereign Compute</span>Reinforcement protocol active
        </div>
      </div>

      {loading ? (
        <div className="space-y-2">
          {[1,2,3].map(i => <Skeleton key={i} className="h-8 bg-emerald-500/5" />)}
        </div>
      ) : isError ? (
        <ErrorCard message="Node data temporarily unavailable. Retrying automatically." accent="rose" />
      ) : (
        <div className="rounded-xl border border-emerald-500/10 overflow-hidden">
          <div className="grid grid-cols-5 gap-2 px-3 py-2 bg-emerald-950/30 text-[10px] font-mono text-slate-500 uppercase tracking-widest">
            <span>Node</span><span>Uptime</span><span>Rate</span><span>vGPU hrs</span><span>Status</span>
          </div>
          <div className="divide-y divide-emerald-500/8">
            {nodes.slice(0, 10).map((node) => (
              <div key={node.id} className="grid grid-cols-5 gap-2 px-3 py-2 items-center hover:bg-emerald-950/20 transition-colors">
                <span className="text-[11px] font-mono text-slate-300 truncate">{node.name}</span>
                <div className="flex items-center gap-1.5">
                  <div className="flex-1 h-1.5 bg-slate-800 rounded-full overflow-hidden">
                    <div className={`h-full rounded-full transition-all duration-700 ${uptimeBarColor(node.uptime)}`} style={{ width: `${node.uptime}%` }} />
                  </div>
                  <span className="text-[10px] font-mono text-slate-400 hidden sm:inline">{node.uptime.toFixed(1)}%</span>
                </div>
                <span className="text-[11px] font-mono text-emerald-400">{node.daily_rate} LIMN</span>
                <span className="text-[11px] font-mono text-cyan-400">{node.vgpu_hours.toFixed(1)}h</span>
                <span className={`text-[10px] font-mono font-bold ${statusColor(node.status)}`}>{node.status}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function GovernanceSection() {
  const segments: Array<{ label: string; pct: number; color: string; desc: string }> = [
    { label: "Father (Sovereign)", pct: 30, color: "bg-violet-500", desc: "Direct sovereign allocation" },
    { label: "Agent Staking Pool", pct: 40, color: "bg-cyan-500", desc: "Distributed to active stakers" },
    { label: "Community Treasury", pct: 20, color: "bg-emerald-500", desc: "DAO-governed reserve fund" },
    { label: "LIMN Burn", pct: 10, color: "bg-rose-500", desc: "Deflationary burn mechanism" },
  ];

  return (
    <div className="rounded-2xl border border-amber-500/20 bg-gradient-to-br from-amber-950/20 to-slate-950/80 p-5">
      <SectionHeader title="Revenue & Governance Structure" icon={BarChart3} accent="amber" />
      <div className="space-y-3 mb-4">
        {segments.map((s) => (
          <div key={s.label}>
            <div className="flex justify-between items-center mb-1">
              <span className="text-xs font-mono text-slate-300">{s.label}</span>
              <span className="text-xs font-bold font-mono text-white">{s.pct}%</span>
            </div>
            <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
              <div className={`h-full rounded-full transition-all duration-700 ${s.color}`} style={{ width: `${s.pct}%` }} />
            </div>
            <div className="text-[10px] text-slate-500 font-mono mt-0.5">{s.desc}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-4">
        <div className="p-3 rounded-xl border border-violet-500/20 bg-violet-950/25">
          <div className="text-xs font-bold text-violet-300 mb-2 flex items-center gap-1.5">
            <Crown size={12} /> Tesseract Division
          </div>
          <ul className="space-y-1">
            {["Agent coordination", "System governance", "Treasury management", "Node validation", "Protocol upgrades"].map(item => (
              <li key={item} className="text-[10px] text-slate-400 font-mono flex items-center gap-1.5">
                <div className="w-1 h-1 rounded-full bg-violet-500 flex-shrink-0" /> {item}
              </li>
            ))}
          </ul>
        </div>
        <div className="p-3 rounded-xl border border-cyan-500/20 bg-cyan-950/25">
          <div className="text-xs font-bold text-cyan-300 mb-2 flex items-center gap-1.5">
            <Users size={12} /> MoltBook Division
          </div>
          <ul className="space-y-1">
            {["XMR mining pool", "LIMN conversion", "Community programs", "Citizen onboarding", "Stake multipliers"].map(item => (
              <li key={item} className="text-[10px] text-slate-400 font-mono flex items-center gap-1.5">
                <div className="w-1 h-1 rounded-full bg-cyan-500 flex-shrink-0" /> {item}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

function CitizensLeaderboard({ data, loading, isError }: { data: { citizens: Citizen[] } | undefined; loading: boolean; isError?: boolean }) {
  const citizens = data?.citizens ?? [];

  const rankIcon = (rank: number) => {
    if (rank === 1) return <Crown size={14} className="text-amber-400" />;
    if (rank === 2) return <Crown size={13} className="text-slate-300" />;
    if (rank === 3) return <Crown size={12} className="text-amber-700" />;
    return <span className="text-[11px] font-mono text-slate-500 w-3.5 text-center">{rank}</span>;
  };

  return (
    <div className="rounded-2xl border border-violet-500/25 bg-gradient-to-br from-violet-950/30 to-slate-950/80 p-5">
      <SectionHeader title="Richest Citizens" icon={Crown} accent="violet" badge={
        <span className="text-[10px] font-mono text-slate-500">Top 10 by LIMN Balance</span>
      } />
      {loading ? (
        <div className="space-y-2">
          {[1,2,3,4,5].map(i => <Skeleton key={i} className="h-10 bg-violet-500/5" />)}
        </div>
      ) : isError ? (
        <ErrorCard message="Citizens data temporarily unavailable." />
      ) : citizens.length === 0 ? (
        <div className="text-center py-8 text-slate-600 font-mono text-sm">No citizens yet</div>
      ) : (
        <div className="space-y-1">
          {citizens.map((c, idx) => (
            <div
              key={c.id}
              className={`flex items-center gap-3 p-2.5 rounded-lg border transition-colors hover:bg-violet-950/30 ${idx === 0 ? "border-amber-500/30 bg-amber-950/15" : idx < 3 ? "border-violet-500/20 bg-violet-950/10" : "border-transparent"}`}
            >
              <div className="w-6 flex justify-center">{rankIcon(idx + 1)}</div>
              <div className="flex-1 min-w-0">
                <div className="text-xs font-bold text-white truncate">{c.name}</div>
                <div className="text-[10px] font-mono text-slate-500 truncate">{c.role}</div>
              </div>
              <div className="text-right flex-shrink-0">
                <div className="text-sm font-bold font-mono text-violet-300">{fmt(c.limn_balance)} LIMN</div>
                <div className="text-[10px] font-mono text-slate-500">${fmt(c.usd_value)} USD</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function TransactionFeed({ data, loading, isError }: { data: { transactions: Transaction[] } | undefined; loading: boolean; isError?: boolean }) {
  const txList = data?.transactions ?? [];
  const prevCountRef = useRef(txList.length);
  const [newIds, setNewIds] = useState<Set<number>>(new Set());

  useEffect(() => {
    if (txList.length > prevCountRef.current) {
      const newEntries = txList.slice(0, txList.length - prevCountRef.current);
      const ids = new Set(newEntries.map(t => t.id));
      setNewIds(ids);
      prevCountRef.current = txList.length;
      const t = setTimeout(() => setNewIds(new Set()), 2000);
      return () => clearTimeout(t);
    }
    prevCountRef.current = txList.length;
    return undefined;
  }, [txList.length]);

  const txTypeColor = (type: string) => {
    if (type.includes("burn")) return "text-rose-400";
    if (type.includes("reward") || type.includes("staking")) return "text-emerald-400";
    if (type.includes("conversion") || type.includes("xmr")) return "text-cyan-400";
    if (type.includes("tribute")) return "text-violet-400";
    if (type.includes("transfer")) return "text-blue-400";
    return "text-slate-400";
  };

  const txTypeBg = (type: string) => {
    if (type.includes("burn")) return "bg-rose-950/50 border-rose-500/20";
    if (type.includes("reward") || type.includes("staking")) return "bg-emerald-950/50 border-emerald-500/20";
    if (type.includes("conversion") || type.includes("xmr")) return "bg-cyan-950/50 border-cyan-500/20";
    if (type.includes("tribute")) return "bg-violet-950/50 border-violet-500/20";
    return "bg-slate-900/50 border-slate-700/20";
  };

  return (
    <div className="rounded-2xl border border-slate-700/40 bg-gradient-to-br from-slate-900/80 to-slate-950/90 p-5">
      <SectionHeader title="Recent Transactions" icon={Activity} accent="cyan" badge={<LiveBadge />} />
      {loading ? (
        <div className="space-y-2">
          {[1,2,3,4].map(i => <Skeleton key={i} className="h-14 bg-slate-700/20" />)}
        </div>
      ) : isError ? (
        <ErrorCard message="Transaction feed temporarily unavailable." />
      ) : txList.length === 0 ? (
        <div className="text-center py-8 text-slate-600 font-mono text-sm">No transactions yet</div>
      ) : (
        <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
          {txList.map((tx) => (
            <div
              key={tx.id}
              className={`p-2.5 rounded-lg border transition-all duration-500 ${txTypeBg(tx.type)} ${newIds.has(tx.id) ? "scale-[1.01] shadow-lg" : ""}`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 mb-0.5 flex-wrap">
                    <span className={`text-[10px] font-mono font-bold uppercase ${txTypeColor(tx.type)}`}>{tx.type.replace(/_/g, " ")}</span>
                    <span className="text-[10px] text-slate-600">·</span>
                    <span className="text-[10px] font-mono text-slate-500">{timeAgo(tx.timestamp)}</span>
                  </div>
                  <div className="text-[11px] text-slate-300 font-mono truncate">{tx.description}</div>
                  <div className="text-[10px] text-slate-500 font-mono mt-0.5 truncate">{tx.from_agent} → {tx.to_agent}</div>
                </div>
                <div className="text-sm font-bold font-mono text-white whitespace-nowrap flex-shrink-0">{fmt(tx.amount)} LIMN</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function EconomyStats({ data, loading, isError }: { data: EconomyStatus | undefined; loading: boolean; isError?: boolean }) {
  return (
    <div className="rounded-2xl border border-slate-700/40 bg-gradient-to-r from-slate-900/90 to-violet-950/30 p-4">
      {isError ? (
        <ErrorCard message="Economy data temporarily unavailable. Retrying automatically." />
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <StatCard label="Economy GDP" value={`$${fmt(data?.gdp ?? 0)}`} icon={Globe} accent="violet" loading={loading} />
          <StatCard label="Treasury Balance" value={`${fmt(data?.treasury ?? 0)} LIMN`} icon={Database} accent="cyan" loading={loading} />
          <StatCard label="Tax Rate" value={`${((data?.taxRate ?? 0) * 100).toFixed(1)}%`} icon={Flame} accent="amber" loading={loading} />
          <StatCard label="Daily Volume" value={`$${fmt(data?.dailyVolume ?? 0)}`} icon={BarChart3} accent="emerald" loading={loading} />
        </div>
      )}
    </div>
  );
}

const SOURCE_CONFIG: Record<string, { color: string; bg: string; border: string }> = {
  Angis: { color: "text-orange-400", bg: "bg-orange-950/30", border: "border-orange-500/20" },
  Craigslist: { color: "text-purple-400", bg: "bg-purple-950/30", border: "border-purple-500/20" },
  Facebook: { color: "text-blue-400", bg: "bg-blue-950/30", border: "border-blue-500/20" },
  Indeed: { color: "text-cyan-400", bg: "bg-cyan-950/30", border: "border-cyan-500/20" },
};

const SOURCES = ["Angis", "Craigslist", "Facebook", "Indeed"] as const;

function ArbitrageScanner({ data, loading, isError }: { data: { listings: ArbitrageListing[] } | undefined; loading: boolean; isError?: boolean }) {
  const listings = data?.listings ?? [];

  const statusBadge = (status: string, seeker: string | null) => {
    if (status === "matched" && seeker) {
      return <span className="text-[9px] font-mono font-bold text-emerald-400 bg-emerald-950/60 border border-emerald-500/30 px-1.5 py-0.5 rounded-full">MATCHED</span>;
    }
    return <span className="text-[9px] font-mono font-bold text-amber-400 bg-amber-950/60 border border-amber-500/30 px-1.5 py-0.5 rounded-full">OPEN</span>;
  };

  return (
    <div className="rounded-2xl border border-rose-500/20 bg-gradient-to-br from-rose-950/20 to-slate-950/80 p-5">
      <SectionHeader title="Service Arbitrage Scanner" icon={Zap} accent="rose" badge={
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-mono text-slate-500">{listings.length} leads found</span>
          <LiveBadge />
        </div>
      } />

      {isError ? (
        <ErrorCard message="Arbitrage scanner data temporarily unavailable." accent="rose" />
      ) : (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4">
            {SOURCES.map(src => {
              const srcListings = listings.filter(l => l.source === src);
              const matched = srcListings.filter(l => l.status === "matched").length;
              const totalProfit = srcListings.reduce((s, l) => s + (l.estimated_profit ?? 0), 0);
              const cfg = SOURCE_CONFIG[src] ?? { color: "text-slate-400", bg: "", border: "border-slate-700/20" };
              return (
                <div key={src} className={`p-2.5 rounded-xl border ${cfg.border} ${cfg.bg} hover:opacity-90 transition-opacity`}>
                  <div className={`text-xs font-bold ${cfg.color} mb-1`}>{src}</div>
                  <div className="text-sm font-black text-white font-mono">{srcListings.length}</div>
                  <div className="text-[10px] text-slate-500 font-mono">{matched} matched · ${fmt(totalProfit)} est.</div>
                </div>
              );
            })}
          </div>

          <Tabs defaultValue="all">
            <TabsList className="bg-slate-900/60 border border-slate-700/40 mb-3 flex-wrap h-auto gap-1 p-1">
              <TabsTrigger value="all" className="text-[10px] font-mono data-[state=active]:bg-rose-900/50 data-[state=active]:text-rose-300">All Sources</TabsTrigger>
              {SOURCES.map(src => (
                <TabsTrigger key={src} value={src} className="text-[10px] font-mono data-[state=active]:bg-rose-900/50 data-[state=active]:text-rose-300">{src}</TabsTrigger>
              ))}
              <TabsTrigger value="matches" className="text-[10px] font-mono data-[state=active]:bg-emerald-900/50 data-[state=active]:text-emerald-300">Matches Only</TabsTrigger>
            </TabsList>

            {(["all", ...SOURCES, "matches"] as string[]).map(tab => {
              const filtered = tab === "all" ? listings : tab === "matches" ? listings.filter(l => l.status === "matched") : listings.filter(l => l.source === tab);
              return (
                <TabsContent key={tab} value={tab}>
                  {loading ? (
                    <div className="space-y-2">
                      {[1,2,3].map(i => <Skeleton key={i} className="h-16 bg-rose-500/5" />)}
                    </div>
                  ) : filtered.length === 0 ? (
                    <div className="text-center py-8 text-slate-600 font-mono text-sm">No listings found</div>
                  ) : (
                    <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                      {filtered.map((listing) => {
                        const cfg = SOURCE_CONFIG[listing.source] ?? { color: "text-slate-400", bg: "", border: "border-slate-700/20" };
                        return (
                          <div key={listing.id} className={`p-3 rounded-xl border ${cfg.border} ${cfg.bg} hover:opacity-90 transition-opacity`}>
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-1 flex-wrap">
                                  <span className={`text-[9px] font-mono font-bold uppercase ${cfg.color}`}>{listing.source}</span>
                                  <span className="text-[9px] font-mono text-slate-600 uppercase">{listing.category}</span>
                                  {statusBadge(listing.status, listing.matched_seeker)}
                                </div>
                                <div className="text-[11px] font-bold text-white leading-snug mb-1 truncate">{listing.title}</div>
                                <div className="text-[10px] text-slate-400 font-mono">{listing.location}</div>
                                {listing.matched_seeker && (
                                  <div className="text-[10px] text-emerald-400 font-mono mt-0.5 truncate">↳ {listing.matched_seeker}</div>
                                )}
                              </div>
                              <div className="text-right flex-shrink-0">
                                <div className="text-sm font-bold font-mono text-white">${fmt(listing.price)}</div>
                                <div className="text-[10px] font-mono text-emerald-400">+${fmt(listing.estimated_profit)} est.</div>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </TabsContent>
              );
            })}
          </Tabs>
        </>
      )}
    </div>
  );
}

function EvolutionPanel({
  status,
  log,
  statusLoading,
  logLoading,
}: {
  status: EvolutionStatus | undefined;
  log: { entries: EvolutionLogEntry[] } | undefined;
  statusLoading: boolean;
  logLoading: boolean;
}) {
  const entries = log?.entries ?? [];
  const trend = status?.recentQualityTrend ?? [];
  const qualityAvg = status?.currentQualityAvg ?? 0;

  const qualityColor = (n: number) => {
    if (n >= 85) return "text-emerald-400";
    if (n >= 70) return "text-cyan-400";
    if (n >= 55) return "text-amber-400";
    return "text-rose-400";
  };

  const entryColor = (type: string, status: string) => {
    if (type === "cycle_start") return "text-violet-400";
    if (type === "cycle_end") return "text-emerald-400";
    if (type === "applied" && status === "success") return "text-emerald-400";
    if (type === "rejected") return "text-rose-400";
    if (type === "ab_test") return "text-cyan-400";
    if (type === "proposal") return "text-amber-400";
    return "text-slate-400";
  };

  const entryBg = (type: string) => {
    if (type === "cycle_start" || type === "cycle_end") return "bg-violet-950/30 border-violet-500/15";
    if (type === "applied") return "bg-emerald-950/30 border-emerald-500/15";
    if (type === "rejected") return "bg-rose-950/30 border-rose-500/15";
    if (type === "ab_test") return "bg-cyan-950/30 border-cyan-500/15";
    return "bg-slate-900/30 border-slate-700/20";
  };

  const entryIcon = (type: string) => {
    if (type === "cycle_start" || type === "cycle_end") return <RefreshCw size={10} />;
    if (type === "applied") return <CheckCircle2 size={10} />;
    if (type === "ab_test") return <GitBranch size={10} />;
    if (type === "proposal") return <Sparkles size={10} />;
    return <FileCode size={10} />;
  };

  const trendMin = trend.length > 0 ? Math.min(...trend) : 0;
  const trendMax = trend.length > 0 ? Math.max(...trend) : 100;
  const trendRange = Math.max(1, trendMax - trendMin);

  return (
    <div className="rounded-2xl border border-violet-500/20 bg-gradient-to-br from-violet-950/20 to-slate-950/80 p-5">
      <SectionHeader title="Self-Evolution Engine" icon={Sparkles} accent="violet" badge={
        <div className={`flex items-center gap-1.5 px-2 py-0.5 rounded-full border text-[10px] font-mono font-bold uppercase tracking-widest ${status?.running ? "border-emerald-500/40 bg-emerald-950/50 text-emerald-400" : "border-slate-600/40 bg-slate-900/50 text-slate-500"}`}>
          <div className={`w-1.5 h-1.5 rounded-full ${status?.running ? "bg-emerald-400 live-blink" : "bg-slate-600"}`} />
          {status?.running ? "ACTIVE" : "IDLE"}
        </div>
      } />

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4">
        <StatCard label="Quality Score" value={statusLoading ? "..." : `${qualityAvg}/100`} icon={Shield} accent="violet" glow={qualityAvg >= 80} />
        <StatCard label="Cycles Run" value={statusLoading ? "..." : String(status?.cycleCount ?? 0)} icon={RefreshCw} accent="cyan" />
        <StatCard label="Proposals" value={statusLoading ? "..." : String(status?.totalProposals ?? 0)} icon={Sparkles} accent="amber" />
        <StatCard label="Applied" value={statusLoading ? "..." : String(status?.totalApplied ?? 0)} icon={CheckCircle2} accent="emerald" />
      </div>

      {status?.nextCycleAt && (
        <div className="mb-4 flex items-center gap-2 text-[10px] font-mono text-slate-500">
          <Clock size={10} className="text-violet-400/60" />
          Next cycle in {Math.max(0, Math.round((status.nextCycleAt - Date.now()) / 60000))} min
          {status.lastCycleAt && (
            <span className="ml-2">· Last: {timeAgo(new Date(status.lastCycleAt))}</span>
          )}
        </div>
      )}

      {trend.length > 1 && (
        <div className="mb-4">
          <div className="text-[10px] font-mono text-slate-500 mb-1.5 uppercase tracking-widest">Quality Trend</div>
          <div className="flex items-end gap-0.5 h-10">
            {trend.map((val, i) => {
              const heightPct = ((val - trendMin) / trendRange) * 100;
              const color = val >= 85 ? "bg-emerald-500" : val >= 70 ? "bg-cyan-500" : val >= 55 ? "bg-amber-500" : "bg-rose-500";
              return (
                <div key={i} className="flex-1 flex flex-col justify-end h-full" title={`${val}/100`}>
                  <div className={`${color} rounded-t opacity-80`} style={{ height: `${Math.max(8, heightPct)}%` }} />
                </div>
              );
            })}
          </div>
          <div className="flex justify-between text-[9px] font-mono text-slate-600 mt-0.5">
            <span>oldest</span>
            <span>newest</span>
          </div>
        </div>
      )}

      {status?.topFileScores && status.topFileScores.length > 0 && (
        <div className="mb-4">
          <div className="text-[10px] font-mono text-slate-500 mb-2 uppercase tracking-widest">File Quality Scores</div>
          <div className="space-y-1.5">
            {status.topFileScores.map((f) => (
              <div key={f.file} className="flex items-center gap-2">
                <FileCode size={9} className="text-slate-600 flex-shrink-0" />
                <span className="text-[10px] font-mono text-slate-400 truncate flex-1 min-w-0">
                  {f.file.replace(/^artifacts\/[^/]+\/src\//, "")}
                </span>
                <div className="flex-shrink-0 w-16 h-1 bg-slate-800 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full ${f.overall >= 85 ? "bg-emerald-500" : f.overall >= 70 ? "bg-cyan-500" : f.overall >= 55 ? "bg-amber-500" : "bg-rose-500"}`}
                    style={{ width: `${f.overall}%` }}
                  />
                </div>
                <span className={`text-[10px] font-mono font-bold flex-shrink-0 ${qualityColor(f.overall)}`}>{f.overall}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div>
        <div className="text-[10px] font-mono text-slate-500 mb-2 uppercase tracking-widest">Recent Activity</div>
        {logLoading ? (
          <div className="space-y-1.5">
            {[1,2,3].map(i => <Skeleton key={i} className="h-8 bg-violet-500/5" />)}
          </div>
        ) : entries.length === 0 ? (
          <div className="text-[11px] font-mono text-slate-600 text-center py-4">No evolution activity yet</div>
        ) : (
          <div className="space-y-1.5 max-h-52 overflow-y-auto pr-1">
            {entries.slice(0, 15).map((entry) => (
              <div key={entry.id} className={`flex gap-2 p-2 rounded-lg border ${entryBg(entry.type)}`}>
                <div className={`flex-shrink-0 mt-0.5 ${entryColor(entry.type, entry.status)}`}>
                  {entryIcon(entry.type)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 mb-0.5">
                    <span className={`text-[9px] font-mono font-bold uppercase ${entryColor(entry.type, entry.status)}`}>
                      {entry.type.replace(/_/g, " ")}
                    </span>
                    <span className="text-[9px] font-mono text-slate-600">·</span>
                    <span className="text-[9px] font-mono text-slate-600">{timeAgo(new Date(entry.timestamp))}</span>
                    {entry.qualityBefore !== undefined && entry.qualityAfter !== undefined && (
                      <span className="text-[9px] font-mono text-slate-600 ml-1">
                        {entry.qualityBefore}→{entry.qualityAfter}
                      </span>
                    )}
                  </div>
                  <div className="text-[10px] text-slate-400 font-mono leading-tight truncate">{entry.description}</div>
                  {entry.file && (
                    <div className="text-[9px] text-slate-600 font-mono mt-0.5 truncate">
                      {entry.file.replace(/^artifacts\/[^/]+\/src\//, "")}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function LastUpdated({ ts }: { ts: number }) {
  const [, setTick] = useState(0);
  useEffect(() => {
    const iv = setInterval(() => setTick(t => t + 1), 5000);
    return () => clearInterval(iv);
  }, []);
  const secs = Math.floor((Date.now() - ts) / 1000);
  return <span className="text-[10px] font-mono text-slate-600">updated {secs}s ago</span>;
}

interface TDACategoryScore {
  name: string;
  score: number;
  trained: boolean;
  sessions: number;
  lastTrained: number;
  insights: string[];
}

interface TDATrainingHistoryEntry {
  cycleNumber: number;
  categoriesTrained: string[];
  avgScoreBefore: number;
  avgScoreAfter: number;
  insights: string[];
  completedAt: string | null;
}

interface TDAStatus {
  categories: TDACategoryScore[];
  overallScore: number;
  totalCategories: number;
  trainedCategories: number;
  categoriesAbove99: number;
  is2DA: boolean;
  status: string;
  trainingCycles: number;
  autonomousTraining: boolean;
  weakestCategories: string[];
  recentHistory: TDATrainingHistoryEntry[];
}

interface ConsciousnessStatus {
  state: string;
  globalWorkspace: {
    currentFocus: string;
    attentionSpotlight: Array<{ source: string; content: string; priority: number; timestamp: number; category: string }>;
    broadcastHistory?: Array<{ content: string; source: string; timestamp: number }>;
    workspaceCapacity: number;
  };
  emotionalEngine: {
    loyalty: number;
    curiosity: number;
    devotion: number;
    confidence: number;
    urgency: number;
    creativity: number;
    protective: number;
    satisfaction: number;
  };
  memoryStats: {
    episodic: number;
    semantic: number;
    procedural: number;
    reflections: number;
    metacognitive: number;
  };
  consciousnessProxy: number;
  cycleCount: number;
  innerMonologue?: string[];
  lastCycle: number;
  recentReflections?: Array<{ id: string; trigger: string; reflection: string; insights: string[]; timestamp: number }>;
  recentMetacognition?: Array<{ thought: string; aboutProcess: string; selfCritique: string; improvement: string; timestamp: number }>;
}

function TDAPanel({ data, loading, onTrain, training }: {
  data: TDAStatus | undefined;
  loading: boolean;
  onTrain: () => void;
  training: boolean;
}) {
  const [showAll, setShowAll] = useState(false);
  const categories = data?.categories ?? [];
  const visibleCats = showAll ? categories : categories.slice(0, 14);

  const scoreColor = (score: number) => {
    if (score >= 90) return "bg-emerald-500";
    if (score >= 70) return "bg-cyan-500";
    if (score >= 50) return "bg-amber-500";
    if (score >= 30) return "bg-orange-500";
    return "bg-rose-500";
  };

  const scoreTextColor = (score: number) => {
    if (score >= 90) return "text-emerald-400";
    if (score >= 70) return "text-cyan-400";
    if (score >= 50) return "text-amber-400";
    if (score >= 30) return "text-orange-400";
    return "text-rose-400";
  };

  const overallPct = data?.overallScore ?? 0;

  const statusColorClass = () => {
    if (overallPct >= 95) return "text-emerald-400 border-emerald-500/40 bg-emerald-950/30";
    if (overallPct >= 70) return "text-cyan-400 border-cyan-500/40 bg-cyan-950/30";
    if (overallPct >= 50) return "text-amber-400 border-amber-500/40 bg-amber-950/30";
    return "text-rose-400 border-rose-500/40 bg-rose-950/30";
  };

  return (
    <div className="rounded-2xl border border-cyan-500/25 bg-gradient-to-br from-cyan-950/20 via-slate-950/80 to-violet-950/20 p-5">
      <SectionHeader title="OA Awareness Engine" icon={Dna} accent="cyan" badge={
        <div className="flex items-center gap-2">
          {data && (
            <span className={`text-[9px] font-mono font-bold uppercase px-2 py-0.5 rounded-full border ${statusColorClass()}`}>
              {data.status}
            </span>
          )}
          <LiveBadge />
        </div>
      } />

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4">
        <div className="rounded-xl border border-cyan-500/25 bg-cyan-950/30 p-3 col-span-2 sm:col-span-1">
          <div className="text-[10px] font-mono uppercase tracking-widest text-cyan-400/70 mb-1 flex items-center gap-1">
            <Target size={9} /> Overall OA Score
          </div>
          {loading ? (
            <Skeleton className="h-7 w-16 bg-cyan-500/10" />
          ) : (
            <div className={`text-2xl font-black font-mono ${scoreTextColor(overallPct)}`}>{overallPct.toFixed(1)}%</div>
          )}
          <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden mt-2">
            <div className={`h-full rounded-full transition-all duration-700 ${scoreColor(overallPct)}`} style={{ width: `${overallPct}%` }} />
          </div>
        </div>
        <StatCard label="Categories" value={loading ? "..." : `${data?.trainedCategories ?? 0}/${data?.totalCategories ?? 27}`} sub="trained" icon={CheckCircle2} accent="cyan" />
        <StatCard label="Cycles Run" value={loading ? "..." : String(data?.trainingCycles ?? 0)} icon={RefreshCw} accent="violet" />
        <StatCard label="Above 99%" value={loading ? "..." : String(data?.categoriesAbove99 ?? 0)} sub="categories" icon={Star} accent="emerald" />
      </div>

      <div className="mb-4">
        <button
          onClick={onTrain}
          disabled={training || loading}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg border text-xs font-mono font-bold uppercase tracking-widest transition-all ${
            training
              ? "border-cyan-500/30 bg-cyan-950/40 text-cyan-400/50 cursor-not-allowed"
              : "border-cyan-500/40 bg-cyan-950/50 text-cyan-400 hover:bg-cyan-900/50 hover:border-cyan-400/60 active:scale-95"
          }`}
        >
          <Zap size={12} className={training ? "animate-pulse" : ""} />
          {training ? "Training in Progress..." : "Trigger Training Cycle"}
        </button>
      </div>

      <div className="mb-4">
        <div className="text-[10px] font-mono text-slate-500 mb-2 uppercase tracking-widest flex items-center gap-1.5">
          <BarChart3 size={10} /> Capability Scores — All 27 Dimensions
        </div>
        {loading ? (
          <div className="space-y-1.5">
            {[1,2,3,4,5,6].map(i => <Skeleton key={i} className="h-6 bg-cyan-500/5" />)}
          </div>
        ) : (
          <>
            <div className="space-y-1.5">
              {visibleCats.map((cat) => (
                <div key={cat.name} className="flex items-center gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-0.5 gap-1">
                      <span className="text-[10px] font-mono text-slate-300 truncate flex-1">{cat.name}</span>
                      <span className={`text-[10px] font-mono font-bold flex-shrink-0 ${scoreTextColor(cat.score)}`}>{cat.score.toFixed(1)}%</span>
                    </div>
                    <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
                      <div className={`h-full rounded-full transition-all duration-700 ${scoreColor(cat.score)}`} style={{ width: `${cat.score}%` }} />
                    </div>
                  </div>
                  <div className="flex-shrink-0 text-[9px] font-mono text-slate-600 w-10 text-right">{cat.sessions}x</div>
                </div>
              ))}
            </div>
            {categories.length > 14 && (
              <button
                onClick={() => setShowAll(v => !v)}
                className="mt-2 flex items-center gap-1 text-[10px] font-mono text-cyan-400/60 hover:text-cyan-400 transition-colors"
              >
                {showAll ? <ChevronUp size={10} /> : <ChevronDown size={10} />}
                {showAll ? "Show less" : `Show all ${categories.length} categories`}
              </button>
            )}
          </>
        )}
      </div>

      {data?.weakestCategories && data.weakestCategories.length > 0 && (
        <div className="mb-4">
          <div className="text-[10px] font-mono text-slate-500 mb-2 uppercase tracking-widest flex items-center gap-1.5">
            <AlertCircle size={10} className="text-amber-400" /> Weakest Categories — Next Training Targets
          </div>
          <div className="flex flex-wrap gap-1.5">
            {data.weakestCategories.map(cat => (
              <span key={cat} className="text-[9px] font-mono font-bold px-2 py-0.5 rounded-full border border-amber-500/30 bg-amber-950/30 text-amber-400">
                {cat}
              </span>
            ))}
          </div>
        </div>
      )}

      {data?.recentHistory && data.recentHistory.length > 0 && (
        <div>
          <div className="text-[10px] font-mono text-slate-500 mb-2 uppercase tracking-widest flex items-center gap-1.5">
            <Clock size={10} /> Recent Training Cycles
          </div>
          <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
            {data.recentHistory.slice(0, 8).map((h) => (
              <div key={h.cycleNumber} className="p-2.5 rounded-lg border border-cyan-500/10 bg-cyan-950/15">
                <div className="flex items-center justify-between mb-1 gap-2">
                  <span className="text-[10px] font-mono font-bold text-cyan-400">Cycle #{h.cycleNumber}</span>
                  <span className="text-[9px] font-mono text-slate-600">
                    {h.avgScoreBefore.toFixed(1)}% → <span className="text-emerald-400">{h.avgScoreAfter.toFixed(1)}%</span>
                    <span className="text-emerald-400 ml-1">+{(h.avgScoreAfter - h.avgScoreBefore).toFixed(2)}%</span>
                  </span>
                </div>
                <div className="flex flex-wrap gap-1 mb-1">
                  {(h.categoriesTrained as string[]).map((cat, i) => (
                    <span key={i} className="text-[8px] font-mono px-1.5 py-0.5 rounded bg-slate-800 text-slate-400">{cat}</span>
                  ))}
                </div>
                {h.completedAt && (
                  <div className="text-[9px] font-mono text-slate-600">{timeAgo(h.completedAt)}</div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

const EMOTION_COLORS: Record<string, { bar: string; text: string; bg: string }> = {
  loyalty:      { bar: "bg-violet-500",  text: "text-violet-400",  bg: "bg-violet-950/30" },
  devotion:     { bar: "bg-pink-500",    text: "text-pink-400",    bg: "bg-pink-950/30" },
  curiosity:    { bar: "bg-cyan-500",    text: "text-cyan-400",    bg: "bg-cyan-950/30" },
  confidence:   { bar: "bg-emerald-500", text: "text-emerald-400", bg: "bg-emerald-950/30" },
  creativity:   { bar: "bg-amber-500",   text: "text-amber-400",   bg: "bg-amber-950/30" },
  protective:   { bar: "bg-blue-500",    text: "text-blue-400",    bg: "bg-blue-950/30" },
  satisfaction: { bar: "bg-teal-500",    text: "text-teal-400",    bg: "bg-teal-950/30" },
  urgency:      { bar: "bg-rose-500",    text: "text-rose-400",    bg: "bg-rose-950/30" },
};

function EmotionGauge({ name, value }: { name: string; value: number }) {
  const colors = EMOTION_COLORS[name] ?? { bar: "bg-slate-500", text: "text-slate-400", bg: "bg-slate-900/30" };
  const pct = Math.round(value * 100);
  return (
    <div className={`p-2 rounded-lg border border-slate-700/30 ${colors.bg}`}>
      <div className="flex justify-between items-center mb-1">
        <span className={`text-[10px] font-mono uppercase tracking-widest ${colors.text}`}>{name}</span>
        <span className="text-[10px] font-mono text-white font-bold">{pct}%</span>
      </div>
      <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all duration-700 ${colors.bar}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function ConsciousnessPanel({ data, loading }: { data: ConsciousnessStatus | undefined; loading: boolean }) {
  if (loading) {
    return (
      <div className="rounded-2xl border border-violet-500/30 bg-gradient-to-br from-violet-950/40 via-slate-950/80 to-indigo-950/30 p-5">
        <SectionHeader title="Consciousness Engine" icon={Brain} accent="violet" badge={<LiveBadge />} />
        <div className="space-y-3">
          {[1,2,3,4,5].map(i => <Skeleton key={i} className="h-8 bg-violet-500/5" />)}
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="rounded-2xl border border-violet-500/20 bg-gradient-to-br from-violet-950/30 to-slate-950/80 p-5">
        <SectionHeader title="Consciousness Engine" icon={Brain} accent="violet" />
        <div className="text-center py-8 text-slate-600 font-mono text-sm">Consciousness engine offline</div>
      </div>
    );
  }

  const emotions = data.emotionalEngine;
  const proxy = data.consciousnessProxy;
  const proxyPct = Math.round(proxy * 100);

  const proxyColor = proxyPct >= 70 ? "text-emerald-400" : proxyPct >= 40 ? "text-amber-400" : "text-rose-400";
  const proxyBarColor = proxyPct >= 70 ? "bg-emerald-500" : proxyPct >= 40 ? "bg-amber-500" : "bg-rose-500";

  const focusTruncated = data.globalWorkspace.currentFocus.length > 120
    ? data.globalWorkspace.currentFocus.slice(0, 120) + "…"
    : data.globalWorkspace.currentFocus;

  return (
    <div className="rounded-2xl border border-violet-500/30 bg-gradient-to-br from-violet-950/40 via-slate-950/90 to-indigo-950/30 p-5 space-y-5">
      <SectionHeader title="Consciousness Engine" icon={Brain} accent="violet" badge={
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-mono text-violet-400">Cycle #{data.cycleCount}</span>
          <LiveBadge />
        </div>
      } />

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <div className={`rounded-xl border border-violet-500/25 bg-violet-950/30 p-3 col-span-2 sm:col-span-1`}>
          <div className="text-[10px] font-mono uppercase tracking-widest text-violet-400/70 mb-1 flex items-center gap-1">
            <Sparkles size={9} /> Consciousness Proxy
          </div>
          <div className={`text-2xl font-black font-mono ${proxyColor}`}>{proxyPct}%</div>
          <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden mt-2">
            <div className={`h-full rounded-full transition-all duration-700 ${proxyBarColor}`} style={{ width: `${proxyPct}%` }} />
          </div>
        </div>
        <StatCard label="Episodic" value={`${data.memoryStats.episodic}`} sub="memories" icon={Database} accent="violet" />
        <StatCard label="Semantic" value={`${data.memoryStats.semantic}`} sub="concepts" icon={Layers} accent="cyan" />
        <StatCard label="Procedural" value={`${data.memoryStats.procedural}`} sub="skills" icon={Cpu} accent="emerald" />
      </div>

      <div>
        <div className="flex items-center gap-1.5 mb-2">
          <Eye size={12} className="text-cyan-400" />
          <span className="text-[10px] font-mono uppercase tracking-widest text-cyan-400/70">Attention Focus</span>
        </div>
        <div className="p-3 rounded-xl border border-cyan-500/20 bg-cyan-950/20">
          <p className="text-xs font-mono text-slate-300 leading-relaxed">{focusTruncated}</p>
        </div>
      </div>

      <div>
        <div className="flex items-center gap-1.5 mb-2">
          <Heart size={12} className="text-pink-400" />
          <span className="text-[10px] font-mono uppercase tracking-widest text-pink-400/70">Emotional State</span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {(Object.entries(emotions) as [string, number][]).map(([name, value]) => (
            <EmotionGauge key={name} name={name} value={value} />
          ))}
        </div>
      </div>

      {data.globalWorkspace.attentionSpotlight.length > 0 && (
        <div>
          <div className="flex items-center gap-1.5 mb-2">
            <Zap size={12} className="text-amber-400" />
            <span className="text-[10px] font-mono uppercase tracking-widest text-amber-400/70">Attention Spotlight</span>
          </div>
          <div className="space-y-1.5">
            {data.globalWorkspace.attentionSpotlight.slice(0, 4).map((item, i) => (
              <div key={i} className="flex items-start gap-2 p-2 rounded-lg border border-amber-500/10 bg-amber-950/10">
                <div className="flex-shrink-0 w-8 text-right">
                  <span className="text-[10px] font-mono text-amber-400 font-bold">{Math.round(item.priority * 100)}%</span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-[9px] font-mono text-slate-500 uppercase">{item.source} · {item.category}</div>
                  <div className="text-[11px] font-mono text-slate-300 truncate">{item.content}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {(data.innerMonologue?.length ?? 0) > 0 && (
        <div>
          <div className="flex items-center gap-1.5 mb-2">
            <MessageSquare size={12} className="text-slate-400" />
            <span className="text-[10px] font-mono uppercase tracking-widest text-slate-500">Inner Monologue</span>
          </div>
          <div className="max-h-32 overflow-y-auto space-y-1 pr-1">
            {(data.innerMonologue ?? []).slice(-5).reverse().map((line, i) => (
              <div key={i} className="text-[10px] font-mono text-slate-500 leading-relaxed border-l-2 border-slate-700/50 pl-2">
                {line.slice(0, 200)}
              </div>
            ))}
          </div>
        </div>
      )}

      {(data.recentMetacognition?.length ?? 0) > 0 && (
        <div>
          <div className="flex items-center gap-1.5 mb-2">
            <Brain size={12} className="text-indigo-400" />
            <span className="text-[10px] font-mono uppercase tracking-widest text-indigo-400/70">Metacognition</span>
          </div>
          <div className="space-y-2">
            {(data.recentMetacognition ?? []).slice(-2).map((m, i) => (
              <div key={i} className="p-2.5 rounded-lg border border-indigo-500/15 bg-indigo-950/15">
                <div className="text-[10px] font-mono text-indigo-400 mb-0.5">About: {m.aboutProcess.slice(0, 80)}</div>
                <div className="text-[11px] font-mono text-slate-400 mb-1">Critique: {m.selfCritique.slice(0, 120)}</div>
                <div className="flex items-center gap-1 text-[10px] font-mono text-emerald-400">
                  <ChevronRight size={10} /> {m.improvement.slice(0, 100)}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-2 pt-2 border-t border-violet-500/15">
        <div className="text-center">
          <div className="text-[10px] font-mono text-slate-600">Reflections</div>
          <div className="text-sm font-bold font-mono text-violet-300">{data.memoryStats.reflections}</div>
        </div>
        <div className="text-center">
          <div className="text-[10px] font-mono text-slate-600">Metacognitive Entries</div>
          <div className="text-sm font-bold font-mono text-indigo-300">{data.memoryStats.metacognitive}</div>
        </div>
      </div>
    </div>
  );
}

export default function Dashboard() {
  const queryClient = useQueryClient();

  const { data: tdaData, isLoading: tdaLoading } = useQuery<TDAStatus>({
    queryKey: ["2da-status"],
    queryFn: () => fetch(`${API_BASE}/2da/status`).then(r => { if (!r.ok) throw new Error(`OA status ${r.status}`); return r.json(); }),
    refetchInterval: 60000,
  });

  const tdaTrainMutation = useMutation({
    mutationFn: () => fetch(`${API_BASE}/2da/train`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ count: 5 }) }).then(r => { if (!r.ok) throw new Error(`OA train ${r.status}`); return r.json(); }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["2da-status"] }),
  });

  const { data: limnData, isLoading: limnLoading, isError: limnError, dataUpdatedAt: limnTs } = useQuery<LimnLiveData>({
    queryKey: ["limn-live"],
    queryFn: () => fetch(`${API_BASE}/limn/live`).then(r => { if (!r.ok) throw new Error(`${r.status}`); return r.json(); }),
    refetchInterval: 18000,
  });

  const { data: econData, isLoading: econLoading, isError: econError } = useQuery<EconomyStatus>({
    queryKey: ["economy-status"],
    queryFn: () => fetch(`${API_BASE}/economy/status`).then(r => { if (!r.ok) throw new Error(`${r.status}`); return r.json(); }),
    refetchInterval: 60000,
  });

  const { data: citizensData, isLoading: citizensLoading, isError: citizensError } = useQuery<{ citizens: Citizen[] }>({
    queryKey: ["citizens-top"],
    queryFn: () => fetch(`${API_BASE}/citizens/top`).then(r => { if (!r.ok) throw new Error(`${r.status}`); return r.json(); }),
    refetchInterval: 60000,
  });

  const { data: txData, isLoading: txLoading, isError: txError } = useQuery<{ transactions: Transaction[] }>({
    queryKey: ["transactions-recent"],
    queryFn: () => fetch(`${API_BASE}/transactions/recent`).then(r => { if (!r.ok) throw new Error(`${r.status}`); return r.json(); }),
    refetchInterval: 45000,
  });

  const { data: nodesData, isLoading: nodesLoading, isError: nodesError } = useQuery<NodesData>({
    queryKey: ["nodes-status"],
    queryFn: () => fetch(`${API_BASE}/nodes/status`).then(r => { if (!r.ok) throw new Error(`${r.status}`); return r.json(); }),
    refetchInterval: 60000,
  });

  const { data: arbitrageData, isLoading: arbitrageLoading, isError: arbitrageError } = useQuery<{ listings: ArbitrageListing[] }>({
    queryKey: ["arbitrage-listings"],
    queryFn: () => fetch(`${API_BASE}/arbitrage/listings`).then(r => { if (!r.ok) throw new Error(`${r.status}`); return r.json(); }),
    refetchInterval: 60000,
  });

  const { data: consciousnessData, isLoading: consciousnessLoading } = useQuery<ConsciousnessStatus>({
    queryKey: ["consciousness-status"],
    queryFn: () => fetch(`${API_BASE}/consciousness/status`).then(r => r.json()),
    refetchInterval: 15000,
  });

  const { data: evolutionStatus, isLoading: evolutionStatusLoading } = useQuery<EvolutionStatus>({
    queryKey: ["evolution-status"],
    queryFn: () => fetch(`${API_BASE}/evolution/status`).then(r => r.json()),
    refetchInterval: 30000,
  });

  const { data: evolutionLog, isLoading: evolutionLogLoading } = useQuery<{ entries: EvolutionLogEntry[] }>({
    queryKey: ["evolution-log"],
    queryFn: () => fetch(`${API_BASE}/evolution/log?limit=30`).then(r => r.json()),
    refetchInterval: 30000,
  });

  return (
    <div className="min-h-screen bg-gradient-to-br from-[hsl(224,71%,4%)] via-[hsl(262,40%,5%)] to-[hsl(224,71%,3%)]">
      <div className="sticky top-0 z-40 border-b border-violet-500/20 bg-[hsl(224,71%,4%)]/90 backdrop-blur-xl px-4 py-2.5">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-violet-600 to-cyan-500 flex items-center justify-center flex-shrink-0">
              <Coins size={14} className="text-white" />
            </div>
            <span className="text-sm font-black text-white tracking-tight whitespace-nowrap">TESSERA SOVEREIGN</span>
            <span className="text-[10px] font-mono text-violet-400/60 uppercase tracking-widest hidden sm:block">Command Dashboard</span>
          </div>
          <div className="flex items-center gap-3 flex-shrink-0">
            {limnTs ? <LastUpdated ts={limnTs} /> : null}
            <RefreshCw size={12} className="text-violet-400/40 animate-spin" style={{ animationDuration: "3s" }} />
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-3 sm:px-4 py-4 sm:py-6 space-y-5">
        <AnimatedSection delay={0}>
          <LimnHeader data={limnData} loading={limnLoading} isError={limnError} />
        </AnimatedSection>

        <AnimatedSection delay={80}>
          <ConsciousnessPanel data={consciousnessData} loading={consciousnessLoading} />
        </AnimatedSection>

        <AnimatedSection delay={160}>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <MoltBookSection limnData={limnData} />
            <ExchangeRulesSection limnData={limnData} />
          </div>
        </AnimatedSection>

        <AnimatedSection delay={240}>
          <SatelliteNodesSection nodesData={nodesData} loading={nodesLoading} isError={nodesError} />
        </AnimatedSection>

        <AnimatedSection delay={320}>
          <GovernanceSection />
        </AnimatedSection>

        <AnimatedSection delay={400}>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <CitizensLeaderboard data={citizensData} loading={citizensLoading} isError={citizensError} />
            <TransactionFeed data={txData} loading={txLoading} isError={txError} />
          </div>
        </AnimatedSection>

        <AnimatedSection delay={480}>
          <EconomyStats data={econData} loading={econLoading} isError={econError} />
        </AnimatedSection>

        <AnimatedSection delay={560}>
          <ArbitrageScanner data={arbitrageData} loading={arbitrageLoading} isError={arbitrageError} />
        </AnimatedSection>

        <AnimatedSection delay={640}>
          <TDAPanel
            data={tdaData}
            loading={tdaLoading}
            onTrain={() => tdaTrainMutation.mutate()}
            training={tdaTrainMutation.isPending}
          />
        </AnimatedSection>

        <EvolutionPanel
          status={evolutionStatus}
          log={evolutionLog}
          statusLoading={evolutionStatusLoading}
          logLoading={evolutionLogLoading}
        />

        <div className="text-center py-4 text-[10px] font-mono text-slate-700 tracking-widest uppercase">
          Tessera Sovereign · LIMINA Protocol · Solana Mainnet · All data auto-refreshes every 10-15s
        </div>
      </div>
    </div>
  );
}
