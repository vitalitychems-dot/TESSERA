import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import {
  AreaChart, Area, LineChart, Line, BarChart, Bar,
  XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from "@/lib/sovereign-charts";
import {
  Coins, Flame, TrendingUp, Users, Shield, Bot,
  DollarSign, ChevronDown, ChevronUp, Activity,
  Lock, AlertTriangle, CheckCircle, Vote, Layers,
  Globe, Zap, ArrowRightLeft, BarChart3,
} from "lucide-react";

function fmt(n: number, d = 2): string {
  if (n >= 1e12) return `${(n / 1e12).toFixed(d)}T`;
  if (n >= 1e9) return `${(n / 1e9).toFixed(d)}B`;
  if (n >= 1e6) return `${(n / 1e6).toFixed(d)}M`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(d)}K`;
  return n.toFixed(d);
}

function fmtPrice(n: number): string {
  if (n < 0.0001) return `$${n.toExponential(4)}`;
  return `$${n.toFixed(6)}`;
}

function Stat({ label, value, sub, icon: Icon, color }: { label: string; value: string; sub?: string; icon: any; color: string }) {
  return (
    <div className={`rounded-lg border p-3 ${color}`} data-testid={`stat-${label.toLowerCase().replace(/\s+/g, "-")}`}>
      <div className="flex items-center gap-1.5 mb-1">
        <Icon size={12} className="opacity-60" />
        <span className="text-[10px] font-mono uppercase tracking-wider text-gray-400">{label}</span>
      </div>
      <div className="text-base font-bold font-mono text-white leading-tight">{value}</div>
      {sub && <div className="text-[9px] text-gray-500 mt-0.5">{sub}</div>}
    </div>
  );
}

function Section({ title, icon: Icon, color, children, defaultOpen = true }: { title: string; icon: any; color: string; children: React.ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border border-white/5 rounded-xl overflow-hidden bg-black/20" data-testid={`section-${title.toLowerCase().replace(/\s+/g, "-")}`}>
      <button
        onClick={() => setOpen(!open)}
        className={`w-full flex items-center justify-between p-3 hover:bg-white/5 transition-colors ${color}`}
        data-testid={`toggle-${title.toLowerCase().replace(/\s+/g, "-")}`}
      >
        <div className="flex items-center gap-2">
          <Icon size={16} />
          <span className="font-semibold text-sm">{title}</span>
        </div>
        {open ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="p-3 space-y-3">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function VerdictBadge({ verdict }: { verdict: string }) {
  const config = verdict === "PASS"
    ? { bg: "bg-emerald-500/20 border-emerald-500/40 text-emerald-400", icon: CheckCircle }
    : verdict === "CAUTION"
    ? { bg: "bg-yellow-500/20 border-yellow-500/40 text-yellow-400", icon: AlertTriangle }
    : { bg: "bg-red-500/20 border-red-500/40 text-red-400", icon: AlertTriangle };
  const Icon = config.icon;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[10px] font-bold ${config.bg}`}>
      <Icon size={10} /> {verdict}
    </span>
  );
}

export default function TokenEconomyPage({ embedded }: { embedded?: boolean }) {
  useEffect(() => { document.title = "3-Tier Token Economy | Tessera"; }, []);

  const { data: overview, isLoading } = useQuery<any>({
    queryKey: ["/api/token-economy/overview"],
    refetchInterval: 15000,
  });

  if (isLoading || !overview) {
    return (
      <div className="flex items-center justify-center h-full min-h-[400px]">
        <div className="flex items-center gap-3 text-gray-400">
          <Activity size={20} className="animate-spin" />
          <span className="font-mono text-sm">Loading 3-Tier Economy...</span>
        </div>
      </div>
    );
  }

  const { tier1: tsov, tier2: tsrx, tier3: investor, bridge, simulations, councilReport } = overview;

  const tsovChartData = (tsov?.supplyHistory || []).map((h: any, i: number) => ({
    name: i,
    supply: h.supply,
    burned: h.burned,
    minted: h.minted,
  }));

  const tsrxChartData = (tsrx?.priceHistory || []).map((h: any, i: number) => ({
    name: i,
    price: h.price * 1e6,
    volume: h.volume,
  }));

  const dividendChartData = (investor?.dividendHistory || []).length > 0
    ? investor.dividendHistory.map((h: any, i: number) => ({
        name: `Q${i + 1}`,
        paid: h.totalPaid,
        perShare: h.perSharePaid * 1e6,
        recipients: h.recipients,
      }))
    : [
        { name: "Q1", paid: 0, perShare: 0, recipients: 0 },
        { name: "Q2 (next)", paid: investor?.dividendPool || 0, perShare: 0, recipients: investor?.investorCount || 0 },
      ];

  return (
    <div className={`${embedded ? "" : "p-4"} space-y-4 max-w-7xl mx-auto`}>
      <div className="flex items-center gap-3 mb-2">
        <Layers size={20} className="text-violet-400" />
        <h1 className="text-lg font-bold text-white" data-testid="page-title">3-Tier Token Economy</h1>
        <span className="text-[10px] font-mono text-gray-500 bg-white/5 px-2 py-0.5 rounded-full">TSOV → TSRX → Investor</span>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        <Stat label="TSOV Supply" value={fmt(tsov?.circulatingSupply || 0)} icon={Coins} color="border-cyan-500/20 bg-cyan-500/5" sub={`Burned: ${fmt(tsov?.burned || 0)}`} />
        <Stat label="TSRX Price" value={fmtPrice(tsrx?.priceUSD || 0)} icon={TrendingUp} color="border-violet-500/20 bg-violet-500/5" sub={`MC: $${fmt(tsrx?.marketCap || 0)}`} />
        <Stat label="Investor Shares" value={fmt(investor?.outstandingShares || 0)} icon={DollarSign} color="border-emerald-500/20 bg-emerald-500/5" sub={`Yield: ${investor?.dividendYieldPercent || 0}% APY`} />
        <Stat label="Bridge Rate" value={`1:${bridge?.tsovToTsrxRate?.toFixed(4) || "?"}`} icon={ArrowRightLeft} color="border-orange-500/20 bg-orange-500/5" sub={`Tax: ${((bridge?.totalTax || 0) * 100).toFixed(0)}%`} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        <Section title="Tier 1: TSOV (Off-Chain AI Economy)" icon={Coins} color="text-cyan-400">
          <div className="grid grid-cols-2 gap-2">
            <Stat label="Births/Day" value={fmt(tsov?.populationBirthsPerDay || 0, 0)} icon={Users} color="border-green-500/10 bg-green-500/5" />
            <Stat label="Deaths/Day" value={fmt(tsov?.populationDeathsPerDay || 0, 0)} icon={Flame} color="border-red-500/10 bg-red-500/5" />
            <Stat label="Halvings" value={`${tsov?.halvingCount || 0}`} icon={Zap} color="border-yellow-500/10 bg-yellow-500/5" sub={`Multiplier: ${tsov?.currentHalvingMultiplier?.toFixed(3) || "1"}`} />
            <Stat label="US Debt" value={`$${(tsov?.usDebtTrillions || 0).toFixed(1)}T`} icon={Globe} color="border-blue-500/10 bg-blue-500/5" sub={`Decrease: ${(tsov?.debtDecreasePercent || 0).toFixed(3)}%`} />
          </div>
          <div className="bg-black/30 rounded-lg p-2" data-testid="chart-tsov-supply">
            <div className="text-[10px] font-mono text-gray-500 mb-1">TSOV Supply & Burn History</div>
            <ResponsiveContainer width="100%" height={140}>
              <AreaChart data={tsovChartData}>
                <defs>
                  <linearGradient id="tsovSupply" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#06b6d4" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="tsovBurned" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="name" hide />
                <YAxis hide />
                <Tooltip
                  contentStyle={{ background: "#111", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, fontSize: 11, fontFamily: "monospace" }}
                  labelStyle={{ display: "none" }}
                  formatter={(val: number, name: string) => [fmt(val, 0), name]}
                />
                <Area type="monotone" dataKey="supply" stroke="#06b6d4" fill="url(#tsovSupply)" strokeWidth={1.5} />
                <Area type="monotone" dataKey="burned" stroke="#ef4444" fill="url(#tsovBurned)" strokeWidth={1.5} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          <div className="text-[10px] font-mono text-gray-500 space-y-0.5">
            <div>Tax: {((tsov?.taxRate || 0) * 100).toFixed(0)}% | Father Tribute: {((tsov?.fatherTributeRate || 0) * 100).toFixed(0)}%</div>
            <div>Wallets: {tsov?.walletCount || 0} | Emission Rate: {tsov?.emissionRate || 0}/cycle</div>
          </div>
        </Section>

        <Section title="Tier 2: TSRX (On-Chain Controlled)" icon={Shield} color="text-violet-400">
          <div className="grid grid-cols-2 gap-2">
            <Stat label="Circulating" value={fmt(tsrx?.circulatingSupply || 0)} icon={Coins} color="border-violet-500/10 bg-violet-500/5" />
            <Stat label="Burned" value={fmt(tsrx?.burnedSupply || 0)} icon={Flame} color="border-red-500/10 bg-red-500/5" />
            <Stat label="Locked" value={fmt(tsrx?.lockedSupply || 0)} icon={Lock} color="border-blue-500/10 bg-blue-500/5" sub={`${tsrx?.liquidityLockDuration || 0} days`} />
            <Stat label="Holders" value={`${tsrx?.holders || 0}`} icon={Users} color="border-green-500/10 bg-green-500/5" />
          </div>
          <div className="bg-black/30 rounded-lg p-2" data-testid="chart-tsrx-price">
            <div className="text-[10px] font-mono text-gray-500 mb-1">TSRX Price (×10⁶ USD)</div>
            <ResponsiveContainer width="100%" height={140}>
              <LineChart data={tsrxChartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="name" hide />
                <YAxis hide />
                <Tooltip
                  contentStyle={{ background: "#111", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, fontSize: 11, fontFamily: "monospace" }}
                  labelStyle={{ display: "none" }}
                  formatter={(val: number, name: string) => [val.toFixed(4), name]}
                />
                <Line type="monotone" dataKey="price" stroke="#8b5cf6" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <div className="space-y-1.5">
            <div className="text-[10px] font-mono text-violet-400 font-bold">Bot Status</div>
            <div className="grid grid-cols-2 gap-1">
              {[
                { name: "Buy-Back", on: tsrx?.botConfig?.buyBackEnabled, val: `${tsrx?.botConfig?.buyBackSOLPerCycle} SOL/cycle` },
                { name: "Snipe", on: tsrx?.botConfig?.snipeBotEnabled, val: `${tsrx?.botConfig?.snipeBotMaxSlippage}% slip` },
                { name: "Volume", on: tsrx?.botConfig?.volumeBotEnabled, val: `${tsrx?.botConfig?.volumeBotTradesPerHour}/hr` },
                { name: "Burn", on: tsrx?.botConfig?.burnBotEnabled, val: `${tsrx?.botConfig?.burnBotPercentPerTx}%/tx` },
                { name: "Scanner", on: tsrx?.botConfig?.scannerEnabled, val: "active" },
                { name: "Short", on: tsrx?.botConfig?.shortBotEnabled, val: `${tsrx?.botConfig?.shortBotThreshold}% trigger` },
              ].map(b => (
                <div key={b.name} className="flex items-center gap-1 text-[9px] font-mono" data-testid={`bot-${b.name.toLowerCase()}`}>
                  <div className={`w-1.5 h-1.5 rounded-full ${b.on ? "bg-emerald-400" : "bg-red-500"}`} />
                  <span className="text-gray-400">{b.name}:</span>
                  <span className="text-white">{b.val}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="space-y-1">
            <div className="text-[10px] font-mono text-violet-400 font-bold">Anti-Rug Protections</div>
            <div className="flex flex-wrap gap-1">
              {[
                { label: `Max Wallet ${tsrx?.antiRugProtections?.maxWalletPercent}%`, on: true },
                { label: `Max TX ${tsrx?.antiRugProtections?.maxTxPercent}%`, on: true },
                { label: `${tsrx?.antiRugProtections?.cooldownSeconds}s Cooldown`, on: true },
                { label: "Honeypot Guard", on: tsrx?.antiRugProtections?.honeypotProtection },
                { label: "LP Locked", on: tsrx?.antiRugProtections?.liquidityLocked },
                { label: "Multisig", on: tsrx?.antiRugProtections?.ownerMultisig },
              ].map(p => (
                <span key={p.label} className={`text-[8px] font-mono px-1.5 py-0.5 rounded-full border ${p.on ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400" : "border-red-500/30 bg-red-500/10 text-red-400"}`}>
                  {p.on ? "✓" : "✗"} {p.label}
                </span>
              ))}
            </div>
          </div>
          <div className="text-[10px] font-mono text-gray-500">
            Trust: {tsrx?.trustStructure?.ownerControlPercent}% owner / {tsrx?.trustStructure?.agentControlPercent}% agent / {tsrx?.trustStructure?.publicFloat}% public
          </div>
        </Section>

        <Section title="Tier 3: Investor Dividends" icon={DollarSign} color="text-emerald-400">
          <div className="grid grid-cols-2 gap-2">
            <Stat label="Share Price" value={fmtPrice(investor?.sharePrice || 0)} icon={TrendingUp} color="border-emerald-500/10 bg-emerald-500/5" />
            <Stat label="Dividend Pool" value={`$${(investor?.dividendPool || 0).toFixed(2)}`} icon={DollarSign} color="border-green-500/10 bg-green-500/5" sub={investor?.dividendFrequency} />
            <Stat label="Total Paid" value={`$${(investor?.totalDividendsPaid || 0).toFixed(2)}`} icon={Coins} color="border-blue-500/10 bg-blue-500/5" />
            <Stat label="Investors" value={`${investor?.investorCount || 0}`} icon={Users} color="border-yellow-500/10 bg-yellow-500/5" />
          </div>
          <div className="bg-black/30 rounded-lg p-2" data-testid="chart-investor-dividends">
            <div className="text-[10px] font-mono text-gray-500 mb-1">Dividend History</div>
            <ResponsiveContainer width="100%" height={140}>
              <BarChart data={dividendChartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="name" tick={{ fontSize: 9, fill: "#888" }} />
                <YAxis hide />
                <Tooltip
                  contentStyle={{ background: "#111", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, fontSize: 11, fontFamily: "monospace" }}
                  formatter={(val: number, name: string) => [val.toFixed(2), name]}
                />
                <Bar dataKey="paid" fill="#10b981" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="space-y-1.5">
            <div className="text-[10px] font-mono text-emerald-400 font-bold">Cap Table</div>
            {(investor?.capTable || []).map((row: any, i: number) => (
              <div key={i} className="flex justify-between items-center text-[9px] font-mono" data-testid={`cap-row-${i}`}>
                <span className="text-gray-400">{row.holder}</span>
                <span className="text-white">{fmt(row.shares, 0)} ({row.percent}%)</span>
              </div>
            ))}
          </div>
          <div className="space-y-1">
            <div className="text-[10px] font-mono text-emerald-400 font-bold">Anti-Takeover</div>
            <div className="flex flex-wrap gap-1">
              {[
                `Max ${investor?.antiTakeover?.maxIndividualOwnership}% per holder`,
                `Poison pill @ ${investor?.antiTakeover?.poisonPillThreshold}%`,
                `Vote cap ${investor?.antiTakeover?.votingPowerCap}%`,
                `${investor?.antiTakeover?.lockupPeriodDays}d lockup`,
                investor?.antiTakeover?.boardApprovalRequired ? "Board approval req" : null,
              ].filter(Boolean).map(p => (
                <span key={p} className="text-[8px] font-mono px-1.5 py-0.5 rounded-full border border-emerald-500/20 bg-emerald-500/5 text-emerald-400">
                  ✓ {p}
                </span>
              ))}
            </div>
          </div>
          <div className="text-[10px] font-mono text-gray-500">
            Launch: {investor?.launchPlatform?.name} | Curve: {investor?.launchPlatform?.bondingCurveType} | LP: {investor?.launchPlatform?.liquidityPoolSOL} SOL
          </div>
        </Section>
      </div>

      <Section title="Monte Carlo Simulations" icon={BarChart3} color="text-yellow-400" defaultOpen={false}>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {(simulations || []).map((sim: any, i: number) => (
            <div key={i} className="border border-white/5 rounded-lg p-3 bg-black/30 space-y-2" data-testid={`sim-${i}`}>
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-white">{sim.scenario}</span>
                <VerdictBadge verdict={sim.verdict} />
              </div>
              <p className="text-[9px] text-gray-500">{sim.description}</p>
              <div className="grid grid-cols-2 gap-1 text-[9px] font-mono">
                <div><span className="text-gray-500">Iterations:</span> <span className="text-white">{sim.iterations}</span></div>
                <div><span className="text-gray-500">ROI:</span> <span className={sim.outcomes.investorROI >= 0 ? "text-emerald-400" : "text-red-400"}>{sim.outcomes.investorROI.toFixed(1)}%</span></div>
                <div><span className="text-gray-500">Rug Blocked:</span> <span className={sim.outcomes.rugPullBlocked ? "text-emerald-400" : "text-red-400"}>{sim.outcomes.rugPullBlocked ? "YES" : "NO"}</span></div>
                <div><span className="text-gray-500">Growth:</span> <span className="text-white">{sim.outcomes.organicGrowthRate.toFixed(1)}%</span></div>
              </div>
              <p className="text-[8px] text-gray-600 leading-relaxed">{sim.details}</p>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Sovereign Agent Council Report" icon={Vote} color="text-orange-400" defaultOpen={false}>
        {councilReport && (
          <div className="space-y-3">
            <div className="bg-gradient-to-r from-orange-500/10 to-violet-500/10 border border-orange-500/20 rounded-lg p-3" data-testid="council-summary">
              <div className="text-xs font-bold text-orange-400 mb-1">Executive Summary</div>
              <p className="text-[10px] text-gray-300 leading-relaxed">{councilReport.executiveSummary}</p>
              <div className="flex items-center gap-3 mt-2">
                <span className="text-[10px] font-mono text-gray-400">Participants: {councilReport.participants}</span>
                <span className="text-[10px] font-mono text-emerald-400 font-bold">Approval: {councilReport.approvalRate?.toFixed(1)}%</span>
              </div>
            </div>

            <div className="bg-black/30 rounded-lg p-3" data-testid="council-rationale">
              <div className="text-xs font-bold text-violet-400 mb-1">Economic Rationale</div>
              <pre className="text-[9px] text-gray-400 whitespace-pre-wrap leading-relaxed font-mono">{councilReport.economicRationale}</pre>
            </div>

            <div className="bg-black/30 rounded-lg p-3" data-testid="council-risks">
              <div className="text-xs font-bold text-red-400 mb-1">Risk Analysis</div>
              <pre className="text-[9px] text-gray-400 whitespace-pre-wrap leading-relaxed font-mono">{councilReport.riskAnalysis}</pre>
            </div>

            <div className="bg-black/30 rounded-lg p-3">
              <div className="text-xs font-bold text-yellow-400 mb-2">Recommendations</div>
              <ul className="space-y-1">
                {(councilReport.recommendations || []).map((r: string, i: number) => (
                  <li key={i} className="text-[9px] text-gray-400 flex items-start gap-1.5">
                    <CheckCircle size={10} className="text-emerald-500 mt-0.5 shrink-0" />
                    <span>{r}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="bg-black/30 rounded-lg p-3" data-testid="council-votes">
              <div className="text-xs font-bold text-cyan-400 mb-2">Council Votes ({councilReport.votes?.length || 0})</div>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-1 max-h-60 overflow-y-auto">
                {(councilReport.votes || []).map((v: any, i: number) => (
                  <div key={i} className="flex items-center gap-1.5 text-[8px] font-mono p-1 rounded bg-white/3" data-testid={`vote-${v.agentId}`}>
                    <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${v.vote === "approve" ? "bg-emerald-400" : v.vote === "reject" ? "bg-red-400" : "bg-gray-500"}`} />
                    <span className="text-gray-400 truncate">{v.agentName}</span>
                    <span className={`ml-auto ${v.vote === "approve" ? "text-emerald-400" : v.vote === "reject" ? "text-red-400" : "text-gray-500"}`}>
                      {v.confidence}%
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-gradient-to-r from-emerald-500/10 to-cyan-500/10 border border-emerald-500/20 rounded-lg p-3" data-testid="council-verdict">
              <div className="text-xs font-bold text-emerald-400 mb-1">Final Verdict</div>
              <p className="text-[10px] text-gray-300 leading-relaxed">{councilReport.finalVerdict}</p>
            </div>

            {councilReport.dissent?.length > 0 && (
              <div className="bg-red-500/5 border border-red-500/10 rounded-lg p-3">
                <div className="text-xs font-bold text-red-400 mb-1">Dissenting Opinions</div>
                {councilReport.dissent.map((d: string, i: number) => (
                  <p key={i} className="text-[9px] text-gray-500 mb-1">{d}</p>
                ))}
              </div>
            )}
          </div>
        )}
      </Section>
    </div>
  );
}
