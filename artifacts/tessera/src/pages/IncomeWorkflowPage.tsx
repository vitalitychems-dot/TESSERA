import { useState, useEffect } from "react";
import { Workflow, DollarSign, Play, Pause, CheckCircle2, Clock, TrendingUp, ArrowRight, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { GlassCard, PageHeader } from "@/components/ui/sovereign";

interface Workflow_ {
  id: string;
  name: string;
  description: string;
  status: "active" | "paused" | "draft";
  earnings: string;
  frequency: string;
  steps: number;
  lastRun: string;
  nextRun: string;
  category: string;
}

const WORKFLOWS: Workflow_[] = [
  { id: "w1", name: "Arbitrage Auto-Scanner", description: "Scan 12 exchanges for arb opportunities and log profitable spreads", status: "active", earnings: "$1,240/day", frequency: "Every 30s", steps: 5, lastRun: "30s ago", nextRun: "in 30s", category: "Trading" },
  { id: "w2", name: "TSRT Reward Collector", description: "Automatically claim and stake council mission rewards", status: "active", earnings: "$890/week", frequency: "Daily", steps: 3, lastRun: "6h ago", nextRun: "in 18h", category: "Sovereign" },
  { id: "w3", name: "API Royalty Collector", description: "Collect royalties from TSRT API marketplace usage", status: "active", earnings: "$340/week", frequency: "Weekly", steps: 2, lastRun: "1d ago", nextRun: "in 6d", category: "Passive" },
  { id: "w4", name: "Lead Gen Outreach", description: "Auto-qualify leads and send sovereign pitch sequences", status: "paused", earnings: "$2,100/month", frequency: "Daily", steps: 7, lastRun: "3d ago", nextRun: "Paused", category: "Sales" },
  { id: "w5", name: "Content Monetization", description: "Publish sovereign intelligence reports and charge for access", status: "active", earnings: "$560/month", frequency: "Weekly", steps: 4, lastRun: "2d ago", nextRun: "in 5d", category: "Content" },
  { id: "w6", name: "Affiliate Commission Tracker", description: "Track and claim affiliate commissions from partner platforms", status: "draft", earnings: "Est. $800/month", frequency: "Monthly", steps: 6, lastRun: "Never", nextRun: "Draft", category: "Affiliate" },
];

const STATUS_STYLES: Record<string, { text: string; bg: string; border: string }> = {
  active: { text: "text-emerald-400", bg: "bg-emerald-500/10", border: "border-emerald-500/25" },
  paused: { text: "text-amber-400", bg: "bg-amber-500/10", border: "border-amber-500/25" },
  draft: { text: "text-slate-500", bg: "bg-slate-500/10", border: "border-slate-500/20" },
};

const totalEarnings = "$3,470";
const monthlyProjected = "$41,640";

export default function IncomeWorkflowPage() {
  useEffect(() => { document.title = "Income Workflows | Tessera"; }, []);
  const [filter, setFilter] = useState<"all" | "active" | "paused" | "draft">("all");

  const filtered = filter === "all" ? WORKFLOWS : WORKFLOWS.filter(w => w.status === filter);
  const active = WORKFLOWS.filter(w => w.status === "active").length;

  return (
    <div className="p-4 pb-20 max-w-3xl mx-auto space-y-5">
      <PageHeader icon={Workflow} title="Income Workflows" subtitle="Automated sovereign revenue streams and passive income pipelines" iconColor="text-emerald-400" />

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Daily Income", val: totalEarnings, color: "emerald" },
          { label: "Monthly Proj.", val: monthlyProjected, color: "cyan" },
          { label: "Active Flows", val: active, color: "violet" },
          { label: "Total Flows", val: WORKFLOWS.length, color: "amber" },
        ].map(({ label, val, color }) => (
          <GlassCard key={label} className="p-3 text-center">
            <div className={cn("text-base font-bold font-mono", `text-${color}-400`)}>{val}</div>
            <div className="text-[9px] text-slate-500 font-mono mt-1">{label.toUpperCase()}</div>
          </GlassCard>
        ))}
      </div>

      <div className="flex items-center justify-between">
        <div className="flex gap-2">
          {(["all", "active", "paused", "draft"] as const).map(f => (
            <button key={f} onClick={() => setFilter(f)} className={cn("px-3 py-1.5 rounded-lg text-xs font-mono capitalize transition-all", filter === f ? "bg-emerald-500/15 text-emerald-400" : "text-slate-500 hover:text-slate-300")}>
              {f}
            </button>
          ))}
        </div>
        <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/15 border border-emerald-500/25 text-emerald-400 text-xs font-mono hover:bg-emerald-500/25 transition-all">
          <Plus size={12} />
          New Flow
        </button>
      </div>

      <div className="space-y-3">
        {filtered.map(wf => {
          const s = STATUS_STYLES[wf.status];
          return (
            <GlassCard key={wf.id} className={cn("p-4 border transition-all hover:bg-white/[0.04]", s.border)}>
              <div className="flex items-start gap-3">
                <div className={cn("w-8 h-8 rounded-xl flex items-center justify-center shrink-0 mt-0.5", s.bg, "border", s.border)}>
                  {wf.status === "active" ? <Play size={13} className={s.text} /> : wf.status === "paused" ? <Pause size={13} className={s.text} /> : <Clock size={13} className={s.text} />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-semibold text-white">{wf.name}</span>
                    <span className={cn("text-[8px] px-1.5 py-0.5 rounded-full border font-mono uppercase", s.bg, s.text, s.border)}>{wf.status}</span>
                    <span className="text-[9px] text-slate-600 font-mono">{wf.category}</span>
                  </div>
                  <p className="text-xs text-slate-500 mt-1 leading-snug">{wf.description}</p>
                  <div className="flex items-center gap-4 mt-2 flex-wrap">
                    <div className="flex items-center gap-1 text-[10px] text-slate-500">
                      <Clock size={10} />
                      <span>{wf.frequency}</span>
                    </div>
                    <div className="text-[10px] text-slate-500">{wf.steps} steps</div>
                    <div className="text-[10px] text-slate-600">Last: {wf.lastRun}</div>
                    <div className="text-[10px] text-slate-600">Next: {wf.nextRun}</div>
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <div className="text-sm font-bold font-mono text-emerald-400">{wf.earnings}</div>
                  <div className="flex justify-end mt-1">
                    <TrendingUp size={11} className="text-emerald-400/50" />
                  </div>
                </div>
              </div>
            </GlassCard>
          );
        })}
      </div>
    </div>
  );
}
