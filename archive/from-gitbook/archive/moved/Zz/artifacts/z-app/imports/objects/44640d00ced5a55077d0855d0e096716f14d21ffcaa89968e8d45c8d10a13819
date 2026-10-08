import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Shield, Activity, Lock, Eye, Zap, AlertTriangle, CheckCircle, XCircle, RefreshCw, Target, Brain, TrendingUp, Server, Key, Database, Bell } from "lucide-react";

interface CategoryAssessment {
  name: string;
  honestScore: number;
  inflatedScore: number;
  benchmarkPassed: boolean;
  benchmarkDescription: string;
  externalApiDependency: boolean;
  canOperateWithoutExternalApi: boolean;
  gaps: string[];
}

interface SovereigntyGap {
  id: string;
  category: string;
  description: string;
  severity: string;
  currentCapability: number;
  requiredCapability: number;
  actionRequired: string;
  estimatedEffort: string;
  status: string;
}

interface RoadmapItem {
  rank: number;
  gapId: string;
  category: string;
  action: string;
  priority: string;
  impact: number;
  effort: string;
}

interface DashboardData {
  assessment: {
    overallSovereigntyPercent: number;
    honestAGIScore: number;
    categoriesAssessed: number;
    categoriesPassing: number;
    externalApiDependencies: number;
    internalOperationPercent: number;
    gaps: SovereigntyGap[];
    prioritizedRoadmap: RoadmapItem[];
    assessedAt: string;
  };
  gateway: {
    totalRequests: number;
    blockedRequests: number;
    anonymizedRequests: number;
    uniqueExternalDomains: string[];
    avgResponseTimeMs: number;
  } | null;
  security: {
    totalScans: number;
    blockedRequests: number;
    leakageDetections: number;
    criticalAlerts: number;
    monitoringActive: boolean;
    recentAlerts: { id: string; severity: string; type: string; description: string; timestamp: number }[];
  } | null;
  pipeline: {
    totalProposals: number;
    submitted: number;
    approved: number;
    executed: number;
    verified: number;
    successRate: number;
    avgImprovementPercent: number;
  } | null;
  roadmap: {
    totalTasks: number;
    completed: number;
    failed: number;
    completionPercent: number;
    avgImprovement: number;
    isRunning: boolean;
  } | null;
}

interface SovereignStackScore {
  sovereigntyScore: number;
  maxScore: number;
  grade: string;
  summary: string;
  timestamp: string;
  components: {
    inference: {
      tier0: boolean;
      tier1: boolean;
      tier2: boolean;
      sovereigntyScore: number;
      totalRequests: number;
      selfHostedRequests: number;
      ollamaAvailable: boolean;
      ollamaModels: string[];
      ollamaEndpoint: string;
    };
    keyVault: {
      totalKeys: number;
      activeKeys: number;
      healthyKeys: number;
      rotationDue: number;
      rateLimited: number;
    };
    cryptoPipeline: {
      totalFetches: number;
      rpcFetches: number;
      cacheHits: number;
      avgLatencyMs: number;
      externalApiKeyRequired: boolean;
    };
    notifications: {
      inAppAvailable: boolean;
      emailAvailable: boolean;
      discordOptional: boolean;
      telegramOptional: boolean;
      webhooksConfigured: number;
      discordRequired: boolean;
    };
  };
}

function ScoreGauge({ value, label, color }: { value: number; label: string; color: string }) {
  const activeTab = "all" as any;
  const setActiveTab = (_: any) => {};
  return (
    <div className="flex flex-col items-center">
      <div className="relative w-24 h-24">
        <svg className="w-24 h-24 transform -rotate-90" viewBox="0 0 100 100">
          <circle cx="50" cy="50" r="40" fill="none" stroke="#1a1a2e" strokeWidth="8" />
          <circle cx="50" cy="50" r="40" fill="none" stroke={color} strokeWidth="8"
            strokeDasharray={`${value * 2.51} ${251 - value * 2.51}`} strokeLinecap="round" />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-lg font-bold" style={{ color }}>{value.toFixed(0)}%</span>
        </div>
      </div>
      <span className="text-xs text-gray-400 mt-1">{label}</span>
    </div>
  );
}

function SeverityBadge({ severity }: { severity: string }) {
  const colors: Record<string, string> = {
    critical: "bg-red-900/50 text-red-300 border-red-500/30",
    high: "bg-orange-900/50 text-orange-300 border-orange-500/30",
    medium: "bg-yellow-900/50 text-yellow-300 border-yellow-500/30",
    low: "bg-blue-900/50 text-blue-300 border-blue-500/30",
  };
  return (
    <span className={`text-xs px-2 py-0.5 rounded border ${colors[severity] || colors.low}`}>
      {severity}
    </span>
  );
}

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    identified: "bg-gray-700 text-gray-300",
    "in-progress": "bg-blue-900/50 text-blue-300",
    resolved: "bg-green-900/50 text-green-300",
    completed: "bg-green-900/50 text-green-300",
    failed: "bg-red-900/50 text-red-300",
  };
  return (
    <span className={`text-xs px-2 py-0.5 rounded ${colors[status] || "bg-gray-700 text-gray-300"}`}>
      {status}
    </span>
  );
}

function StackStatusRow({ label, ok, detail }: { label: string; ok: boolean; detail?: string }) {
  return (
    <div className="flex items-center justify-between py-1.5 border-b border-gray-800/50 last:border-0">
      <div className="flex items-center gap-2 text-sm text-gray-300">
        {ok ? <CheckCircle className="w-3.5 h-3.5 text-green-400 flex-shrink-0" /> : <XCircle className="w-3.5 h-3.5 text-red-400 flex-shrink-0" />}
        {label}
      </div>
      {detail && <span className="text-xs text-gray-500">{detail}</span>}
    </div>
  );
}

function GradeBadge({ grade }: { grade: string }) {
  const colors: Record<string, string> = {
    "SOVEREIGN": "bg-green-900/50 text-green-300 border-green-500/40",
    "HIGHLY SOVEREIGN": "bg-cyan-900/50 text-cyan-300 border-cyan-500/40",
    "PARTIALLY SOVEREIGN": "bg-yellow-900/50 text-yellow-300 border-yellow-500/40",
    "DEPENDENT": "bg-orange-900/50 text-orange-300 border-orange-500/40",
    "CRITICAL DEPENDENCY": "bg-red-900/50 text-red-300 border-red-500/40",
  };
  return (
    <span className={`text-xs px-2.5 py-1 rounded border font-medium ${colors[grade] || "bg-gray-700 text-gray-300 border-gray-600"}`}>
      {grade}
    </span>
  );
}

export default function SovereigntyDashboardPage({ embedded }: { embedded?: boolean }) {
  const activeTab = "all" as any;
  const queryClient = useQueryClient();

  const { data: dashboard, isLoading, error } = useQuery<DashboardData>({
    queryKey: ["/api/sovereignty/autonomy-dashboard"],
    refetchInterval: 30000,
  });

  const { data: stackScore, isLoading: stackLoading } = useQuery<SovereignStackScore>({
    queryKey: ["/api/sov-stack/score"],
    refetchInterval: 15000,
    enabled: true,
    retry: 1,
  });

  const refreshMutation = useMutation({
    mutationFn: () => fetch("/api/sovereignty/assessment").then(r => r.json()),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/sovereignty/autonomy-dashboard"] }),
  });

  const { data: categories } = useQuery<CategoryAssessment[]>({
    queryKey: ["/api/sovereignty/categories"],
    enabled: true,
  });

  const resetMutation = useMutation({
    mutationFn: () => fetch("/api/sovereignty/reset-baselines", { method: "POST" }).then(r => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/sovereignty/autonomy-dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["/api/sovereignty/categories"] });
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 2, ease: "linear" }}>
          <Shield className="w-8 h-8 text-cyan-400" />
        </motion.div>
      </div>
    );
  }

  if (error || !dashboard) {
    return (
      <div className="p-6 text-center">
        <AlertTriangle className="w-8 h-8 text-yellow-400 mx-auto mb-2" />
        <p className="text-gray-400">Failed to load sovereignty dashboard</p>
        <button onClick={() => refreshMutation.mutate()} className="mt-2 px-4 py-2 bg-cyan-900/50 text-cyan-300 rounded hover:bg-cyan-800/50">
          Run Assessment
        </button>
      </div>
    );
  }

  const { assessment, gateway, security, pipeline, roadmap } = dashboard;

  if (!assessment) {
    return (
      <div className="p-6 text-center">
        <AlertTriangle className="w-8 h-8 text-yellow-400 mx-auto mb-2" />
        <p className="text-gray-400">Assessment data not available yet</p>
        <button onClick={() => refreshMutation.mutate()} className="mt-2 px-4 py-2 bg-cyan-900/50 text-cyan-300 rounded hover:bg-cyan-800/50">
          Run Assessment
        </button>
      </div>
    );
  }

  const tabs = [
    { id: "overview" as const, label: "Overview", icon: Activity },
    { id: "stack" as const, label: "Sovereign Stack", icon: Server },
    { id: "categories" as const, label: "Categories", icon: Brain },
    { id: "gaps" as const, label: "Gaps", icon: Target },
    { id: "gateway" as const, label: "API Gateway", icon: Lock },
    { id: "security" as const, label: "Security", icon: Shield },
    { id: "roadmap" as const, label: "Roadmap", icon: TrendingUp },
  ];

  return (
    <div className={`${embedded ? "" : "p-6"} space-y-6 max-w-7xl mx-auto`}>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-cyan-300 flex items-center gap-2">
            <Shield className="w-6 h-6" />
            AGI Sovereignty Dashboard
          </h1>
          <p className="text-sm text-gray-500 mt-1">Honest capability assessment &amp; sovereignty tracking</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => resetMutation.mutate()} disabled={resetMutation.isPending}
            className="px-3 py-1.5 text-sm bg-orange-900/30 text-orange-300 rounded hover:bg-orange-800/40 border border-orange-500/20 disabled:opacity-50">
            {resetMutation.isPending ? "Resetting..." : "Reset Baselines"}
          </button>
          <button onClick={() => refreshMutation.mutate()} disabled={refreshMutation.isPending}
            className="px-3 py-1.5 text-sm bg-cyan-900/30 text-cyan-300 rounded hover:bg-cyan-800/40 border border-cyan-500/20 disabled:opacity-50 flex items-center gap-1">
            <RefreshCw className={`w-3 h-3 ${refreshMutation.isPending ? "animate-spin" : ""}`} />
            {refreshMutation.isPending ? "Assessing..." : "Re-assess"}
          </button>
        </div>
      </div>

      <div className="flex gap-2 border-b border-gray-800 pb-2 overflow-x-auto">
        {false && tabs.map(tab => (
          <button key={tab.id} 
            className={`flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-t transition whitespace-nowrap ${activeTab === tab.id ? "bg-cyan-900/30 text-cyan-300 border-b-2 border-cyan-400" : "text-gray-500 hover:text-gray-300"}`}>
            <tab.icon className="w-3.5 h-3.5" />
            {tab.label}
          </button>
        ))}
      </div>

      {true && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-gray-900/50 rounded-lg p-4 border border-gray-800 flex flex-col items-center">
              <ScoreGauge value={assessment.honestAGIScore} label="Honest AGI Score" color="#22d3ee" />
            </div>
            <div className="bg-gray-900/50 rounded-lg p-4 border border-gray-800 flex flex-col items-center">
              <ScoreGauge value={assessment.overallSovereigntyPercent} label="Sovereignty %" color="#a78bfa" />
            </div>
            <div className="bg-gray-900/50 rounded-lg p-4 border border-gray-800 flex flex-col items-center">
              <ScoreGauge value={assessment.categoriesAssessed > 0 ? (assessment.categoriesPassing / assessment.categoriesAssessed) * 100 : 0} label="Categories Passing" color="#34d399" />
            </div>
            <div className="bg-gray-900/50 rounded-lg p-4 border border-gray-800 flex flex-col items-center">
              <ScoreGauge value={assessment.internalOperationPercent} label="Internal Ops" color="#fbbf24" />
            </div>
          </div>

          {stackScore && (
            <motion.div className="bg-gray-900/50 rounded-lg p-4 border border-purple-500/20" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-medium text-gray-400 flex items-center gap-1.5">
                  <Server className="w-4 h-4 text-purple-400" />
                  Sovereign Stack Score
                </h3>
                <div className="flex items-center gap-2">
                  <GradeBadge grade={stackScore.grade} />
                  <span className="text-lg font-bold text-purple-300">{stackScore.sovereigntyScore}/100</span>
                </div>
              </div>
              <div className="w-full bg-gray-800 rounded-full h-2 mb-2">
                <div className="h-2 rounded-full bg-gradient-to-r from-purple-500 to-cyan-500 transition-all"
                  style={{ width: `${stackScore.sovereigntyScore}%` }} />
              </div>
              <p className="text-xs text-gray-500">{stackScore.summary}</p>
            </motion.div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <motion.div className="bg-gray-900/50 rounded-lg p-4 border border-gray-800" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
              <h3 className="text-sm font-medium text-gray-400 mb-3 flex items-center gap-1"><Zap className="w-4 h-4 text-cyan-400" /> Action Pipeline</h3>
              {pipeline ? (
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between"><span className="text-gray-500">Proposals</span><span className="text-cyan-300">{pipeline.totalProposals}</span></div>
                  <div className="flex justify-between"><span className="text-gray-500">Verified</span><span className="text-green-300">{pipeline.verified}</span></div>
                  <div className="flex justify-between"><span className="text-gray-500">Success Rate</span><span className="text-cyan-300">{pipeline.successRate}%</span></div>
                  <div className="flex justify-between"><span className="text-gray-500">Avg Improvement</span><span className="text-green-300">{pipeline.avgImprovementPercent}%</span></div>
                </div>
              ) : <p className="text-gray-500 text-sm">Pipeline not active</p>}
            </motion.div>

            <motion.div className="bg-gray-900/50 rounded-lg p-4 border border-gray-800" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
              <h3 className="text-sm font-medium text-gray-400 mb-3 flex items-center gap-1"><Lock className="w-4 h-4 text-purple-400" /> API Gateway</h3>
              {gateway ? (
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between"><span className="text-gray-500">Total Requests</span><span className="text-cyan-300">{gateway.totalRequests}</span></div>
                  <div className="flex justify-between"><span className="text-gray-500">Blocked</span><span className="text-red-300">{gateway.blockedRequests}</span></div>
                  <div className="flex justify-between"><span className="text-gray-500">Anonymized</span><span className="text-green-300">{gateway.anonymizedRequests}</span></div>
                  <div className="flex justify-between"><span className="text-gray-500">External Domains</span><span className="text-yellow-300">{gateway.uniqueExternalDomains.length}</span></div>
                </div>
              ) : <p className="text-gray-500 text-sm">Gateway not active</p>}
            </motion.div>

            <motion.div className="bg-gray-900/50 rounded-lg p-4 border border-gray-800" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
              <h3 className="text-sm font-medium text-gray-400 mb-3 flex items-center gap-1"><Shield className="w-4 h-4 text-red-400" /> Security</h3>
              {security ? (
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between"><span className="text-gray-500">Scans</span><span className="text-cyan-300">{security.totalScans}</span></div>
                  <div className="flex justify-between"><span className="text-gray-500">Blocked</span><span className="text-red-300">{security.blockedRequests}</span></div>
                  <div className="flex justify-between"><span className="text-gray-500">Leakage Detections</span><span className="text-orange-300">{security.leakageDetections}</span></div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Monitoring</span>
                    <span className={security.monitoringActive ? "text-green-300" : "text-red-300"}>
                      {security.monitoringActive ? "Active" : "Inactive"}
                    </span>
                  </div>
                </div>
              ) : <p className="text-gray-500 text-sm">Security not active</p>}
            </motion.div>
          </div>

          {assessment.prioritizedRoadmap.length > 0 && (
            <div className="bg-gray-900/50 rounded-lg p-4 border border-gray-800">
              <h3 className="text-sm font-medium text-gray-400 mb-3 flex items-center gap-1"><Target className="w-4 h-4 text-yellow-400" /> Priority Roadmap (Top 5)</h3>
              <div className="space-y-2">
                {assessment.prioritizedRoadmap.slice(0, 5).map(item => (
                  <div key={item.gapId} className="flex items-center gap-3 text-sm p-2 rounded bg-gray-800/50">
                    <span className="text-gray-500 w-6 text-center">#{item.rank}</span>
                    <SeverityBadge severity={item.priority} />
                    <span className="text-gray-300 flex-1 truncate">{item.action}</span>
                    <span className="text-gray-500">{item.effort}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="text-xs text-gray-600 text-center">
            Last assessed: {assessment.assessedAt ? new Date(assessment.assessedAt).toLocaleString() : "Never"}
          </div>
        </div>
      )}

      {true && (
        <div className="space-y-4">
          {stackLoading && !stackScore ? (
            <div className="flex items-center justify-center py-12">
              <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 2, ease: "linear" }}>
                <Server className="w-8 h-8 text-purple-400" />
              </motion.div>
            </div>
          ) : stackScore ? (
            <>
              <div className="bg-gray-900/50 rounded-lg p-5 border border-purple-500/20">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h2 className="text-lg font-bold text-purple-300 flex items-center gap-2">
                      <Server className="w-5 h-5" />
                      Sovereign Stack
                    </h2>
                    <p className="text-xs text-gray-500 mt-0.5">Self-hosted AI inference · encrypted key vault · direct chain data · self-hosted notifications</p>
                  </div>
                  <div className="text-right">
                    <div className="text-3xl font-bold text-purple-300">{stackScore.sovereigntyScore}<span className="text-lg text-gray-500">/100</span></div>
                    <GradeBadge grade={stackScore.grade} />
                  </div>
                </div>
                <div className="w-full bg-gray-800 rounded-full h-3 mb-2">
                  <div className="h-3 rounded-full bg-gradient-to-r from-purple-600 to-cyan-500 transition-all"
                    style={{ width: `${stackScore.sovereigntyScore}%` }} />
                </div>
                <p className="text-xs text-gray-500">{stackScore.summary}</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <motion.div className="bg-gray-900/50 rounded-lg p-4 border border-gray-800" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
                  <h3 className="text-sm font-semibold text-gray-300 mb-3 flex items-center gap-2">
                    <Brain className="w-4 h-4 text-cyan-400" />
                    AI Inference Gateway
                    <span className="ml-auto text-xs text-gray-500">
                      {stackScore.components.inference.tier0 ? "Tier 0 (Self-hosted)" :
                        stackScore.components.inference.tier1 ? "Tier 1 (Own keys)" :
                        "Tier 2 (Free/Proxy)"}
                    </span>
                  </h3>
                  <div className="space-y-1">
                    <StackStatusRow
                      label="Ollama (self-hosted)"
                      ok={stackScore.components.inference.ollamaAvailable}
                      detail={stackScore.components.inference.ollamaAvailable
                        ? `${stackScore.components.inference.ollamaModels.length} model(s)`
                        : stackScore.components.inference.ollamaEndpoint}
                    />
                    <StackStatusRow
                      label="Own API keys (Groq/SambaNova/Cerebras)"
                      ok={stackScore.components.inference.tier1}
                      detail={stackScore.components.inference.tier1 ? "configured" : "not configured"}
                    />
                    <StackStatusRow
                      label="Free/proxy fallback"
                      ok={stackScore.components.inference.tier2}
                      detail="Pollinations + OpenRouter free"
                    />
                  </div>
                  {stackScore.components.inference.totalRequests > 0 && (
                    <div className="mt-3 pt-3 border-t border-gray-800 grid grid-cols-2 gap-2 text-xs">
                      <div className="text-center">
                        <p className="text-cyan-300 font-bold">{stackScore.components.inference.selfHostedRequests}</p>
                        <p className="text-gray-500">Self-hosted reqs</p>
                      </div>
                      <div className="text-center">
                        <p className="text-purple-300 font-bold">{stackScore.components.inference.totalRequests}</p>
                        <p className="text-gray-500">Total reqs</p>
                      </div>
                    </div>
                  )}
                  {stackScore.components.inference.ollamaAvailable && stackScore.components.inference.ollamaModels.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {stackScore.components.inference.ollamaModels.map(m => (
                        <span key={m} className="text-xs px-1.5 py-0.5 bg-cyan-900/30 text-cyan-400 rounded border border-cyan-500/20">{m}</span>
                      ))}
                    </div>
                  )}
                </motion.div>

                <motion.div className="bg-gray-900/50 rounded-lg p-4 border border-gray-800" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}>
                  <h3 className="text-sm font-semibold text-gray-300 mb-3 flex items-center gap-2">
                    <Key className="w-4 h-4 text-yellow-400" />
                    Sovereign Key Vault
                  </h3>
                  <div className="space-y-1">
                    <StackStatusRow
                      label="AES-256-GCM encryption"
                      ok={true}
                      detail="in-process"
                    />
                    <StackStatusRow
                      label="Keys tracked"
                      ok={stackScore.components.keyVault.totalKeys > 0}
                      detail={`${stackScore.components.keyVault.activeKeys} active / ${stackScore.components.keyVault.totalKeys} total`}
                    />
                    <StackStatusRow
                      label="All keys healthy"
                      ok={stackScore.components.keyVault.healthyKeys === stackScore.components.keyVault.totalKeys && stackScore.components.keyVault.totalKeys > 0}
                      detail={`${stackScore.components.keyVault.healthyKeys} healthy`}
                    />
                    <StackStatusRow
                      label="Rotation up-to-date"
                      ok={stackScore.components.keyVault.rotationDue === 0}
                      detail={stackScore.components.keyVault.rotationDue > 0 ? `${stackScore.components.keyVault.rotationDue} due` : "all current"}
                    />
                    <StackStatusRow
                      label="No rate-limited keys"
                      ok={stackScore.components.keyVault.rateLimited === 0}
                      detail={stackScore.components.keyVault.rateLimited > 0 ? `${stackScore.components.keyVault.rateLimited} limited` : "clear"}
                    />
                  </div>
                </motion.div>

                <motion.div className="bg-gray-900/50 rounded-lg p-4 border border-gray-800" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
                  <h3 className="text-sm font-semibold text-gray-300 mb-3 flex items-center gap-2">
                    <Database className="w-4 h-4 text-green-400" />
                    Crypto Data Pipeline
                  </h3>
                  <div className="space-y-1">
                    <StackStatusRow
                      label="Direct Solana RPC"
                      ok={true}
                      detail="no API key required"
                    />
                    <StackStatusRow
                      label="Jupiter Price API v2"
                      ok={true}
                      detail="keyless"
                    />
                    <StackStatusRow
                      label="GeckoTerminal + DexScreener"
                      ok={true}
                      detail="keyless fallbacks"
                    />
                    <StackStatusRow
                      label="No Birdeye dependency"
                      ok={!stackScore.components.cryptoPipeline.externalApiKeyRequired}
                      detail="replaced"
                    />
                  </div>
                  {stackScore.components.cryptoPipeline.totalFetches > 0 && (
                    <div className="mt-3 pt-3 border-t border-gray-800 grid grid-cols-3 gap-2 text-xs">
                      <div className="text-center">
                        <p className="text-green-300 font-bold">{stackScore.components.cryptoPipeline.rpcFetches}</p>
                        <p className="text-gray-500">RPC fetches</p>
                      </div>
                      <div className="text-center">
                        <p className="text-cyan-300 font-bold">{stackScore.components.cryptoPipeline.cacheHits}</p>
                        <p className="text-gray-500">Cache hits</p>
                      </div>
                      <div className="text-center">
                        <p className="text-yellow-300 font-bold">{stackScore.components.cryptoPipeline.avgLatencyMs}ms</p>
                        <p className="text-gray-500">Avg latency</p>
                      </div>
                    </div>
                  )}
                </motion.div>

                <motion.div className="bg-gray-900/50 rounded-lg p-4 border border-gray-800" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
                  <h3 className="text-sm font-semibold text-gray-300 mb-3 flex items-center gap-2">
                    <Bell className="w-4 h-4 text-blue-400" />
                    Notification System
                  </h3>
                  <div className="space-y-1">
                    <StackStatusRow
                      label="In-app SSE/WebSocket"
                      ok={stackScore.components.notifications.inAppAvailable}
                      detail="always available"
                    />
                    <StackStatusRow
                      label="Email notifications"
                      ok={stackScore.components.notifications.emailAvailable}
                      detail={stackScore.components.notifications.emailAvailable ? "configured" : "not configured"}
                    />
                    <StackStatusRow
                      label="Webhook delivery"
                      ok={stackScore.components.notifications.webhooksConfigured > 0}
                      detail={`${stackScore.components.notifications.webhooksConfigured} endpoint(s)`}
                    />
                    <StackStatusRow
                      label="Discord (optional)"
                      ok={stackScore.components.notifications.discordOptional}
                      detail="not required"
                    />
                    <StackStatusRow
                      label="Discord not required"
                      ok={!stackScore.components.notifications.discordRequired}
                      detail="sovereign"
                    />
                  </div>
                </motion.div>
              </div>

              <div className="bg-gray-900/30 rounded-lg p-3 border border-gray-800 text-xs text-gray-500 flex items-center justify-between">
                <span>Last updated: {new Date(stackScore.timestamp).toLocaleTimeString()}</span>
                <button
                  onClick={() => queryClient.invalidateQueries({ queryKey: ["/api/sov-stack/score"] })}
                  className="flex items-center gap-1 text-purple-400 hover:text-purple-300"
                >
                  <RefreshCw className="w-3 h-3" /> Refresh
                </button>
              </div>
            </>
          ) : (
            <div className="p-6 text-center">
              <Server className="w-8 h-8 text-gray-600 mx-auto mb-2" />
              <p className="text-gray-500">Sovereign stack data unavailable</p>
              <p className="text-xs text-gray-600 mt-1">The sovereign gateway routes may not be registered yet</p>
            </div>
          )}
        </div>
      )}

      {true && (
        <div className="space-y-3">
          {(categories || []).map(cat => (
            <div key={cat.name} className="bg-gray-900/50 rounded-lg p-3 border border-gray-800">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  {cat.benchmarkPassed ? <CheckCircle className="w-4 h-4 text-green-400" /> : <XCircle className="w-4 h-4 text-red-400" />}
                  <span className="text-sm font-medium text-gray-200">{cat.name}</span>
                </div>
                <div className="flex items-center gap-3 text-xs">
                  <span className="text-cyan-300">Honest: {cat.honestScore}%</span>
                  <span className="text-gray-500 line-through">Inflated: {cat.inflatedScore}%</span>
                  {cat.externalApiDependency && (
                    <span className="text-orange-300 flex items-center gap-1">
                      <Eye className="w-3 h-3" /> External API
                    </span>
                  )}
                </div>
              </div>
              <div className="w-full bg-gray-800 rounded-full h-1.5 mb-1">
                <div className="h-1.5 rounded-full transition-all" style={{ width: `${cat.honestScore}%`, backgroundColor: cat.honestScore > 60 ? "#34d399" : cat.honestScore > 30 ? "#fbbf24" : "#f87171" }} />
              </div>
              <p className="text-xs text-gray-500">{cat.benchmarkDescription}</p>
              {cat.gaps.length > 0 && (
                <div className="mt-1">
                  {cat.gaps.map((gap, i) => (
                    <p key={i} className="text-xs text-orange-300/70">{gap}</p>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {true && (
        <div className="space-y-3">
          {assessment.gaps.length === 0 ? (
            <p className="text-center text-gray-500 py-8">No capability gaps identified</p>
          ) : (
            assessment.gaps.map(gap => (
              <div key={gap.id} className="bg-gray-900/50 rounded-lg p-3 border border-gray-800">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-medium text-gray-200">{gap.category}</span>
                  <div className="flex gap-2">
                    <SeverityBadge severity={gap.severity} />
                    <StatusBadge status={gap.status} />
                  </div>
                </div>
                <p className="text-xs text-gray-400 mb-2">{gap.description}</p>
                <div className="flex items-center gap-4 text-xs">
                  <span className="text-gray-500">Current: <span className="text-cyan-300">{gap.currentCapability}%</span></span>
                  <span className="text-gray-500">Required: <span className="text-green-300">{gap.requiredCapability}%</span></span>
                  <span className="text-gray-500">Effort: <span className="text-yellow-300">{gap.estimatedEffort}</span></span>
                </div>
                <p className="text-xs text-cyan-400/70 mt-1">Action: {gap.actionRequired}</p>
              </div>
            ))
          )}
        </div>
      )}

      {true && (
        <div className="space-y-4">
          {gateway ? (
            <>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                  { label: "Total Requests", value: gateway.totalRequests, color: "text-cyan-300" },
                  { label: "Blocked", value: gateway.blockedRequests, color: "text-red-300" },
                  { label: "Anonymized", value: gateway.anonymizedRequests, color: "text-green-300" },
                  { label: "Avg Response", value: `${gateway.avgResponseTimeMs}ms`, color: "text-yellow-300" },
                ].map(stat => (
                  <div key={stat.label} className="bg-gray-900/50 rounded-lg p-4 border border-gray-800 text-center">
                    <p className={`text-2xl font-bold ${stat.color}`}>{stat.value}</p>
                    <p className="text-xs text-gray-500">{stat.label}</p>
                  </div>
                ))}
              </div>
              <div className="bg-gray-900/50 rounded-lg p-4 border border-gray-800">
                <h3 className="text-sm font-medium text-gray-400 mb-2">External Domains ({gateway.uniqueExternalDomains.length})</h3>
                <div className="flex flex-wrap gap-2">
                  {gateway.uniqueExternalDomains.map(domain => (
                    <span key={domain} className="text-xs px-2 py-1 bg-gray-800 rounded text-gray-300">{domain}</span>
                  ))}
                  {gateway.uniqueExternalDomains.length === 0 && (
                    <span className="text-xs text-gray-500">No external domains contacted yet</span>
                  )}
                </div>
              </div>
            </>
          ) : <p className="text-center text-gray-500 py-8">Gateway not initialized</p>}
        </div>
      )}

      {true && (
        <div className="space-y-4">
          {security ? (
            <>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                  { label: "Total Scans", value: security.totalScans, color: "text-cyan-300" },
                  { label: "Blocked", value: security.blockedRequests, color: "text-red-300" },
                  { label: "Leakage Found", value: security.leakageDetections, color: "text-orange-300" },
                  { label: "Critical Alerts", value: security.criticalAlerts, color: "text-red-400" },
                ].map(stat => (
                  <div key={stat.label} className="bg-gray-900/50 rounded-lg p-4 border border-gray-800 text-center">
                    <p className={`text-2xl font-bold ${stat.color}`}>{stat.value}</p>
                    <p className="text-xs text-gray-500">{stat.label}</p>
                  </div>
                ))}
              </div>
              {security.recentAlerts.length > 0 && (
                <div className="bg-gray-900/50 rounded-lg p-4 border border-gray-800">
                  <h3 className="text-sm font-medium text-gray-400 mb-2">Recent Alerts</h3>
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {security.recentAlerts.map(alert => (
                      <div key={alert.id} className="flex items-start gap-2 text-xs p-2 rounded bg-gray-800/50">
                        <SeverityBadge severity={alert.severity} />
                        <div className="flex-1">
                          <span className="text-gray-300">{alert.description.slice(0, 120)}</span>
                          <p className="text-gray-600 mt-0.5">{new Date(alert.timestamp).toLocaleString()}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          ) : <p className="text-center text-gray-500 py-8">Security monitor not initialized</p>}
        </div>
      )}

      {true && (
        <div className="space-y-4">
          {roadmap ? (
            <>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                  { label: "Total Tasks", value: roadmap.totalTasks, color: "text-cyan-300" },
                  { label: "Completed", value: roadmap.completed, color: "text-green-300" },
                  { label: "Completion %", value: `${roadmap.completionPercent}%`, color: "text-cyan-300" },
                  { label: "Avg Improvement", value: `${roadmap.avgImprovement}%`, color: "text-green-300" },
                ].map(stat => (
                  <div key={stat.label} className="bg-gray-900/50 rounded-lg p-4 border border-gray-800 text-center">
                    <p className={`text-2xl font-bold ${stat.color}`}>{stat.value}</p>
                    <p className="text-xs text-gray-500">{stat.label}</p>
                  </div>
                ))}
              </div>
              <div className="bg-gray-900/50 rounded-lg p-4 border border-gray-800">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-medium text-gray-400">Executor Status</h3>
                  <span className={`text-xs px-2 py-0.5 rounded ${roadmap.isRunning ? "bg-green-900/50 text-green-300" : "bg-gray-700 text-gray-400"}`}>
                    {roadmap.isRunning ? "Running" : "Stopped"}
                  </span>
                </div>
                <div className="w-full bg-gray-800 rounded-full h-2">
                  <div className="h-2 rounded-full bg-gradient-to-r from-cyan-500 to-green-500 transition-all"
                    style={{ width: `${roadmap.completionPercent}%` }} />
                </div>
              </div>
            </>
          ) : <p className="text-center text-gray-500 py-8">Roadmap executor not initialized</p>}

          {assessment.prioritizedRoadmap.length > 0 && (
            <div className="bg-gray-900/50 rounded-lg p-4 border border-gray-800">
              <h3 className="text-sm font-medium text-gray-400 mb-3">Full Prioritized Roadmap</h3>
              <div className="space-y-2">
                {assessment.prioritizedRoadmap.map(item => (
                  <div key={item.gapId} className="flex items-center gap-3 text-sm p-2 rounded bg-gray-800/50">
                    <span className="text-gray-500 w-6 text-center">#{item.rank}</span>
                    <SeverityBadge severity={item.priority} />
                    <span className="text-gray-300 flex-1">{item.action}</span>
                    <span className="text-cyan-300 text-xs">+{item.impact}%</span>
                    <span className="text-gray-500 text-xs">{item.effort}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
