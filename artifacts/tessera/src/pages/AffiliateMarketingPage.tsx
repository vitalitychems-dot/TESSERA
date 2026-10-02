import { useState, useEffect } from "react";
import { TrendingUp, DollarSign, Users, Link2, Copy, CheckCheck, ExternalLink, BarChart3 } from "lucide-react";
import { cn } from "@/lib/utils";
import { GlassCard, PageHeader } from "@/components/ui/sovereign";

const PROGRAMS = [
  { id: "p1", name: "Tessera Intelligence API", commission: "30%", type: "Recurring", earnings: "$2,840/mo", clicks: 1240, conversions: 48, rate: "3.9%", status: "active", link: "https://tessera.ai/ref/sovereign" },
  { id: "p2", name: "Sovereign Mesh Enterprise", commission: "20%", type: "One-time", earnings: "$1,200/mo", clicks: 380, conversions: 6, rate: "1.6%", status: "active", link: "https://mesh.tessera.ai/ref/sovereign" },
  { id: "p3", name: "TSRT Token Launch Presale", commission: "15%", type: "CPA", earnings: "$4,100/mo", clicks: 8200, conversions: 320, rate: "3.9%", status: "active", link: "https://tsrt.tessera.ai/ref/sovereign" },
  { id: "p4", name: "Sacred Conference VIP", commission: "25%", type: "One-time", earnings: "$890/mo", clicks: 210, conversions: 12, rate: "5.7%", status: "paused", link: "https://conference.tessera.ai/ref/sovereign" },
  { id: "p5", name: "Knowledge Vault Premium", commission: "40%", type: "Recurring", earnings: "$340/mo", clicks: 95, conversions: 14, rate: "14.7%", status: "active", link: "https://vault.tessera.ai/ref/sovereign" },
];

const STATS = [
  { label: "Total Earnings", val: "$9,370/mo", color: "emerald" },
  { label: "Active Programs", val: 4, color: "cyan" },
  { label: "Total Clicks", val: "10.1K", color: "violet" },
  { label: "Avg Conv. Rate", val: "3.9%", color: "amber" },
];

export default function AffiliateMarketingPage() {
  useEffect(() => { document.title = "Affiliate Marketing | Tessera"; }, []);
  const [copied, setCopied] = useState<string | null>(null);

  const copy = (id: string) => {
    setCopied(id);
    setTimeout(() => setCopied(null), 2000);
  };

  return (
    <div className="p-4 pb-20 max-w-3xl mx-auto space-y-5">
      <PageHeader icon={TrendingUp} title="Affiliate Marketing" subtitle="Sovereign revenue through strategic affiliate partnerships" iconColor="text-emerald-400" />

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {STATS.map(({ label, val, color }) => (
          <GlassCard key={label} className="p-3 text-center">
            <div className={cn("text-base font-bold font-mono", `text-${color}-400`)}>{val}</div>
            <div className="text-[9px] text-slate-500 font-mono mt-1">{label.toUpperCase()}</div>
          </GlassCard>
        ))}
      </div>

      <GlassCard className="p-4 bg-gradient-to-br from-emerald-500/5 to-cyan-500/5 border-emerald-500/20">
        <div className="text-[10px] text-slate-500 font-mono mb-1">YOUR MASTER REFERRAL LINK</div>
        <div className="flex items-center gap-2 mt-2">
          <div className="flex-1 p-2 rounded-lg bg-black/30 border border-white/5 font-mono text-xs text-cyan-400 truncate">
            https://tessera.ai/ref/sovereign-{Math.random().toString(36).slice(2, 8)}
          </div>
          <button onClick={() => copy("master")} className="px-3 py-2 rounded-lg bg-emerald-500/15 border border-emerald-500/25 text-emerald-400 text-xs font-mono hover:bg-emerald-500/25 transition-all shrink-0">
            {copied === "master" ? <CheckCheck size={12} /> : <Copy size={12} />}
          </button>
        </div>
      </GlassCard>

      <div className="text-[10px] text-slate-500 font-mono tracking-widest">AFFILIATE PROGRAMS</div>

      <div className="space-y-3">
        {PROGRAMS.map(prog => (
          <GlassCard key={prog.id} className="p-4 hover:bg-white/[0.04] transition-all">
            <div className="flex items-start gap-3">
              <div className={cn("shrink-0 w-8 h-8 rounded-xl flex items-center justify-center", prog.status === "active" ? "bg-emerald-500/15 border border-emerald-500/25" : "bg-slate-500/10 border border-slate-500/20")}>
                <Link2 size={13} className={prog.status === "active" ? "text-emerald-400" : "text-slate-500"} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-white">{prog.name}</span>
                  <span className={cn("text-[8px] px-1.5 py-0.5 rounded-full border font-mono uppercase", prog.status === "active" ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/25" : "bg-slate-500/10 text-slate-500 border-slate-500/20")}>
                    {prog.status}
                  </span>
                </div>
                <div className="flex items-center gap-3 mt-1 flex-wrap text-[10px] text-slate-500">
                  <span className="text-emerald-400 font-mono font-bold">{prog.commission}</span>
                  <span>{prog.type}</span>
                  <span>·</span>
                  <span>{prog.clicks.toLocaleString()} clicks</span>
                  <span>·</span>
                  <span>{prog.conversions} conv.</span>
                  <span>·</span>
                  <span>{prog.rate} CVR</span>
                </div>
              </div>
              <div className="text-right shrink-0">
                <div className="text-sm font-bold font-mono text-emerald-400">{prog.earnings}</div>
                <button onClick={() => copy(prog.id)} className="mt-1 flex items-center gap-1 text-[10px] text-slate-500 hover:text-slate-300 font-mono">
                  {copied === prog.id ? <CheckCheck size={10} className="text-emerald-400" /> : <Copy size={10} />}
                  {copied === prog.id ? "Copied!" : "Copy link"}
                </button>
              </div>
            </div>
          </GlassCard>
        ))}
      </div>
    </div>
  );
}
