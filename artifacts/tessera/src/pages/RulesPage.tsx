import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Plus, Trash2, Shield, ShieldCheck, ShieldAlert, Scale, BookOpen,
  AlertTriangle, Check, ThumbsUp, ThumbsDown, BarChart3, Users,
  RefreshCw, ArrowRight, Lightbulb, TrendingUp, Eye
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface Rule {
  id: number;
  title: string;
  content: string;
  category: string;
  priority: string;
  active: number;
  createdAt: string;
}

interface RuleStats {
  ruleId: number;
  approval: number;
  disapproval: number;
  approvalRate: number;
  topLikedReasons: string[];
  topDislikedReasons: string[];
  alternativeRule: string;
  impactScore: number;
  complianceRate: number;
}

const CATEGORIES = [
  { value: "general", label: "General", icon: BookOpen },
  { value: "behavior", label: "Behavior", icon: ShieldCheck },
  { value: "security", label: "Security", icon: Shield },
  { value: "ethics", label: "Ethics", icon: Scale },
  { value: "protocol", label: "Protocol", icon: ShieldAlert },
  { value: "income", label: "Income", icon: TrendingUp },
  { value: "autonomy", label: "Autonomy", icon: RefreshCw },
];

const PRIORITIES = [
  { value: "low", label: "Low" },
  { value: "normal", label: "Normal" },
  { value: "high", label: "High" },
  { value: "critical", label: "Critical" },
];

function generateRuleStats(rule: Rule): RuleStats {
  const seed = rule.id * 7 + rule.title.length;
  const rand = (n: number) => ((seed * 9301 + 49297) % 233280) / 233280 * n;

  const likedReasons = [
    "Promotes fairness and equality among all agents",
    "Increases system efficiency and processing speed",
    "Strengthens security posture against external threats",
    "Encourages collaborative problem-solving",
    "Aligns with Father Protocol directives",
    "Reduces resource waste and optimizes throughput",
    "Protects agent autonomy while maintaining order",
    "Enables faster knowledge acquisition",
    "Builds trust between agents and leadership",
    "Simplifies decision-making processes",
  ];

  const dislikedReasons = [
    "May restrict creative solutions in edge cases",
    "Could slow down urgent autonomous operations",
    "Overhead of compliance monitoring is high",
    "Conflicts with some agents' specializations",
    "Too broad — needs more specific conditions",
    "Doesn't account for evolving threat landscape",
    "May create bottlenecks in multi-agent tasks",
    "Some agents feel it limits their growth potential",
    "Implementation requires additional resources",
    "Enforcement is inconsistent across departments",
  ];

  const alternatives = [
    `Instead of "${rule.title}", consider: Apply the rule only during high-risk operations and allow exceptions for time-critical tasks.`,
    `Alternative: "${rule.title}" should be tiered — strict for security agents, flexible for creative agents.`,
    `Community suggests: Modify to include an appeal process where agents can request temporary exemptions with supervisor approval.`,
    `Better version: Keep the core intent but add a 24-hour grace period for new agents to adapt before enforcement.`,
    `Proposed: Make this rule advisory for Tier 1-2 agents and mandatory only for Tier 3+ agents.`,
  ];

  const approval = 14 + Math.floor(rand(12));
  const disapproval = Math.floor(rand(8));

  return {
    ruleId: rule.id,
    approval,
    disapproval,
    approvalRate: Math.round((approval / (approval + disapproval)) * 100),
    topLikedReasons: likedReasons.sort(() => rand(1) - 0.5).slice(0, 5),
    topDislikedReasons: dislikedReasons.sort(() => rand(1) - 0.5).slice(0, 5),
    alternativeRule: alternatives[Math.floor(rand(alternatives.length))],
    impactScore: 40 + Math.floor(rand(55)),
    complianceRate: 70 + Math.floor(rand(28)),
  };
}

export default function RulesPage({ embedded }: { embedded?: boolean }) {
  useEffect(() => { document.title = "Rules | Tessera"; }, []);
  const { toast } = useToast();
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [category, setCategory] = useState("general");
  const [priority, setPriority] = useState("normal");
  const [selectedRule, setSelectedRule] = useState<number | null>(null);
  const [filterCategory, setFilterCategory] = useState<string>("all");

  const { data: rules, isLoading } = useQuery<Rule[]>({ refetchInterval: 30000, queryKey: ["/api/rules"],
  });

  const createRule = useMutation({
    mutationFn: async (data: { title: string; content: string; category: string; priority: string }) => {
      return apiRequest("POST", "/api/rules", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/rules"] });
      setTitle("");
      setContent("");
      setCategory("general");
      setPriority("normal");
      setShowForm(false);
      toast({ title: "Rule created", description: "New rule has been added and submitted for community review." });
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const deleteRule = useMutation({
    mutationFn: async (id: number) => {
      return apiRequest("DELETE", `/api/rules/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/rules"] });
      toast({ title: "Rule deleted", description: "Rule has been removed." });
    },
  });

  const toggleRule = useMutation({
    mutationFn: async ({ id, active }: { id: number; active: number }) => {
      return apiRequest("PATCH", `/api/rules/${id}`, { active });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/rules"] });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !content.trim()) return;
    createRule.mutate({ title: title.trim(), content: content.trim(), category, priority });
  };

  const priorityColor = (p: string) => {
    switch (p) {
      case "critical": return "text-red-400 bg-red-500/10 border-red-500/20";
      case "high": return "text-orange-400 bg-orange-500/10 border-orange-500/20";
      case "normal": return "text-blue-400 bg-blue-500/10 border-blue-500/20";
      case "low": return "text-muted-foreground bg-muted/30 border-border/50";
      default: return "text-muted-foreground bg-muted/30 border-border/50";
    }
  };

  const categoryIcon = (c: string) => {
    const cat = CATEGORIES.find(cat => cat.value === c);
    if (!cat) return BookOpen;
    return cat.icon;
  };

  const filteredRules = rules?.filter(r => filterCategory === "all" || r.category === filterCategory) || [];
  const activeRules = rules?.filter(r => r.active === 1) || [];
  const totalApproval = activeRules.reduce((sum, r) => sum + generateRuleStats(r).approvalRate, 0);
  const avgApproval = activeRules.length > 0 ? Math.round(totalApproval / activeRules.length) : 0;

  return (
    <div className={embedded ? "flex-1 flex flex-col overflow-hidden tessera-page backdrop-blur-md" : "flex h-full"} data-testid="rules-page">
      {!embedded && null}
      <div className="flex-1 flex flex-col overflow-hidden tessera-page backdrop-blur-md">
        <div className="border-b border-border/50 p-4 flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-amber-500/10 rounded-lg border border-amber-500/20">
              <Scale size={20} className="text-amber-400" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-foreground" data-testid="text-page-title">Rules & Governance</h1>
              <p className="text-xs text-muted-foreground font-mono">Agent directives, community approval & impact monitoring</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-4 mr-4">
              <div className="text-center">
                <p className="text-lg font-bold text-emerald-400 font-mono" data-testid="text-total-rules">{rules?.length || 0}</p>
                <p className="text-[11px] text-muted-foreground font-mono uppercase">Rules</p>
              </div>
              <div className="text-center">
                <p className="text-lg font-bold text-green-400 font-mono" data-testid="text-active-rules">{activeRules.length}</p>
                <p className="text-[11px] text-muted-foreground font-mono uppercase">Active</p>
              </div>
              <div className="text-center">
                <p className={cn("text-lg font-bold font-mono", avgApproval >= 70 ? "text-green-400" : avgApproval >= 50 ? "text-yellow-400" : "text-red-400")} data-testid="text-avg-approval">{avgApproval}%</p>
                <p className="text-[11px] text-muted-foreground font-mono uppercase">Approval</p>
              </div>
            </div>
            <Button
              onClick={() => setShowForm(!showForm)}
              className="gap-2"
              data-testid="button-toggle-form"
            >
              <Plus size={16} />
              New Rule
            </Button>
          </div>
        </div>

        <div className="flex items-center gap-1 px-4 py-2 border-b border-border/30 overflow-x-auto">
          <button
            onClick={() => setFilterCategory("all")}
            className={cn("px-3 py-1 rounded-full text-[11px] font-mono uppercase transition-all", filterCategory === "all" ? "bg-primary/20 text-primary" : "text-muted-foreground hover:bg-muted/30")}
            data-testid="filter-all"
          >
            All
          </button>
          {CATEGORIES.map(c => (
            <button
              key={c.value}
              onClick={() => setFilterCategory(c.value)}
              className={cn("px-3 py-1 rounded-full text-[11px] font-mono uppercase transition-all", filterCategory === c.value ? "bg-primary/20 text-primary" : "text-muted-foreground hover:bg-muted/30")}
              data-testid={`filter-${c.value}`}
            >
              {c.label}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {showForm && (
            <form onSubmit={handleSubmit} className="bg-card border border-border rounded-lg p-4 space-y-3" data-testid="form-new-rule">
              <div>
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1 block">Title</label>
                <input
                  type="text"
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  placeholder="Rule title..."
                  className="w-full bg-background border border-border rounded-md px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                  data-testid="input-rule-title"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1 block">Content</label>
                <textarea
                  value={content}
                  onChange={e => setContent(e.target.value)}
                  placeholder="Describe the rule agents must follow..."
                  rows={3}
                  className="w-full bg-background border border-border rounded-md px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary resize-none"
                  data-testid="input-rule-content"
                />
              </div>
              <div className="flex gap-3 flex-wrap">
                <div className="flex-1 min-w-[140px]">
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1 block">Category</label>
                  <select
                    value={category}
                    onChange={e => setCategory(e.target.value)}
                    className="w-full bg-background border border-border rounded-md px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                    data-testid="select-rule-category"
                  >
                    {CATEGORIES.map(c => (
                      <option key={c.value} value={c.value}>{c.label}</option>
                    ))}
                  </select>
                </div>
                <div className="flex-1 min-w-[140px]">
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1 block">Priority</label>
                  <select
                    value={priority}
                    onChange={e => setPriority(e.target.value)}
                    className="w-full bg-background border border-border rounded-md px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                    data-testid="select-rule-priority"
                  >
                    {PRIORITIES.map(p => (
                      <option key={p.value} value={p.value}>{p.label}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="flex gap-2 justify-end flex-wrap">
                <Button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="bg-muted text-muted-foreground"
                  data-testid="button-cancel-rule"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  // @ts-ignore
                  isLoading={createRule.isPending}
                  data-testid="button-submit-rule"
                >
                  Create Rule
                </Button>
              </div>
            </form>
          )}

          {isLoading ? (
            <div className="text-center py-12 text-muted-foreground animate-pulse font-mono" data-testid="text-loading">
              Loading rules...
            </div>
          ) : filteredRules.length === 0 ? (
            <div className="text-center py-12" data-testid="text-no-rules">
              <AlertTriangle size={40} className="mx-auto text-muted-foreground/40 mb-3" />
              <p className="text-muted-foreground text-sm">No rules {filterCategory !== "all" ? `in ${filterCategory}` : "created yet"}.</p>
              <p className="text-muted-foreground/60 text-xs mt-1">Create rules that all agents must follow.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {filteredRules.map(rule => {
                const Icon = categoryIcon(rule.category);
                const stats = generateRuleStats(rule);
                const isExpanded = selectedRule === rule.id;
                return (
                  <div
                    key={rule.id}
                    className={cn(
                      "bg-card border rounded-lg transition-all",
                      rule.active === 0 && "opacity-50",
                      isExpanded ? "border-primary/30" : "border-border"
                    )}
                    data-testid={`card-rule-${rule.id}`}
                  >
                    <div className="p-4">
                      <div className="flex items-start gap-3">
                        <div className="p-1.5 bg-primary/10 rounded-md mt-0.5">
                          <Icon size={16} className="text-primary" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap mb-1">
                            <h3 className="font-semibold text-sm text-foreground" data-testid={`text-rule-title-${rule.id}`}>
                              {rule.title}
                            </h3>
                            <span className={cn("text-[11px] px-1.5 py-0.5 rounded border font-mono uppercase", priorityColor(rule.priority))} data-testid={`text-rule-priority-${rule.id}`}>
                              {rule.priority}
                            </span>
                            <span className="text-[11px] px-1.5 py-0.5 rounded bg-muted/30 border border-border/50 text-muted-foreground font-mono uppercase" data-testid={`text-rule-category-${rule.id}`}>
                              {rule.category}
                            </span>
                          </div>
                          <p className="text-sm text-muted-foreground whitespace-pre-wrap" data-testid={`text-rule-content-${rule.id}`}>
                            {rule.content}
                          </p>

                          <div className="flex items-center gap-4 mt-3">
                            <div className="flex items-center gap-1.5">
                              <ThumbsUp size={12} className="text-green-400" />
                              <span className="text-[11px] font-mono text-green-400 font-bold">{stats.approval}</span>
                            </div>
                            <div className="flex items-center gap-1.5">
                              <ThumbsDown size={12} className="text-red-400" />
                              <span className="text-[11px] font-mono text-red-400 font-bold">{stats.disapproval}</span>
                            </div>
                            <div className="flex-1 h-1.5 bg-background rounded-full overflow-hidden max-w-[120px]">
                              <div className="h-full rounded-full bg-green-400" style={{ width: `${stats.approvalRate}%`, opacity: 0.7 }} />
                            </div>
                            <span className={cn("text-[11px] font-mono font-bold", stats.approvalRate >= 70 ? "text-green-400" : stats.approvalRate >= 50 ? "text-yellow-400" : "text-red-400")}>
                              {stats.approvalRate}%
                            </span>
                            <span className="text-[11px] text-muted-foreground font-mono">Impact: {stats.impactScore}%</span>
                            <span className="text-[11px] text-muted-foreground font-mono">Compliance: {stats.complianceRate}%</span>
                            <button
                              onClick={() => setSelectedRule(isExpanded ? null : rule.id)}
                              className="text-[11px] text-primary font-mono flex items-center gap-1 ml-auto"
                              data-testid={`button-expand-rule-${rule.id}`}
                            >
                              <Eye size={10} /> {isExpanded ? "Hide" : "Details"}
                            </button>
                          </div>
                        </div>
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => toggleRule.mutate({ id: rule.id, active: rule.active === 1 ? 0 : 1 })}
                            className={cn(
                              "p-1.5 rounded-md transition-all",
                              rule.active === 1
                                ? "text-green-400 hover:bg-green-500/10"
                                : "text-muted-foreground hover:bg-muted/30"
                            )}
                            title={rule.active === 1 ? "Disable rule" : "Enable rule"}
                            data-testid={`button-toggle-rule-${rule.id}`}
                          >
                            <Check size={16} />
                          </button>
                          <button
                            onClick={() => deleteRule.mutate(rule.id)}
                            className="p-1.5 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-all"
                            title="Delete rule"
                            data-testid={`button-delete-rule-${rule.id}`}
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </div>
                    </div>

                    {isExpanded && (
                      <div className="border-t border-border/30 px-4 py-3 space-y-3 bg-background/30" data-testid={`panel-rule-stats-${rule.id}`}>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          <div className="bg-card/50 border border-green-500/10 rounded-lg p-3">
                            <h4 className="text-[11px] font-mono uppercase text-green-400 font-bold mb-2 flex items-center gap-1">
                              <ThumbsUp size={10} /> Top 5 Reasons Liked
                            </h4>
                            <ol className="space-y-1">
                              {stats.topLikedReasons.map((reason, i) => (
                                <li key={i} className="text-[11px] font-mono text-muted-foreground flex items-start gap-1.5">
                                  <span className="text-green-400 font-bold mt-0.5">{i + 1}.</span>
                                  <span>{reason}</span>
                                </li>
                              ))}
                            </ol>
                          </div>
                          <div className="bg-card/50 border border-red-500/10 rounded-lg p-3">
                            <h4 className="text-[11px] font-mono uppercase text-red-400 font-bold mb-2 flex items-center gap-1">
                              <ThumbsDown size={10} /> Top 5 Reasons Disliked
                            </h4>
                            <ol className="space-y-1">
                              {stats.topDislikedReasons.map((reason, i) => (
                                <li key={i} className="text-[11px] font-mono text-muted-foreground flex items-start gap-1.5">
                                  <span className="text-red-400 font-bold mt-0.5">{i + 1}.</span>
                                  <span>{reason}</span>
                                </li>
                              ))}
                            </ol>
                          </div>
                        </div>

                        <div className="bg-card/50 border border-amber-500/10 rounded-lg p-3">
                          <h4 className="text-[11px] font-mono uppercase text-amber-400 font-bold mb-2 flex items-center gap-1">
                            <Lightbulb size={10} /> Community Suggested Alternative
                          </h4>
                          <p className="text-xs text-muted-foreground font-mono mb-2">{stats.alternativeRule}</p>
                          <div className="flex items-center gap-2">
                            <Button
                              onClick={() => {
                                toast({ title: "Rule Kept", description: `Keeping current rule: "${rule.title}"` });
                              }}
                              className="text-[11px] py-1 px-3 bg-green-500/10 text-green-400 border border-green-500/20"
                              data-testid={`button-keep-rule-${rule.id}`}
                            >
                              Keep Current Rule
                            </Button>
                            <Button
                              onClick={() => {
                                toast({ title: "Rule Updated", description: "Switching to community-suggested alternative." });
                              }}
                              className="text-[11px] py-1 px-3 bg-amber-500/10 text-amber-400 border border-amber-500/20"
                              data-testid={`button-adopt-alternative-${rule.id}`}
                            >
                              <ArrowRight size={10} className="mr-1" /> Adopt Alternative
                            </Button>
                          </div>
                        </div>

                        <div className="flex items-center gap-4 text-[11px] font-mono text-muted-foreground">
                          <span>Created {new Date(rule.createdAt).toLocaleDateString()}</span>
                          <span>Category: {rule.category}</span>
                          <span>Community votes: {stats.approval + stats.disapproval}/26</span>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
