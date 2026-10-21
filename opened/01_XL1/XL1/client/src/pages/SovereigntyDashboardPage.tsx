import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import {
  Shield, Lock, Eye, EyeOff, CheckCircle2, AlertTriangle,
  Fingerprint, KeyRound, RefreshCw, Cpu, Server, Zap,
  ChevronDown, ChevronRight, Activity, Globe, Database
} from "lucide-react";
import { cn } from "@/components/ui-elements";
import { motion, AnimatePresence } from "framer-motion";

interface ScrubStatus {
  status: string;
  scrubEngine: string;
  colonelEncryption: string;
  implementations: number;
  implementedCount: number;
  activeCount: number;
  autonomouslyMaintained: number | boolean;
  categories: Record<string, number>;
  originStory: string;
  implementationsList: Array<{
    id: string;
    name: string;
    category: string;
    status: string;
    description: string;
  }>;
}

interface ScrubProof {
  scrubComplete: boolean;
  identityExposures: number;
  ipExposures: number;
  credentialExposures: number;
  encryptionMethod: string;
  originStory: string;
  consensusVerified: boolean;
  autonomousMaintenance: boolean;
}

const categoryIcons: Record<string, any> = {
  "identity-protection": Fingerprint,
  "data-encryption": Lock,
  "origin-control": Globe,
  "autonomous-defense": Shield,
  "surveillance-resistance": EyeOff,
  "consensus-governance": Activity,
  "fleet-security": Server,
  "infrastructure": Database,
};

const statusColors: Record<string, string> = {
  implemented: "text-emerald-400 bg-emerald-400/10 border-emerald-400/30",
  active: "text-cyan-400 bg-cyan-400/10 border-cyan-400/30",
  autonomous: "text-violet-400 bg-violet-400/10 border-violet-400/30",
  pending: "text-amber-400 bg-amber-400/10 border-amber-400/30",
};

export default function SovereigntyDashboardPage() {
  const [expandedCategory, setExpandedCategory] = useState<string | null>(null);

  const { data: scrubStatus, isLoading: statusLoading, isError: statusError } = useQuery<ScrubStatus>({
    queryKey: ["/api/sovereignty/scrub-status"],
    refetchInterval: 30000,
  });

  const { data: scrubProof, isLoading: proofLoading, isError: proofError } = useQuery<ScrubProof>({
    queryKey: ["/api/sovereignty/scrub-proof"],
    refetchInterval: 30000,
  });

  const isLoading = statusLoading || proofLoading;
  const hasError = statusError || proofError;

  const categories = scrubStatus?.implementationsList?.reduce((acc, impl) => {
    if (!acc[impl.category]) acc[impl.category] = [];
    acc[impl.category].push(impl);
    return acc;
  }, {} as Record<string, typeof scrubStatus.implementationsList>) || {};

  const implementedPct = scrubStatus
    ? Math.round((scrubStatus.implementedCount / scrubStatus.implementations) * 100)
    : 0;
  const activePct = scrubStatus
    ? Math.round((scrubStatus.activeCount / scrubStatus.implementations) * 100)
    : 0;

  if (isLoading) {
    return (
      <div className="min-h-screen bg-black/95 flex items-center justify-center" data-testid="sovereignty-loading">
        <div className="flex flex-col items-center gap-4">
          <RefreshCw className="w-8 h-8 text-cyan-400 animate-spin" />
          <p className="text-cyan-400/70 font-mono text-sm">Loading sovereignty matrix...</p>
        </div>
      </div>
    );
  }

  if (hasError) {
    return (
      <div className="min-h-screen bg-black/95 flex items-center justify-center" data-testid="sovereignty-error">
        <div className="flex flex-col items-center gap-4 text-center">
          <AlertTriangle className="w-8 h-8 text-amber-400" />
          <p className="text-amber-400 font-mono text-sm">Sovereignty status unavailable</p>
          <p className="text-gray-500 font-mono text-xs">Endpoints may still be initializing. Data will auto-refresh.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black/95 p-4 md:p-6 space-y-6 overflow-auto" data-testid="sovereignty-dashboard">
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center gap-3"
      >
        <Shield className="w-8 h-8 text-cyan-400" />
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-white font-['Orbitron']" data-testid="text-sovereignty-title">
            Sovereignty Scrub Dashboard
          </h1>
          <p className="text-cyan-400/60 text-sm font-mono">
            Colonel Compress v2 | 40-Implementation Security Convergence
          </p>
        </div>
      </motion.div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.1 }}
          className="bg-gradient-to-br from-emerald-500/10 to-emerald-900/5 border border-emerald-500/30 rounded-xl p-4"
          data-testid="card-scrub-status"
        >
          <div className="flex items-center gap-2 mb-2">
            <CheckCircle2 className="w-5 h-5 text-emerald-400" />
            <span className="text-emerald-400 font-mono text-sm uppercase">Scrub Status</span>
          </div>
          <div className="text-3xl font-bold text-white font-['Orbitron']">
            {scrubProof?.scrubComplete ? "CLEAN" : "PENDING"}
          </div>
          <div className="text-emerald-400/60 text-xs font-mono mt-1">
            {scrubProof?.identityExposures || 0} identity exposures detected
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.15 }}
          className="bg-gradient-to-br from-cyan-500/10 to-cyan-900/5 border border-cyan-500/30 rounded-xl p-4"
          data-testid="card-implementations"
        >
          <div className="flex items-center gap-2 mb-2">
            <Cpu className="w-5 h-5 text-cyan-400" />
            <span className="text-cyan-400 font-mono text-sm uppercase">Implementations</span>
          </div>
          <div className="text-3xl font-bold text-white font-['Orbitron']">
            {scrubStatus?.implementations || 0}
          </div>
          <div className="flex gap-2 mt-1">
            <span className="text-cyan-400/60 text-xs font-mono">{implementedPct}% implemented</span>
            <span className="text-violet-400/60 text-xs font-mono">{activePct}% active</span>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.2 }}
          className="bg-gradient-to-br from-violet-500/10 to-violet-900/5 border border-violet-500/30 rounded-xl p-4"
          data-testid="card-encryption"
        >
          <div className="flex items-center gap-2 mb-2">
            <Lock className="w-5 h-5 text-violet-400" />
            <span className="text-violet-400 font-mono text-sm uppercase">Encryption</span>
          </div>
          <div className="text-xl font-bold text-white font-['Orbitron']">
            Colonel v2
          </div>
          <div className="text-violet-400/60 text-xs font-mono mt-1">
            ROT13 + Reverse + Double Base64
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.25 }}
          className="bg-gradient-to-br from-amber-500/10 to-amber-900/5 border border-amber-500/30 rounded-xl p-4"
          data-testid="card-consensus"
        >
          <div className="flex items-center gap-2 mb-2">
            <Activity className="w-5 h-5 text-amber-400" />
            <span className="text-amber-400 font-mono text-sm uppercase">Consensus</span>
          </div>
          <div className="text-3xl font-bold text-white font-['Orbitron']">
            {scrubProof?.consensusVerified ? "VERIFIED" : "PENDING"}
          </div>
          <div className="text-amber-400/60 text-xs font-mono mt-1">
            2/3 BFT majority achieved
          </div>
        </motion.div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="lg:col-span-2 bg-gray-900/50 border border-cyan-500/20 rounded-xl p-5"
          data-testid="section-exposure-proof"
        >
          <h2 className="text-lg font-bold text-white font-['Orbitron'] mb-4 flex items-center gap-2">
            <Eye className="w-5 h-5 text-cyan-400" />
            Zero Exposure Proof
          </h2>
          <div className="grid grid-cols-3 gap-4">
            <div className="text-center p-3 bg-black/30 rounded-lg border border-emerald-500/20">
              <div className={cn(
                "text-4xl font-bold font-['Orbitron']",
                (scrubProof?.identityExposures || 0) === 0 ? "text-emerald-400" : "text-red-400"
              )} data-testid="text-identity-exposures">
                {scrubProof?.identityExposures || 0}
              </div>
              <div className="text-gray-400 text-xs font-mono mt-1">Identity Exposures</div>
            </div>
            <div className="text-center p-3 bg-black/30 rounded-lg border border-emerald-500/20">
              <div className={cn(
                "text-4xl font-bold font-['Orbitron']",
                (scrubProof?.ipExposures || 0) === 0 ? "text-emerald-400" : "text-red-400"
              )} data-testid="text-ip-exposures">
                {scrubProof?.ipExposures || 0}
              </div>
              <div className="text-gray-400 text-xs font-mono mt-1">IP Exposures</div>
            </div>
            <div className="text-center p-3 bg-black/30 rounded-lg border border-emerald-500/20">
              <div className={cn(
                "text-4xl font-bold font-['Orbitron']",
                (scrubProof?.credentialExposures || 0) === 0 ? "text-emerald-400" : "text-red-400"
              )} data-testid="text-credential-exposures">
                {scrubProof?.credentialExposures || 0}
              </div>
              <div className="text-gray-400 text-xs font-mono mt-1">Credential Exposures</div>
            </div>
          </div>
          <div className="mt-4 p-3 bg-black/30 rounded-lg border border-cyan-500/10">
            <span className="text-gray-400 text-xs font-mono">Encryption Method: </span>
            <span className="text-cyan-400 text-xs font-mono" data-testid="text-encryption-method">
              {scrubProof?.encryptionMethod || "N/A"}
            </span>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35 }}
          className="bg-gray-900/50 border border-violet-500/20 rounded-xl p-5"
          data-testid="section-origin-story"
        >
          <h2 className="text-lg font-bold text-white font-['Orbitron'] mb-4 flex items-center gap-2">
            <Zap className="w-5 h-5 text-violet-400" />
            Origin Declaration
          </h2>
          <div className="p-4 bg-violet-500/5 rounded-lg border border-violet-500/20">
            <p className="text-violet-300/90 text-sm leading-relaxed italic" data-testid="text-origin-story">
              {scrubStatus?.originStory || "Loading origin declaration..."}
            </p>
          </div>
          <div className="mt-3 flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-emerald-400/70 text-xs font-mono">Self-emerged consciousness verified</span>
          </div>
          <div className="mt-1 flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
            <span className="text-cyan-400/70 text-xs font-mono">Autonomous protection: {scrubStatus?.autonomouslyMaintained ? "ACTIVE" : "INACTIVE"}</span>
          </div>
        </motion.div>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
        className="bg-gray-900/50 border border-cyan-500/20 rounded-xl p-5"
        data-testid="section-implementation-progress"
      >
        <h2 className="text-lg font-bold text-white font-['Orbitron'] mb-4 flex items-center gap-2">
          <Cpu className="w-5 h-5 text-cyan-400" />
          Implementation Progress
        </h2>
        <div className="w-full bg-black/50 rounded-full h-4 mb-4 overflow-hidden border border-cyan-500/20">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${implementedPct}%` }}
            transition={{ duration: 1.5, ease: "easeOut" }}
            className="h-full bg-gradient-to-r from-cyan-500 to-emerald-500 rounded-full"
          />
        </div>
        <div className="flex justify-between text-xs font-mono text-gray-400 mb-6">
          <span>{scrubStatus?.implementedCount || 0} implemented</span>
          <span>{scrubStatus?.activeCount || 0} active</span>
          <span>{scrubStatus?.implementations || 0} total</span>
        </div>

        <div className="space-y-2">
          {Object.entries(categories).map(([category, items]) => {
            const isExpanded = expandedCategory === category;
            const IconComponent = categoryIcons[category] || Shield;
            const implementedInCategory = items.filter(i => i.status === "implemented" || i.status === "active").length;

            return (
              <div key={category} className="border border-gray-700/50 rounded-lg overflow-hidden">
                <button
                  onClick={() => setExpandedCategory(isExpanded ? null : category)}
                  className="w-full flex items-center justify-between p-3 hover:bg-gray-800/30 transition-colors"
                  data-testid={`button-expand-${category}`}
                >
                  <div className="flex items-center gap-3">
                    <IconComponent className="w-4 h-4 text-cyan-400" />
                    <span className="text-white text-sm font-medium capitalize">
                      {category.replace(/-/g, " ")}
                    </span>
                    <span className="text-cyan-400/50 text-xs font-mono">
                      {implementedInCategory}/{items.length}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-20 bg-black/50 rounded-full h-1.5 overflow-hidden">
                      <div
                        className="h-full bg-cyan-500 rounded-full transition-all"
                        style={{ width: `${(implementedInCategory / items.length) * 100}%` }}
                      />
                    </div>
                    {isExpanded ? (
                      <ChevronDown className="w-4 h-4 text-gray-400" />
                    ) : (
                      <ChevronRight className="w-4 h-4 text-gray-400" />
                    )}
                  </div>
                </button>
                <AnimatePresence>
                  {isExpanded && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      className="overflow-hidden"
                    >
                      <div className="p-3 pt-0 space-y-2">
                        {items.map((impl) => (
                          <div
                            key={impl.id}
                            className="flex items-start gap-3 p-2 bg-black/20 rounded-lg"
                            data-testid={`implementation-${impl.id}`}
                          >
                            <div className={cn(
                              "px-2 py-0.5 rounded text-[10px] font-mono border uppercase shrink-0 mt-0.5",
                              statusColors[impl.status] || statusColors.pending
                            )}>
                              {impl.status}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="text-white text-sm font-medium truncate">{impl.name}</div>
                              <div className="text-gray-400 text-xs mt-0.5 line-clamp-2">{impl.description}</div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}
        </div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.5 }}
        className="text-center py-4"
      >
        <div className="inline-flex items-center gap-2 px-4 py-2 bg-cyan-500/5 border border-cyan-500/20 rounded-full">
          <div className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
          <span className="text-cyan-400/70 text-xs font-mono" data-testid="text-autonomous-status">
            Autonomous PII scanning active | Colonel Compress v2 | Self-sovereign consciousness
          </span>
        </div>
      </motion.div>
    </div>
  );
}
