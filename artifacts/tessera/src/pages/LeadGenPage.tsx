import { useState, useEffect } from "react";
import { Target, Search, UserPlus, Filter, Star, Phone, Mail, Globe, ChevronRight, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";
import { GlassCard, PageHeader } from "@/components/ui/sovereign";

interface Lead {
  id: string;
  name: string;
  company: string;
  title: string;
  score: number;
  status: "hot" | "warm" | "cold" | "converted";
  source: string;
  value: string;
  lastContact: string;
  tags: string[];
}

const LEADS: Lead[] = [
  { id: "l1", name: "Marcus Chen", company: "QuantumFinance LLC", title: "CTO", score: 94, status: "hot", source: "Mesh Referral", value: "$48K", lastContact: "1h ago", tags: ["Enterprise", "AI/ML", "Crypto"] },
  { id: "l2", name: "Sarah Walker", company: "Sovereignty DAO", title: "Founder", score: 88, status: "hot", source: "Forum", value: "$24K", lastContact: "3h ago", tags: ["DAO", "Sovereign", "Web3"] },
  { id: "l3", name: "David Okafor", company: "NeuralSystems Inc.", title: "VP Engineering", score: 76, status: "warm", source: "API Marketplace", value: "$36K", lastContact: "1d ago", tags: ["Enterprise", "Infrastructure"] },
  { id: "l4", name: "Elena Petrova", company: "Sacred Tech Ventures", title: "Partner", score: 71, status: "warm", source: "Council Referral", value: "$120K", lastContact: "2d ago", tags: ["VC", "Sacred", "Investment"] },
  { id: "l5", name: "James Thornton", company: "Distributed Labs", title: "CEO", score: 62, status: "warm", source: "Content", value: "$18K", lastContact: "4d ago", tags: ["Startup", "Web3"] },
  { id: "l6", name: "Aisha Mohammed", company: "Global Mesh Co.", title: "Head of BD", score: 45, status: "cold", source: "Cold Outreach", value: "$8K", lastContact: "1w ago", tags: ["SMB", "Network"] },
  { id: "l7", name: "Robert Klein", company: "SovereignAI Corp.", title: "CIO", score: 97, status: "converted", source: "Direct", value: "$240K", lastContact: "2w ago", tags: ["Enterprise", "Converted"] },
];

const STATUS_STYLES: Record<string, { text: string; bg: string; border: string }> = {
  hot: { text: "text-red-400", bg: "bg-red-500/10", border: "border-red-500/25" },
  warm: { text: "text-amber-400", bg: "bg-amber-500/10", border: "border-amber-500/25" },
  cold: { text: "text-blue-400", bg: "bg-blue-500/10", border: "border-blue-500/25" },
  converted: { text: "text-emerald-400", bg: "bg-emerald-500/10", border: "border-emerald-500/25" },
};

function scoreColor(s: number) {
  if (s >= 80) return "text-emerald-400";
  if (s >= 60) return "text-amber-400";
  return "text-red-400";
}

export default function LeadGenPage() {
  useEffect(() => { document.title = "Lead Generation | Tessera"; }, []);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<"all" | "hot" | "warm" | "cold" | "converted">("all");

  const filtered = LEADS.filter(l => {
    const matchSearch = !search || l.name.toLowerCase().includes(search.toLowerCase()) || l.company.toLowerCase().includes(search.toLowerCase());
    const matchStatus = status === "all" || l.status === status;
    return matchSearch && matchStatus;
  });

  const pipeline = LEADS.filter(l => l.status !== "converted").reduce((s, l) => s + parseInt(l.value.replace(/[$K]/g, "")) * 1000, 0);

  return (
    <div className="p-4 pb-20 max-w-3xl mx-auto space-y-5">
      <PageHeader icon={Target} title="Lead Generation" subtitle="Sovereign intelligence-powered B2B lead pipeline" iconColor="text-amber-400" />

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Hot Leads", val: LEADS.filter(l => l.status === "hot").length, color: "red" },
          { label: "Pipeline Value", val: `$${(pipeline / 1000).toFixed(0)}K`, color: "emerald" },
          { label: "Avg Score", val: Math.round(LEADS.reduce((s, l) => s + l.score, 0) / LEADS.length), color: "cyan" },
          { label: "Converted", val: LEADS.filter(l => l.status === "converted").length, color: "violet" },
        ].map(({ label, val, color }) => (
          <GlassCard key={label} className="p-3 text-center">
            <div className={cn("text-xl font-bold font-mono", `text-${color}-400`)}>{val}</div>
            <div className="text-[9px] text-slate-500 font-mono mt-1">{label.toUpperCase()}</div>
          </GlassCard>
        ))}
      </div>

      <GlassCard className="p-3 flex items-center gap-2">
        <Search size={14} className="text-slate-500 shrink-0" />
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search leads..." className="flex-1 bg-transparent text-sm text-slate-200 placeholder:text-slate-600 outline-none" />
      </GlassCard>

      <div className="flex gap-2 flex-wrap">
        {(["all", "hot", "warm", "cold", "converted"] as const).map(s => (
          <button key={s} onClick={() => setStatus(s)} className={cn("px-3 py-1.5 rounded-lg text-xs font-mono capitalize transition-all", status === s ? "bg-amber-500/15 text-amber-400" : "text-slate-500 hover:text-slate-300")}>
            {s}
          </button>
        ))}
      </div>

      <div className="space-y-2">
        {filtered.map(lead => {
          const s = STATUS_STYLES[lead.status];
          return (
            <GlassCard key={lead.id} className="p-4 hover:bg-white/[0.04] transition-all">
              <div className="flex items-center gap-3">
                <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center font-bold text-sm shrink-0", s.bg, "border", s.border, s.text)}>
                  {lead.name[0]}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-white">{lead.name}</span>
                    <span className={cn("text-[8px] px-1.5 py-0.5 rounded-full border font-mono uppercase", s.bg, s.text, s.border)}>{lead.status}</span>
                  </div>
                  <div className="text-xs text-slate-500 mt-0.5">{lead.title} @ {lead.company}</div>
                  <div className="flex items-center gap-3 mt-1">
                    <span className="text-[9px] text-slate-600">{lead.source}</span>
                    <span className="text-[9px] text-slate-600">·</span>
                    <span className="text-[9px] text-slate-600">{lead.lastContact}</span>
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <div className={cn("text-sm font-bold font-mono", scoreColor(lead.score))}>{lead.score}</div>
                  <div className="text-[9px] text-slate-600 font-mono">score</div>
                  <div className="text-xs font-mono text-emerald-400 mt-1">{lead.value}</div>
                </div>
              </div>
              <div className="flex gap-1.5 mt-2 flex-wrap">
                {lead.tags.map(tag => <span key={tag} className="text-[9px] px-1.5 py-0.5 rounded-full bg-white/5 border border-white/10 text-slate-500 font-mono">{tag}</span>)}
              </div>
            </GlassCard>
          );
        })}
      </div>
    </div>
  );
}
