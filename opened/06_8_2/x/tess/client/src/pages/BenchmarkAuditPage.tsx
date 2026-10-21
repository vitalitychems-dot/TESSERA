import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  CheckCircle2, XCircle, AlertTriangle, TrendingUp, TrendingDown, Minus,
  RefreshCw, BarChart3, Shield, Cpu, Zap, Brain, Target, Activity,
  ChevronRight, ChevronDown, Award, FlaskConical, Database, Globe, Lock, Key
} from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";

interface CategoryAudit {
  name: string;
  simulatedScore: number;
  realScore: number;
  gap: number;
  testDescription: string;
  testResult: string;
  passed: boolean;
  improvementsNeeded: string[];
  improvementsApplied: string[];
  reachedTarget: boolean;
}

interface DimensionAudit {
  name: string;
  simulatedScore: number;
  realScore: number;
  gap: number;
  measurementMethod: string;
  evidence: string;
  status: "genuine_100" | "improving" | "gap_identified" | "external_dependency";
}

interface IndustryComparison {
  category: string;
  tesseraScore: number;
  gpt4oScore: number;
  claude35Score: number;
  tesseraAdvantage: boolean;
  honestAssessment: string;
  evidence: string;
}

interface DependencyTrainingResult {
  dependency: string;
  type: "npm" | "api" | "system" | "library";
  knowledgeVerified: boolean;
  canGenerateCode: boolean;
  canExplainAPI: boolean;
  score: number;
  evidence: string;
}

interface AuditReport {
  generatedAt: number;
  categoryAudits: CategoryAudit[];
  dimensionAudits: DimensionAudit[];
  industryComparisons: IndustryComparison[];
  dependencyTraining: DependencyTrainingResult[];
  overallCategoryScore: number;
  overallDimensionScore: number;
  categoriesAt100: number;
  categoriesAbove95: number;
  improvementCyclesRun: number;
  finalVerifiedScore: number;
  verdict: string;
  trendData: Array<{ timestamp: number; score: number; label: string }>;
}

interface ExternalDependencyEntry {
  name: string;
  category: "llm_inference" | "data" | "blockchain" | "auth" | "storage";
  configured: boolean;
  functionalityDependent: string[];
  sovereigntyImpact: "critical" | "high" | "medium" | "low";
  sovereignAlternative: string;
  dependencyPercent: number;
}

interface AGIBenchmarkLatest {
  externalDependencyAudit?: ExternalDependencyEntry[];
  percentile?: number;
  grade?: string;
}

function ScoreBadge({ score, target = 95 }: { score: number; target?: number }) {
  const color = score >= 95 ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/30"
    : score >= 80 ? "bg-blue-500/20 text-blue-300 border-blue-500/30"
    : score >= 60 ? "bg-amber-500/20 text-amber-300 border-amber-500/30"
    : "bg-red-500/20 text-red-300 border-red-500/30";
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-mono font-bold border ${color}`}>
      {score}%
    </span>
  );
}

function GapBadge({ gap }: { gap: number }) {
  if (gap > 5) return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-mono bg-emerald-900/30 text-emerald-400 border border-emerald-500/20">
      <TrendingUp className="w-3 h-3" />+{gap}%
    </span>
  );
  if (gap < -5) return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-mono bg-red-900/30 text-red-400 border border-red-500/20">
      <TrendingDown className="w-3 h-3" />{gap}%
    </span>
  );
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-mono bg-slate-800 text-slate-400 border border-slate-600/20">
      <Minus className="w-3 h-3" />{gap > 0 ? `+${gap}` : gap}%
    </span>
  );
}

function DimStatusBadge({ status }: { status: DimensionAudit["status"] }) {
  if (status === "genuine_100") return <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-500/30 text-[10px]">Verified</Badge>;
  if (status === "improving") return <Badge className="bg-blue-500/20 text-blue-300 border-blue-500/30 text-[10px]">Improving</Badge>;
  if (status === "external_dependency") return <Badge className="bg-amber-500/20 text-amber-300 border-amber-500/30 text-[10px]">External</Badge>;
  return <Badge className="bg-red-500/20 text-red-300 border-red-500/30 text-[10px]">Gap</Badge>;
}

function CategoryCard({ audit }: { audit: CategoryAudit }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div
      className={`rounded-lg border p-3 cursor-pointer transition-all ${
        audit.reachedTarget
          ? "border-emerald-500/30 bg-emerald-950/20"
          : audit.realScore >= 80
          ? "border-blue-500/20 bg-blue-950/10"
          : "border-amber-500/20 bg-amber-950/10"
      }`}
      onClick={() => setExpanded(e => !e)}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          {audit.reachedTarget
            ? <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            : audit.passed
            ? <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
            : <XCircle className="w-4 h-4 text-red-400 shrink-0" />}
          <span className="text-xs font-medium text-slate-200 truncate">{audit.name}</span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-[10px] text-slate-500 font-mono line-through">{audit.simulatedScore}%</span>
          <ScoreBadge score={audit.realScore} />
          <GapBadge gap={audit.gap} />
          {expanded ? <ChevronDown className="w-3 h-3 text-slate-500" /> : <ChevronRight className="w-3 h-3 text-slate-500" />}
        </div>
      </div>
      <div className="mt-2">
        <Progress value={audit.realScore} className="h-1" />
      </div>
      {expanded && (
        <div className="mt-3 space-y-2 border-t border-white/5 pt-3">
          <div className="text-[11px] text-slate-400 font-mono bg-black/30 rounded p-2 leading-relaxed">
            {audit.testResult}
          </div>
          {audit.improvementsApplied.length > 0 && (
            <div>
              <div className="text-[10px] text-emerald-400 font-mono mb-1 uppercase tracking-wider">Improvements Applied</div>
              <ul className="space-y-1">
                {audit.improvementsApplied.map((imp, i) => (
                  <li key={i} className="flex items-start gap-1.5 text-[11px] text-slate-300">
                    <CheckCircle2 className="w-3 h-3 text-emerald-400 shrink-0 mt-0.5" />
                    {imp}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {audit.improvementsNeeded.length > 0 && (
            <div>
              <div className="text-[10px] text-amber-400 font-mono mb-1 uppercase tracking-wider">Still Needed</div>
              <ul className="space-y-1">
                {audit.improvementsNeeded.map((imp, i) => (
                  <li key={i} className="flex items-start gap-1.5 text-[11px] text-slate-400">
                    <ChevronRight className="w-3 h-3 text-amber-400 shrink-0 mt-0.5" />
                    {imp}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function DimensionCard({ dim }: { dim: DimensionAudit }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div
      className="rounded-lg border border-white/8 bg-white/[0.02] p-3 cursor-pointer hover:bg-white/[0.04] transition-all"
      onClick={() => setExpanded(e => !e)}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-medium text-slate-200 truncate">{dim.name}</span>
        <div className="flex items-center gap-2 shrink-0">
          <DimStatusBadge status={dim.status} />
          <span className="text-[10px] text-slate-500 font-mono line-through">{dim.simulatedScore}%</span>
          <ScoreBadge score={dim.realScore} />
          <GapBadge gap={dim.gap} />
        </div>
      </div>
      <div className="mt-2">
        <Progress value={dim.realScore} className="h-1" />
      </div>
      {expanded && (
        <div className="mt-3 space-y-2 border-t border-white/5 pt-3">
          <div className="text-[10px] text-slate-500 uppercase tracking-wider font-mono">{dim.measurementMethod}</div>
          <div className="text-[11px] text-slate-400 font-mono bg-black/30 rounded p-2">{dim.evidence}</div>
        </div>
      )}
    </div>
  );
}

function IndustryCard({ comp }: { comp: IndustryComparison }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div
      className="rounded-lg border border-white/8 bg-white/[0.02] p-3 cursor-pointer hover:bg-white/[0.04] transition-all"
      onClick={() => setExpanded(e => !e)}
    >
      <div className="flex items-center justify-between gap-2 mb-2">
        <span className="text-xs font-medium text-slate-200">{comp.category}</span>
        {comp.tesseraAdvantage
          ? <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-500/30 text-[10px]">Tessera Leads</Badge>
          : <Badge className="bg-slate-700 text-slate-400 border-slate-600 text-[10px]">Gap Exists</Badge>}
      </div>
      <div className="grid grid-cols-3 gap-2 text-center">
        <div>
          <div className="text-[10px] text-slate-500 mb-1">Tessera</div>
          <ScoreBadge score={comp.tesseraScore} />
        </div>
        <div>
          <div className="text-[10px] text-slate-500 mb-1">GPT-4o</div>
          <ScoreBadge score={comp.gpt4oScore} />
        </div>
        <div>
          <div className="text-[10px] text-slate-500 mb-1">Claude 3.5</div>
          <ScoreBadge score={comp.claude35Score} />
        </div>
      </div>
      {expanded && (
        <div className="mt-3 space-y-2 border-t border-white/5 pt-3">
          <div className="text-[11px] text-slate-300 leading-relaxed">{comp.honestAssessment}</div>
          <div className="text-[11px] text-slate-500 font-mono bg-black/30 rounded p-2">{comp.evidence}</div>
        </div>
      )}
    </div>
  );
}

function DependencyCard({ dep }: { dep: DependencyTrainingResult }) {
  const typeColor = dep.type === "npm" ? "text-blue-400" : dep.type === "api" ? "text-purple-400" : dep.type === "system" ? "text-emerald-400" : "text-amber-400";
  return (
    <div className="flex items-center gap-3 p-2 rounded-lg border border-white/5 bg-white/[0.02]">
      <div className={`text-[10px] font-mono font-bold uppercase ${typeColor} w-8 shrink-0`}>{dep.type.slice(0, 3)}</div>
      <div className="flex-1 min-w-0">
        <div className="text-[11px] font-medium text-slate-300 truncate">{dep.dependency}</div>
        <div className="flex items-center gap-2 mt-0.5">
          {dep.canGenerateCode && <span className="text-[9px] text-emerald-400">Code</span>}
          {dep.canExplainAPI && <span className="text-[9px] text-blue-400">API</span>}
          {dep.knowledgeVerified && <span className="text-[9px] text-purple-400">Verified</span>}
        </div>
      </div>
      <ScoreBadge score={dep.score} />
    </div>
  );
}

function ExternalDepCard({ dep }: { dep: ExternalDependencyEntry }) {
  const [expanded, setExpanded] = useState(false);
  const impactColor = dep.sovereigntyImpact === "critical" ? "border-red-500/30 bg-red-950/15"
    : dep.sovereigntyImpact === "high" ? "border-orange-500/25 bg-orange-950/10"
    : dep.sovereigntyImpact === "medium" ? "border-yellow-500/20 bg-yellow-950/10"
    : "border-blue-500/15 bg-blue-950/5";
  const impactBadge = dep.sovereigntyImpact === "critical" ? "bg-red-500/20 text-red-300 border-red-500/30"
    : dep.sovereigntyImpact === "high" ? "bg-orange-500/20 text-orange-300 border-orange-500/30"
    : dep.sovereigntyImpact === "medium" ? "bg-yellow-500/20 text-yellow-300 border-yellow-500/30"
    : "bg-blue-500/20 text-blue-300 border-blue-500/30";
  const catLabel = dep.category === "llm_inference" ? "LLM" : dep.category === "storage" ? "DB"
    : dep.category === "blockchain" ? "Chain" : dep.category === "auth" ? "Auth" : "Data";
  const catColor = dep.category === "llm_inference" ? "text-violet-400" : dep.category === "storage" ? "text-emerald-400"
    : dep.category === "blockchain" ? "text-amber-400" : "text-blue-400";
  return (
    <div className={`rounded-lg border p-3 cursor-pointer transition-all ${impactColor}`} onClick={() => setExpanded(e => !e)}>
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          {dep.sovereigntyImpact === "critical" || dep.sovereigntyImpact === "high"
            ? <AlertTriangle className={`w-4 h-4 shrink-0 ${dep.sovereigntyImpact === "critical" ? "text-red-400" : "text-orange-400"}`} />
            : dep.dependencyPercent === 0
            ? <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
            : <Shield className="w-4 h-4 shrink-0 text-yellow-400" />}
          <span className="text-xs font-medium text-slate-200 truncate">{dep.name}</span>
          <span className={`text-[9px] font-mono font-bold uppercase ${catColor} shrink-0`}>{catLabel}</span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-mono font-bold border ${impactBadge}`}>
            {dep.sovereigntyImpact}
          </span>
          <span className={`text-xs font-mono font-bold ${dep.dependencyPercent >= 80 ? "text-red-400" : dep.dependencyPercent >= 40 ? "text-amber-400" : "text-emerald-400"}`}>
            {dep.dependencyPercent}% dep
          </span>
          {dep.configured
            ? <span className="text-[9px] text-emerald-400 font-mono">configured</span>
            : <span className="text-[9px] text-red-400 font-mono">not configured</span>}
          {expanded ? <ChevronDown className="w-3 h-3 text-slate-500" /> : <ChevronRight className="w-3 h-3 text-slate-500" />}
        </div>
      </div>
      <div className="mt-2">
        <div className="flex items-center gap-1">
          <div className="flex-1 h-1.5 bg-slate-800 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full ${dep.dependencyPercent >= 80 ? "bg-red-500" : dep.dependencyPercent >= 40 ? "bg-amber-500" : "bg-emerald-500"}`}
              style={{ width: `${dep.dependencyPercent}%` }}
            />
          </div>
          <span className="text-[9px] text-slate-500 font-mono w-8 text-right">{dep.dependencyPercent}%</span>
        </div>
      </div>
      {expanded && (
        <div className="mt-3 space-y-2 border-t border-white/5 pt-3">
          <div>
            <div className="text-[10px] text-amber-400 font-mono mb-1 uppercase tracking-wider">Core functionality dependent</div>
            <div className="flex flex-wrap gap-1">
              {dep.functionalityDependent.map((fn, i) => (
                <span key={i} className="text-[10px] px-1.5 py-0.5 rounded bg-white/5 text-slate-300 border border-white/8">{fn}</span>
              ))}
            </div>
          </div>
          <div>
            <div className="text-[10px] text-emerald-400 font-mono mb-1 uppercase tracking-wider">Sovereign alternative</div>
            <div className="text-[11px] text-slate-400 font-mono bg-black/30 rounded p-2 leading-relaxed">{dep.sovereignAlternative}</div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function BenchmarkAuditPage() {
  const [activeTab, setActiveTab] = useState("overview");

  const { data: report, isLoading, error } = useQuery<AuditReport>({
    queryKey: ["/api/benchmark-audit/report"],
    refetchOnWindowFocus: false,
  });

  const { data: agiBenchmark } = useQuery<AGIBenchmarkLatest>({
    queryKey: ["/api/agi-benchmark/latest"],
    refetchOnWindowFocus: false,
    retry: 1,
  });

  const runMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/benchmark-audit/run"),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/benchmark-audit/report"] });
      queryClient.invalidateQueries({ queryKey: ["/api/agi-benchmark/latest"] });
    },
  });

  if (isLoading) return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="text-center space-y-4">
        <div className="w-12 h-12 border-2 border-violet-500/50 border-t-violet-400 rounded-full animate-spin mx-auto" />
        <div className="text-slate-400 text-sm font-mono">Running initial audit...</div>
      </div>
    </div>
  );

  if (error || !report) return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="text-center space-y-4">
        <XCircle className="w-12 h-12 text-red-500 mx-auto" />
        <div className="text-slate-400 text-sm">Audit data unavailable</div>
        <Button onClick={() => runMutation.mutate()} variant="outline" size="sm">Run Audit</Button>
      </div>
    </div>
  );

  const topCategories = [...(report.categoryAudits || [])].sort((a, b) => b.realScore - a.realScore).slice(0, 5);
  const weakCategories = [...(report.categoryAudits || [])].sort((a, b) => a.realScore - b.realScore).slice(0, 5);

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-950 via-black to-gray-950 text-white p-4 md:p-6">
      <div className="max-w-7xl mx-auto space-y-6">

        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 rounded-xl bg-violet-500/20 border border-violet-500/30">
                <FlaskConical className="w-6 h-6 text-violet-400" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-white">Benchmark Audit</h1>
                <p className="text-slate-400 text-sm">Real capability measurement — no simulated scores</p>
              </div>
            </div>
          </div>
          <Button
            onClick={() => runMutation.mutate()}
            disabled={runMutation.isPending}
            className="bg-violet-600 hover:bg-violet-500 text-white shrink-0"
            size="sm"
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${runMutation.isPending ? "animate-spin" : ""}`} />
            {runMutation.isPending ? "Running..." : "Re-run Audit"}
          </Button>
        </div>

        {/* Score Summary */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: "Verified Score", value: `${report.finalVerifiedScore}%`, icon: Award, color: "text-violet-400", bg: "bg-violet-500/10 border-violet-500/20" },
            { label: "Categories ≥95%", value: `${report.categoriesAbove95}/28`, icon: Target, color: "text-emerald-400", bg: "bg-emerald-500/10 border-emerald-500/20" },
            { label: "Category Avg", value: `${report.overallCategoryScore}%`, icon: BarChart3, color: "text-blue-400", bg: "bg-blue-500/10 border-blue-500/20" },
            { label: "Dimension Avg", value: `${report.overallDimensionScore}%`, icon: Activity, color: "text-amber-400", bg: "bg-amber-500/10 border-amber-500/20" },
          ].map((s) => (
            <Card key={s.label} className={`border ${s.bg} bg-transparent`}>
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-2">
                  <s.icon className={`w-4 h-4 ${s.color}`} />
                  <span className="text-xs text-slate-400">{s.label}</span>
                </div>
                <div className={`text-2xl font-bold font-mono ${s.color}`}>{s.value}</div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Verdict Banner */}
        <div className={`rounded-xl border p-4 ${
          report.finalVerifiedScore >= 95
            ? "bg-emerald-950/30 border-emerald-500/30"
            : report.finalVerifiedScore >= 85
            ? "bg-blue-950/30 border-blue-500/30"
            : "bg-amber-950/30 border-amber-500/30"
        }`}>
          <div className="flex items-center gap-3">
            <CheckCircle2 className={`w-5 h-5 ${report.finalVerifiedScore >= 95 ? "text-emerald-400" : report.finalVerifiedScore >= 85 ? "text-blue-400" : "text-amber-400"}`} />
            <div>
              <div className="font-bold text-white">{report.verdict}</div>
              <div className="text-xs text-slate-400 mt-0.5">
                Last run: {new Date(report.generatedAt).toLocaleString()} · {report.improvementCyclesRun} audit cycles completed
              </div>
            </div>
          </div>
        </div>

        {/* Trend Line */}
        {report.trendData.length > 1 && (
          <Card className="border border-white/8 bg-transparent">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-emerald-400" />
                Score Trend
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-end gap-1 h-16">
                {report.trendData.map((d, i) => {
                  const maxScore = Math.max(...report.trendData.map(t => t.score));
                  const height = maxScore > 0 ? (d.score / maxScore) * 100 : 50;
                  const isLast = i === report.trendData.length - 1;
                  return (
                    <div
                      key={i}
                      className={`flex-1 rounded-t transition-all ${isLast ? "bg-violet-500" : "bg-slate-700"}`}
                      style={{ height: `${height}%` }}
                      title={`${d.label}: ${d.score}%`}
                    />
                  );
                })}
              </div>
              <div className="flex justify-between text-[10px] text-slate-600 mt-1 font-mono">
                <span>{report.trendData[0]?.score}%</span>
                <span>Current: {report.finalVerifiedScore}%</span>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="bg-white/5 border border-white/10 w-full overflow-x-auto">
            <TabsTrigger value="overview" className="text-xs">Overview</TabsTrigger>
            <TabsTrigger value="categories" className="text-xs">28 Categories</TabsTrigger>
            <TabsTrigger value="dimensions" className="text-xs">20 Dimensions</TabsTrigger>
            <TabsTrigger value="industry" className="text-xs">Industry Comparison</TabsTrigger>
            <TabsTrigger value="ext-deps" className="text-xs">External Deps</TabsTrigger>
            <TabsTrigger value="dependencies" className="text-xs">NPM/APIs</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-4 mt-4">
            <div className="grid md:grid-cols-2 gap-4">
              <Card className="border border-emerald-500/20 bg-emerald-950/10">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2 text-emerald-400">
                    <TrendingUp className="w-4 h-4" />
                    Top 5 Categories (Genuine)
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {topCategories.map(c => (
                    <div key={c.name} className="flex items-center justify-between gap-2">
                      <span className="text-xs text-slate-300 truncate">{c.name}</span>
                      <ScoreBadge score={c.realScore} />
                    </div>
                  ))}
                </CardContent>
              </Card>
              <Card className="border border-amber-500/20 bg-amber-950/10">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2 text-amber-400">
                    <Target className="w-4 h-4" />
                    Improvement Opportunities
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {weakCategories.map(c => (
                    <div key={c.name} className="flex items-center justify-between gap-2">
                      <span className="text-xs text-slate-300 truncate">{c.name}</span>
                      <div className="flex items-center gap-2">
                        <ScoreBadge score={c.realScore} />
                        <span className="text-[10px] text-slate-600 font-mono">→95%</span>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </div>

            <div className="grid md:grid-cols-3 gap-4">
              <Card className="border border-white/8 bg-transparent">
                <CardContent className="p-4 text-center">
                  <Globe className="w-8 h-8 text-violet-400 mx-auto mb-2" />
                  <div className="text-2xl font-bold text-white font-mono">
                    {(report.industryComparisons || []).filter(c => c.tesseraAdvantage).length}
                  </div>
                  <div className="text-xs text-slate-400">Industry Categories Led</div>
                </CardContent>
              </Card>
              <Card className="border border-white/8 bg-transparent">
                <CardContent className="p-4 text-center">
                  <Database className="w-8 h-8 text-blue-400 mx-auto mb-2" />
                  <div className="text-2xl font-bold text-white font-mono">
                    {(report.dependencyTraining || []).filter(d => d.knowledgeVerified).length}
                  </div>
                  <div className="text-xs text-slate-400">Dependencies Verified</div>
                </CardContent>
              </Card>
              <Card className="border border-white/8 bg-transparent">
                <CardContent className="p-4 text-center">
                  <Shield className="w-8 h-8 text-emerald-400 mx-auto mb-2" />
                  <div className="text-2xl font-bold text-white font-mono">
                    {(report.dimensionAudits || []).filter(d => d.status === "genuine_100").length}
                  </div>
                  <div className="text-xs text-slate-400">Dimensions Verified</div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="categories" className="mt-4">
            <div className="mb-3 flex items-center justify-between">
              <div className="text-sm text-slate-400">
                {(report.categoryAudits || []).filter(c => c.reachedTarget).length} of {(report.categoryAudits || []).length} categories at ≥95% real score
              </div>
              <div className="flex items-center gap-2 text-[11px] text-slate-500">
                <span className="w-2 h-2 rounded-full bg-emerald-400 inline-block" /> ≥95%
                <span className="w-2 h-2 rounded-full bg-amber-400 inline-block" /> ≥70%
                <span className="w-2 h-2 rounded-full bg-red-400 inline-block" /> &lt;70%
              </div>
            </div>
            <div className="grid md:grid-cols-2 gap-3">
              {(report.categoryAudits || []).map(audit => (
                <CategoryCard key={audit.name} audit={audit} />
              ))}
            </div>
          </TabsContent>

          <TabsContent value="dimensions" className="mt-4">
            <div className="mb-3 text-sm text-slate-400">
              20-dimension AGI benchmark suite — real measurements vs simulated scores
            </div>
            <div className="space-y-2">
              {(report.dimensionAudits || []).map(dim => (
                <DimensionCard key={dim.name} dim={dim} />
              ))}
            </div>
          </TabsContent>

          <TabsContent value="industry" className="mt-4">
            <div className="mb-3 text-sm text-slate-400">
              Honest comparison against GPT-4o and Claude 3.5 — inflated scores corrected
            </div>
            <div className="space-y-3">
              {(report.industryComparisons || []).map(comp => (
                <IndustryCard key={comp.category} comp={comp} />
              ))}
            </div>
            <div className="mt-4 rounded-lg border border-amber-500/20 bg-amber-950/10 p-4">
              <div className="flex items-start gap-3">
                <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                <div className="text-xs text-slate-300">
                  <strong className="text-amber-300">Honest Assessment Policy:</strong> Scores where Tessera routes to external LLMs reflect the quality of those models, not native capability. Genuine advantages exist in sovereignty, swarm coordination, persistent memory, self-improvement, and economic autonomy. Conventional LLM benchmarks (MMLU, HumanEval) favor larger pretrained models which Tessera accesses via routing.
                </div>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="ext-deps" className="mt-4">
            <div className="mb-3">
              <div className="text-sm text-slate-400">External API dependency audit — what the system relies on externally and what percentage of core functionality depends on each</div>
            </div>
            {agiBenchmark?.externalDependencyAudit && agiBenchmark.externalDependencyAudit.length > 0 ? (
              <>
                <div className="mb-4 grid grid-cols-2 md:grid-cols-3 gap-3">
                  <div className="rounded-lg border border-red-500/20 bg-red-950/10 p-3 text-center">
                    <div className="text-xl font-bold text-red-400 font-mono">
                      {agiBenchmark.externalDependencyAudit.filter(d => d.sovereigntyImpact === "critical").length}
                    </div>
                    <div className="text-[10px] text-slate-400 mt-1">Critical Dependencies</div>
                  </div>
                  <div className="rounded-lg border border-orange-500/15 bg-orange-950/10 p-3 text-center">
                    <div className="text-xl font-bold text-orange-400 font-mono">
                      {agiBenchmark.externalDependencyAudit.filter(d => d.sovereigntyImpact === "high").length}
                    </div>
                    <div className="text-[10px] text-slate-400 mt-1">High Impact Dependencies</div>
                  </div>
                  <div className="rounded-lg border border-emerald-500/20 bg-emerald-950/10 p-3 text-center">
                    <div className="text-xl font-bold text-emerald-400 font-mono">
                      {agiBenchmark.externalDependencyAudit.filter(d => d.dependencyPercent === 0).length}
                    </div>
                    <div className="text-[10px] text-slate-400 mt-1">Fully Sovereign</div>
                  </div>
                </div>
                <div className="rounded-lg border border-red-500/20 bg-red-950/10 p-3 mb-4 flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                  <div className="text-xs text-slate-300">
                    <strong className="text-red-300">Core Intelligence Gap:</strong> All chat responses, code generation, reasoning, summarization, and creative writing route through external LLM providers (Groq, OpenRouter, OpenAI, Anthropic). The system has no internal transformer model — NLU sovereignty is ~8%. Fixing this requires self-hosted GPU inference (Ollama + a capable model).
                  </div>
                </div>
                <div className="space-y-2">
                  {agiBenchmark.externalDependencyAudit.map((dep, i) => (
                    <ExternalDepCard key={`${dep.name}-${i}`} dep={dep} />
                  ))}
                </div>
              </>
            ) : (
              <div className="text-center py-8 text-slate-500">
                <Key className="w-8 h-8 mx-auto mb-2 opacity-40" />
                <div className="text-sm">Run the AGI benchmark to load external dependency data</div>
              </div>
            )}
          </TabsContent>

          <TabsContent value="dependencies" className="mt-4">
            <div className="mb-3 text-sm text-slate-400">
              Dependency training pipeline — verifying system knowledge of all npm packages, APIs, and system capabilities
            </div>
            <div className="grid gap-2">
              {(report.dependencyTraining || []).map((dep, i) => (
                <DependencyCard key={`${dep.dependency}-${i}`} dep={dep} />
              ))}
            </div>
            <div className="mt-4 p-4 rounded-lg border border-white/8 bg-white/[0.02]">
              <div className="text-xs text-slate-400">
                <strong className="text-slate-300">Dependency Training Score:</strong>{" "}
                {(report.dependencyTraining || []).length > 0
                  ? Math.round((report.dependencyTraining || []).reduce((s, d) => s + d.score, 0) / (report.dependencyTraining || []).length)
                  : 0}% average across {(report.dependencyTraining || []).length} dependencies
              </div>
            </div>
          </TabsContent>
        </Tabs>

      </div>
    </div>
  );
}
