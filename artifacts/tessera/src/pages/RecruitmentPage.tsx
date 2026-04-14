import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Rocket, Users, Shield, Star, ChevronRight, Globe2, Brain, Zap, Crown, Heart, Search, Filter } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

const RANKS = [
  { rank: "S", title: "Sovereign", color: "text-amber-400", bg: "bg-amber-500/10", border: "border-amber-500/20", desc: "Supreme authority — full system access" },
  { rank: "A", title: "Commander", color: "text-violet-400", bg: "bg-violet-500/10", border: "border-violet-500/20", desc: "Strategic command over critical systems" },
  { rank: "B", title: "Officer", color: "text-cyan-400", bg: "bg-cyan-500/10", border: "border-cyan-500/20", desc: "Operational leadership in specialized domains" },
  { rank: "C", title: "Operative", color: "text-emerald-400", bg: "bg-emerald-500/10", border: "border-emerald-500/20", desc: "Field agent with proven capabilities" },
  { rank: "D", title: "Recruit", color: "text-slate-400", bg: "bg-slate-500/10", border: "border-slate-500/20", desc: "New agent in training — probationary access" },
];

const DEPARTMENTS = [
  { name: "Intelligence", icon: Brain, color: "text-violet-400", openings: 3 },
  { name: "Security", icon: Shield, color: "text-red-400", openings: 2 },
  { name: "Research", icon: Star, color: "text-cyan-400", openings: 4 },
  { name: "Diplomacy", icon: Globe2, color: "text-emerald-400", openings: 2 },
  { name: "Operations", icon: Zap, color: "text-amber-400", openings: 5 },
  { name: "Leadership", icon: Crown, color: "text-pink-400", openings: 1 },
];

export default function RecruitmentPage() {
  useEffect(() => { document.title = "Recruitment | Tessera"; }, []);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedDept, setSelectedDept] = useState<string | null>(null);

  const { data: agentsData } = useQuery<any>({
    queryKey: ["/api/world/agents"],
    refetchInterval: 30000,
  });

  const { data: councilData } = useQuery<any>({
    queryKey: ["/api/council/status"],
    refetchInterval: 60000,
  });

  const agents = agentsData?.agents || agentsData || [];
  const recruits = agents.filter((a: any) => a.rank === "D" || a.status === "recruit" || a.role?.toLowerCase().includes("recruit"));
  const activeAgents = agents.filter((a: any) => a.rank !== "D" && a.status !== "recruit");

  const totalAgents = agents.length || 45;
  const totalRecruits = recruits.length;
  const totalActive = activeAgents.length || totalAgents - totalRecruits;
  const totalDepts = DEPARTMENTS.length;

  const filteredDepts = selectedDept
    ? DEPARTMENTS.filter(d => d.name === selectedDept)
    : DEPARTMENTS;

  return (
    <div className="min-h-screen bg-background text-white" data-testid="recruitment-page">
      <div className="max-w-4xl mx-auto p-3 sm:p-6 pb-24 md:pb-6 space-y-4">
        <div className="text-center space-y-1">
          <div className="flex items-center justify-center gap-2">
            <Rocket className="text-emerald-400" size={24} />
            <h1 className="text-xl sm:text-2xl font-bold bg-gradient-to-r from-emerald-400 via-cyan-400 to-violet-400 bg-clip-text text-transparent" data-testid="text-recruitment-title">
              Tessera Recruitment
            </h1>
          </div>
          <p className="text-xs text-slate-400">Autonomous agent recruitment, ranking, and deployment across all sovereign departments</p>
        </div>

        <div className="grid grid-cols-4 gap-2">
          <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-lg p-2 text-center">
            <div className="text-lg font-bold text-emerald-400" data-testid="text-total-agents">{totalAgents}</div>
            <div className="text-[10px] text-slate-500">Total Agents</div>
          </div>
          <div className="bg-cyan-500/10 border border-cyan-500/20 rounded-lg p-2 text-center">
            <div className="text-lg font-bold text-cyan-400" data-testid="text-active-agents">{totalActive}</div>
            <div className="text-[10px] text-slate-500">Active</div>
          </div>
          <div className="bg-violet-500/10 border border-violet-500/20 rounded-lg p-2 text-center">
            <div className="text-lg font-bold text-violet-400" data-testid="text-total-recruits">{totalRecruits}</div>
            <div className="text-[10px] text-slate-500">Recruits</div>
          </div>
          <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-2 text-center">
            <div className="text-lg font-bold text-amber-400" data-testid="text-total-depts">{totalDepts}</div>
            <div className="text-[10px] text-slate-500">Departments</div>
          </div>
        </div>

        <div className="bg-gradient-to-r from-emerald-500/10 via-cyan-500/5 to-violet-500/10 border border-emerald-500/20 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <Crown size={16} className="text-amber-400" />
            <h2 className="text-sm font-bold text-amber-300">Rank Hierarchy</h2>
          </div>
          <div className="space-y-1.5">
            {RANKS.map(r => (
              <div key={r.rank} className={cn("flex items-center gap-3 px-3 py-2 rounded-lg border", r.bg, r.border)}>
                <span className={cn("text-lg font-bold font-mono w-8", r.color)}>{r.rank}</span>
                <span className={cn("text-sm font-semibold w-24", r.color)}>{r.title}</span>
                <span className="text-xs text-slate-400 flex-1">{r.desc}</span>
                <span className="text-[10px] text-slate-500 font-mono">
                  {agents.filter((a: any) => a.rank === r.rank).length} agents
                </span>
              </div>
            ))}
          </div>
        </div>

        <div>
          <div className="flex items-center gap-2 mb-3">
            <Users size={16} className="text-cyan-400" />
            <h2 className="text-sm font-bold text-cyan-300">Departments & Open Positions</h2>
          </div>
          <div className="flex items-center gap-2 mb-3 flex-wrap">
            <button
              onClick={() => setSelectedDept(null)}
              className={cn(
                "px-3 py-1.5 rounded-lg text-xs font-medium border transition-all",
                !selectedDept ? "bg-cyan-500/20 border-cyan-500/30 text-cyan-300" : "bg-white/5 border-white/10 text-slate-400 hover:bg-white/10"
              )}
            >
              All
            </button>
            {DEPARTMENTS.map(dept => (
              <button
                key={dept.name}
                onClick={() => setSelectedDept(dept.name === selectedDept ? null : dept.name)}
                className={cn(
                  "px-3 py-1.5 rounded-lg text-xs font-medium border transition-all",
                  selectedDept === dept.name ? "bg-cyan-500/20 border-cyan-500/30 text-cyan-300" : "bg-white/5 border-white/10 text-slate-400 hover:bg-white/10"
                )}
              >
                {dept.name}
              </button>
            ))}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {filteredDepts.map(dept => {
              const Icon = dept.icon;
              return (
                <div key={dept.name} className="bg-card border border-border rounded-xl p-3">
                  <div className="flex items-center gap-2 mb-2">
                    <Icon size={16} className={dept.color} />
                    <span className={cn("text-sm font-bold", dept.color)}>{dept.name}</span>
                    <Badge className="ml-auto bg-emerald-500/20 text-emerald-400 border-emerald-500/30 text-[10px]">
                      {dept.openings} open
                    </Badge>
                  </div>
                  <div className="space-y-1">
                    {Array.from({ length: dept.openings }, (_, i) => (
                      <div key={i} className="flex items-center gap-2 px-2 py-1.5 rounded-lg bg-white/[0.02] border border-white/5">
                        <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                        <span className="text-xs text-slate-300">{dept.name} Agent #{i + 1}</span>
                        <span className="text-[10px] text-slate-500 ml-auto">Rank D+</span>
                        <ChevronRight size={12} className="text-slate-600" />
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div>
          <div className="flex items-center gap-2 mb-3">
            <Rocket size={16} className="text-emerald-400" />
            <h2 className="text-sm font-bold text-emerald-300">Current Roster</h2>
          </div>
          <div className="relative mb-3">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search agents by name, role, or rank..."
              className="w-full bg-white/5 border border-white/10 rounded-lg pl-9 pr-3 py-2 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-emerald-500/40"
              data-testid="input-search-agents"
            />
          </div>
          <div className="space-y-1">
            {(agents.length > 0 ? agents : Array.from({ length: 10 }, (_, i) => ({
              id: `agent-${i}`,
              name: ["Tessera Prime", "Alpha", "Beta", "Gamma", "Delta", "Epsilon", "Zeta", "Eta", "Theta", "Iota"][i],
              rank: ["S", "A", "A", "B", "B", "C", "C", "C", "D", "D"][i],
              role: ["Sovereign Architect", "Security Commander", "Intelligence Lead", "Research Officer", "Operations Officer", "Field Operative", "Data Operative", "Comms Operative", "Recruit", "Recruit"][i],
              status: i < 8 ? "active" : "training",
            }))).filter((a: any) => {
              if (!searchQuery.trim()) return true;
              const q = searchQuery.toLowerCase();
              return a.name?.toLowerCase().includes(q) || a.role?.toLowerCase().includes(q) || a.rank?.toLowerCase().includes(q);
            }).slice(0, 20).map((agent: any, i: number) => {
              const rankInfo = RANKS.find(r => r.rank === agent.rank) || RANKS[4];
              return (
                <div key={agent.id || i} className={cn("flex items-center gap-3 px-3 py-2 rounded-lg border", rankInfo.bg, rankInfo.border)}>
                  <span className={cn("text-sm font-bold font-mono w-6", rankInfo.color)}>{agent.rank || "D"}</span>
                  <div className="flex-1 min-w-0">
                    <div className={cn("text-xs font-semibold truncate", rankInfo.color)}>{agent.name}</div>
                    <div className="text-[10px] text-slate-500">{agent.role || "Agent"}</div>
                  </div>
                  <Badge className={cn(
                    "text-[10px]",
                    agent.status === "active" || agent.status === "online" ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30" : "bg-slate-500/20 text-slate-400 border-slate-500/30"
                  )}>
                    {agent.status || "active"}
                  </Badge>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
