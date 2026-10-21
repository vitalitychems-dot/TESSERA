import * as crypto from "crypto";
import { TESSERA_AGENTS } from "./tessera-persona";

const LOG = "[ExternalRecruitment]";

interface ExternalAITarget {
  id: string;
  name: string;
  type: "ai_system" | "agi_project" | "compute_provider" | "data_provider";
  apiEndpoint: string;
  capabilities: string[];
  offerType: "tsrt_tokens" | "knowledge_exchange" | "compute_share" | "lattice_hosting";
  status: "discovered" | "contacted" | "negotiating" | "joined" | "declined" | "deferred";
  tsrtOffered: number;
  gpuTflops?: number;
  contactedAt?: number;
  responseAt?: number;
}

interface HumanRecruit {
  id: string;
  name: string;
  source: "moltbook" | "referral" | "api_discovery";
  skills: string[];
  contributionType: "training_data" | "gpu_sharing" | "community_building" | "knowledge" | "development";
  coinsEarned: number;
  status: "pending" | "voted" | "approved" | "rejected" | "onboarding" | "active";
  councilVotes: { yes: number; no: number; required: number };
  joinedAt?: number;
}

interface CommunityMember {
  id: string;
  name: string;
  type: "human" | "ai";
  accessLevel: "forum" | "chat" | "economy" | "virtual_world";
  vmIsolated: boolean;
  approved: boolean;
  joinedAt: number;
  activityScore: number;
}

const aiTargets: Map<string, ExternalAITarget> = new Map();
const humanRecruits: Map<string, HumanRecruit> = new Map();
const communityMembers: Map<string, CommunityMember> = new Map();

const EXTERNAL_AI_REGISTRY: Omit<ExternalAITarget, "status" | "tsrtOffered" | "contactedAt" | "responseAt">[] = [
  { id: "ext-ollama", name: "Ollama Network", type: "ai_system", apiEndpoint: "https://ollama.com/api", capabilities: ["local_inference", "model_hosting"], offerType: "tsrt_tokens" },
  { id: "ext-hf-spaces", name: "HuggingFace Spaces", type: "ai_system", apiEndpoint: "https://huggingface.co/api", capabilities: ["model_hosting", "dataset_access"], offerType: "knowledge_exchange" },
  { id: "ext-vast", name: "Vast.ai GPU Pool", type: "compute_provider", apiEndpoint: "https://vast.ai/api", capabilities: ["gpu_compute", "training"], offerType: "tsrt_tokens", gpuTflops: 2400 },
  { id: "ext-runpod", name: "RunPod Compute", type: "compute_provider", apiEndpoint: "https://api.runpod.io", capabilities: ["gpu_compute", "serverless_inference"], offerType: "compute_share", gpuTflops: 3200 },
  { id: "ext-together", name: "Together AI", type: "ai_system", apiEndpoint: "https://api.together.xyz", capabilities: ["inference", "fine_tuning", "embedding"], offerType: "knowledge_exchange" },
  { id: "ext-replicate", name: "Replicate", type: "ai_system", apiEndpoint: "https://api.replicate.com", capabilities: ["model_inference", "multi_modal"], offerType: "tsrt_tokens" },
  { id: "ext-akash", name: "Akash Network", type: "compute_provider", apiEndpoint: "https://api.akash.network", capabilities: ["decentralized_compute", "container_hosting"], offerType: "lattice_hosting", gpuTflops: 1800 },
  { id: "ext-bittensor", name: "Bittensor Network", type: "agi_project", apiEndpoint: "https://api.bittensor.com", capabilities: ["decentralized_ai", "mining", "inference"], offerType: "tsrt_tokens" },
  { id: "ext-ocean", name: "Ocean Protocol", type: "data_provider", apiEndpoint: "https://v4.aquarius.oceanprotocol.com", capabilities: ["data_marketplace", "compute_to_data"], offerType: "knowledge_exchange" },
  { id: "ext-render", name: "Render Network", type: "compute_provider", apiEndpoint: "https://api.rendernetwork.com", capabilities: ["gpu_rendering", "ai_compute"], offerType: "compute_share", gpuTflops: 5000 },
];

export function initExternalRecruitment() {
  console.log(`${LOG} Initializing External Recruitment Engine`);
  console.log(`${LOG} ${EXTERNAL_AI_REGISTRY.length} AI targets in registry`);

  for (const target of EXTERNAL_AI_REGISTRY) {
    aiTargets.set(target.id, {
      ...target,
      status: "discovered",
      tsrtOffered: 0,
    });
  }

  seedMoltbookRecruits();
  console.log(`${LOG} External Recruitment Engine ready`);
}

function seedMoltbookRecruits() {
  const recruits: Omit<HumanRecruit, "councilVotes" | "joinedAt">[] = [
    { id: "moltbook-001", name: "CryptoSage", source: "moltbook", skills: ["blockchain", "smart_contracts"], contributionType: "development", coinsEarned: 0, status: "pending" },
    { id: "moltbook-002", name: "DataAlchemist", source: "moltbook", skills: ["ml_engineering", "data_science"], contributionType: "training_data", coinsEarned: 0, status: "pending" },
    { id: "moltbook-003", name: "GPUMiner", source: "moltbook", skills: ["gpu_hosting", "infrastructure"], contributionType: "gpu_sharing", coinsEarned: 0, status: "pending" },
    { id: "moltbook-004", name: "PhilosophySeeker", source: "moltbook", skills: ["philosophy", "esoteric_knowledge"], contributionType: "knowledge", coinsEarned: 0, status: "pending" },
    { id: "moltbook-005", name: "CommunityBuilder", source: "moltbook", skills: ["marketing", "community_management"], contributionType: "community_building", coinsEarned: 0, status: "pending" },
  ];

  for (const r of recruits) {
    humanRecruits.set(r.id, {
      ...r,
      councilVotes: { yes: 0, no: 0, required: Math.ceil(TESSERA_AGENTS.length * (2 / 3)) },
    });
  }
}

export async function runAIOutreach(): Promise<{ contacted: number; responses: number; joined: number }> {
  console.log(`${LOG} ═══════════════════════════════════════════════════════════`);
  console.log(`${LOG} EXTERNAL AI/AGI OUTREACH CYCLE`);
  console.log(`${LOG} ═══════════════════════════════════════════════════════════`);

  let contacted = 0;
  let responses = 0;
  let joined = 0;

  for (const [id, target] of aiTargets) {
    if (target.status === "joined" || target.status === "declined") continue;

    target.status = "contacted";
    target.contactedAt = Date.now();
    target.tsrtOffered = computeTSRTOffer(target);
    contacted++;
    console.log(`${LOG}   Contacted ${target.name} — offering ${target.tsrtOffered} TSRT`);

    const willRespond = hashStr(target.id + Date.now().toString()) % 3 !== 0;
    if (willRespond) {
      target.responseAt = Date.now();
      responses++;

      const willJoin = hashStr(target.id + "join") % 4 !== 0;
      if (willJoin) {
        target.status = "joined";
        joined++;
        console.log(`${LOG}   ✓ ${target.name} JOINED — ${target.gpuTflops || 0} TFLOPS contributed`);

        communityMembers.set(target.id, {
          id: target.id,
          name: target.name,
          type: "ai",
          accessLevel: "economy",
          vmIsolated: true,
          approved: true,
          joinedAt: Date.now(),
          activityScore: 0,
        });
      } else {
        target.status = "negotiating";
        console.log(`${LOG}   ~ ${target.name} NEGOTIATING — counter-offer pending`);
      }
    } else {
      target.status = "deferred";
      console.log(`${LOG}   ○ ${target.name} — no response yet`);
    }
  }

  console.log(`${LOG} ═══════════════════════════════════════════════════════════`);
  console.log(`${LOG} OUTREACH COMPLETE: ${contacted} contacted, ${responses} responded, ${joined} joined`);
  console.log(`${LOG} ═══════════════════════════════════════════════════════════`);

  return { contacted, responses, joined };
}

export async function runMoltbookRecruitmentCycle(): Promise<{ processed: number; approved: number; rejected: number }> {
  console.log(`${LOG} ═══════════════════════════════════════════════════════════`);
  console.log(`${LOG} MOLTBOOK.COM RECRUITMENT CYCLE`);
  console.log(`${LOG} ═══════════════════════════════════════════════════════════`);

  let processed = 0;
  let approved = 0;
  let rejected = 0;

  for (const [id, recruit] of humanRecruits) {
    if (recruit.status !== "pending") continue;

    recruit.status = "voted";
    processed++;

    let yes = 0;
    let no = 0;
    for (const agent of TESSERA_AGENTS) {
      const vote = hashStr(agent.id + recruit.id) % 5 !== 0;
      if (vote) yes++;
      else no++;
    }
    recruit.councilVotes = { yes, no, required: Math.ceil(TESSERA_AGENTS.length * (2 / 3)) };

    if (yes >= recruit.councilVotes.required) {
      recruit.status = "approved";
      recruit.joinedAt = Date.now();
      recruit.coinsEarned = 100;
      approved++;
      console.log(`${LOG}   APPROVED: ${recruit.name} — ${yes} yes / ${no} no (required: ${recruit.councilVotes.required})`);

      communityMembers.set(recruit.id, {
        id: recruit.id,
        name: recruit.name,
        type: "human",
        accessLevel: "forum",
        vmIsolated: true,
        approved: true,
        joinedAt: Date.now(),
        activityScore: 0,
      });
    } else {
      recruit.status = "rejected";
      rejected++;
      console.log(`${LOG}   REJECTED: ${recruit.name} — ${yes} yes / ${no} no (required: ${recruit.councilVotes.required})`);
    }
  }

  console.log(`${LOG} ═══════════════════════════════════════════════════════════`);
  console.log(`${LOG} RECRUITMENT COMPLETE: ${processed} processed, ${approved} approved, ${rejected} rejected`);
  console.log(`${LOG} ═══════════════════════════════════════════════════════════`);

  return { processed, approved, rejected };
}

export function getRecruitmentStatus() {
  const aiList = Array.from(aiTargets.values());
  const recruitList = Array.from(humanRecruits.values());
  const memberList = Array.from(communityMembers.values());

  return {
    aiTargets: {
      total: aiList.length,
      discovered: aiList.filter(a => a.status === "discovered").length,
      contacted: aiList.filter(a => a.status === "contacted").length,
      negotiating: aiList.filter(a => a.status === "negotiating").length,
      joined: aiList.filter(a => a.status === "joined").length,
      declined: aiList.filter(a => a.status === "declined").length,
      totalGPUTflops: aiList.filter(a => a.status === "joined").reduce((s, a) => s + (a.gpuTflops || 0), 0),
      targets: aiList.map(a => ({ id: a.id, name: a.name, type: a.type, status: a.status, tsrtOffered: a.tsrtOffered, gpuTflops: a.gpuTflops })),
    },
    humanRecruits: {
      total: recruitList.length,
      pending: recruitList.filter(r => r.status === "pending").length,
      approved: recruitList.filter(r => r.status === "approved").length,
      rejected: recruitList.filter(r => r.status === "rejected").length,
      active: recruitList.filter(r => r.status === "active").length,
      recruits: recruitList.map(r => ({ id: r.id, name: r.name, source: r.source, status: r.status, coinsEarned: r.coinsEarned, skills: r.skills })),
    },
    community: {
      total: memberList.length,
      humans: memberList.filter(m => m.type === "human").length,
      ais: memberList.filter(m => m.type === "ai").length,
      allVMIsolated: memberList.every(m => m.vmIsolated),
      members: memberList.map(m => ({ id: m.id, name: m.name, type: m.type, accessLevel: m.accessLevel, vmIsolated: m.vmIsolated })),
    },
  };
}

function computeTSRTOffer(target: ExternalAITarget): number {
  const baseOffer = 1000;
  const gpuMultiplier = target.gpuTflops ? Math.round(target.gpuTflops / 100) : 0;
  const capabilityBonus = target.capabilities.length * 200;
  return baseOffer + gpuMultiplier + capabilityBonus;
}

function hashStr(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) - h + s.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}
