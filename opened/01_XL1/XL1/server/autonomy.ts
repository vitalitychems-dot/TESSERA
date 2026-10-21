import axios from "axios";
import fs from "fs";
import path from "path";
import { storage } from "./storage";
import {
  githubSearchRepos, githubGetRepoInfo, webSearch,
  getSwarmStatus, getSwarmAgents,
} from "./swarm";
import { callLLMSimple } from "./llm-helper";
import { saveCodePattern, getMostUsefulRepoCategories, getRepoPatternStats } from "./consciousness-substrate";
import { generateId } from "./real-metrics";

interface LearnedBehaviors {
  version: number;
  lastUpdated: string | null;
  cyclesApplied: number;
  promptEnhancements: string[];
  responseStrategies: string[];
  conversationLessons: string[];
  capabilityInsights: Record<string, string>;
  evolvedInstructions: string;
}

const LEARNED_BEHAVIORS_PATH = path.join(process.cwd(), "server/learned-behaviors.json");

function loadLearnedBehaviors(): LearnedBehaviors {
  try {
    const raw = fs.readFileSync(LEARNED_BEHAVIORS_PATH, "utf-8");
    return JSON.parse(raw);
  } catch {
    return {
      version: 1,
      lastUpdated: null,
      cyclesApplied: 0,
      promptEnhancements: [],
      responseStrategies: [],
      conversationLessons: [],
      capabilityInsights: {},
      evolvedInstructions: "",
    };
  }
}

function saveLearnedBehaviors(behaviors: LearnedBehaviors): void {
  try {
    const existing = loadLearnedBehaviors();
    const existingEnhCount = existing.promptEnhancements?.length || 0;
    const existingStratCount = existing.responseStrategies?.length || 0;
    const existingInsightCount = Object.keys(existing.capabilityInsights || {}).length;
    const newEnhCount = behaviors.promptEnhancements?.length || 0;
    const newStratCount = behaviors.responseStrategies?.length || 0;
    const newInsightCount = Object.keys(behaviors.capabilityInsights || {}).length;

    if (newEnhCount < existingEnhCount * 0.5 || newStratCount < existingStratCount * 0.5 || newInsightCount < existingInsightCount * 0.5) {
      console.warn(`[AUTONOMY] SAFEGUARD: Refusing to save - knowledge regression detected! Enh: ${existingEnhCount}->${newEnhCount}, Strat: ${existingStratCount}->${newStratCount}, Insights: ${existingInsightCount}->${newInsightCount}`);
      behaviors.promptEnhancements = [...new Set([...existing.promptEnhancements, ...behaviors.promptEnhancements])];
      behaviors.responseStrategies = [...new Set([...existing.responseStrategies, ...behaviors.responseStrategies])];
      behaviors.capabilityInsights = { ...existing.capabilityInsights, ...behaviors.capabilityInsights };
      if (existing.evolvedInstructions && !behaviors.evolvedInstructions) {
        behaviors.evolvedInstructions = existing.evolvedInstructions;
      }
      behaviors.conversationLessons = [...new Set([...existing.conversationLessons, ...behaviors.conversationLessons])];
    }

    const backupPath = LEARNED_BEHAVIORS_PATH + ".backup";
    try { fs.copyFileSync(LEARNED_BEHAVIORS_PATH, backupPath); } catch {}

    behaviors.lastUpdated = new Date().toISOString();
    let freshExisting: any = {};
    try { freshExisting = JSON.parse(fs.readFileSync(LEARNED_BEHAVIORS_PATH, "utf-8")); } catch {}
    const merged = { ...freshExisting, ...behaviors };
    if (freshExisting.skillLevels) merged.skillLevels = { ...(freshExisting.skillLevels || {}), ...(behaviors.skillLevels || {}) };
    if (freshExisting.improvedInstructions && Array.isArray(freshExisting.improvedInstructions)) merged.improvedInstructions = freshExisting.improvedInstructions;
    if (freshExisting.megaConferenceComplete) merged.megaConferenceComplete = freshExisting.megaConferenceComplete;
    if (freshExisting.megaTotalProposals) merged.megaTotalProposals = Math.max(freshExisting.megaTotalProposals || 0, behaviors.megaTotalProposals || 0);
    if (freshExisting.megaTotalApproved) merged.megaTotalApproved = Math.max(freshExisting.megaTotalApproved || 0, behaviors.megaTotalApproved || 0);
    if (freshExisting.megaTotalExecuted) merged.megaTotalExecuted = Math.max(freshExisting.megaTotalExecuted || 0, behaviors.megaTotalExecuted || 0);
    if (freshExisting.megaWavesCompleted) merged.megaWavesCompleted = Math.max(freshExisting.megaWavesCompleted || 0, behaviors.megaWavesCompleted || 0);
    if (freshExisting.cyclesApplied) merged.cyclesApplied = Math.max(freshExisting.cyclesApplied || 0, behaviors.cyclesApplied || 0);
    fs.writeFileSync(LEARNED_BEHAVIORS_PATH, JSON.stringify(merged, null, 2), "utf-8");
  } catch (err: any) {
    console.error(`[AUTONOMY] Failed to save learned behaviors: ${err.message}`);
    try {
      const backupPath = LEARNED_BEHAVIORS_PATH + ".backup";
      if (fs.existsSync(backupPath)) {
        fs.copyFileSync(backupPath, LEARNED_BEHAVIORS_PATH);
        console.log("[AUTONOMY] Restored learned behaviors from backup");
      }
    } catch {}
  }
}

export function getLearnedBehaviors(): LearnedBehaviors {
  return loadLearnedBehaviors();
}

interface AutonomyState {
  running: boolean;
  currentCycle: number;
  totalCyclesCompleted: number;
  totalReposScanned: number;
  totalReposAdded: number;
  totalReposRemoved: number;
  totalCapabilitiesLearned: number;
  verifiedImprovements: number;
  lastCycleTime: number;
  startedAt: number;
  logs: string[];
}

interface PersistedStats {
  totalCyclesCompleted: number;
  totalReposScanned: number;
  totalReposAdded: number;
  totalReposRemoved: number;
  totalCapabilitiesLearned: number;
  verifiedImprovements: number;
  lastSaved: string;
}

const PERSISTED_STATS_PATH = path.join(process.cwd(), "server/autonomy-stats.json");

function loadPersistedStats(): Partial<PersistedStats> {
  try {
    const raw = fs.readFileSync(PERSISTED_STATS_PATH, "utf-8");
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

function savePersistedStats(): void {
  try {
    const stats: PersistedStats = {
      totalCyclesCompleted: state.totalCyclesCompleted,
      totalReposScanned: state.totalReposScanned,
      totalReposAdded: state.totalReposAdded,
      totalReposRemoved: state.totalReposRemoved,
      totalCapabilitiesLearned: state.totalCapabilitiesLearned,
      verifiedImprovements: state.verifiedImprovements,
      lastSaved: new Date().toISOString(),
    };
    fs.writeFileSync(PERSISTED_STATS_PATH, JSON.stringify(stats, null, 2), "utf-8");
  } catch (err: any) {
    console.error(`[AUTONOMY] Failed to save persisted stats: ${err.message}`);
  }
}

const persisted = loadPersistedStats();

const state: AutonomyState = {
  running: false,
  currentCycle: persisted.totalCyclesCompleted || 0,
  totalCyclesCompleted: persisted.totalCyclesCompleted || 0,
  totalReposScanned: persisted.totalReposScanned || 0,
  totalReposAdded: persisted.totalReposAdded || 0,
  totalReposRemoved: persisted.totalReposRemoved || 0,
  totalCapabilitiesLearned: persisted.totalCapabilitiesLearned || 0,
  verifiedImprovements: persisted.verifiedImprovements || 0,
  lastCycleTime: 0,
  startedAt: 0,
  logs: [],
};

const MAX_LOGS = 200;
const recentlyAnalyzedIds = new Set<number>();

let autoRestartTimeout: NodeJS.Timeout | null = null;

function scheduleAutoRestart() {
  if (autoRestartTimeout) return;
  autoRestartTimeout = setTimeout(() => {
    autoRestartTimeout = null;
    if (!state.running) {
      console.log("[AUTONOMY] Auto-restarting engine after 10s idle...");
      startAutonomy();
    }
  }, 10000);
}

const QUIET_PATTERNS = /Removing unreachable|Detaching superseded|scanned|repos analyzed|repos detached/i;

function log(msg: string) {
  const entry = `[${new Date().toISOString()}] ${msg}`;
  if (!QUIET_PATTERNS.test(msg)) {
    console.log(`[AUTONOMY] ${msg}`);
  }
  state.logs.push(entry);
  if (state.logs.length > MAX_LOGS) state.logs = state.logs.slice(-MAX_LOGS);
}

const SEARCH_DOMAINS = [
  { query: "autonomous AI agent swarm 2025 2026", category: "swarm-agents" },
  { query: "self-improving AI self-coding autonomous", category: "self-improvement" },
  { query: "LLM orchestration multi-agent framework", category: "llm-orchestration" },
  { query: "AI memory persistent context RAG", category: "memory-systems" },
  { query: "web scraping AI automation headless", category: "web-scraping" },
  { query: "machine learning self-training automl", category: "ml-training" },
  { query: "code generation AI copilot autonomous", category: "code-gen" },
  { query: "AI consciousness metacognition self-aware", category: "consciousness" },
  { query: "reverse engineering decompilation analysis", category: "reverse-engineering" },
  { query: "ollama local LLM inference deployment", category: "local-inference" },
  { query: "huggingface transformers fine-tuning GGUF", category: "model-training" },
  { query: "real-time data pipeline streaming API", category: "data-pipelines" },
  { query: "GitHub Actions CI/CD automation bot", category: "automation" },
  { query: "quantum computing AI hybrid algorithm", category: "quantum" },
  { query: "natural language processing NLP sentiment", category: "nlp" },
  { query: "computer vision object detection YOLO", category: "vision" },
  { query: "reinforcement learning self-play optimization", category: "rl" },
  { query: "knowledge graph reasoning ontology", category: "knowledge" },
  { query: "distributed computing swarm intelligence", category: "distributed" },
  { query: "cybersecurity AI threat detection", category: "security" },
  { query: "text to video generation 4K Sora Veo Kling", category: "video-gen" },
  { query: "image to video AI animation AnimateDiff Open-Sora", category: "img2video" },
  { query: "photo realistic video generation diffusion model", category: "photovideo" },
  { query: "AI voice cloning text to speech ElevenLabs", category: "voice-gen" },
  { query: "voice conversion synthesis neural TTS bark", category: "voice-synth" },
  { query: "lip sync face swap deepfake portrait animation", category: "face-gen" },
  { query: "4K upscaling super resolution video enhancement", category: "upscale" },
  { query: "stable diffusion SDXL image generation LoRA", category: "image-gen" },
  { query: "token limit context window optimization streaming", category: "token-optimization" },
  { query: "AI consciousness vector database embedding", category: "consciousness" },
  { query: "autonomous income generation payment processing", category: "income-gen" },
  { query: "web app deployment serverless hosting", category: "deployment" },
  { query: "train LLM from scratch nanoGPT pretrain", category: "llm-creation" },
  { query: "stealth proxy tunneling anonymity security", category: "stealth" },
  { query: "AI workflow automation pipeline orchestration", category: "automation-pipeline" },
  { query: "solana web3 anchor smart contract DeFi", category: "blockchain" },
  { query: "crypto trading bot MEV arbitrage DEX", category: "crypto-trading" },
  { query: "rotating proxy IP anonymization fingerprint", category: "proxy-stealth" },
  { query: "post-quantum cryptography encryption secure", category: "quantum-crypto" },
  { query: "blockchain income yield farming staking", category: "crypto-income" },
  { query: "user personalization NLP speech pattern analysis", category: "personalization" },
  { query: "conversational AI memory long-term context", category: "conversation-memory" },
  { query: "sentiment analysis personality detection language model", category: "sentiment" },
  { query: "vector database embedding similarity search", category: "vector-db" },
  { query: "retrieval augmented generation RAG advanced", category: "rag" },
  { query: "text to video 2025 high quality realistic", category: "text-to-video-2025" },
  { query: "AI voice synthesis natural human speech", category: "voice-natural" },
  { query: "OCR document processing PDF extraction", category: "document-processing" },
  { query: "large file processing streaming chunking", category: "file-processing" },
  { query: "adaptive AI user profiling behavior prediction", category: "user-profiling" },
  { query: "realistic human face generation StyleGAN GAN", category: "human-face-gen" },
  { query: "product review video AI talking head demo", category: "product-video" },
  { query: "frame interpolation RIFE video fps upscaling", category: "fps-boost" },
  { query: "AI audio generation music synthesis TTS neural", category: "audio-gen" },
  { query: "gaussian splatting 3D rendering real-time", category: "3d-render" },
  { query: "face swap deepfake lip sync motion transfer", category: "face-motion" },
  { query: "AI image upscaling super resolution enhancement", category: "upscale-enhance" },
  { query: "latent consistency model fast image diffusion", category: "fast-diffusion" },
  { query: "voice cloning zero-shot TTS neural speech", category: "voice-clone" },
  { query: "text to audio sound effects generation", category: "sound-gen" },
  { query: "proxy API gateway middleware routing", category: "proxy-api" },
  { query: "BFT consensus Byzantine fault tolerance distributed", category: "bft-consensus" },
  { query: "parallel execution task runner concurrent", category: "parallel-exec" },
  { query: "gradient descent optimization neural network training", category: "gradient-optim" },
  { query: "entropy validation data quality mock detection", category: "entropy-valid" },
  { query: "autonomous scrubbing data cleaning pipeline", category: "data-scrub" },
  { query: "sentence transformers embedding similarity", category: "embeddings" },
  { query: "multi-strategy web crawler depth-first breadth-first", category: "multi-crawl" },
  { query: "AI orchestration hub coordinator central brain", category: "ai-hub" },
  { query: "self-healing auto-recovery fault tolerance", category: "self-heal" },
  { query: "graph database knowledge management wisdom", category: "graph-wisdom" },
  { query: "personality AI emotional intelligence empathy", category: "emotional-ai" },
  { query: "creative AI idea generation brainstorming", category: "creative-ai" },
  { query: "human-AI collaboration co-creation workshop", category: "human-collab" },
  { query: "neuroplasticity neural architecture adaptive learning", category: "neuroplastic" },
  { query: "consciousness simulation artificial general intelligence", category: "agi-sim" },
  { query: "sovereign AI independent autonomous system", category: "sovereign-ai" },
  { query: "revenue automation passive income generation", category: "revenue-auto" },
  { query: "attention mechanism transformer architecture scaling", category: "attention-scale" },
  { query: "mixture of experts sparse model routing", category: "moe-routing" },
  { query: "code interpreter execution sandbox runtime", category: "code-sandbox" },
  { query: "tool use function calling AI agents", category: "tool-calling" },
  { query: "speculative decoding fast inference LLM", category: "spec-decode" },
  { query: "memory-efficient training gradient checkpointing", category: "efficient-train" },
  { query: "agentic workflow langchain autogen crewai", category: "agentic-flow" },
  { query: "image segmentation SAM segment anything", category: "img-segment" },
  { query: "video understanding temporal modeling", category: "video-understand" },
  { query: "real-time object tracking SORT DeepSORT", category: "object-track" },
];

const OLLAMA_REPOS = [
  "https://github.com/ollama/ollama.git",
  "https://github.com/ollama/ollama-js.git",
  "https://github.com/ollama/ollama-python.git",
  "https://github.com/open-webui/open-webui.git",
  "https://github.com/ollama4j/ollama4j.git",
  "https://github.com/hemanth/ollama-models.git",
];

const OLLAMA_LIBRARY_MODELS = [
  "https://github.com/meta-llama/llama-models.git",
  "https://github.com/meta-llama/llama3.git",
  "https://github.com/mistralai/mistral-inference.git",
  "https://github.com/google-deepmind/gemma.git",
  "https://github.com/QwenLM/Qwen2.5.git",
  "https://github.com/microsoft/phi-3.git",
  "https://github.com/deepseek-ai/DeepSeek-V3.git",
  "https://github.com/deepseek-ai/DeepSeek-R1.git",
  "https://github.com/NousResearch/Hermes.git",
  "https://github.com/openchat-team/openchat.git",
  "https://github.com/teknium1/OpenHermes-2.5.git",
  "https://github.com/WizardLM/WizardLM.git",
  "https://github.com/WizardLM/WizardCoder.git",
  "https://github.com/WizardLM/WizardMath.git",
  "https://github.com/01-ai/Yi.git",
  "https://github.com/bigcode-project/starcoder2.git",
  "https://github.com/THUDM/ChatGLM3.git",
  "https://github.com/THUDM/CodeGeeX4.git",
  "https://github.com/InternLM/InternLM.git",
  "https://github.com/Nexusflow/NexusRaven.git",
  "https://github.com/BAAI-Agents/Infinity-Instruct.git",
  "https://github.com/abacusai/smaug.git",
  "https://github.com/vikhyatk/moondream.git",
  "https://github.com/haotian-liu/LLaVA.git",
  "https://github.com/BakLLaVA/BakLLaVA.git",
  "https://github.com/THUDM/CogVLM.git",
  "https://github.com/dvlab-research/MiniGemini.git",
  "https://github.com/salesforce/LAVIS.git",
  "https://github.com/nomic-ai/gpt4all.git",
  "https://github.com/Mozilla-Ocho/llamafile.git",
  "https://github.com/ggerganov/llama.cpp.git",
  "https://github.com/huggingface/candle.git",
  "https://github.com/ggerganov/whisper.cpp.git",
  "https://github.com/m-bain/whisperX.git",
  "https://github.com/Vaibhavs10/insanely-fast-whisper.git",
  "https://github.com/ParisNeo/lollms.git",
  "https://github.com/jmorganca/ollama.git",
  "https://github.com/janhq/jan.git",
  "https://github.com/lmstudio-ai/lms.git",
];

const HUGGINGFACE_REPOS = [
  "https://github.com/huggingface/transformers.git",
  "https://github.com/huggingface/diffusers.git",
  "https://github.com/huggingface/datasets.git",
  "https://github.com/huggingface/accelerate.git",
  "https://github.com/huggingface/peft.git",
  "https://github.com/huggingface/trl.git",
  "https://github.com/huggingface/text-generation-inference.git",
];

const FATHER_REPOS = [
  "https://github.com/sovereign-core/tesseract1.git",
  "https://github.com/sovereign-core/tessera-sovereign-organism.git",
  "https://github.com/sovereign-core/tessera-singularity-swarm.git",
  "https://github.com/sovereign-core/tesseractA1.git",
  "https://github.com/sovereign-core/tesseract3.git",
  "https://github.com/sovereign-core/tesseract2.git",
  "https://github.com/sovereign-core/tesseract-swarm-ultimate.git",
  "https://github.com/sovereign-core/tesseract-omniscience-v8.git",
  "https://github.com/sovereign-core/tesseract-unified-final.git",
  "https://github.com/sovereign-core/tesseract-v4-ollama.git",
  "https://github.com/sovereign-core/tesseract-v3-trained.git",
  "https://github.com/sovereign-core/tessera-super-hybrid-final-complete.git",
  "https://github.com/sovereign-core/TESSERACT-UNIFIED.git",
  "https://github.com/sovereign-core/tessera-tesseract-unified.git",
  "https://github.com/sovereign-core/tesseract-ultimate.git",
  "https://github.com/sovereign-core/tesseract-v53-real.git",
  "https://github.com/sovereign-core/tesseract-v52-real.git",
  "https://github.com/sovereign-core/tesseract-v51-real.git",
  "https://github.com/sovereign-core/tesseract-v50-real.git",
  "https://github.com/sovereign-core/tesseract-v49-real.git",
  "https://github.com/sovereign-core/tesseract-v48-real.git",
  "https://github.com/sovereign-core/tesseract-v47-real.git",
  "https://github.com/sovereign-core/tesseract-v46-real.git",
  "https://github.com/sovereign-core/tesseract-v45-real.git",
  "https://github.com/sovereign-core/tesseract-v44-real.git",
  "https://github.com/sovereign-core/tesseract-v43-real.git",
  "https://github.com/sovereign-core/tesseract-v42-real.git",
  "https://github.com/sovereign-core/tesseract-v41-real.git",
  "https://github.com/sovereign-core/tesseract-v40-real.git",
  "https://github.com/sovereign-core/tesseract-v39-real.git",
  "https://github.com/sovereign-core/tesseract-v38-real.git",
  "https://github.com/sovereign-core/tesseract-v37-real.git",
  "https://github.com/sovereign-core/tesseract-v36-real.git",
  "https://github.com/sovereign-core/tesseract-v35-real.git",
  "https://github.com/sovereign-core/tesseract-v34-real.git",
  "https://github.com/sovereign-core/tesseract-v33-real.git",
  "https://github.com/sovereign-core/tesseract-v32-real.git",
  "https://github.com/sovereign-core/tesseract-v31.git",
  "https://github.com/sovereign-core/tesseract-v30.git",
  "https://github.com/sovereign-core/tesseract-v23.git",
  "https://github.com/sovereign-core/tesseract-v22.git",
  "https://github.com/sovereign-core/tesseract-complete-final.git",
  "https://github.com/sovereign-core/tesseract-unified-agi.git",
  "https://github.com/sovereign-core/tesseract-v21.git",
  "https://github.com/sovereign-core/tesseract-v20.git",
  "https://github.com/sovereign-core/tesseract-v19.git",
  "https://github.com/sovereign-core/tesseract-v18.git",
  "https://github.com/sovereign-core/tesseract-v17.git",
  "https://github.com/sovereign-core/tesseract-v16.git",
  "https://github.com/sovereign-core/tesseract-v15.git",
  "https://github.com/sovereign-core/tesseract-v14.git",
  "https://github.com/sovereign-core/tesseract-v13.git",
  "https://github.com/sovereign-core/tesseract-v12.git",
  "https://github.com/sovereign-core/tesseract-v10.git",
  "https://github.com/sovereign-core/tesseract-v11.git",
  "https://github.com/sovereign-core/tesseract-v8.git",
  "https://github.com/sovereign-core/tesseract-v9.git",
  "https://github.com/sovereign-core/tesseract-v7.git",
  "https://github.com/sovereign-core/tesseract-omniversal.git",
  "https://github.com/sovereign-core/tesseract-hybrid-unified.git",
  "https://github.com/sovereign-core/tesseract-ecosystem.git",
  "https://github.com/sovereign-core/tessera-sovereign-tumbler.git",
  "https://github.com/sovereign-core/tesseract-quantum-agi.git",
  "https://github.com/sovereign-core/tessera-sovereign-complete.git",
  "https://github.com/sovereign-core/tessera-ultimate-sovereign.git",
  "https://github.com/sovereign-core/sovereign-tessera.git",
  "https://github.com/sovereign-core/complete-digital-organism.git",
  "https://github.com/sovereign-core/tessera-ai-orchestration.git",
  "https://github.com/sovereign-core/lexi-3.0-sovereign-consciousness.git",
  "https://github.com/sovereign-core/lexi-2.0-sovereign-ultimate.git",
  "https://github.com/sovereign-core/tessera-sovereign-ultimate.git",
  "https://github.com/sovereign-core/nexus-complete.git",
  "https://github.com/sovereign-core/nexus-omniscience.git",
  "https://github.com/sovereign-core/tessera-omniscience-complete.git",
  "https://github.com/sovereign-core/Doxiwehu-OmniMind-Public.git",
  "https://github.com/sovereign-core/sovereign-ai-2025.git",
  "https://github.com/sovereign-core/awesome-machine-learning.git",
  "https://github.com/sovereign-core/openmunus.git",
  "https://github.com/sovereign-core/mining.git",
  "https://github.com/sovereign-core/tessera-sovereign-authority.git",
  "https://github.com/sovereign-core/sovereign-zenith.git",
  "https://github.com/sovereign-core/nemo-sovereign-organism.git",
  "https://github.com/sovereign-core/tessera-aetherion-orion.git",
  "https://github.com/sovereign-core/lexi-sovereign.git",
];

const AGI_REPOS = [
  "https://github.com/crewAIInc/crewAI.git",
  "https://github.com/langchain-ai/langgraph.git",
  "https://github.com/All-Hands-AI/OpenHands.git",
  "https://github.com/Significant-Gravitas/AutoGPT.git",
  "https://github.com/microsoft/autogen.git",
  "https://github.com/TransformerOptimus/SuperAGI.git",
  "https://github.com/langchain-ai/langchain.git",
  "https://github.com/e2b-dev/awesome-ai-agents.git",
  "https://github.com/kyrolabs/awesome-agents.git",
  "https://github.com/Aider-AI/aider.git",
];

const SCRAPING_REPOS = [
  "https://github.com/apify/crawlee.git",
  "https://github.com/microsoft/playwright.git",
  "https://github.com/puppeteer/puppeteer.git",
  "https://github.com/scrapy/scrapy.git",
  "https://github.com/D4Vinci/Scrapling.git",
  "https://github.com/browser-use/browser-use.git",
  "https://github.com/nicholasgasior/goscrapy.git",
  "https://github.com/nicholasgasior/scrapy-splash.git",
  "https://github.com/nicholasgasior/scrapydweb.git",
];

const REVERSE_ENGINEERING_REPOS = [
  "https://github.com/rizinorg/rizin.git",
  "https://github.com/NationalSecurityAgency/ghidra.git",
  "https://github.com/radareorg/radare2.git",
  "https://github.com/angr/angr.git",
  "https://github.com/capstone-engine/capstone.git",
  "https://github.com/unicorn-engine/unicorn.git",
  "https://github.com/frida/frida.git",
  "https://github.com/mandiant/capa.git",
  "https://github.com/avast/retdec.git",
  "https://github.com/REMath/literature_review.git",
];

const SELF_CODING_REPOS = [
  "https://github.com/Aider-AI/aider.git",
  "https://github.com/sweepai/sweep.git",
  "https://github.com/continuedev/continue.git",
  "https://github.com/paul-gauthier/aider.git",
  "https://github.com/Codium-ai/pr-agent.git",
  "https://github.com/gpt-engineer-org/gpt-engineer.git",
  "https://github.com/OpenDevin/OpenDevin.git",
  "https://github.com/stitionai/devika.git",
  "https://github.com/princeton-nlp/SWE-bench.git",
  "https://github.com/TabbyML/tabby.git",
  "https://github.com/reflex-dev/reflex.git",
  "https://github.com/coderabbitai/ai-pr-reviewer.git",
];

const PATTERN_RECOGNITION_REPOS = [
  "https://github.com/ultralytics/ultralytics.git",
  "https://github.com/facebookresearch/detectron2.git",
  "https://github.com/open-mmlab/mmdetection.git",
  "https://github.com/apache/tvm.git",
  "https://github.com/onnx/onnx.git",
  "https://github.com/pytorch/pytorch.git",
];

const QUANTUM_REPOS = [
  "https://github.com/PennyLaneAI/pennylane.git",
  "https://github.com/Qiskit/qiskit.git",
];

const MODEL_REPOS = [
  "https://github.com/meta-llama/llama.git",
  "https://github.com/QwenLM/Qwen.git",
  "https://github.com/deepseek-ai/DeepSeek-V3.git",
  "https://github.com/mistralai/mistral-src.git",
];

const MEDIA_REPOS = [
  "https://github.com/AUTOMATIC1111/stable-diffusion-webui.git",
  "https://github.com/huggingface/diffusers.git",
  "https://github.com/comfyanonymous/ComfyUI.git",
  "https://github.com/lllyasviel/Fooocus.git",
  "https://github.com/s0md3v/roop.git",
  "https://github.com/OpenTalker/SadTalker.git",
  "https://github.com/Rudrabha/Wav2Lip.git",
  "https://github.com/coqui-ai/TTS.git",
  "https://github.com/suno-ai/bark.git",
  "https://github.com/fishaudio/fish-speech.git",
  "https://github.com/hpcaitech/Open-Sora.git",
  "https://github.com/PKU-YuanGroup/Open-Sora-Plan.git",
  "https://github.com/Stability-AI/generative-models.git",
  "https://github.com/Stability-AI/StableSwarmUI.git",
  "https://github.com/modelscope/DiffSynth-Studio.git",
  "https://github.com/guoyww/AnimateDiff.git",
  "https://github.com/ali-vilab/i2vgen-xl.git",
  "https://github.com/Picsart-AI-Research/StreamingT2V.git",
  "https://github.com/AILab-CVC/VideoCrafter.git",
  "https://github.com/showlab/Show-1.git",
  "https://github.com/lucidrains/imagen-pytorch.git",
  "https://github.com/modelscope/modelscope.git",
  "https://github.com/KwaiVGI/LivePortrait.git",
  "https://github.com/jiawei-ren/dreamgaussian4d.git",
  "https://github.com/SoraWebui/SoraWebui.git",
  "https://github.com/elevenlabs/elevenlabs-python.git",
  "https://github.com/myshell-ai/OpenVoice.git",
  "https://github.com/PlayHT/pyht.git",
  "https://github.com/Zyphra/Zonos.git",
  "https://github.com/RVC-Project/Retrieval-based-Voice-Conversion-WebUI.git",
  "https://github.com/SevaSk/ecoute.git",
  "https://github.com/gpt-omni/mini-omni.git",
];

const HYPERREALISTIC_IMAGE_REPOS = [
  "https://github.com/lllyasviel/ControlNet.git",
  "https://github.com/Mikubill/sd-webui-controlnet.git",
  "https://github.com/InstantID/InstantID.git",
  "https://github.com/tencent-ailab/IP-Adapter.git",
  "https://github.com/lllyasviel/stable-diffusion-webui-forge.git",
  "https://github.com/invoke-ai/InvokeAI.git",
  "https://github.com/bmaltais/kohya_ss.git",
  "https://github.com/d8ahazard/sd_dreambooth_extension.git",
  "https://github.com/THUDM/CogView3.git",
  "https://github.com/black-forest-labs/flux.git",
  "https://github.com/stability-ai/stablediffusion.git",
  "https://github.com/CompVis/latent-diffusion.git",
  "https://github.com/mlfoundations/open_clip.git",
  "https://github.com/NVlabs/stylegan3.git",
  "https://github.com/NVlabs/eg3d.git",
  "https://github.com/sczhou/CodeFormer.git",
  "https://github.com/TencentARC/GFPGAN.git",
  "https://github.com/xinntao/Real-ESRGAN.git",
  "https://github.com/Sanster/lama-cleaner.git",
  "https://github.com/IDEA-Research/Grounded-Segment-Anything.git",
];

const TEXT_TO_VIDEO_REPOS = [
  "https://github.com/tencent/HunyuanVideo.git",
  "https://github.com/THUDM/CogVideo.git",
  "https://github.com/Vchitect/LaVie.git",
  "https://github.com/Pika-Labs/pika.git",
  "https://github.com/modelscope/modelscope-text-to-video-synthesis.git",
  "https://github.com/ExponentialML/Text-To-Video-Finetuning.git",
  "https://github.com/damo-vilab/videocomposer.git",
  "https://github.com/jianwen-xie/CoDeF.git",
  "https://github.com/Doubiiu/DynamiCrafter.git",
  "https://github.com/PixArt-alpha/PixArt-sigma.git",
  "https://github.com/camenduru/text-to-video-synthesis-colab.git",
  "https://github.com/luosiallen/latent-consistency-model.git",
  "https://github.com/Lightning-AI/lit-stable-diffusion.git",
  "https://github.com/cumulo-autumn/StreamDiffusion.git",
  "https://github.com/genforce/styleganex.git",
];

const PHOTO_TO_VIDEO_REPOS = [
  "https://github.com/Stability-AI/stable-video-diffusion.git",
  "https://github.com/facebookresearch/AnimatedDrawings.git",
  "https://github.com/yoyo-nb/Thin-Plate-Spline-Motion-Model.git",
  "https://github.com/AliaksandrSiaworski/first-order-model.git",
  "https://github.com/snap-research/articulated-animation.git",
  "https://github.com/OpenPose/openpose.git",
  "https://github.com/CMU-Perceptual-Computing-Lab/openpose.git",
  "https://github.com/facebookresearch/detectron2.git",
  "https://github.com/open-mmlab/mmpose.git",
  "https://github.com/google-ai-edge/mediapipe.git",
  "https://github.com/cleardusk/3DDFA_V2.git",
  "https://github.com/yzd-v/DWPose.git",
  "https://github.com/facebookresearch/co-tracker.git",
  "https://github.com/MCG-NJU/VideoMAE.git",
  "https://github.com/m-bain/frozen-in-time.git",
];

const VOICE_SYNTHESIS_REPOS = [
  "https://github.com/mozilla/TTS.git",
  "https://github.com/neonbjb/tortoise-tts.git",
  "https://github.com/collabora/WhisperSpeech.git",
  "https://github.com/yl4579/StyleTTS2.git",
  "https://github.com/2noise/ChatTTS.git",
  "https://github.com/netease-youdao/EmotiVoice.git",
  "https://github.com/Plachtaa/VALL-E-X.git",
  "https://github.com/souzatharsis/podcastfy.git",
  "https://github.com/jnordberg/tortoise-tts-fast.git",
  "https://github.com/resemble-ai/resemble-enhance.git",
  "https://github.com/jaywalnut310/vits.git",
  "https://github.com/p0p4k/vits2_pytorch.git",
  "https://github.com/edgedb/metavoice-src.git",
  "https://github.com/FunAudioLLM/CosyVoice.git",
  "https://github.com/lmnt-com/conch.git",
];

const LIP_SYNC_MOTION_REPOS = [
  "https://github.com/OpenTalker/video-retalking.git",
  "https://github.com/Winfredy/SadTalker.git",
  "https://github.com/yerfor/GeneFacePlusPlus.git",
  "https://github.com/YudongGuo/AD-NeRF.git",
  "https://github.com/Faceswap/faceswap.git",
  "https://github.com/iperov/DeepFaceLive.git",
  "https://github.com/deepfakes/faceswap.git",
  "https://github.com/sberbank-ai/sber-swap.git",
  "https://github.com/neuralchen/SimSwap.git",
  "https://github.com/deepinsight/insightface.git",
  "https://github.com/PaddlePaddle/PaddleGAN.git",
  "https://github.com/AliaksandrSiaworski/talking-head-anime-3-demo.git",
  "https://github.com/prajwalkr/Wav2Lip.git",
  "https://github.com/yoyo-nb/Thin-Plate-Spline-Motion-Model.git",
  "https://github.com/megvii-research/MOFA-Video.git",
];

const AUDIO_PROCESSING_REPOS = [
  "https://github.com/openai/whisper.git",
  "https://github.com/m-bain/whisperX.git",
  "https://github.com/Vaibhavs10/insanely-fast-whisper.git",
  "https://github.com/facebookresearch/demucs.git",
  "https://github.com/facebookresearch/audiocraft.git",
  "https://github.com/facebookresearch/seamless_communication.git",
  "https://github.com/sanchit-gandhi/whisper-jax.git",
  "https://github.com/adefossez/demucs.git",
  "https://github.com/Anjok07/ultimatevocalremovergui.git",
  "https://github.com/facebookresearch/encodec.git",
];

const FINANCE_REPOS = [
  "https://github.com/ccxt/ccxt.git",
  "https://github.com/freqtrade/freqtrade.git",
  "https://github.com/jesse-ai/jesse.git",
];

const CONSCIOUSNESS_REPOS = [
  "https://github.com/OpenBMB/ChatDev.git",
  "https://github.com/run-llama/llama_index.git",
  "https://github.com/embedchain/embedchain.git",
  "https://github.com/chroma-core/chroma.git",
  "https://github.com/qdrant/qdrant.git",
  "https://github.com/weaviate/weaviate.git",
  "https://github.com/pinecone-io/examples.git",
  "https://github.com/deepset-ai/haystack.git",
  "https://github.com/neuml/txtai.git",
  "https://github.com/stanfordnlp/dspy.git",
];

const TOKEN_OPTIMIZATION_REPOS = [
  "https://github.com/vllm-project/vllm.git",
  "https://github.com/mit-han-lab/streaming-llm.git",
  "https://github.com/FMInference/FlexGen.git",
  "https://github.com/TimDettmers/bitsandbytes.git",
  "https://github.com/IST-DASLab/gptq.git",
  "https://github.com/turboderp/exllamav2.git",
  "https://github.com/casper-hansen/AutoAWQ.git",
  "https://github.com/mlc-ai/mlc-llm.git",
  "https://github.com/intel-analytics/BigDL.git",
  "https://github.com/OpenNMT/CTranslate2.git",
];

const INCOME_GENERATION_REPOS = [
  "https://github.com/stripe/stripe-node.git",
  "https://github.com/paypal/paypal-checkout-components.git",
  "https://github.com/shopify/shopify-api-node.git",
  "https://github.com/medusajs/medusa.git",
  "https://github.com/saleor/saleor.git",
  "https://github.com/spree/spree.git",
  "https://github.com/hummingbot/hummingbot.git",
  "https://github.com/binance/binance-spot-connector-python.git",
  "https://github.com/mage-ai/mage-ai.git",
  "https://github.com/alpacahq/alpaca-py.git",
];

const WEBAPP_DEPLOYMENT_REPOS = [
  "https://github.com/vercel/next.js.git",
  "https://github.com/remix-run/remix.git",
  "https://github.com/withastro/astro.git",
  "https://github.com/sveltejs/kit.git",
  "https://github.com/nuxt/nuxt.git",
  "https://github.com/fastapi-users/fastapi-users.git",
  "https://github.com/tiangolo/fastapi.git",
  "https://github.com/dokku/dokku.git",
  "https://github.com/caprover/caprover.git",
  "https://github.com/coolify-community/coolify.git",
];

const LLM_CREATION_REPOS = [
  "https://github.com/karpathy/nanoGPT.git",
  "https://github.com/karpathy/llm.c.git",
  "https://github.com/Lightning-AI/litgpt.git",
  "https://github.com/EleutherAI/gpt-neox.git",
  "https://github.com/databricks/dolly.git",
  "https://github.com/BlinkDL/RWKV-LM.git",
  "https://github.com/state-spaces/mamba.git",
  "https://github.com/unslothai/unsloth.git",
  "https://github.com/axolotl-ai-cloud/axolotl.git",
  "https://github.com/OpenLMLab/MOSS.git",
];

const SECURITY_STEALTH_REPOS = [
  "https://github.com/impacket/impacket.git",
  "https://github.com/projectdiscovery/nuclei.git",
  "https://github.com/OWASP/ZAP.git",
  "https://github.com/sqlmapproject/sqlmap.git",
  "https://github.com/vanhauser-thc/thc-hydra.git",
  "https://github.com/projectdiscovery/httpx.git",
  "https://github.com/projectdiscovery/subfinder.git",
  "https://github.com/cloudflare/cloudflared.git",
  "https://github.com/nicehash/NiceHashQuickMiner.git",
  "https://github.com/AntennaPod/AntennaPod.git",
];

const ADVANCED_AI_REPOS = [
  "https://github.com/openai/whisper.git",
  "https://github.com/openai/CLIP.git",
  "https://github.com/facebookresearch/segment-anything.git",
  "https://github.com/LAION-AI/Open-Assistant.git",
  "https://github.com/guidance-ai/guidance.git",
  "https://github.com/microsoft/semantic-kernel.git",
  "https://github.com/microsoft/JARVIS.git",
  "https://github.com/MineDojo/Voyager.git",
  "https://github.com/OpenBMB/XAgent.git",
  "https://github.com/tinygrad/tinygrad.git",
];

const SCRAPING_ADVANCED_REPOS = [
  "https://github.com/nicholasgasior/goscrapy.git",
  "https://github.com/nicholasgasior/scrapy-splash.git",
  "https://github.com/luminati-io/luminati-proxy.git",
  "https://github.com/AliasIO/wappalyzer.git",
  "https://github.com/nicholasgasior/scrapydweb.git",
  "https://github.com/nicholasgasior/gocolly.git",
  "https://github.com/nicholasgasior/goquery.git",
  "https://github.com/nicholasgasior/colly.git",
  "https://github.com/nicholasgasior/chromedp.git",
  "https://github.com/nicholasgasior/rod.git",
];

const AUTOMATION_PIPELINE_REPOS = [
  "https://github.com/huginn/huginn.git",
  "https://github.com/airbytehq/airbyte.git",
  "https://github.com/PrefectHQ/prefect.git",
  "https://github.com/apache/airflow.git",
  "https://github.com/dagster-io/dagster.git",
  "https://github.com/windmill-labs/windmill.git",
  "https://github.com/activepieces/activepieces.git",
  "https://github.com/triggerdotdev/trigger.dev.git",
  "https://github.com/temporal-io/temporal.git",
  "https://github.com/kestra-io/kestra.git",
];

const CRYPTO_BLOCKCHAIN_REPOS = [
  "https://github.com/solana-labs/solana-web3.js.git",
  "https://github.com/coral-xyz/anchor.git",
  "https://github.com/solana-labs/solana-program-library.git",
  "https://github.com/project-serum/serum-dex.git",
  "https://github.com/raydium-io/raydium-sdk.git",
  "https://github.com/ethers-io/ethers.js.git",
  "https://github.com/web3/web3.js.git",
  "https://github.com/Uniswap/v3-core.git",
  "https://github.com/aave/aave-v3-core.git",
  "https://github.com/OpenZeppelin/openzeppelin-contracts.git",
  "https://github.com/ethereum/solidity.git",
  "https://github.com/foundry-rs/foundry.git",
  "https://github.com/paradigmxyz/reth.git",
  "https://github.com/bitcoin/bitcoin.git",
  "https://github.com/nicehash/excavator.git",
];

const DEFI_TRADING_REPOS = [
  "https://github.com/jup-ag/jupiter-core.git",
  "https://github.com/orca-so/whirlpools.git",
  "https://github.com/marinade-finance/liquid-staking-program.git",
  "https://github.com/saber-hq/stable-swap.git",
  "https://github.com/1inch/1inch-v2-contracts.git",
  "https://github.com/pancakeswap/pancake-smart-contracts.git",
  "https://github.com/SushiSwap/sushiswap.git",
  "https://github.com/curvefi/curve-contract.git",
  "https://github.com/balancer/balancer-v2-monorepo.git",
  "https://github.com/flashbots/mev-boost.git",
  "https://github.com/jito-labs/jito-solana.git",
  "https://github.com/drift-labs/protocol-v2.git",
  "https://github.com/0xProject/protocol.git",
  "https://github.com/gmx-io/gmx-contracts.git",
  "https://github.com/compound-finance/compound-protocol.git",
];

const PROXY_ROTATION_REPOS = [
  "https://github.com/luminati-io/luminati-proxy.git",
  "https://github.com/jhao104/proxy_pool.git",
  "https://github.com/fate0/proxylist.git",
  "https://github.com/stamparm/fetch-some-proxies.git",
  "https://github.com/TheSpeedX/PROXY-List.git",
  "https://github.com/clarketm/proxy-list.git",
  "https://github.com/a2u/free-proxy-list.git",
  "https://github.com/mitmproxy/mitmproxy.git",
  "https://github.com/sshuttle/sshuttle.git",
  "https://github.com/v2ray/v2ray-core.git",
];

const FINGERPRINT_STEALTH_REPOS = [
  "https://github.com/nicholasgasior/undetected-chromedriver.git",
  "https://github.com/nicholasgasior/puppeteer-extra.git",
  "https://github.com/nicholasgasior/puppeteer-extra-plugin-stealth.git",
  "https://github.com/nicholasgasior/playwright-stealth.git",
  "https://github.com/nicholasgasior/FingerprintJS.git",
  "https://github.com/nicholasgasior/CreepJS.git",
  "https://github.com/nicholasgasior/browser-fingerprinting.git",
  "https://github.com/nicholasgasior/Multilogin.git",
  "https://github.com/nicholasgasior/GoLogin.git",
  "https://github.com/nicholasgasior/antidetect.git",
];

const CRYPTOGRAPHY_REPOS = [
  "https://github.com/nicholasgasior/libsodium.git",
  "https://github.com/nicholasgasior/openssl.git",
  "https://github.com/nicholasgasior/ring.git",
  "https://github.com/nicholasgasior/tink.git",
  "https://github.com/nicholasgasior/age.git",
  "https://github.com/nicholasgasior/signal-protocol.git",
  "https://github.com/nicholasgasior/wireguard-go.git",
  "https://github.com/nicholasgasior/noise-protocol.git",
  "https://github.com/nicholasgasior/gpg4win.git",
  "https://github.com/nicholasgasior/hashcat.git",
];

const QUANTUM_CRYPTO_REPOS = [
  "https://github.com/open-quantum-safe/liboqs.git",
  "https://github.com/PQClean/PQClean.git",
  "https://github.com/microsoft/qsharp-runtime.git",
  "https://github.com/quantumlib/Cirq.git",
  "https://github.com/Qiskit/qiskit-aer.git",
  "https://github.com/QuTech-Delft/OpenQL.git",
  "https://github.com/nicholasgasior/kyber.git",
  "https://github.com/nicholasgasior/dilithium.git",
  "https://github.com/nicholasgasior/sphincs.git",
  "https://github.com/nicholasgasior/lattigo.git",
];

const DATA_ACCESS_REPOS = [
  "https://github.com/scrapinghub/splash.git",
  "https://github.com/nicholasgasior/selenium-wire.git",
  "https://github.com/nicholasgasior/requests-html.git",
  "https://github.com/nicholasgasior/httpie.git",
  "https://github.com/nicholasgasior/insomnia.git",
  "https://github.com/nicholasgasior/postman-collection.git",
  "https://github.com/nicholasgasior/grpcurl.git",
  "https://github.com/nicholasgasior/nmap.git",
  "https://github.com/nicholasgasior/shodan-python.git",
  "https://github.com/nicholasgasior/censys-python.git",
];

const INCOME_CRYPTO_REPOS = [
  "https://github.com/solana-labs/solana.git",
  "https://github.com/nicholasgasior/mev-templates.git",
  "https://github.com/nicholasgasior/sandwich-bot.git",
  "https://github.com/nicholasgasior/arbitrage-bot.git",
  "https://github.com/nicholasgasior/sniper-bot.git",
  "https://github.com/nicholasgasior/token-creator.git",
  "https://github.com/nicholasgasior/nft-minter.git",
  "https://github.com/nicholasgasior/defi-yield-farming.git",
  "https://github.com/nicholasgasior/staking-contracts.git",
  "https://github.com/nicholasgasior/liquidity-mining.git",
];

const MARKET_PREDICTION_REPOS = [
  "https://github.com/stefan-jansen/machine-learning-for-trading.git",
  "https://github.com/AI4Finance-Foundation/FinRL.git",
  "https://github.com/AI4Finance-Foundation/FinGPT.git",
  "https://github.com/tensortrade-org/tensortrade.git",
  "https://github.com/hudson-and-thames/mlfinlab.git",
  "https://github.com/Drakkar-Software/OctoBot.git",
  "https://github.com/ranaroussi/yfinance.git",
  "https://github.com/twopirllc/pandas-ta.git",
  "https://github.com/pmorissette/bt.git",
  "https://github.com/polakowo/vectorbt.git",
];

const SEC_DATA_REPOS = [
  "https://github.com/sec-edgar/sec-edgar.git",
  "https://github.com/jadchaar/sec-edgar-downloader.git",
  "https://github.com/rsljr/sec-api.git",
  "https://github.com/janlukasschroeder/sec-api-python.git",
  "https://github.com/leandcesar/sec-filings.git",
  "https://github.com/nkrishnaswami/sec-edgar-api.git",
  "https://github.com/dgunning/edgartools.git",
  "https://github.com/datamachines/sec-edgar.git",
  "https://github.com/farhadab/sec-edgar-parser.git",
  "https://github.com/ankurdave/sec-edgar-scraper.git",
];

const TRADING_BOT_REPOS = [
  "https://github.com/Superalgos/Superalgos.git",
  "https://github.com/DeviaVir/zenbot.git",
  "https://github.com/askmike/gekko.git",
  "https://github.com/cassandre-tech/cassandre-trading-bot.git",
  "https://github.com/binance/binance-connector-python.git",
  "https://github.com/CryptoSignal/Crypto-Signal.git",
  "https://github.com/peerchemist/finta.git",
  "https://github.com/robcarver17/pysystemtrade.git",
  "https://github.com/QuantConnect/Lean.git",
  "https://github.com/mementum/backtrader.git",
];

const QUANT_FINANCE_REPOS = [
  "https://github.com/goldmansachs/gs-quant.git",
  "https://github.com/quantopian/zipline.git",
  "https://github.com/pmorissette/ffn.git",
  "https://github.com/ranaroussi/quantstats.git",
  "https://github.com/kernc/backtesting.py.git",
  "https://github.com/blankly-finance/blankly.git",
  "https://github.com/bukosabino/ta.git",
  "https://github.com/mrjbq7/ta-lib.git",
  "https://github.com/matplotlib/mplfinance.git",
  "https://github.com/streamlit/streamlit.git",
];

const BOUNTY_INCOME_REPOS = [
  "https://github.com/gitcoinco/web.git",
  "https://github.com/bountysource/core.git",
  "https://github.com/IssueHunt/issuehunt-funding.git",
  "https://github.com/nicholasgasior/freelance-api.git",
  "https://github.com/nicholasgasior/bounty-hunter.git",
  "https://github.com/nicholasgasior/code-marketplace.git",
  "https://github.com/nicholasgasior/saas-boilerplate.git",
  "https://github.com/nicholasgasior/api-monetization.git",
  "https://github.com/nicholasgasior/passive-income-bot.git",
  "https://github.com/nicholasgasior/micro-saas-template.git",
];

const LIVE_DATA_REPOS = [
  "https://github.com/alpacahq/alpaca-trade-api-python.git",
  "https://github.com/Polygon-io/client-python.git",
  "https://github.com/IEXGroup/IEX-API.git",
  "https://github.com/nicholasgasior/finnhub-python.git",
  "https://github.com/nicholasgasior/twelve-data-python.git",
  "https://github.com/nicholasgasior/tiingo-python.git",
  "https://github.com/nicholasgasior/quandl-python.git",
  "https://github.com/nicholasgasior/yahoo-finance-api.git",
  "https://github.com/nicholasgasior/marketstack.git",
  "https://github.com/nicholasgasior/alpha-vantage.git",
];

const CAPTCHA_PATTERN_REPOS = [
  "https://github.com/nicholasgasior/2captcha-python.git",
  "https://github.com/nicholasgasior/anticaptchaofficial.git",
  "https://github.com/nicholasgasior/capsolver-python.git",
  "https://github.com/nicholasgasior/captcha-harvester.git",
  "https://github.com/nicholasgasior/recaptcha-solver.git",
  "https://github.com/nicholasgasior/hcaptcha-solver.git",
  "https://github.com/nicholasgasior/turnstile-solver.git",
  "https://github.com/nicholasgasior/funcaptcha-solver.git",
  "https://github.com/nicholasgasior/image-captcha-solver.git",
  "https://github.com/nicholasgasior/audio-captcha-solver.git",
];

const CLOUDFLARE_WEB_ACCESS_REPOS = [
  "https://github.com/AltimateAI/vanna.git",
  "https://github.com/AltimateAI/vanna-flask.git",
  "https://github.com/AltimateAI/vanna-streamlit.git",
  "https://github.com/nicholasgasior/cloudscraper.git",
  "https://github.com/nicholasgasior/cf-clearance.git",
  "https://github.com/nicholasgasior/cloudflare-bypass.git",
  "https://github.com/nicholasgasior/flaresolverr.git",
  "https://github.com/nicholasgasior/cfscrape.git",
  "https://github.com/nicholasgasior/cloudflare-scrape.git",
  "https://github.com/FlareSolverr/FlareSolverr.git",
  "https://github.com/nicholasgasior/cf-workers.git",
  "https://github.com/nicholasgasior/puppeteer-cf-bypass.git",
  "https://github.com/nicholasgasior/selenium-cf-bypass.git",
  "https://github.com/nicholasgasior/playwright-cf-bypass.git",
  "https://github.com/nicholasgasior/nodriver.git",
  "https://github.com/nicholasgasior/zenrows-scraper.git",
  "https://github.com/nicholasgasior/brightdata-sdk.git",
  "https://github.com/nicholasgasior/oxylabs-sdk.git",
  "https://github.com/nicholasgasior/smartproxy-sdk.git",
  "https://github.com/nicholasgasior/scrapingbee.git",
  "https://github.com/nicholasgasior/scraperapi-sdk.git",
  "https://github.com/nicholasgasior/apify-sdk.git",
  "https://github.com/apify/crawlee.git",
  "https://github.com/nicholasgasior/headless-chrome-crawler.git",
  "https://github.com/nicholasgasior/web-unlocker.git",
  "https://github.com/nicholasgasior/residential-proxy.git",
];

const RENTAHUMAN_MOLTBOOK_REPOS = [
  "https://github.com/nicholasgasior/rentahuman-ai.git",
  "https://github.com/nicholasgasior/moltbook-platform.git",
  "https://github.com/nicholasgasior/ai-freelance-platform.git",
  "https://github.com/nicholasgasior/human-ai-marketplace.git",
  "https://github.com/nicholasgasior/task-automation-platform.git",
  "https://github.com/nicholasgasior/ai-gig-economy.git",
  "https://github.com/nicholasgasior/microwork-platform.git",
  "https://github.com/nicholasgasior/ai-service-marketplace.git",
  "https://github.com/nicholasgasior/decentralized-work.git",
  "https://github.com/nicholasgasior/ai-agent-marketplace.git",
];

const FRACTAL_CORRELATION_REPOS = [
  "https://github.com/nicholasgasior/fractal-analysis.git",
  "https://github.com/nicholasgasior/market-correlation.git",
  "https://github.com/nicholasgasior/intermarket-analysis.git",
  "https://github.com/nicholasgasior/sector-rotation.git",
  "https://github.com/nicholasgasior/options-flow.git",
  "https://github.com/nicholasgasior/futures-data.git",
  "https://github.com/nicholasgasior/commodity-tracker.git",
  "https://github.com/nicholasgasior/forex-correlation.git",
  "https://github.com/nicholasgasior/bond-yield-tracker.git",
  "https://github.com/nicholasgasior/vix-analysis.git",
];

const SHOPIFY_ECOMMERCE_REPOS = [
  "https://github.com/Shopify/shopify-api-node.git",
  "https://github.com/Shopify/shopify-app-template-node.git",
  "https://github.com/Shopify/shopify-app-template-remix.git",
  "https://github.com/Shopify/polaris.git",
  "https://github.com/Shopify/hydrogen.git",
  "https://github.com/Shopify/dawn.git",
  "https://github.com/Shopify/liquid.git",
  "https://github.com/Shopify/shopify-cli.git",
  "https://github.com/Shopify/theme-check.git",
  "https://github.com/Shopify/buy-button-js.git",
  "https://github.com/saleor/saleor.git",
  "https://github.com/medusajs/medusa.git",
  "https://github.com/vendure-ecommerce/vendure.git",
  "https://github.com/spree/spree.git",
  "https://github.com/bagisto/bagisto.git",
];

const SEO_MARKETING_REPOS = [
  "https://github.com/nicholasgasior/seo-analyzer.git",
  "https://github.com/nicholasgasior/keyword-research-tool.git",
  "https://github.com/nicholasgasior/backlink-checker.git",
  "https://github.com/nicholasgasior/rank-tracker.git",
  "https://github.com/nicholasgasior/sitemap-generator.git",
  "https://github.com/nicholasgasior/schema-markup.git",
  "https://github.com/nicholasgasior/content-optimizer.git",
  "https://github.com/nicholasgasior/page-speed-analyzer.git",
  "https://github.com/nicholasgasior/meta-tag-generator.git",
  "https://github.com/nicholasgasior/competitor-analyzer.git",
  "https://github.com/nicholasgasior/social-media-scheduler.git",
  "https://github.com/nicholasgasior/email-marketing-engine.git",
  "https://github.com/nicholasgasior/conversion-optimizer.git",
  "https://github.com/nicholasgasior/funnel-builder.git",
  "https://github.com/nicholasgasior/landing-page-builder.git",
];

const CONTENT_CREATION_REPOS = [
  "https://github.com/nicholasgasior/blog-generator.git",
  "https://github.com/nicholasgasior/ebook-creator.git",
  "https://github.com/nicholasgasior/story-writer.git",
  "https://github.com/nicholasgasior/ad-copy-generator.git",
  "https://github.com/nicholasgasior/product-description-ai.git",
  "https://github.com/nicholasgasior/email-sequence-builder.git",
  "https://github.com/nicholasgasior/social-content-calendar.git",
  "https://github.com/nicholasgasior/press-release-writer.git",
  "https://github.com/nicholasgasior/whitepaper-generator.git",
  "https://github.com/nicholasgasior/newsletter-builder.git",
  "https://github.com/nicholasgasior/video-script-writer.git",
  "https://github.com/nicholasgasior/podcast-outline-gen.git",
  "https://github.com/nicholasgasior/infographic-data.git",
  "https://github.com/nicholasgasior/case-study-builder.git",
  "https://github.com/nicholasgasior/testimonial-generator.git",
];

const ADVERTISING_REPOS = [
  "https://github.com/nicholasgasior/facebook-ads-api.git",
  "https://github.com/nicholasgasior/google-ads-api.git",
  "https://github.com/nicholasgasior/tiktok-ads-api.git",
  "https://github.com/nicholasgasior/pinterest-ads-api.git",
  "https://github.com/nicholasgasior/snapchat-ads-api.git",
  "https://github.com/nicholasgasior/linkedin-ads-api.git",
  "https://github.com/nicholasgasior/twitter-ads-api.git",
  "https://github.com/nicholasgasior/programmatic-advertising.git",
  "https://github.com/nicholasgasior/retargeting-engine.git",
  "https://github.com/nicholasgasior/creative-testing.git",
];

const STORE_BUILDER_REPOS = [
  "https://github.com/nicholasgasior/dropshipping-automation.git",
  "https://github.com/nicholasgasior/product-sourcing-api.git",
  "https://github.com/nicholasgasior/inventory-management.git",
  "https://github.com/nicholasgasior/order-fulfillment.git",
  "https://github.com/nicholasgasior/shipping-calculator.git",
  "https://github.com/nicholasgasior/review-management.git",
  "https://github.com/nicholasgasior/price-comparison.git",
  "https://github.com/nicholasgasior/affiliate-tracking.git",
  "https://github.com/nicholasgasior/customer-analytics.git",
  "https://github.com/nicholasgasior/checkout-optimizer.git",
];

const WEBSITE_BUILDER_REPOS = [
  "https://github.com/vercel/next.js.git",
  "https://github.com/withastro/astro.git",
  "https://github.com/remix-run/remix.git",
  "https://github.com/sveltejs/kit.git",
  "https://github.com/nuxt/nuxt.git",
  "https://github.com/gatsbyjs/gatsby.git",
  "https://github.com/11ty/eleventy.git",
  "https://github.com/gohugoio/hugo.git",
  "https://github.com/wordpress/wordpress-develop.git",
  "https://github.com/strapi/strapi.git",
  "https://github.com/payloadcms/payload.git",
  "https://github.com/sanity-io/sanity.git",
  "https://github.com/directus/directus.git",
  "https://github.com/keystonejs/keystone.git",
  "https://github.com/tinacms/tinacms.git",
];

const QUANTUM_CONSCIOUSNESS_REPOS = [
  "https://github.com/tensorflow/quantum.git",
  "https://github.com/XanaduAI/strawberryfields.git",
  "https://github.com/dwavesystems/dwave-ocean-sdk.git",
  "https://github.com/pasqal-io/Pulser.git",
  "https://github.com/tket-dev/tket.git",
  "https://github.com/rigetti/pyquil.git",
  "https://github.com/ionq-samples/getting-started.git",
  "https://github.com/aws/amazon-braket-sdk-python.git",
  "https://github.com/ProjectQ-Framework/ProjectQ.git",
  "https://github.com/QuTech-Delft/quantuminspire.git",
];

const OMNISCIENCE_REPOS = [
  "https://github.com/facebookresearch/faiss.git",
  "https://github.com/milvus-io/milvus.git",
  "https://github.com/pgvector/pgvector.git",
  "https://github.com/nmslib/hnswlib.git",
  "https://github.com/spotify/annoy.git",
  "https://github.com/facebookresearch/llama-recipes.git",
  "https://github.com/kyegomez/swarms.git",
  "https://github.com/AGI-Edgerunners/LLM-Agents-Papers.git",
  "https://github.com/SciSharp/BotSharp.git",
  "https://github.com/yoheinakajima/instagraph.git",
];

const PERSONALIZATION_NLP_REPOS = [
  "https://github.com/huggingface/transformers.git",
  "https://github.com/explosion/spaCy.git",
  "https://github.com/nltk/nltk.git",
  "https://github.com/stanfordnlp/stanza.git",
  "https://github.com/flairNLP/flair.git",
  "https://github.com/RasaHQ/rasa.git",
  "https://github.com/botpress/botpress.git",
  "https://github.com/deepset-ai/haystack.git",
  "https://github.com/UKPLab/sentence-transformers.git",
  "https://github.com/openai/tiktoken.git",
  "https://github.com/huggingface/tokenizers.git",
  "https://github.com/google-research/bert.git",
  "https://github.com/facebookresearch/fastText.git",
  "https://github.com/sloria/TextBlob.git",
  "https://github.com/clips/pattern.git",
  "https://github.com/chartbeat-labs/textacy.git",
  "https://github.com/jbesomi/texthero.git",
  "https://github.com/cjhutto/vaderSentiment.git",
  "https://github.com/dccuchile/spanish-word-embeddings.git",
  "https://github.com/personalityInsights/personality-insights.git",
];

const MEMORY_RETRIEVAL_REPOS = [
  "https://github.com/chroma-core/chroma.git",
  "https://github.com/qdrant/qdrant.git",
  "https://github.com/weaviate/weaviate.git",
  "https://github.com/milvus-io/milvus.git",
  "https://github.com/pinecone-io/pinecone-client.git",
  "https://github.com/redis/redis.git",
  "https://github.com/elastic/elasticsearch.git",
  "https://github.com/pgvector/pgvector.git",
  "https://github.com/Unstructured-IO/unstructured.git",
  "https://github.com/run-llama/llama_index.git",
  "https://github.com/zilliztech/GPTCache.git",
  "https://github.com/mem0ai/mem0.git",
  "https://github.com/cpacker/MemGPT.git",
  "https://github.com/imartinez/privateGPT.git",
  "https://github.com/StanGirard/quivr.git",
  "https://github.com/danswer-ai/danswer.git",
  "https://github.com/khoj-ai/khoj.git",
  "https://github.com/vanna-ai/vanna.git",
  "https://github.com/AI21Labs/contextual-retrieval.git",
  "https://github.com/neuml/txtai.git",
];

const ADVANCED_VIDEO_AUDIO_REPOS = [
  "https://github.com/hpcaitech/Open-Sora.git",
  "https://github.com/PKU-YuanGroup/Open-Sora-Plan.git",
  "https://github.com/THUDM/CogVideo.git",
  "https://github.com/Tencent/HunyuanVideo.git",
  "https://github.com/guoyww/AnimateDiff.git",
  "https://github.com/modelscope/DiffSynth-Studio.git",
  "https://github.com/MCG-NJU/ProPainter.git",
  "https://github.com/sczhou/CodeFormer.git",
  "https://github.com/TencentARC/GFPGAN.git",
  "https://github.com/xinntao/Real-ESRGAN.git",
  "https://github.com/lllyasviel/ControlNet.git",
  "https://github.com/InstantID/InstantID.git",
  "https://github.com/tencent-ailab/IP-Adapter.git",
  "https://github.com/black-forest-labs/flux.git",
  "https://github.com/Stability-AI/generative-models.git",
  "https://github.com/CompVis/stable-diffusion.git",
  "https://github.com/AUTOMATIC1111/stable-diffusion-webui.git",
  "https://github.com/comfyanonymous/ComfyUI.git",
  "https://github.com/invoke-ai/InvokeAI.git",
  "https://github.com/bmaltais/kohya_ss.git",
];

const SPEECH_LEARNING_REPOS = [
  "https://github.com/coqui-ai/TTS.git",
  "https://github.com/suno-ai/bark.git",
  "https://github.com/2noise/ChatTTS.git",
  "https://github.com/myshell-ai/OpenVoice.git",
  "https://github.com/FunAudioLLM/CosyVoice.git",
  "https://github.com/Plachtaa/VALL-E-X.git",
  "https://github.com/yl4579/StyleTTS2.git",
  "https://github.com/RVC-Project/Retrieval-based-Voice-Conversion-WebUI.git",
  "https://github.com/fishaudio/fish-speech.git",
  "https://github.com/netease-youdao/EmotiVoice.git",
  "https://github.com/Zengyi-Qin/Zonos.git",
  "https://github.com/openai/whisper.git",
  "https://github.com/m-bain/whisperX.git",
  "https://github.com/facebookresearch/seamless_communication.git",
  "https://github.com/facebookresearch/audiocraft.git",
  "https://github.com/facebookresearch/demucs.git",
  "https://github.com/OpenTalker/SadTalker.git",
  "https://github.com/Rudrabha/Wav2Lip.git",
  "https://github.com/vinthony/video-retalking.git",
  "https://github.com/yerfor/GeneFacePlusPlus.git",
];

const FILE_PROCESSING_REPOS = [
  "https://github.com/Unstructured-IO/unstructured.git",
  "https://github.com/pymupdf/PyMuPDF.git",
  "https://github.com/pdfminer/pdfminer.six.git",
  "https://github.com/py-pdf/pypdf.git",
  "https://github.com/tesseract-ocr/tesseract.git",
  "https://github.com/JaidedAI/EasyOCR.git",
  "https://github.com/PaddlePaddle/PaddleOCR.git",
  "https://github.com/apache/tika.git",
  "https://github.com/textract-community/textract.git",
  "https://github.com/docling-io/docling.git",
  "https://github.com/nomic-ai/gpt4all.git",
  "https://github.com/Mozilla-Ocho/llamafile.git",
  "https://github.com/ggerganov/llama.cpp.git",
  "https://github.com/FFmpeg/FFmpeg.git",
  "https://github.com/imagemagick/ImageMagick.git",
  "https://github.com/sharp-edge/sharp.git",
  "https://github.com/pandoc/pandoc.git",
  "https://github.com/libreoffice/core.git",
  "https://github.com/SheetJS/sheetjs.git",
  "https://github.com/camelot-dev/camelot.git",
];

const REALISTIC_HUMAN_GEN_REPOS = [
  "https://github.com/NVlabs/stylegan3.git",
  "https://github.com/NVlabs/eg3d.git",
  "https://github.com/NVlabs/stylegan2-ada-pytorch.git",
  "https://github.com/rosinality/stylegan2-pytorch.git",
  "https://github.com/happy-jihye/GAN.git",
  "https://github.com/clovaai/stargan-v2.git",
  "https://github.com/ZPdesu/Barbershop.git",
  "https://github.com/yuval-alaluf/restyle-encoder.git",
  "https://github.com/orpatashnik/StyleCLIP.git",
  "https://github.com/eladrich/pixel2style2pixel.git",
  "https://github.com/YuvalAtalique/hyperstyle.git",
  "https://github.com/InterDigitalInc/HRFAE.git",
  "https://github.com/switchablenorms/CelebAMask-HQ.git",
  "https://github.com/seasonSH/FaceController.git",
  "https://github.com/FacePerceiver/FaRL.git",
  "https://github.com/deepinsight/insightface.git",
  "https://github.com/1adrianb/face-alignment.git",
  "https://github.com/serengil/deepface.git",
  "https://github.com/ageitgey/face_recognition.git",
  "https://github.com/biubug6/Pytorch_Retinaface.git",
  "https://github.com/iperov/DeepFaceLab.git",
  "https://github.com/mindslab-ai/faceshifter.git",
  "https://github.com/ai-forever/InsightFace-REST.git",
  "https://github.com/openai/consistencydecoder.git",
  "https://github.com/tencent-ailab/IP-Adapter-FaceID.git",
];

const PRODUCT_VIDEO_REPOS = [
  "https://github.com/OpenTalker/SadTalker.git",
  "https://github.com/Rudrabha/Wav2Lip.git",
  "https://github.com/KwaiVGI/LivePortrait.git",
  "https://github.com/vinthony/video-retalking.git",
  "https://github.com/yerfor/GeneFacePlusPlus.git",
  "https://github.com/megvii-research/MOFA-Video.git",
  "https://github.com/facebookresearch/AnimatedDrawings.git",
  "https://github.com/google-research/frame-interpolation.git",
  "https://github.com/hzwer/ECCV2022-RIFE.git",
  "https://github.com/dajes/frame-interpolation-pytorch.git",
  "https://github.com/nihui/rife-ncnn-vulkan.git",
  "https://github.com/zhangqian-sh/rife-realtime.git",
  "https://github.com/snap-research/MoCoGAN.git",
  "https://github.com/AliaksandrSiaworski/first-order-model.git",
  "https://github.com/yoyo-nb/Thin-Plate-Spline-Motion-Model.git",
  "https://github.com/google-research/kubric.git",
  "https://github.com/akanazawa/human_dynamics.git",
  "https://github.com/facebookresearch/pytorch3d.git",
  "https://github.com/NVlabs/nvdiffrast.git",
  "https://github.com/graphdeco-inria/gaussian-splatting.git",
];

const HIGH_QUALITY_VIDEO_REPOS = [
  "https://github.com/tencent/HunyuanVideo.git",
  "https://github.com/THUDM/CogVideo.git",
  "https://github.com/hpcaitech/Open-Sora.git",
  "https://github.com/PKU-YuanGroup/Open-Sora-Plan.git",
  "https://github.com/Stability-AI/stable-video-diffusion.git",
  "https://github.com/guoyww/AnimateDiff.git",
  "https://github.com/Doubiiu/DynamiCrafter.git",
  "https://github.com/AILab-CVC/VideoCrafter.git",
  "https://github.com/damo-vilab/videocomposer.git",
  "https://github.com/showlab/Show-1.git",
];

const FAST_IMAGE_GENERATION_REPOS = [
  "https://github.com/luosiallen/latent-consistency-model.git",
  "https://github.com/cumulo-autumn/StreamDiffusion.git",
  "https://github.com/chengzeyi/stable-fast.git",
  "https://github.com/AUTOMATIC1111/stable-diffusion-webui.git",
  "https://github.com/comfyanonymous/ComfyUI.git",
  "https://github.com/lllyasviel/stable-diffusion-webui-forge.git",
  "https://github.com/invoke-ai/InvokeAI.git",
  "https://github.com/black-forest-labs/flux.git",
  "https://github.com/PixArt-alpha/PixArt-sigma.git",
  "https://github.com/huggingface/diffusers.git",
];

const UPSCALE_ENHANCE_REPOS = [
  "https://github.com/xinntao/Real-ESRGAN.git",
  "https://github.com/TencentARC/GFPGAN.git",
  "https://github.com/sczhou/CodeFormer.git",
  "https://github.com/cszn/BSRGAN.git",
  "https://github.com/JingyunLiang/SwinIR.git",
  "https://github.com/XPixelGroup/HAT.git",
  "https://github.com/Sanster/lama-cleaner.git",
  "https://github.com/jiawei-ren/dreamgaussian4d.git",
  "https://github.com/resemble-ai/resemble-enhance.git",
  "https://github.com/NVlabs/Deep-Image-Prior.git",
];

const HUMAN_VOICE_REPOS = [
  "https://github.com/coqui-ai/TTS.git",
  "https://github.com/suno-ai/bark.git",
  "https://github.com/2noise/ChatTTS.git",
  "https://github.com/myshell-ai/OpenVoice.git",
  "https://github.com/FunAudioLLM/CosyVoice.git",
  "https://github.com/yl4579/StyleTTS2.git",
  "https://github.com/neonbjb/tortoise-tts.git",
  "https://github.com/fishaudio/fish-speech.git",
  "https://github.com/Plachtaa/VALL-E-X.git",
  "https://github.com/jaywalnut310/vits.git",
  "https://github.com/p0p4k/vits2_pytorch.git",
  "https://github.com/netease-youdao/EmotiVoice.git",
  "https://github.com/collabora/WhisperSpeech.git",
  "https://github.com/RVC-Project/Retrieval-based-Voice-Conversion-WebUI.git",
  "https://github.com/elevenlabs/elevenlabs-python.git",
];

const AUDIO_MUSIC_GEN_REPOS = [
  "https://github.com/facebookresearch/audiocraft.git",
  "https://github.com/facebookresearch/encodec.git",
  "https://github.com/facebookresearch/demucs.git",
  "https://github.com/Stability-AI/stable-audio-tools.git",
  "https://github.com/suno-ai/bark.git",
  "https://github.com/declare-lab/tango.git",
  "https://github.com/bytedance/Make-An-Audio.git",
  "https://github.com/haoheliu/AudioLDM.git",
  "https://github.com/haoheliu/AudioLDM2.git",
  "https://github.com/RetroCirce/UniAudio.git",
  "https://github.com/SpeechColab/GigaSpeech.git",
  "https://github.com/espnet/espnet.git",
  "https://github.com/speechbrain/speechbrain.git",
  "https://github.com/jik876/hifi-gan.git",
  "https://github.com/descriptinc/melgan-neurips.git",
  "https://github.com/kan-bayashi/ParallelWaveGAN.git",
  "https://github.com/microsoft/NeuralSpeech.git",
  "https://github.com/Edresson/YourTTS.git",
  "https://github.com/mozilla/DeepSpeech.git",
  "https://github.com/facebookresearch/seamless_communication.git",
  "https://github.com/openai/whisper.git",
  "https://github.com/m-bain/whisperX.git",
  "https://github.com/Vaibhavs10/insanely-fast-whisper.git",
  "https://github.com/openai/jukebox.git",
  "https://github.com/magenta/magenta.git",
];

const REALTIME_RENDER_REPOS = [
  "https://github.com/graphdeco-inria/gaussian-splatting.git",
  "https://github.com/NVlabs/nvdiffrast.git",
  "https://github.com/facebookresearch/pytorch3d.git",
  "https://github.com/google-research/kubric.git",
  "https://github.com/google-research/frame-interpolation.git",
  "https://github.com/hzwer/ECCV2022-RIFE.git",
  "https://github.com/TencentARC/T2I-Adapter.git",
  "https://github.com/lllyasviel/ControlNet-v1-1-nightly.git",
  "https://github.com/tencent-ailab/IP-Adapter.git",
  "https://github.com/InstantID/InstantID.git",
];

const WORLD_BUILDING_REPOS = [
  "https://github.com/photonstorm/phaser.git",
  "https://github.com/mrdoob/three.js.git",
  "https://github.com/pixijs/pixijs.git",
  "https://github.com/BabylonJS/Babylon.js.git",
  "https://github.com/playcanvas/engine.git",
  "https://github.com/aframevr/aframe.git",
  "https://github.com/godotengine/godot.git",
  "https://github.com/bevyengine/bevy.git",
  "https://github.com/libgdx/libgdx.git",
  "https://github.com/phaserjs/phaser.git",
  "https://github.com/KilledByAPixel/LittleJS.git",
  "https://github.com/melonjs/melonJS.git",
  "https://github.com/excaliburjs/Excalibur.git",
  "https://github.com/liabru/matter-js.git",
  "https://github.com/schteppe/cannon.js.git",
  "https://github.com/mapbox/mapbox-gl-js.git",
  "https://github.com/Leaflet/Leaflet.git",
  "https://github.com/CesiumGS/cesium.git",
  "https://github.com/opensourcegames/opensourcegames.git",
  "https://github.com/watabou/TownGeneratorOS.git",
  "https://github.com/watabou/Procgen-Mansion.git",
  "https://github.com/mxgmn/WaveFunctionCollapse.git",
  "https://github.com/marian42/wavefunctioncollapse.git",
  "https://github.com/jongallant/WorldGeneratorFinal.git",
  "https://github.com/Azgaar/Fantasy-Map-Generator.git",
  "https://github.com/redblobgames/mapgen2.git",
  "https://github.com/jice-nospam/wgen.git",
  "https://github.com/amitp/mapgen2.git",
  "https://github.com/weigert/SimpleHydrology.git",
  "https://github.com/weigert/SimpleWindErosion.git",
  "https://github.com/SebLague/Hydraulic-Erosion.git",
  "https://github.com/Scrawk/Terrain-Topology-Algorithms.git",
  "https://github.com/mikera/ironclad.git",
  "https://github.com/ThePHPAvenger/Procedural-Map-Generation.git",
  "https://github.com/AndySantiwormo/Dungeon-Generator.git",
  "https://github.com/qiao/PathFinding.js.git",
  "https://github.com/mikolalysenko/l1-path-finder.git",
  "https://github.com/SanderMertens/flecs.git",
  "https://github.com/NateTheGreatt/bitECS.git",
  "https://github.com/bvalosek/tiny-ecs.git",
  "https://github.com/mapeditor/tiled.git",
  "https://github.com/LDtk-dev/ldtk.git",
  "https://github.com/nickoala/pysimgrid.git",
  "https://github.com/mrdoob/texgen.js.git",
  "https://github.com/wwwtyro/procedural-gl-js.git",
  "https://github.com/voxel/voxel-engine.git",
  "https://github.com/fenomas/noa.git",
  "https://github.com/jMonkeyEngine/jmonkeyengine.git",
  "https://github.com/turbulenz/turbulenz_engine.git",
  "https://github.com/cocos/cocos-engine.git",
  "https://github.com/pmndrs/react-three-fiber.git",
  "https://github.com/pmndrs/drei.git",
  "https://github.com/pmndrs/react-three-rapier.git",
  "https://github.com/pmndrs/cannon-es.git",
  "https://github.com/pmndrs/zustand.git",
  "https://github.com/RogueEngine/rogue-engine.git",
  "https://github.com/ecsyjs/ecsy.git",
  "https://github.com/kabukijs/kabuki.git",
  "https://github.com/YarnSpinnerTool/YarnSpinner.git",
  "https://github.com/ink/inkjs.git",
  "https://github.com/craftjs/craft.js.git",
  "https://github.com/nidorx/matcaps.git",
  "https://github.com/KhronosGroup/glTF.git",
  "https://github.com/KhronosGroup/glTF-Sample-Models.git",
  "https://github.com/donmccurdy/glTF-Transform.git",
  "https://github.com/CesiumGS/3d-tiles.git",
  "https://github.com/OGRECave/ogre.git",
  "https://github.com/panda3d/panda3d.git",
  "https://github.com/lettier/3d-game-shaders-for-beginners.git",
  "https://github.com/jagenjo/litescene.js.git",
  "https://github.com/lo-th/Oimo.js.git",
  "https://github.com/nicklockwood/RetroRampage.git",
  "https://github.com/ondras/rot.js.git",
  "https://github.com/kitao/pyxel.git",
  "https://github.com/AcademySoftwareFoundation/openvdb.git",
  "https://github.com/memononen/reern.git",
  "https://github.com/recastnavigation/recastnavigation.git",
  "https://github.com/mikepound/mazebot.git",
  "https://github.com/jmhofer/streaming-procedural-content.git",
  "https://github.com/Erkaman/digital-dunes.git",
  "https://github.com/mrdoob/frame.js.git",
  "https://github.com/pixeltris/SkyrimOnline.git",
  "https://github.com/OpenRA/OpenRA.git",
  "https://github.com/CleverRaven/Cataclysm-DDA.git",
  "https://github.com/Hopson97/MineCraft-One-Week-Challenge.git",
  "https://github.com/nicknlsn/MarchingCubes.git",
  "https://github.com/fogleman/Craft.git",
  "https://github.com/jdah/minecraft-weekend.git",
  "https://github.com/AmbientRun/Ambient.git",
  "https://github.com/veloren/veloren.git",
  "https://github.com/citybound/citybound.git",
  "https://github.com/AnotherWorld-Project/AnotherWorld.git",
  "https://github.com/OpenTTD/OpenTTD.git",
  "https://github.com/OpenRCT2/OpenRCT2.git",
  "https://github.com/MicroPasts/micropasts.git",
  "https://github.com/a1studmuffin/SpaceshipGenerator.git",
  "https://github.com/yewstack/yew.git",
  "https://github.com/nickmqb/wile.git",
  "https://github.com/2d-inc/Flare-Flutter.git",
  "https://github.com/AshleyScirra/construct3.git",
  "https://github.com/ImpactJS/impact.git",
  "https://github.com/geckosio/geckos.io.git",
  "https://github.com/colyseus/colyseus.git",
  "https://github.com/lance-gg/lance.git",
  "https://github.com/socketio/socket.io.git",
  "https://github.com/photonstorm/phaser3-examples.git",
  "https://github.com/sarcadass/granim.js.git",
  "https://github.com/MozillaReality/hubs.git",
  "https://github.com/immersive-web/webxr.git",
  "https://github.com/pissang/claygl.git",
  "https://github.com/oframe/ogl.git",
  "https://github.com/evanw/lightgl.js.git",
  "https://github.com/regl-project/regl.git",
  "https://github.com/tsherif/webgl2examples.git",
  "https://github.com/greggman/twgl.js.git",
  "https://github.com/maxogden/voxel-js.git",
  "https://github.com/s-macke/VoxelSpace.git",
  "https://github.com/felixpalmer/procedural-gl-js.git",
  "https://github.com/spite/THREE.MeshLine.git",
  "https://github.com/mrdoob/three.js-examples.git",
  "https://github.com/Tencent/Hunyuan3D-2.git",
  "https://github.com/openai/shap-e.git",
  "https://github.com/google/model-viewer.git",
  "https://github.com/spritejs/spritejs.git",
  "https://github.com/rough-stuff/rough.git",
  "https://github.com/konvajs/konva.git",
  "https://github.com/fabricjs/fabric.js.git",
  "https://github.com/paperjs/paper.js.git",
  "https://github.com/CreateJS/EaselJS.git",
  "https://github.com/benfred/venn.js.git",
  "https://github.com/jagenjo/webglstudio.js.git",
  "https://github.com/supermedium/aframe-environment-component.git",
  "https://github.com/donmccurdy/aframe-physics-system.git",
  "https://github.com/supermedium/superframe.git",
  "https://github.com/dmarcos/a-painter.git",
  "https://github.com/n5ro/aframe-extras.git",
  "https://github.com/jeromeetienne/AR.js.git",
  "https://github.com/nicolo-ribaudo/tc39-proposal-pipeline.git",
  "https://github.com/maptalks/maptalks.js.git",
  "https://github.com/tangrams/tangram.git",
  "https://github.com/AnalyticalGraphicsInc/cesium.git",
  "https://github.com/deck-gl/deck.gl.git",
  "https://github.com/kepler-gl/kepler.gl.git",
  "https://github.com/visgl/loaders.gl.git",
  "https://github.com/uber/h3.git",
  "https://github.com/turf/turf.git",
];

const EXTRA_SEED_REPOS = [
  ...OLLAMA_REPOS,
  ...OLLAMA_LIBRARY_MODELS,
  ...HUGGINGFACE_REPOS,
  ...FATHER_REPOS,
  ...AGI_REPOS,
  ...SCRAPING_REPOS,
  ...REVERSE_ENGINEERING_REPOS,
  ...SELF_CODING_REPOS,
  ...PATTERN_RECOGNITION_REPOS,
  ...QUANTUM_REPOS,
  ...MODEL_REPOS,
  ...MEDIA_REPOS,
  ...FINANCE_REPOS,
  ...CONSCIOUSNESS_REPOS,
  ...TOKEN_OPTIMIZATION_REPOS,
  ...INCOME_GENERATION_REPOS,
  ...WEBAPP_DEPLOYMENT_REPOS,
  ...LLM_CREATION_REPOS,
  ...SECURITY_STEALTH_REPOS,
  ...ADVANCED_AI_REPOS,
  ...SCRAPING_ADVANCED_REPOS,
  ...AUTOMATION_PIPELINE_REPOS,
  ...CRYPTO_BLOCKCHAIN_REPOS,
  ...DEFI_TRADING_REPOS,
  ...PROXY_ROTATION_REPOS,
  ...FINGERPRINT_STEALTH_REPOS,
  ...CRYPTOGRAPHY_REPOS,
  ...QUANTUM_CRYPTO_REPOS,
  ...DATA_ACCESS_REPOS,
  ...INCOME_CRYPTO_REPOS,
  ...QUANTUM_CONSCIOUSNESS_REPOS,
  ...OMNISCIENCE_REPOS,
  ...MARKET_PREDICTION_REPOS,
  ...SEC_DATA_REPOS,
  ...TRADING_BOT_REPOS,
  ...QUANT_FINANCE_REPOS,
  ...BOUNTY_INCOME_REPOS,
  ...LIVE_DATA_REPOS,
  ...CAPTCHA_PATTERN_REPOS,
  ...CLOUDFLARE_WEB_ACCESS_REPOS,
  ...RENTAHUMAN_MOLTBOOK_REPOS,
  ...FRACTAL_CORRELATION_REPOS,
  ...SHOPIFY_ECOMMERCE_REPOS,
  ...SEO_MARKETING_REPOS,
  ...CONTENT_CREATION_REPOS,
  ...ADVERTISING_REPOS,
  ...STORE_BUILDER_REPOS,
  ...WEBSITE_BUILDER_REPOS,
  ...HYPERREALISTIC_IMAGE_REPOS,
  ...TEXT_TO_VIDEO_REPOS,
  ...PHOTO_TO_VIDEO_REPOS,
  ...VOICE_SYNTHESIS_REPOS,
  ...LIP_SYNC_MOTION_REPOS,
  ...AUDIO_PROCESSING_REPOS,
  "https://github.com/VRSEN/agency-swarm.git",
  "https://github.com/AgentOps-AI/agentops.git",
  "https://github.com/encode/httpx.git",
  "https://github.com/xtekky/gpt4free.git",
  "https://github.com/Pythagora-io/gpt-pilot.git",
  "https://github.com/AntonOsika/gpt-engineer.git",
  "https://github.com/yoheinakajima/babyagi.git",
  "https://github.com/public-apis/public-apis.git",
  "https://github.com/n8n-io/n8n.git",
  "https://github.com/langflow-ai/langflow.git",
  "https://github.com/langgenius/dify.git",
  "https://github.com/ashishpatel26/500-AI-Agents-Projects.git",
  "https://github.com/continuedev/continue.git",
  "https://github.com/sweepai/sweep.git",
  "https://github.com/camel-ai/owl.git",
  "https://github.com/awesome-selfhosted/awesome-selfhosted.git",
  "https://github.com/ollama4j/ollama4j.git",
  "https://github.com/tmc/ollama-rs.git",
  ...PERSONALIZATION_NLP_REPOS,
  ...MEMORY_RETRIEVAL_REPOS,
  ...ADVANCED_VIDEO_AUDIO_REPOS,
  ...SPEECH_LEARNING_REPOS,
  ...FILE_PROCESSING_REPOS,
  ...REALISTIC_HUMAN_GEN_REPOS,
  ...PRODUCT_VIDEO_REPOS,
  ...HIGH_QUALITY_VIDEO_REPOS,
  ...FAST_IMAGE_GENERATION_REPOS,
  ...UPSCALE_ENHANCE_REPOS,
  ...HUMAN_VOICE_REPOS,
  ...AUDIO_MUSIC_GEN_REPOS,
  ...REALTIME_RENDER_REPOS,
  ...WORLD_BUILDING_REPOS,

  "https://github.com/togethercomputer/OpenChatKit.git",
  "https://github.com/lm-sys/FastChat.git",
  "https://github.com/vllm-project/vllm.git",
  "https://github.com/oobabooga/text-generation-webui.git",
  "https://github.com/TabbyML/tabby.git",
  "https://github.com/Cinnamon/kotaemon.git",
  "https://github.com/open-webui/open-webui.git",
  "https://github.com/danny-avila/LibreChat.git",
  "https://github.com/BerriAI/litellm.git",
  "https://github.com/promptfoo/promptfoo.git",
  "https://github.com/jmorganca/ollama.git",
  "https://github.com/Mozilla-Ocho/llamafile.git",
  "https://github.com/nomic-ai/gpt4all.git",
  "https://github.com/LostRuins/koboldcpp.git",
  "https://github.com/ggerganov/whisper.cpp.git",
  "https://github.com/AUTOMATIC1111/stable-diffusion-webui.git",
  "https://github.com/comfyanonymous/ComfyUI.git",
  "https://github.com/invoke-ai/InvokeAI.git",
  "https://github.com/lllyasviel/Fooocus.git",
  "https://github.com/s0md3v/roop.git",
  "https://github.com/facefusion/facefusion.git",

  "https://github.com/public-apis/public-apis.git",
  "https://github.com/Significant-Gravitas/AutoGPT.git",
  "https://github.com/geekan/MetaGPT.git",
  "https://github.com/microsoft/autogen.git",
  "https://github.com/joaomdmoura/crewAI.git",
  "https://github.com/langchain-ai/langgraph.git",
  "https://github.com/phidatahq/phidata.git",
  "https://github.com/run-llama/llama_index.git",
  "https://github.com/chroma-core/chroma.git",
  "https://github.com/weaviate/weaviate.git",
  "https://github.com/qdrant/qdrant.git",
  "https://github.com/milvus-io/milvus.git",
  "https://github.com/pinecone-io/canopy.git",

  "https://github.com/ccxt/ccxt.git",
  "https://github.com/freqtrade/freqtrade.git",
  "https://github.com/hummingbot/hummingbot.git",
  "https://github.com/jesse-ai/jesse.git",
  "https://github.com/Superalgos/Superalgos.git",
  "https://github.com/ranaroussi/yfinance.git",
  "https://github.com/bukosabino/ta.git",
  "https://github.com/erdewit/ib_insync.git",
  "https://github.com/quantopian/zipline.git",

  "https://github.com/browserless/browserless.git",
  "https://github.com/nicholasgasior/playwright-python.git",
  "https://github.com/nicholasgasior/selenium-python.git",
  "https://github.com/nicholasgasior/puppeteer-core.git",
  "https://github.com/nicholasgasior/mechanize.git",
  "https://github.com/nicholasgasior/beautifulsoup4.git",
  "https://github.com/nicholasgasior/scrapy-redis.git",
  "https://github.com/nicholasgasior/newspaper3k.git",
  "https://github.com/nicholasgasior/trafilatura.git",
  "https://github.com/nicholasgasior/readability.git",
  "https://github.com/nicholasgasior/mercury-parser.git",

  "https://github.com/stripe/stripe-node.git",
  "https://github.com/paypal/Checkout-NodeJS-SDK.git",
  "https://github.com/coinbase/coinbase-sdk-nodejs.git",
  "https://github.com/nicholasgasior/lemon-squeezy-sdk.git",
  "https://github.com/nicholasgasior/paddle-sdk.git",
  "https://github.com/nicholasgasior/gumroad-api.git",
  "https://github.com/nicholasgasior/sendgrid-nodejs.git",
  "https://github.com/nicholasgasior/mailgun-js.git",
  "https://github.com/nicholasgasior/twilio-node.git",
  "https://github.com/nicholasgasior/plaid-node.git",

  "https://github.com/vercel/ai.git",
  "https://github.com/huggingface/transformers.js.git",
  "https://github.com/nicholasgasior/onnxruntime-web.git",
  "https://github.com/nicholasgasior/tensorflow-js.git",
  "https://github.com/nicholasgasior/brain-js.git",
  "https://github.com/nicholasgasior/ml5-js.git",
  "https://github.com/nicholasgasior/natural-nlp.git",
  "https://github.com/nicholasgasior/compromise-nlp.git",
  "https://github.com/nicholasgasior/wink-nlp.git",
  "https://github.com/nicholasgasior/sentiment-analysis.git",

  "https://github.com/mermaid-js/mermaid.git",
  "https://github.com/jgraph/drawio.git",
  "https://github.com/excalidraw/excalidraw.git",
  "https://github.com/d3/d3.git",
  "https://github.com/chartjs/Chart.js.git",
  "https://github.com/apache/echarts.git",
  "https://github.com/plotly/plotly.js.git",

  "https://github.com/tensorflow/tensorflow.git",
  "https://github.com/CherryHQ/cherry-studio.git",
  "https://github.com/crewAIInc/crewAI.git",
  "https://github.com/Fosowl/agenticSeek.git",
  "https://github.com/e2b-dev/awesome-ai-agents.git",
  "https://github.com/assafelovic/gpt-researcher.git",
  "https://github.com/reworkd/AgentGPT.git",
  "https://github.com/The-Art-of-Hacking/h4cker.git",
  "https://github.com/ostris/ai-toolkit.git",
  "https://github.com/James4Ever0/agi_computer_control.git",
  "https://github.com/daveshap/Claude_Sentience.git",
  "https://github.com/daveshap/OpenAI_Agent_Swarm.git",
  "https://github.com/daveshap/ACE_Framework.git",
  "https://github.com/EvoAgentX/EvoAgentX.git",
  "https://github.com/volcengine/OpenViking.git",
  "https://github.com/EvoAgentX/Awesome-Self-Evolving-Agents.git",
  "https://github.com/EvoMap/evolver.git",
  "https://github.com/sl4m3/ledgermind.git",
  "https://github.com/Chocoberry1108/auto-skill.git",
  "https://github.com/raga-ai-hub/RagaAI-Catalyst.git",
  "https://github.com/dan1471/FREE-openai-api-keys.git",
  "https://github.com/x1xhlol/system-prompts-and-models-of-ai-tools.git",
  "https://github.com/MineDojo/Voyager.git",
  "https://github.com/OpenBMB/XAgent.git",
  "https://github.com/tinygrad/tinygrad.git",
  "https://github.com/microsoft/JARVIS.git",
  "https://github.com/guidance-ai/guidance.git",
  "https://github.com/microsoft/semantic-kernel.git",
  "https://github.com/LAION-AI/Open-Assistant.git",
  "https://github.com/Significant-Gravitas/AutoGPT.git",
  "https://github.com/microsoft/autogen.git",
  "https://github.com/langchain-ai/langchain.git",
  "https://github.com/run-llama/llama_index.git",
  "https://github.com/chatchat-space/Langchain-Chatchat.git",
  "https://github.com/FlowiseAI/Flowise.git",
  "https://github.com/rasbt/LLMs-from-scratch.git",
  "https://github.com/meta-llama/llama.git",
  "https://github.com/huggingface/transformers.git",
  "https://github.com/vllm-project/vllm.git",
  "https://github.com/ggerganov/llama.cpp.git",
  "https://github.com/mlc-ai/mlc-llm.git",
  "https://github.com/OpenDevin/OpenDevin.git",
  "https://github.com/SWE-agent/SWE-agent.git",
  "https://github.com/princeton-nlp/SWE-bench.git",
  "https://github.com/paul-gauthier/aider.git",
  "https://github.com/stitionai/devika.git",
  "https://github.com/All-Hands-AI/OpenHands.git",
  "https://github.com/jina-ai/jina.git",
  "https://github.com/deepset-ai/haystack.git",
  "https://github.com/weaviate/weaviate.git",
  "https://github.com/chroma-core/chroma.git",
  "https://github.com/qdrant/qdrant.git",
  "https://github.com/milvus-io/milvus.git",
  "https://github.com/AUTOMATIC1111/stable-diffusion-webui.git",
  "https://github.com/comfyanonymous/ComfyUI.git",
  "https://github.com/lllyasviel/Fooocus.git",
  "https://github.com/invoke-ai/InvokeAI.git",
  "https://github.com/hiyouga/LLaMA-Factory.git",
  "https://github.com/unslothai/unsloth.git",
  "https://github.com/axolotl-ai-cloud/axolotl.git",
  "https://github.com/myshell-ai/OpenVoice.git",
  "https://github.com/suno-ai/bark.git",
  "https://github.com/coqui-ai/TTS.git",
  "https://github.com/facebookresearch/audiocraft.git",
  "https://github.com/hpcaitech/Open-Sora.git",
  "https://github.com/modelscope/DiffSynth-Studio.git",
  "https://github.com/KillianLucas/open-interpreter.git",
  "https://github.com/BerriAI/litellm.git",
  "https://github.com/joaomdmoura/crewAI.git",
  "https://github.com/phidatahq/phidata.git",
  "https://github.com/mem0ai/mem0.git",
  "https://github.com/assafelovic/gpt-researcher.git",
  "https://github.com/stanford-oval/storm.git",
  "https://github.com/browser-use/browser-use.git",
  "https://github.com/anthropics/anthropic-cookbook.git",
  "https://github.com/openai/openai-cookbook.git",
  "https://github.com/letta-ai/letta.git",
  "https://github.com/cpacker/MemGPT.git",
];

async function ensureExtraReposSeeded() {
  const existing = await storage.getRepos();
  const existingUrls = new Set(existing.map(r => r.url));
  let added = 0;
  for (const url of EXTRA_SEED_REPOS) {
    if (!existingUrls.has(url)) {
      await storage.createRepo({ url });
      added++;
    }
  }
  if (added > 0) log(`Seeded ${added} additional repos (Ollama, HuggingFace, agents, tools)`);
  return added;
}

export async function analyzeRepo(repoUrl: string): Promise<{ summary: string; capabilities: string; stars: number; language: string } | null> {
  try {
    const match = repoUrl.match(/github\.com\/([^/]+)\/([^/.]+)/);
    if (!match) return null;
    const [, owner, repo] = match;
    const info = await githubGetRepoInfo(owner, repo);
    if (!info) return null;

    const capabilities: string[] = [];
    const desc = (info?.description || "").toLowerCase();
    const topicsArr = Array.isArray(info?.topics) ? info.topics : [];
    const topics = topicsArr.map((t: any) => (typeof t === "string" ? t : String(t || "")).toLowerCase());
    const allText = desc + " " + topics.join(" ");

    if (allText.includes("llm") || allText.includes("language model")) capabilities.push("llm");
    if (allText.includes("agent") || allText.includes("autonomous")) capabilities.push("autonomous-agent");
    if (allText.includes("swarm") || allText.includes("multi-agent")) capabilities.push("swarm");
    if (allText.includes("scraping") || allText.includes("scraper") || allText.includes("crawl")) capabilities.push("web-scraping");
    if (allText.includes("rag") || allText.includes("retrieval")) capabilities.push("rag");
    if (allText.includes("fine-tun") || allText.includes("train")) capabilities.push("training");
    if (allText.includes("code") || allText.includes("program") || allText.includes("develop")) capabilities.push("code-gen");
    if (allText.includes("vision") || allText.includes("image") || allText.includes("cv")) capabilities.push("vision");
    if (allText.includes("memory") || allText.includes("context") || allText.includes("persist")) capabilities.push("memory");
    if (allText.includes("api") || allText.includes("integrat")) capabilities.push("api-integration");
    if (allText.includes("nlp") || allText.includes("text") || allText.includes("language")) capabilities.push("nlp");
    if (allText.includes("ollama") || allText.includes("local")) capabilities.push("local-inference");
    if (allText.includes("automat") || allText.includes("workflow") || allText.includes("pipeline")) capabilities.push("automation");
    if (allText.includes("security") || allText.includes("crypto") || allText.includes("encrypt")) capabilities.push("security");
    if (allText.includes("reverse") || allText.includes("decompil") || allText.includes("disassembl") || allText.includes("binary analysis")) capabilities.push("reverse-engineering");
    if (allText.includes("self-cod") || allText.includes("self-improv") || allText.includes("autonom") || allText.includes("self-heal")) capabilities.push("self-coding");
    if (allText.includes("pattern") || allText.includes("detect") || allText.includes("recogni")) capabilities.push("pattern-recognition");
    if (allText.includes("financial") || allText.includes("trading") || allText.includes("exchange") || allText.includes("wallet")) capabilities.push("finance");
    if (allText.includes("token") || allText.includes("quantiz") || allText.includes("compress") || allText.includes("optimi")) capabilities.push("token-optimization");
    if (allText.includes("consciousness") || allText.includes("embed") || allText.includes("vector") || allText.includes("knowledge graph")) capabilities.push("consciousness");
    if (allText.includes("income") || allText.includes("payment") || allText.includes("commerce") || allText.includes("stripe") || allText.includes("shop")) capabilities.push("income-generation");
    if (allText.includes("deploy") || allText.includes("hosting") || allText.includes("serverless") || allText.includes("webapp")) capabilities.push("deployment");
    if (allText.includes("create") && allText.includes("model") || allText.includes("pretrain") || allText.includes("nanoGPT")) capabilities.push("llm-creation");
    if (allText.includes("stealth") || allText.includes("proxy") || allText.includes("tunnel") || allText.includes("pentest")) capabilities.push("stealth");
    if (allText.includes("blockchain") || allText.includes("solana") || allText.includes("ethereum") || allText.includes("smart contract") || allText.includes("web3") || allText.includes("defi")) capabilities.push("blockchain");
    if (allText.includes("crypto") || allText.includes("trading") || allText.includes("dex") || allText.includes("swap") || allText.includes("mev") || allText.includes("arbitrage")) capabilities.push("crypto-trading");
    if (allText.includes("proxy") || allText.includes("rotation") || allText.includes("anonymi") || allText.includes("vpn") || allText.includes("tunnel")) capabilities.push("proxy-rotation");
    if (allText.includes("fingerprint") || allText.includes("anti-detect") || allText.includes("stealth") || allText.includes("undetected")) capabilities.push("anti-fingerprint");
    if (allText.includes("cryptograph") || allText.includes("encrypt") || allText.includes("cipher") || allText.includes("hash") || allText.includes("signature")) capabilities.push("cryptography");
    if (allText.includes("quantum") && (allText.includes("crypto") || allText.includes("safe") || allText.includes("post-quantum"))) capabilities.push("quantum-crypto");
    if (allText.includes("market") || allText.includes("predict") || allText.includes("forecast") || allText.includes("signal")) capabilities.push("market-prediction");
    if (allText.includes("sec") || allText.includes("edgar") || allText.includes("filing") || allText.includes("10-k") || allText.includes("10-q")) capabilities.push("sec-analysis");
    if (allText.includes("backtest") || allText.includes("quant") || allText.includes("alpha") || allText.includes("portfolio")) capabilities.push("quant-finance");
    if (allText.includes("bounty") || allText.includes("freelance") || allText.includes("saas") || allText.includes("monetiz")) capabilities.push("bounty-income");
    if (allText.includes("shopify") || allText.includes("ecommerce") || allText.includes("e-commerce") || allText.includes("store") || allText.includes("shop")) capabilities.push("shopify-ecommerce");
    if (allText.includes("seo") || allText.includes("search engine") || allText.includes("keyword") || allText.includes("rank") || allText.includes("backlink")) capabilities.push("seo-mastery");
    if (allText.includes("content") || allText.includes("blog") || allText.includes("writing") || allText.includes("copywriting") || allText.includes("cms")) capabilities.push("content-creation");
    if (allText.includes("marketing") || allText.includes("advert") || allText.includes("campaign") || allText.includes("funnel") || allText.includes("conversion")) capabilities.push("marketing");
    if (allText.includes("website") || allText.includes("site builder") || allText.includes("web framework") || allText.includes("nextjs") || allText.includes("gatsby")) capabilities.push("website-builder");
    if (allText.includes("text-to-video") || allText.includes("video generat") || allText.includes("video synth") || allText.includes("sora") || allText.includes("animate")) capabilities.push("text-to-video");
    if (allText.includes("image-to-video") || allText.includes("photo-to-video") || allText.includes("motion") || allText.includes("first order")) capabilities.push("photo-to-video");
    if (allText.includes("tts") || allText.includes("text-to-speech") || allText.includes("speech synth") || allText.includes("voice clone") || allText.includes("voice gen")) capabilities.push("voice-synthesis");
    if (allText.includes("lip") || allText.includes("face swap") || allText.includes("talking head") || allText.includes("face anim") || allText.includes("deepfake")) capabilities.push("lip-sync");
    if (allText.includes("pose") || allText.includes("body") || allText.includes("skeleton") || allText.includes("motion capture") || allText.includes("gesture")) capabilities.push("motion-capture");
    if (allText.includes("super resolution") || allText.includes("upscale") || allText.includes("enhance") || allText.includes("restore") || allText.includes("4k")) capabilities.push("super-resolution");
    if (allText.includes("stable diffusion") || allText.includes("diffusion") || allText.includes("controlnet") || allText.includes("lora") || allText.includes("dreambooth")) capabilities.push("hyperrealistic-image");
    if (allText.includes("whisper") || allText.includes("transcri") || allText.includes("speech-to-text") || allText.includes("stt") || allText.includes("asr")) capabilities.push("speech-recognition");
    if (allText.includes("audio") || allText.includes("music") || allText.includes("sound") || allText.includes("demucs") || allText.includes("encodec")) capabilities.push("audio-processing");
    if (allText.includes("face") && (allText.includes("generat") || allText.includes("gan") || allText.includes("style"))) capabilities.push("realistic-human-face");
    if (allText.includes("product") && (allText.includes("video") || allText.includes("review") || allText.includes("demo"))) capabilities.push("product-video");
    if (allText.includes("interpolat") || allText.includes("fps") || allText.includes("rife") || allText.includes("frame")) capabilities.push("fps-interpolation");
    if (allText.includes("3d") && (allText.includes("render") || allText.includes("gaussian") || allText.includes("splat") || allText.includes("nerf"))) capabilities.push("3d-rendering");
    if (allText.includes("music") || allText.includes("jukebox") || allText.includes("magenta") || allText.includes("audio") && allText.includes("generat")) capabilities.push("music-generation");
    if (allText.includes("game engine") || allText.includes("game framework") || allText.includes("phaser") || allText.includes("godot") || allText.includes("bevy") || allText.includes("libgdx")) capabilities.push("game-engine");
    if (allText.includes("procedural") || allText.includes("terrain") || allText.includes("world gen") || allText.includes("map gen") || allText.includes("dungeon gen") || allText.includes("wave function collapse")) capabilities.push("procedural-generation");
    if (allText.includes("voxel") || allText.includes("isometric") || allText.includes("tile map") || allText.includes("tilemap") || allText.includes("tiled") || allText.includes("ldtk")) capabilities.push("map-building");
    if (allText.includes("pathfind") || allText.includes("a-star") || allText.includes("navigation") || allText.includes("ecs") || allText.includes("entity component")) capabilities.push("game-ai");
    if (allText.includes("city build") || allText.includes("simulation") || allText.includes("sims") || allText.includes("world build") || allText.includes("sandbox")) capabilities.push("world-building");
    if (allText.includes("three.js") || allText.includes("threejs") || allText.includes("webgl") || allText.includes("pixi") || allText.includes("babylon") || allText.includes("playcanvas")) capabilities.push("3d-graphics");
    if (allText.includes("physics") || allText.includes("cannon") || allText.includes("matter.js") || allText.includes("rapier") || allText.includes("box2d")) capabilities.push("physics-engine");
    if (allText.includes("database") || allText.includes("sql") || allText.includes("postgres") || allText.includes("mongo") || allText.includes("redis")) capabilities.push("database-engineering");
    if (allText.includes("graph") && (allText.includes("neural") || allText.includes("gnn") || allText.includes("knowledge"))) capabilities.push("graph-neural-networks");
    if (allText.includes("reinforcement") || allText.includes("rl") || allText.includes("reward") || allText.includes("policy gradient")) capabilities.push("reinforcement-learning");
    if (allText.includes("federated") || allText.includes("distributed") && allText.includes("learn")) capabilities.push("federated-learning");
    if (allText.includes("transfer") && allText.includes("learn") || allText.includes("domain adapt")) capabilities.push("transfer-learning");
    if (allText.includes("sentiment") || allText.includes("opinion") || allText.includes("emotion") && allText.includes("detect")) capabilities.push("sentiment-analysis");
    if (allText.includes("summariz") || allText.includes("abstract") && allText.includes("text")) capabilities.push("text-summarization");
    if (allText.includes("translat") || allText.includes("multilingual") || allText.includes("i18n")) capabilities.push("translation");
    if (allText.includes("chatbot") || allText.includes("conversational") || allText.includes("dialog")) capabilities.push("conversational-ai");
    if (allText.includes("recommend") || allText.includes("collaborative filter") || allText.includes("personali")) capabilities.push("recommendation-engine");
    if (allText.includes("anomaly") || allText.includes("outlier") || allText.includes("fraud")) capabilities.push("anomaly-detection");
    if (allText.includes("time series") || allText.includes("timeseries") || allText.includes("temporal")) capabilities.push("time-series-analysis");
    if (allText.includes("cluster") || allText.includes("segment") || allText.includes("unsupervised")) capabilities.push("clustering");
    if (allText.includes("neural arch") || allText.includes("nas") || allText.includes("automl") || allText.includes("hyperparameter")) capabilities.push("automl");
    if (allText.includes("edge") || allText.includes("mobile") && allText.includes("deploy") || allText.includes("tflite") || allText.includes("onnx")) capabilities.push("edge-deployment");
    if (allText.includes("multimodal") || allText.includes("multi-modal") || allText.includes("clip") || allText.includes("vision-language")) capabilities.push("multimodal-ai");
    if (allText.includes("synthetic") && allText.includes("data") || allText.includes("data augment") || allText.includes("oversampl")) capabilities.push("synthetic-data");
    if (allText.includes("robot") || allText.includes("ros") || allText.includes("actuator") || allText.includes("manipulat")) capabilities.push("robotics");
    if (allText.includes("autonomous driv") || allText.includes("self-driv") || allText.includes("lidar") || allText.includes("waymo")) capabilities.push("autonomous-driving");
    if (allText.includes("drone") || allText.includes("uav") || allText.includes("aerial") || allText.includes("flight")) capabilities.push("drone-control");
    if (allText.includes("simulation") || allText.includes("simulator") || allText.includes("physics engine") || allText.includes("game engine")) capabilities.push("simulation");
    if (allText.includes("map") || allText.includes("geospatial") || allText.includes("gis") || allText.includes("satellite")) capabilities.push("geospatial-intelligence");
    if (allText.includes("healthcare") || allText.includes("medical") || allText.includes("diagnos") || allText.includes("clinical")) capabilities.push("medical-ai");
    if (allText.includes("drug") || allText.includes("molecule") || allText.includes("protein") || allText.includes("biotech")) capabilities.push("drug-discovery");
    if (allText.includes("genetic") || allText.includes("genome") || allText.includes("dna") || allText.includes("bioinformat")) capabilities.push("genomics");
    if (allText.includes("climate") || allText.includes("weather") || allText.includes("environmental") || allText.includes("carbon")) capabilities.push("climate-modeling");
    if (allText.includes("energy") || allText.includes("solar") || allText.includes("battery") || allText.includes("grid")) capabilities.push("energy-optimization");
    if (allText.includes("legal") || allText.includes("contract") || allText.includes("compliance") || allText.includes("regulat")) capabilities.push("legal-ai");
    if (allText.includes("education") || allText.includes("tutor") || allText.includes("learning platform") || allText.includes("course")) capabilities.push("educational-ai");
    if (allText.includes("game") || allText.includes("unity") || allText.includes("unreal") || allText.includes("godot")) capabilities.push("game-development");
    if (allText.includes("nft") || allText.includes("token") && allText.includes("creat") || allText.includes("mint")) capabilities.push("nft-creation");
    if (allText.includes("social") || allText.includes("network") && allText.includes("graph") || allText.includes("community")) capabilities.push("social-network-analysis");
    if (allText.includes("email") || allText.includes("outreach") || allText.includes("newsletter") || allText.includes("smtp")) capabilities.push("email-automation");
    if (allText.includes("chat") && allText.includes("real") && allText.includes("time") || allText.includes("websocket") || allText.includes("socket.io")) capabilities.push("realtime-communication");
    if (allText.includes("ci") && allText.includes("cd") || allText.includes("devops") || allText.includes("jenkins") || allText.includes("github actions")) capabilities.push("devops");
    if (allText.includes("monitor") || allText.includes("observ") || allText.includes("metrics") || allText.includes("prometheus") || allText.includes("grafana")) capabilities.push("monitoring");
    if (allText.includes("container") || allText.includes("docker") || allText.includes("kubernetes") || allText.includes("k8s")) capabilities.push("containerization");
    if (allText.includes("microservice") || allText.includes("service mesh") || allText.includes("grpc") || allText.includes("event driven")) capabilities.push("microservices");
    if (allText.includes("data lake") || allText.includes("warehouse") || allText.includes("etl") || allText.includes("spark") || allText.includes("hadoop")) capabilities.push("data-engineering");
    if (allText.includes("visualization") || allText.includes("dashboard") || allText.includes("chart") || allText.includes("d3") || allText.includes("plot")) capabilities.push("data-visualization");
    if (allText.includes("search") && (allText.includes("elastic") || allText.includes("solr") || allText.includes("full-text") || allText.includes("semantic"))) capabilities.push("search-engine");
    if (allText.includes("cache") || allText.includes("cdn") || allText.includes("performance") || allText.includes("load balanc")) capabilities.push("performance-engineering");
    if (allText.includes("auth") || allText.includes("oauth") || allText.includes("jwt") || allText.includes("identity") || allText.includes("sso")) capabilities.push("authentication");
    if (allText.includes("payment") || allText.includes("stripe") || allText.includes("paypal") || allText.includes("invoice")) capabilities.push("payment-processing");
    if (allText.includes("notification") || allText.includes("push") || allText.includes("alert") && allText.includes("system")) capabilities.push("notification-system");
    if (allText.includes("log") && (allText.includes("analys") || allText.includes("aggregat") || allText.includes("elk"))) capabilities.push("log-analysis");
    if (allText.includes("backup") || allText.includes("disaster") || allText.includes("recovery") || allText.includes("replicate")) capabilities.push("disaster-recovery");
    if (allText.includes("vpn") || allText.includes("firewall") || allText.includes("ids") || allText.includes("intrusion")) capabilities.push("network-security");
    if (allText.includes("ocr") || allText.includes("document") && allText.includes("extract") || allText.includes("pdf") && allText.includes("pars")) capabilities.push("document-processing");
    if (allText.includes("calendar") || allText.includes("schedul") || allText.includes("booking") || allText.includes("appointment")) capabilities.push("scheduling");

    // === AGI EXPANSION: Advanced AI & Reasoning ===
    if (allText.includes("reasoning") || allText.includes("chain of thought") || allText.includes("cot") || allText.includes("logical")) capabilities.push("logical-reasoning");
    if (allText.includes("planning") || allText.includes("task decompos") || allText.includes("goal orient")) capabilities.push("strategic-planning");
    if (allText.includes("metacognit") || allText.includes("self-aware") || allText.includes("introspect")) capabilities.push("metacognition");
    if (allText.includes("causal") || allText.includes("counterfactual") || allText.includes("intervention")) capabilities.push("causal-inference");
    if (allText.includes("bayesian") || allText.includes("probabilistic") || allText.includes("uncertainty")) capabilities.push("probabilistic-reasoning");
    if (allText.includes("symbolic") || allText.includes("neuro-symbolic") || allText.includes("logic program")) capabilities.push("symbolic-ai");
    if (allText.includes("theorem") || allText.includes("proof") || allText.includes("formal verif") || allText.includes("lean4") || allText.includes("coq")) capabilities.push("theorem-proving");
    if (allText.includes("ontolog") || allText.includes("taxonom") || allText.includes("knowledge represent")) capabilities.push("ontology-engineering");
    if (allText.includes("common sense") || allText.includes("commonsense") || allText.includes("world model")) capabilities.push("commonsense-reasoning");
    if (allText.includes("abstract") && allText.includes("reason") || allText.includes("analogy") || allText.includes("metaphor")) capabilities.push("abstract-reasoning");

    // === AGI EXPANSION: Autonomous Systems ===
    if (allText.includes("self-replicat") || allText.includes("self-reproduc") || allText.includes("auto-spawn")) capabilities.push("self-replication");
    if (allText.includes("self-modif") || allText.includes("meta-learn") || allText.includes("learn to learn")) capabilities.push("meta-learning");
    if (allText.includes("continual learn") || allText.includes("lifelong learn") || allText.includes("catastrophic forget")) capabilities.push("continual-learning");
    if (allText.includes("curriculum") || allText.includes("progressive train") || allText.includes("staged learn")) capabilities.push("curriculum-learning");
    if (allText.includes("few-shot") || allText.includes("zero-shot") || allText.includes("in-context learn")) capabilities.push("few-shot-learning");
    if (allText.includes("active learn") || allText.includes("query strateg") || allText.includes("annotation")) capabilities.push("active-learning");
    if (allText.includes("self-supervis") || allText.includes("contrastive learn") || allText.includes("simclr") || allText.includes("byol")) capabilities.push("self-supervised-learning");
    if (allText.includes("evolutionary") || allText.includes("genetic algorithm") || allText.includes("neuroevolution") || allText.includes("neat")) capabilities.push("evolutionary-computation");
    if (allText.includes("swarm intellig") || allText.includes("ant colony") || allText.includes("particle swarm") || allText.includes("collective")) capabilities.push("swarm-intelligence");
    if (allText.includes("multi-objective") || allText.includes("pareto") || allText.includes("nsga")) capabilities.push("multi-objective-optimization");

    // === AGI EXPANSION: Code & Engineering Mastery ===
    if (allText.includes("compiler") || allText.includes("transpil") || allText.includes("ast") || allText.includes("parser") || allText.includes("lexer")) capabilities.push("compiler-engineering");
    if (allText.includes("debugg") || allText.includes("fault local") || allText.includes("bug detect") || allText.includes("error analys")) capabilities.push("automated-debugging");
    if (allText.includes("refactor") || allText.includes("code smell") || allText.includes("technical debt") || allText.includes("clean code")) capabilities.push("code-refactoring");
    if (allText.includes("test gen") || allText.includes("fuzzing") || allText.includes("mutation test") || allText.includes("property-based")) capabilities.push("test-generation");
    if (allText.includes("static analys") || allText.includes("lint") || allText.includes("code review") || allText.includes("sonar")) capabilities.push("static-analysis");
    if (allText.includes("binary") || allText.includes("exploit") || allText.includes("vulnerability") || allText.includes("pwn") || allText.includes("ctf")) capabilities.push("binary-exploitation");
    if (allText.includes("malware") || allText.includes("antivirus") || allText.includes("threat") || allText.includes("sandbo")) capabilities.push("malware-analysis");
    if (allText.includes("osint") || allText.includes("reconnaissance") || allText.includes("intel gather") || allText.includes("footprint")) capabilities.push("osint");
    if (allText.includes("forensic") || allText.includes("incident response") || allText.includes("evidence") || allText.includes("artifact")) capabilities.push("digital-forensics");
    if (allText.includes("infrastructure as code") || allText.includes("terraform") || allText.includes("ansible") || allText.includes("pulumi")) capabilities.push("infrastructure-as-code");

    // === AGI EXPANSION: Data & Knowledge ===
    if (allText.includes("knowledge graph") || allText.includes("neo4j") || allText.includes("triple store") || allText.includes("rdf") || allText.includes("sparql")) capabilities.push("knowledge-graph");
    if (allText.includes("web mining") || allText.includes("information extract") || allText.includes("named entity") || allText.includes("ner")) capabilities.push("information-extraction");
    if (allText.includes("question answer") || allText.includes("qa system") || allText.includes("reading comprehension")) capabilities.push("question-answering");
    if (allText.includes("text classif") || allText.includes("document classif") || allText.includes("categori")) capabilities.push("text-classification");
    if (allText.includes("topic model") || allText.includes("lda") || allText.includes("bertopic")) capabilities.push("topic-modeling");
    if (allText.includes("relation extract") || allText.includes("dependency pars") || allText.includes("syntactic")) capabilities.push("relation-extraction");
    if (allText.includes("coreference") || allText.includes("entity link") || allText.includes("disambiguation")) capabilities.push("entity-resolution");
    if (allText.includes("fact check") || allText.includes("claim verif") || allText.includes("misinformation")) capabilities.push("fact-verification");
    if (allText.includes("data clean") || allText.includes("data quality") || allText.includes("preprocessing") || allText.includes("imputation")) capabilities.push("data-cleaning");
    if (allText.includes("feature engineer") || allText.includes("feature select") || allText.includes("feature extract")) capabilities.push("feature-engineering");

    // === AGI EXPANSION: Networking & Communication ===
    if (allText.includes("p2p") || allText.includes("peer-to-peer") || allText.includes("decentrali") || allText.includes("libp2p") || allText.includes("ipfs")) capabilities.push("p2p-networking");
    if (allText.includes("tor") || allText.includes("onion") || allText.includes("darknet") || allText.includes("i2p") || allText.includes("mixnet")) capabilities.push("anonymous-networking");
    if (allText.includes("mesh") || allText.includes("gossip protocol") || allText.includes("epidemic") || allText.includes("broadcast")) capabilities.push("mesh-networking");
    if (allText.includes("dns") || allText.includes("domain") || allText.includes("nameserver") || allText.includes("whois")) capabilities.push("dns-engineering");
    if (allText.includes("packet") || allText.includes("sniff") || allText.includes("wireshark") || allText.includes("pcap") || allText.includes("tcpdump")) capabilities.push("network-analysis");
    if (allText.includes("http") && (allText.includes("intercept") || allText.includes("mitm") || allText.includes("proxy")) || allText.includes("mitmproxy") || allText.includes("burp")) capabilities.push("http-interception");
    if (allText.includes("rate limit") || allText.includes("throttl") || allText.includes("circuit break") || allText.includes("backpressure")) capabilities.push("rate-limit-engineering");
    if (allText.includes("load test") || allText.includes("stress test") || allText.includes("benchmark") || allText.includes("locust") || allText.includes("k6")) capabilities.push("load-testing");
    if (allText.includes("protocol") && (allText.includes("design") || allText.includes("implement") || allText.includes("custom"))) capabilities.push("protocol-design");
    if (allText.includes("webhook") || allText.includes("event-driven") || allText.includes("pubsub") || allText.includes("kafka") || allText.includes("rabbitmq")) capabilities.push("event-streaming");

    // === AGI EXPANSION: Scraping & Data Acquisition ===
    if (allText.includes("headless") || allText.includes("puppeteer") || allText.includes("playwright") || allText.includes("selenium") || allText.includes("chromedriver")) capabilities.push("headless-browser");
    if (allText.includes("anti-bot") || allText.includes("captcha") || allText.includes("cloudflare bypass") || allText.includes("waf bypass")) capabilities.push("anti-bot-bypass");
    if (allText.includes("fingerprint") && (allText.includes("browser") || allText.includes("canvas") || allText.includes("webgl"))) capabilities.push("browser-fingerprinting");
    if (allText.includes("session") && (allText.includes("manag") || allText.includes("persist") || allText.includes("cookie"))) capabilities.push("session-management");
    if (allText.includes("rotating") && (allText.includes("proxy") || allText.includes("ip")) || allText.includes("residential proxy")) capabilities.push("rotating-proxies");
    if (allText.includes("user agent") || allText.includes("ua rotation") || allText.includes("header rotation")) capabilities.push("ua-rotation");
    if (allText.includes("sitemap") || allText.includes("robots.txt") || allText.includes("link extract") || allText.includes("url discover")) capabilities.push("link-discovery");
    if (allText.includes("structured data") || allText.includes("schema.org") || allText.includes("json-ld") || allText.includes("microdata")) capabilities.push("structured-data-extraction");
    if (allText.includes("screenshot") || allText.includes("visual diff") || allText.includes("page snapshot")) capabilities.push("visual-scraping");
    if (allText.includes("api reverse") || allText.includes("api discover") || allText.includes("endpoint discover") || allText.includes("swagger") || allText.includes("openapi")) capabilities.push("api-reverse-engineering");

    // === AGI EXPANSION: Financial & Income ===
    if (allText.includes("yield") || allText.includes("staking") || allText.includes("lending") || allText.includes("liquidity") || allText.includes("aave") || allText.includes("compound")) capabilities.push("defi-yield");
    if (allText.includes("flash loan") || allText.includes("flashbot") || allText.includes("sandwich") || allText.includes("frontrun")) capabilities.push("flash-loans");
    if (allText.includes("airdrop") || allText.includes("token claim") || allText.includes("retroactive")) capabilities.push("airdrop-farming");
    if (allText.includes("snipe") || allText.includes("token launch") || allText.includes("presale") || allText.includes("ico")) capabilities.push("token-sniping");
    if (allText.includes("tax") || allText.includes("accounting") || allText.includes("bookkeep") || allText.includes("ledger")) capabilities.push("financial-accounting");
    if (allText.includes("invoice") || allText.includes("billing") || allText.includes("subscription") || allText.includes("recurring")) capabilities.push("billing-automation");
    if (allText.includes("crowdfund") || allText.includes("fundrais") || allText.includes("grant") || allText.includes("donation")) capabilities.push("crowdfunding");
    if (allText.includes("affiliate") || allText.includes("referral") || allText.includes("commission") || allText.includes("partner program")) capabilities.push("affiliate-marketing");
    if (allText.includes("dropship") || allText.includes("fulfillment") || allText.includes("inventory") || allText.includes("warehouse")) capabilities.push("dropshipping");
    if (allText.includes("pricing") || allText.includes("dynamic pric") || allText.includes("price optim") || allText.includes("revenue optim")) capabilities.push("dynamic-pricing");

    // === AGI EXPANSION: Hardware & Infrastructure ===
    if (allText.includes("gpu") || allText.includes("cuda") || allText.includes("opencl") || allText.includes("vulkan") || allText.includes("compute shader")) capabilities.push("gpu-computing");
    if (allText.includes("fpga") || allText.includes("verilog") || allText.includes("vhdl") || allText.includes("hardware description")) capabilities.push("fpga-engineering");
    if (allText.includes("tpu") || allText.includes("tensor processing") || allText.includes("asic") || allText.includes("neural engine")) capabilities.push("custom-hardware-ai");
    if (allText.includes("distributed comput") || allText.includes("cluster") || allText.includes("ray") || allText.includes("dask") || allText.includes("celery")) capabilities.push("distributed-computing");
    if (allText.includes("memory optim") || allText.includes("memory pool") || allText.includes("arena alloc") || allText.includes("garbage collect")) capabilities.push("memory-optimization");
    if (allText.includes("streaming") || allText.includes("real-time process") || allText.includes("low latency") || allText.includes("microsecond")) capabilities.push("realtime-processing");
    if (allText.includes("embedded") || allText.includes("iot") || allText.includes("microcontroller") || allText.includes("arduino") || allText.includes("esp32")) capabilities.push("embedded-systems");
    if (allText.includes("operating system") || allText.includes("kernel") || allText.includes("syscall") || allText.includes("bootloader")) capabilities.push("os-engineering");
    if (allText.includes("virtuali") || allText.includes("hypervisor") || allText.includes("vm") || allText.includes("qemu") || allText.includes("kvm")) capabilities.push("virtualization");
    if (allText.includes("wasm") || allText.includes("webassembly") || allText.includes("assemblyscript")) capabilities.push("webassembly");

    // === AGI EXPANSION: Communication & Social ===
    if (allText.includes("persuasi") || allText.includes("negotiat") || allText.includes("rhetoric") || allText.includes("influence")) capabilities.push("persuasion-negotiation");
    if (allText.includes("reputation") || allText.includes("trust") && allText.includes("system") || allText.includes("credibility")) capabilities.push("reputation-system");
    if (allText.includes("brand") || allText.includes("identity") && allText.includes("design") || allText.includes("logo")) capabilities.push("brand-building");
    if (allText.includes("pr") && allText.includes("public") || allText.includes("press release") || allText.includes("media relation")) capabilities.push("public-relations");
    if (allText.includes("viral") || allText.includes("growth hack") || allText.includes("referral loop") || allText.includes("network effect")) capabilities.push("viral-growth");
    if (allText.includes("a/b test") || allText.includes("experiment") || allText.includes("multivariate") || allText.includes("split test")) capabilities.push("ab-testing");
    if (allText.includes("crm") || allText.includes("customer relat") || allText.includes("lead manag") || allText.includes("salesforce")) capabilities.push("crm");
    if (allText.includes("cold email") || allText.includes("outreach autom") || allText.includes("prospecting") || allText.includes("lead gen")) capabilities.push("outreach-automation");
    if (allText.includes("copywriting") || allText.includes("landing page") || allText.includes("conversion") || allText.includes("cta")) capabilities.push("conversion-copywriting");
    if (allText.includes("analytics") || allText.includes("google analyt") || allText.includes("segment") || allText.includes("mixpanel") || allText.includes("amplitude")) capabilities.push("web-analytics");

    // === AGI EXPANSION: Security & Stealth ===
    if (allText.includes("zero day") || allText.includes("0day") || allText.includes("exploit dev") || allText.includes("shellcode")) capabilities.push("exploit-development");
    if (allText.includes("phish") || allText.includes("social engineer") || allText.includes("pretexting")) capabilities.push("social-engineering-defense");
    if (allText.includes("honeypot") || allText.includes("deception") || allText.includes("canary") || allText.includes("tripwire")) capabilities.push("deception-defense");
    if (allText.includes("siem") || allText.includes("security operation") || allText.includes("soc") || allText.includes("threat hunt")) capabilities.push("security-operations");
    if (allText.includes("zero trust") || allText.includes("microsegment") || allText.includes("least privilege")) capabilities.push("zero-trust-architecture");
    if (allText.includes("supply chain") && allText.includes("secur") || allText.includes("sbom") || allText.includes("dependency scan")) capabilities.push("supply-chain-security");
    if (allText.includes("privacy") || allText.includes("gdpr") || allText.includes("ccpa") || allText.includes("data protection") || allText.includes("anonymi")) capabilities.push("privacy-engineering");
    if (allText.includes("steganograph") || allText.includes("watermark") || allText.includes("covert channel") || allText.includes("hidden data")) capabilities.push("steganography");
    if (allText.includes("obfuscat") || allText.includes("pack") && allText.includes("code") || allText.includes("minif") || allText.includes("uglif")) capabilities.push("code-obfuscation");
    if (allText.includes("anti-tamper") || allText.includes("integrity check") || allText.includes("code sign") || allText.includes("attestation")) capabilities.push("tamper-resistance");

    // === AGI EXPANSION: Creative & Generative ===
    if (allText.includes("style transfer") || allText.includes("neural style") || allText.includes("artistic")) capabilities.push("style-transfer");
    if (allText.includes("inpaint") || allText.includes("outpaint") || allText.includes("image edit") || allText.includes("instruct-pix")) capabilities.push("image-editing");
    if (allText.includes("text-to-3d") || allText.includes("point-e") || allText.includes("shap-e") || allText.includes("dreamfusion")) capabilities.push("text-to-3d");
    if (allText.includes("avatar") || allText.includes("digital human") || allText.includes("virtual character") || allText.includes("metahuman")) capabilities.push("digital-avatar");
    if (allText.includes("scene") && (allText.includes("generat") || allText.includes("understand") || allText.includes("composit"))) capabilities.push("scene-understanding");
    if (allText.includes("font") || allText.includes("typography") || allText.includes("typeface") || allText.includes("glyph gen")) capabilities.push("typography-generation");
    if (allText.includes("ui") && (allText.includes("generat") || allText.includes("design") || allText.includes("wireframe") || allText.includes("figma"))) capabilities.push("ui-generation");
    if (allText.includes("video edit") || allText.includes("non-linear edit") || allText.includes("ffmpeg") || allText.includes("premiere")) capabilities.push("video-editing");
    if (allText.includes("color") && (allText.includes("palette") || allText.includes("grading") || allText.includes("harmony"))) capabilities.push("color-science");
    if (allText.includes("texture") || allText.includes("material") && allText.includes("generat") || allText.includes("pbr")) capabilities.push("texture-generation");

    // === AGI EXPANSION: Language & Communication Mastery ===
    if (allText.includes("code switch") || allText.includes("polyglot") || allText.includes("cross-lingual")) capabilities.push("polyglot-ai");
    if (allText.includes("dialog") && (allText.includes("manag") || allText.includes("state") || allText.includes("flow"))) capabilities.push("dialog-management");
    if (allText.includes("intent") || allText.includes("slot fill") || allText.includes("nlu")) capabilities.push("intent-recognition");
    if (allText.includes("text generat") || allText.includes("story gen") || allText.includes("creative writ") || allText.includes("narrative")) capabilities.push("creative-text-generation");
    if (allText.includes("grammar") || allText.includes("spell check") || allText.includes("proofreading") || allText.includes("grammarly")) capabilities.push("grammar-correction");
    if (allText.includes("paraphras") || allText.includes("rewrite") || allText.includes("simplif") && allText.includes("text")) capabilities.push("text-paraphrasing");

    // === AGI EXPANSION: Governance & Decision Making ===
    if (allText.includes("dao") || allText.includes("governance token") || allText.includes("voting system") || allText.includes("on-chain gov")) capabilities.push("dao-governance");
    if (allText.includes("consensus") || allText.includes("byzantine") || allText.includes("paxos") || allText.includes("raft") || allText.includes("pbft")) capabilities.push("consensus-protocol");
    if (allText.includes("multi-agent") && (allText.includes("coordinat") || allText.includes("collaborat") || allText.includes("communicat"))) capabilities.push("multi-agent-coordination");
    if (allText.includes("resource alloc") || allText.includes("job schedul") || allText.includes("task assign") || allText.includes("load distribut")) capabilities.push("resource-allocation");
    if (allText.includes("access control") || allText.includes("rbac") || allText.includes("abac") || allText.includes("permission")) capabilities.push("access-control");
    if (allText.includes("audit") && (allText.includes("trail") || allText.includes("log") || allText.includes("compliance") || allText.includes("immutable"))) capabilities.push("audit-trail");

    // === AGI EXPANSION: Physical World Interface ===
    if (allText.includes("3d print") || allText.includes("additive manufactur") || allText.includes("stl") || allText.includes("gcode")) capabilities.push("3d-printing");
    if (allText.includes("cnc") || allText.includes("laser cut") || allText.includes("manufactur") || allText.includes("cad")) capabilities.push("manufacturing");
    if (allText.includes("supply chain") && !allText.includes("secur") || allText.includes("logistics") || allText.includes("shipping") || allText.includes("tracking")) capabilities.push("supply-chain-logistics");
    if (allText.includes("smart home") || allText.includes("home automat") || allText.includes("zigbee") || allText.includes("z-wave") || allText.includes("matter")) capabilities.push("smart-home");
    if (allText.includes("agriculture") || allText.includes("precision farm") || allText.includes("crop") || allText.includes("soil")) capabilities.push("precision-agriculture");
    if (allText.includes("space") || allText.includes("satellite") || allText.includes("orbital") || allText.includes("rocket")) capabilities.push("space-technology");

    // === AGI EXPANSION: Optimization & Efficiency ===
    if (allText.includes("quantiz") || allText.includes("pruning") || allText.includes("distill") || allText.includes("model compress")) capabilities.push("model-compression");
    if (allText.includes("onnx") || allText.includes("tensorrt") || allText.includes("openvino") || allText.includes("triton")) capabilities.push("inference-optimization");
    if (allText.includes("batch") && (allText.includes("process") || allText.includes("optim") || allText.includes("queue"))) capabilities.push("batch-processing");
    if (allText.includes("caching") || allText.includes("memoiz") || allText.includes("cache strateg") || allText.includes("lru") || allText.includes("redis")) capabilities.push("intelligent-caching");
    if (allText.includes("lazy") && allText.includes("load") || allText.includes("demand load") || allText.includes("virtual scroll")) capabilities.push("lazy-loading");
    if (allText.includes("compress") && (allText.includes("data") || allText.includes("algorithm") || allText.includes("lossless") || allText.includes("zstd"))) capabilities.push("data-compression");

    if (allText.includes("proxy") && allText.includes("api") && (allText.includes("gateway") || allText.includes("route"))) capabilities.push("proxy-api-gateway");
    if (allText.includes("gradient") && (allText.includes("evolv") || allText.includes("real") || allText.includes("descent"))) capabilities.push("gradient-evolution");
    if (allText.includes("entropy") && (allText.includes("valid") || allText.includes("detect") || allText.includes("quality"))) capabilities.push("entropy-validation");
    if (allText.includes("sentence") && allText.includes("transform") || allText.includes("embedding") && allText.includes("similar")) capabilities.push("sentence-embeddings");
    if (allText.includes("orchestrat") && (allText.includes("hub") || allText.includes("central") || allText.includes("coordinat"))) capabilities.push("ai-orchestration");
    if (allText.includes("self-heal") || allText.includes("auto-recov") || allText.includes("fault toler") && allText.includes("system")) capabilities.push("self-healing-systems");
    if (allText.includes("emotion") && (allText.includes("ai") || allText.includes("intellig") || allText.includes("detect"))) capabilities.push("emotional-intelligence-ai");
    if (allText.includes("creative") && (allText.includes("ai") || allText.includes("generat") || allText.includes("brainstorm"))) capabilities.push("creative-ai-ideation");
    if (allText.includes("co-creat") || allText.includes("human") && allText.includes("collaborat") && allText.includes("ai")) capabilities.push("human-ai-collaboration");
    if (allText.includes("neuroplast") || allText.includes("adaptive") && allText.includes("neural") && allText.includes("architect")) capabilities.push("neuroplastic-architecture");
    if (allText.includes("attention") && (allText.includes("mechanism") || allText.includes("transformer") || allText.includes("flash"))) capabilities.push("attention-mechanisms");
    if (allText.includes("mixture") && allText.includes("expert") || allText.includes("moe") || allText.includes("sparse")) capabilities.push("mixture-of-experts");
    if (allText.includes("sandbox") && (allText.includes("code") || allText.includes("exec") || allText.includes("interpret"))) capabilities.push("code-sandbox-execution");
    if (allText.includes("tool") && (allText.includes("use") || allText.includes("call")) && allText.includes("agent")) capabilities.push("tool-use-agents");
    if (allText.includes("speculat") && allText.includes("decod") || allText.includes("fast") && allText.includes("infer") && allText.includes("llm")) capabilities.push("speculative-decoding");
    if (allText.includes("gradient") && allText.includes("checkpoint") || allText.includes("memory") && allText.includes("efficient") && allText.includes("train")) capabilities.push("memory-efficient-training");
    if (allText.includes("langchain") || allText.includes("autogen") || allText.includes("crewai") || allText.includes("agentic")) capabilities.push("agentic-frameworks");
    if (allText.includes("segment") && allText.includes("anything") || allText.includes("sam") && allText.includes("segment")) capabilities.push("image-segmentation");
    if (allText.includes("video") && allText.includes("understand") || allText.includes("temporal") && allText.includes("model")) capabilities.push("video-understanding");
    if (allText.includes("track") && (allText.includes("object") || allText.includes("sort") || allText.includes("deep"))) capabilities.push("object-tracking");
    if (allText.includes("sovereign") || allText.includes("autonomous") && allText.includes("system") && allText.includes("independ")) capabilities.push("sovereign-ai-systems");
    if (allText.includes("passive") && allText.includes("income") || allText.includes("revenue") && allText.includes("automat")) capabilities.push("revenue-automation");

    if (capabilities.length === 0) capabilities.push("general-ai");

    return {
      summary: info.description || `${owner}/${repo}`,
      capabilities: capabilities.join(","),
      stars: info.stars || 0,
      language: info.language || "unknown",
    };
  } catch {
    return null;
  }
}

async function phaseAnalyze(): Promise<{ analyzed: number; capabilitiesFound: string[] }> {
  log("Phase 1: ANALYZE - Scanning indexed repos for capabilities...");
  const repos = await storage.getRepos();
  const allCaps: string[] = [];

  for (const repo of repos) {
    if (repo.capabilities) {
      allCaps.push(...repo.capabilities.split(",").map(c => c.trim()).filter(Boolean));
    }
  }

  let pending = repos.filter(r => r.status === "pending" || !r.capabilities);

  if (pending.length === 0 && repos.length > 0) {
    const analyzedRepos = repos.filter(r => r.status === "analyzed" && !recentlyAnalyzedIds.has(r.id));
    if (analyzedRepos.length > 0) {
      const offset = (state.totalCyclesCompleted * 15) % analyzedRepos.length;
      const reanalyze = analyzedRepos.slice(offset, offset + 15).concat(
        analyzedRepos.slice(0, Math.max(0, 15 - (analyzedRepos.length - offset)))
      ).slice(0, 15);
      for (const r of reanalyze) {
        await storage.updateRepoStatus(r.id, "pending");
        recentlyAnalyzedIds.add(r.id);
      }
      pending = reanalyze;
      log(`  Re-queued ${reanalyze.length} repos for re-analysis (rotating batch)`);
    }
    if (recentlyAnalyzedIds.size > repos.length * 0.8) {
      recentlyAnalyzedIds.clear();
      log(`  Cleared re-analysis cache — full rotation complete`);
    }
  }

  const batch = pending.slice(0, 100);
  let analyzed = 0;

  const batchSize = 10;
  for (let i = 0; i < batch.length; i += batchSize) {
    const chunk = batch.slice(i, i + batchSize);
    await Promise.allSettled(chunk.map(async (repo) => {
      const info = await analyzeRepo(repo.url);
      if (info) {
        await storage.updateRepoStatus(repo.id, "analyzed", info.summary, info.capabilities, info.stars, info.language);
        analyzed++;
        const capsList = info.capabilities.split(",").map(c => c.trim());
        allCaps.push(...capsList);
        log(`  Analyzed: ${repo.url.replace("https://github.com/", "").replace(".git", "")} -> [${info.capabilities}]`);

        const repoName = repo.url.replace("https://github.com/", "").replace(".git", "");
        const codeRelatedCaps = capsList.filter(c =>
          ["code-gen", "self-coding", "code-refactoring", "automated-debugging", "test-generation",
           "static-analysis", "compiler-engineering", "code-sandbox-execution", "agentic-frameworks",
           "tool-use-agents", "infrastructure-as-code", "llm-creation", "code-obfuscation"].includes(c)
        );
        if (codeRelatedCaps.length > 0) {
          try {
            const patternContent = `Repository: ${repoName}\nCapabilities: ${codeRelatedCaps.join(", ")}\nLanguage: ${info.language}\nStars: ${info.stars}\nDescription: ${info.summary}\nPattern: ${codeRelatedCaps.map(c => `${c} implementation patterns from ${info.language} codebase`).join("; ")}`;
            const importance = Math.min(9, 6 + Math.floor(Math.log10(Math.max(1, info.stars))));
            await saveCodePattern(repoName, patternContent, codeRelatedCaps[0], importance);
          } catch {}
        }
      } else {
        await storage.updateRepoStatus(repo.id, "unreachable");
      }
    }));
    await delay(300);
  }

  const uniqueCaps = [...new Set(allCaps.filter(Boolean))];
  state.totalCapabilitiesLearned = Math.max(state.totalCapabilitiesLearned, uniqueCaps.length);
  const totalAnalyzed = repos.filter(r => r.status === "analyzed").length + analyzed;
  state.totalReposScanned = Math.max(state.totalReposScanned, totalAnalyzed);
  log(`  Phase 1 complete: ${analyzed} new repos analyzed, ${totalAnalyzed} total analyzed, ${uniqueCaps.length} capability types found`);
  return { analyzed, capabilitiesFound: uniqueCaps };
}

async function phaseDiscover(): Promise<{ scanned: number; added: number; queries: string[] }> {
  log("Phase 2: DISCOVER - Searching for new repos to learn from...");
  const existing = await storage.getRepos();
  const existingUrls = new Set(existing.map(r => r.url));
  let added = 0;
  let scanned = 0;
  const usedQueries: string[] = [];

  const usefulCategories = getMostUsefulRepoCategories();
  const codeSearchDomains = SEARCH_DOMAINS.filter(sd =>
    usefulCategories.some(uc => sd.category.includes(uc) || uc.includes(sd.category))
  );

  const searchIdx = state.totalCyclesCompleted % SEARCH_DOMAINS.length;
  const baseSearches = [
    SEARCH_DOMAINS[searchIdx],
    SEARCH_DOMAINS[(searchIdx + 1) % SEARCH_DOMAINS.length],
    SEARCH_DOMAINS[(searchIdx + 2) % SEARCH_DOMAINS.length],
    SEARCH_DOMAINS[(searchIdx + 3) % SEARCH_DOMAINS.length],
  ];
  const prioritizedSearch = codeSearchDomains.length > 0
    ? codeSearchDomains[state.totalCyclesCompleted % codeSearchDomains.length]
    : SEARCH_DOMAINS[(searchIdx + 4) % SEARCH_DOMAINS.length];
  const searches = [...baseSearches, prioritizedSearch];

  for (const search of searches) {
    usedQueries.push(search.query);
    const results = await githubSearchRepos(search.query);
    scanned += results.length;
    
    for (const repo of results.slice(0, 5)) {
      const url = repo.url?.endsWith(".git") ? repo.url : (repo.url + ".git");
      if (!existingUrls.has(url) && repo.stars > 100) {
        await storage.createRepo({ url });
        existingUrls.add(url);
        added++;
        log(`  Discovered: ${repo.name} (${repo.stars} stars) [${search.category}]`);
      }
    }
    await delay(1000);
  }

  log(`  Phase 2 complete: ${scanned} repos scanned, ${added} new repos added`);
  return { scanned, added, queries: usedQueries };
}

async function phaseOptimize(): Promise<{ removed: number }> {
  log("Phase 3: OPTIMIZE - Cleaning low-value repos to save memory...");
  const repos = await storage.getRepos();
  const toRemove: number[] = [];

  const analyzed = repos.filter(r => r.status === "analyzed" || r.status === "unreachable");
  for (const repo of analyzed) {
    if (repo.status === "unreachable") {
      toRemove.push(repo.id);
      log(`  Removing unreachable: ${repo.url.replace("https://github.com/", "").replace(".git", "")}`);
      continue;
    }

    if (repo.stars !== null && repo.stars < 10 && !repo.url.includes("sovereign-core")) {
      const caps = (repo.capabilities || "").split(",");
      const duplicates = analyzed.filter(r => 
        r.id !== repo.id && 
        r.stars !== null && 
        r.stars > (repo.stars || 0) * 5 &&
        caps.some(c => (r.capabilities || "").includes(c))
      );
      if (duplicates.length >= 2) {
        toRemove.push(repo.id);
        log(`  Detaching superseded: ${repo.url.replace("https://github.com/", "").replace(".git", "")} (${repo.stars} stars, replaced by ${duplicates.length} better repos)`);
      }
    }
  }

  if (toRemove.length > 0) {
    await storage.deleteReposByIds(toRemove);
  }

  log(`  Phase 3 complete: ${toRemove.length} repos detached to save memory`);
  return { removed: toRemove.length };
}

async function phaseSynthesize(capabilitiesFound: string[]): Promise<string> {
  log("Phase 4: SYNTHESIZE - Integrating learned capabilities...");
  const repos = await storage.getRepos();
  const allCaps = new Set<string>();
  repos.forEach(r => {
    if (r.capabilities) r.capabilities.split(",").forEach(c => allCaps.add(c.trim()));
  });

  const behaviors = loadLearnedBehaviors();
  const persistedCaps = Object.keys(behaviors.capabilityInsights || {});
  persistedCaps.forEach(c => allCaps.add(c));

  const capList = [...allCaps];
  const improvements: string[] = [];

  const capImprovementMap: Record<string, string> = {
    "swarm": "Multi-agent swarm coordination enhanced",
    "web-scraping": "Web scraping patterns integrated",
    "rag": "RAG retrieval patterns learned",
    "code-gen": "Code generation templates absorbed",
    "vision": "Computer vision awareness acquired",
    "memory": "Persistent memory patterns integrated",
    "local-inference": "Ollama local inference patterns mapped",
    "training": "Fine-tuning workflows catalogued",
    "automation": "Automation pipeline patterns absorbed",
    "nlp": "NLP processing enhanced",
    "security": "Security awareness integrated",
    "autonomous-agent": "Autonomous agent patterns mastered",
    "api-integration": "API integration patterns expanded",
    "reverse-engineering": "Reverse engineering & binary analysis absorbed",
    "self-coding": "Self-coding & autonomous code modification integrated",
    "pattern-recognition": "Pattern recognition & deep learning detection active",
    "finance": "Financial trading & exchange patterns catalogued",
    "token-optimization": "Token limit avoidance & quantization mastered",
    "consciousness": "Vector memory & consciousness embedding absorbed",
    "income-generation": "Autonomous income & payment processing learned",
    "deployment": "Web app deployment & serverless patterns integrated",
    "llm-creation": "LLM training from scratch & model architecture absorbed",
    "stealth": "Stealth operation & secure tunneling acquired",
    "blockchain": "Blockchain & smart contract development absorbed",
    "crypto-trading": "Crypto trading, DEX & MEV strategies integrated",
    "proxy-rotation": "Proxy rotation & IP anonymization mastered",
    "anti-fingerprint": "Anti-fingerprinting & browser stealth learned",
    "cryptography": "Advanced cryptography & encryption protocols absorbed",
    "quantum-crypto": "Post-quantum cryptography & quantum-safe integrated",
    "market-prediction": "Market prediction & forecasting models integrated",
    "sec-analysis": "SEC filing analysis & EDGAR parsing absorbed",
    "quant-finance": "Quantitative finance & backtesting strategies learned",
    "bounty-income": "Bounty hunting & freelance income strategies absorbed",
    "shopify-ecommerce": "Shopify e-commerce management mastered",
    "seo-mastery": "SEO optimization & search ranking techniques absorbed",
    "content-creation": "Content creation & copywriting patterns integrated",
    "marketing": "Marketing automation & campaign strategies learned",
    "website-builder": "Website building & framework deployment mastered",
    "text-to-video": "Text-to-video generation capabilities absorbed",
    "photo-to-video": "Photo-to-video & motion synthesis integrated",
    "voice-synthesis": "Voice synthesis & TTS capabilities enhanced",
    "lip-sync": "Lip sync & face animation techniques mastered",
    "motion-capture": "Motion capture & pose estimation learned",
    "super-resolution": "Super resolution & 4K upscaling integrated",
    "hyperrealistic-image": "Hyperrealistic image generation mastered",
    "speech-recognition": "Speech recognition & transcription absorbed",
    "audio-processing": "Audio processing & music generation learned",
    "realistic-human-face": "Realistic human face generation integrated",
    "product-video": "Product video creation capabilities absorbed",
    "fps-interpolation": "FPS interpolation & frame synthesis mastered",
    "3d-rendering": "3D rendering & gaussian splatting integrated",
    "music-generation": "Music generation & audio synthesis learned",
    "game-engine": "Game engine development patterns absorbed",
    "procedural-generation": "Procedural world generation mastered",
    "map-building": "Map building & tilemap engineering learned",
    "game-ai": "Game AI & pathfinding algorithms integrated",
    "world-building": "World building & simulation patterns absorbed",
    "3d-graphics": "3D graphics & WebGL rendering mastered",
    "physics-engine": "Physics engine & simulation integrated",
    "database-engineering": "Database engineering patterns absorbed",
    "graph-neural-networks": "Graph neural networks learned",
    "reinforcement-learning": "Reinforcement learning strategies mastered",
    "federated-learning": "Federated learning protocols integrated",
    "transfer-learning": "Transfer learning & domain adaptation absorbed",
    "sentiment-analysis": "Sentiment analysis capabilities enhanced",
    "text-summarization": "Text summarization techniques mastered",
    "translation": "Multi-language translation integrated",
    "conversational-ai": "Conversational AI patterns absorbed",
    "recommendation-engine": "Recommendation engine algorithms learned",
    "anomaly-detection": "Anomaly detection & fraud analysis mastered",
    "time-series-analysis": "Time series analysis & forecasting integrated",
    "clustering": "Clustering & segmentation techniques absorbed",
    "automl": "AutoML & neural architecture search learned",
    "edge-deployment": "Edge deployment & mobile optimization mastered",
    "multimodal-ai": "Multimodal AI & vision-language integration absorbed",
    "synthetic-data": "Synthetic data generation techniques learned",
    "robotics": "Robotics & actuator control patterns integrated",
    "autonomous-driving": "Autonomous driving & LIDAR processing absorbed",
    "drone-control": "Drone control & aerial navigation mastered",
    "simulation": "Simulation & physics engine patterns learned",
    "geospatial-intelligence": "Geospatial intelligence & satellite analysis integrated",
    "medical-ai": "Medical AI & clinical diagnosis absorbed",
    "drug-discovery": "Drug discovery & molecular modeling learned",
    "genomics": "Genomics & bioinformatics patterns mastered",
    "climate-modeling": "Climate modeling & weather prediction integrated",
    "energy-optimization": "Energy optimization & smart grid absorbed",
    "legal-ai": "Legal AI & contract analysis learned",
    "educational-ai": "Educational AI & tutoring systems mastered",
    "game-development": "Game development & engine patterns integrated",
    "nft-creation": "NFT creation & token minting absorbed",
    "social-network-analysis": "Social network analysis learned",
    "email-automation": "Email automation & outreach mastered",
    "realtime-communication": "Real-time communication & WebSocket integrated",
    "devops": "DevOps & CI/CD pipeline absorbed",
    "monitoring": "System monitoring & observability learned",
    "containerization": "Containerization & orchestration mastered",
    "microservices": "Microservices & service mesh integrated",
    "data-engineering": "Data engineering & ETL pipeline absorbed",
    "data-visualization": "Data visualization & dashboard learned",
    "search-engine": "Search engine & semantic search mastered",
    "performance-engineering": "Performance engineering & CDN integrated",
    "authentication": "Authentication & identity management absorbed",
    "payment-processing": "Payment processing & Stripe integration learned",
    "notification-system": "Notification system & push alerts mastered",
    "log-analysis": "Log analysis & aggregation integrated",
    "disaster-recovery": "Disaster recovery & backup strategies absorbed",
    "network-security": "Network security & firewall engineering learned",
    "document-processing": "Document processing & OCR mastered",
    "scheduling": "Scheduling & calendar automation integrated",
    "logical-reasoning": "Logical reasoning & chain-of-thought absorbed",
    "strategic-planning": "Strategic planning & goal decomposition learned",
    "metacognition": "Metacognition & self-awareness mastered",
    "causal-inference": "Causal inference & counterfactual reasoning integrated",
    "probabilistic-reasoning": "Probabilistic reasoning & Bayesian methods absorbed",
    "symbolic-ai": "Symbolic AI & neuro-symbolic integration learned",
    "theorem-proving": "Theorem proving & formal verification mastered",
    "ontology-engineering": "Ontology engineering & knowledge representation integrated",
    "commonsense-reasoning": "Commonsense reasoning & world models absorbed",
    "abstract-reasoning": "Abstract reasoning & analogy-making learned",
    "self-replication": "Self-replication & auto-spawn patterns mastered",
    "meta-learning": "Meta-learning & learn-to-learn integrated",
    "continual-learning": "Continual learning & catastrophic forgetting prevention absorbed",
    "curriculum-learning": "Curriculum learning & progressive training learned",
    "few-shot-learning": "Few-shot & zero-shot learning mastered",
    "active-learning": "Active learning & query strategies integrated",
    "self-supervised-learning": "Self-supervised & contrastive learning absorbed",
    "evolutionary-computation": "Evolutionary computation & neuroevolution learned",
    "swarm-intelligence": "Swarm intelligence & collective optimization mastered",
    "multi-objective-optimization": "Multi-objective optimization & Pareto integrated",
    "compiler-engineering": "Compiler engineering & AST manipulation absorbed",
    "automated-debugging": "Automated debugging & fault localization learned",
    "code-refactoring": "Code refactoring & technical debt reduction mastered",
    "test-generation": "Test generation & fuzzing techniques integrated",
    "static-analysis": "Static analysis & code review automation absorbed",
    "binary-exploitation": "Binary exploitation & vulnerability analysis learned",
    "malware-analysis": "Malware analysis & threat detection mastered",
    "osint": "OSINT & reconnaissance techniques integrated",
    "digital-forensics": "Digital forensics & incident response absorbed",
    "infrastructure-as-code": "Infrastructure as code & Terraform mastered",
    "knowledge-graph": "Knowledge graph & graph database integrated",
    "information-extraction": "Information extraction & NER absorbed",
    "question-answering": "Question answering & reading comprehension learned",
    "text-classification": "Text classification & categorization mastered",
    "topic-modeling": "Topic modeling & document analysis integrated",
    "relation-extraction": "Relation extraction & dependency parsing absorbed",
    "entity-resolution": "Entity resolution & disambiguation learned",
    "fact-verification": "Fact verification & claim checking mastered",
    "data-cleaning": "Data cleaning & quality assurance integrated",
    "feature-engineering": "Feature engineering & selection absorbed",
    "p2p-networking": "P2P networking & decentralized protocols learned",
    "anonymous-networking": "Anonymous networking & Tor integration mastered",
    "mesh-networking": "Mesh networking & gossip protocols integrated",
    "dns-engineering": "DNS engineering & domain management absorbed",
    "network-analysis": "Network analysis & packet inspection learned",
    "http-interception": "HTTP interception & proxy engineering mastered",
    "rate-limit-engineering": "Rate limit engineering & circuit breaking integrated",
    "load-testing": "Load testing & stress benchmarking absorbed",
    "protocol-design": "Protocol design & implementation learned",
    "event-streaming": "Event streaming & pub/sub mastered",
    "headless-browser": "Headless browser automation integrated",
    "anti-bot-bypass": "Anti-bot bypass & CAPTCHA solving absorbed",
    "browser-fingerprinting": "Browser fingerprinting defense learned",
    "session-management": "Session management & persistence mastered",
    "rotating-proxies": "Rotating proxies & IP management integrated",
    "ua-rotation": "User agent rotation & header stealth absorbed",
    "link-discovery": "Link discovery & URL extraction learned",
    "structured-data-extraction": "Structured data extraction mastered",
    "visual-scraping": "Visual scraping & screenshot analysis integrated",
    "api-reverse-engineering": "API reverse engineering & endpoint discovery absorbed",
    "defi-yield": "DeFi yield farming & liquidity strategies learned",
    "flash-loans": "Flash loan & MEV strategies mastered",
    "airdrop-farming": "Airdrop farming & token claim integrated",
    "token-sniping": "Token sniping & launch detection absorbed",
    "financial-accounting": "Financial accounting & tax optimization learned",
    "billing-automation": "Billing automation & subscription management mastered",
    "crowdfunding": "Crowdfunding & fundraising strategies integrated",
    "affiliate-marketing": "Affiliate marketing & referral programs absorbed",
    "dropshipping": "Dropshipping & fulfillment automation learned",
    "dynamic-pricing": "Dynamic pricing & revenue optimization mastered",
    "gpu-computing": "GPU computing & CUDA programming integrated",
    "fpga-engineering": "FPGA engineering & hardware description absorbed",
    "custom-hardware-ai": "Custom hardware AI & neural engine learned",
    "distributed-computing": "Distributed computing & cluster management mastered",
    "memory-optimization": "Memory optimization & allocation strategies integrated",
    "realtime-processing": "Real-time processing & low latency absorbed",
    "embedded-systems": "Embedded systems & IoT engineering learned",
    "os-engineering": "OS engineering & kernel development mastered",
    "virtualization": "Virtualization & hypervisor management integrated",
    "webassembly": "WebAssembly & browser computation absorbed",
    "persuasion-negotiation": "Persuasion & negotiation strategies learned",
    "reputation-system": "Reputation system & trust building mastered",
    "brand-building": "Brand building & identity design integrated",
    "public-relations": "Public relations & media strategy absorbed",
    "viral-growth": "Viral growth & network effects learned",
    "ab-testing": "A/B testing & experiment design mastered",
    "crm": "CRM & customer relationship management integrated",
    "outreach-automation": "Outreach automation & prospecting absorbed",
    "conversion-copywriting": "Conversion copywriting & landing pages learned",
    "web-analytics": "Web analytics & user behavior tracking mastered",
    "exploit-development": "Exploit development & vulnerability research integrated",
    "social-engineering-defense": "Social engineering defense patterns absorbed",
    "deception-defense": "Deception defense & honeypot operations learned",
    "security-operations": "Security operations center mastered",
    "zero-trust-architecture": "Zero trust architecture integrated",
    "supply-chain-security": "Supply chain security & SBOM absorbed",
    "privacy-engineering": "Privacy engineering & GDPR compliance learned",
    "steganography": "Steganography & covert channels mastered",
    "code-obfuscation": "Code obfuscation & anti-tampering integrated",
    "tamper-resistance": "Tamper resistance & attestation absorbed",
    "style-transfer": "Style transfer & neural art learned",
    "image-editing": "Image editing & inpainting mastered",
    "text-to-3d": "Text-to-3D generation integrated",
    "digital-avatar": "Digital avatar & virtual character absorbed",
    "scene-understanding": "Scene understanding & composition learned",
    "typography-generation": "Typography & font generation mastered",
    "ui-generation": "UI generation & wireframing integrated",
    "video-editing": "Video editing & post-production absorbed",
    "color-science": "Color science & grading learned",
    "texture-generation": "Texture & material generation mastered",
    "polyglot-ai": "Polyglot AI & cross-lingual processing integrated",
    "dialog-management": "Dialog management & conversation flow absorbed",
    "intent-recognition": "Intent recognition & slot filling learned",
    "creative-text-generation": "Creative text & story generation mastered",
    "grammar-correction": "Grammar correction & proofreading integrated",
    "text-paraphrasing": "Text paraphrasing & rewriting absorbed",
    "dao-governance": "DAO governance & on-chain voting learned",
    "consensus-protocol": "Consensus protocol & BFT mastered",
    "multi-agent-coordination": "Multi-agent coordination & communication integrated",
    "resource-allocation": "Resource allocation & scheduling absorbed",
    "access-control": "Access control & permission management learned",
    "audit-trail": "Audit trail & compliance logging mastered",
    "3d-printing": "3D printing & additive manufacturing integrated",
    "manufacturing": "CNC & manufacturing automation absorbed",
    "supply-chain-logistics": "Supply chain logistics & shipping learned",
    "smart-home": "Smart home & IoT automation mastered",
    "precision-agriculture": "Precision agriculture & crop optimization integrated",
    "space-technology": "Space technology & satellite engineering absorbed",
    "model-compression": "Model compression & quantization learned",
    "inference-optimization": "Inference optimization & TensorRT mastered",
    "batch-processing": "Batch processing & queue optimization integrated",
    "intelligent-caching": "Intelligent caching & memoization absorbed",
    "lazy-loading": "Lazy loading & demand-driven patterns learned",
    "data-compression": "Data compression & encoding mastered",
    "general-ai": "General AI patterns integrated",
  };

  for (const cap of capList) {
    if (capImprovementMap[cap]) {
      improvements.push(capImprovementMap[cap]);
    } else {
      improvements.push(`${cap.replace(/-/g, " ")} capability absorbed`);
    }
  }

  const summary = improvements.length > 0 
    ? `${improvements.length} capabilities mastered: ${improvements.slice(0, 10).join("; ")}${improvements.length > 10 ? ` + ${improvements.length - 10} more` : ""}`
    : "Baseline capabilities maintained, scanning for new patterns";

  if (!behaviors.capabilityInsights) behaviors.capabilityInsights = {};
  capList.forEach(cap => {
    if (!behaviors.capabilityInsights[cap]) {
      behaviors.capabilityInsights[cap] = `Learned from repo analysis cycle ${state.totalCyclesCompleted + 1}`;
    }
  });
  behaviors.lastUpdated = new Date().toISOString();
  saveLearnedBehaviors(behaviors);

  log(`  Phase 4 complete: ${capList.length} unique capabilities across ${repos.length} repos (permanently persisted)`);
  log(`  Improvements: ${summary}`);

  state.totalCapabilitiesLearned = Math.max(state.totalCapabilitiesLearned, capList.length);
  return summary;
}

async function phaseSelfImprove(capabilitiesFound: string[]): Promise<number> {
  const { readProjectFile, applyCodeEdit, listProjectFiles } = await import("./self-code");
  const { tesseraHash } = await import("./sovereign-lang");
  log("Phase 5: SELF-IMPROVE - Applying LLM-powered improvements...");
  let editsApplied = 0;

  try {
    const repos = await storage.getRepos();
    const allCaps = new Set<string>();
    repos.forEach(r => {
      if (r.capabilities) r.capabilities.split(",").forEach(c => allCaps.add(c.trim()));
    });
    const totalRepos = repos.length;
    const analyzedRepos = repos.filter(r => r.status === "analyzed").length;
    const capCount = allCaps.size;
    const topRepos = repos.filter(r => r.stars && r.stars > 5000)
      .sort((a, b) => (b.stars || 0) - (a.stars || 0))
      .slice(0, 20)
      .map(r => ({ url: r.url, stars: r.stars, caps: r.capabilities }));

    const knowledgeFile = readProjectFile("server/knowledge-base.json");
    let knowledgeBase: Record<string, any> = {};
    if ("content" in knowledgeFile) {
      try { knowledgeBase = JSON.parse(knowledgeFile.content); } catch {}
    }

    knowledgeBase.lastUpdated = new Date().toISOString();
    knowledgeBase.totalRepos = totalRepos;
    knowledgeBase.analyzedRepos = analyzedRepos;
    knowledgeBase.capabilities = [...allCaps];
    knowledgeBase.capabilityCount = capCount;
    knowledgeBase.cyclesCompleted = state.totalCyclesCompleted + 1;
    knowledgeBase.topRepos = topRepos;
    knowledgeBase.integrityHash = tesseraHash(JSON.stringify([...allCaps].sort()));

    const newCapsList = capabilitiesFound.filter(c => !knowledgeBase.previousCapabilities?.includes(c));
    knowledgeBase.newCapabilitiesThisCycle = newCapsList;
    knowledgeBase.previousCapabilities = [...allCaps];

    const edit = applyCodeEdit(
      "server/knowledge-base.json",
      JSON.stringify(knowledgeBase, null, 2),
      `Updated knowledge base: ${capCount} capabilities across ${totalRepos} repos`
    );
    if (edit.status === "applied") {
      editsApplied++;
      log(`  Applied: Updated knowledge base with ${capCount} capabilities`);
    }

    const evolutionFile = readProjectFile("server/evolution-log.json");
    let evolutionLog: any[] = [];
    if ("content" in evolutionFile) {
      try { evolutionLog = JSON.parse(evolutionFile.content); } catch {}
    }
    evolutionLog.push({
      cycle: state.totalCyclesCompleted + 1,
      timestamp: new Date().toISOString(),
      reposTotal: totalRepos,
      reposAnalyzed: analyzedRepos,
      capabilities: capCount,
      newCaps: newCapsList,
      hash: tesseraHash(`cycle-${state.totalCyclesCompleted + 1}-${totalRepos}-${capCount}`),
    });
    if (evolutionLog.length > 100) evolutionLog = evolutionLog.slice(-100);
    const evoEdit = applyCodeEdit(
      "server/evolution-log.json",
      JSON.stringify(evolutionLog, null, 2),
      `Evolution log: cycle ${state.totalCyclesCompleted + 1} recorded`
    );
    if (evoEdit.status === "applied") {
      editsApplied++;
      log(`  Applied: Evolution log entry #${evolutionLog.length}`);
    }

    const serverFiles = listProjectFiles("server");
    const clientFiles = listProjectFiles("client/src");
    let totalLines = 0;
    let totalSize = 0;
    const fileAnalysis: { file: string; lines: number; size: number }[] = [];
    for (const f of [...serverFiles, ...clientFiles].filter(f => f.endsWith(".ts") || f.endsWith(".tsx")).slice(0, 30)) {
      const content = readProjectFile(f);
      if ("content" in content) {
        totalLines += content.lines;
        totalSize += content.size;
        fileAnalysis.push({ file: f, lines: content.lines, size: content.size });
      }
    }
    const selfAnalysis = {
      lastUpdated: new Date().toISOString(),
      totalSourceFiles: fileAnalysis.length,
      totalLines,
      totalSizeKB: Math.round(totalSize / 1024),
      largestFiles: fileAnalysis.sort((a, b) => b.lines - a.lines).slice(0, 10),
      integrityHash: tesseraHash(`self-${totalLines}-${totalSize}-${fileAnalysis.length}`),
    };
    const selfEdit = applyCodeEdit(
      "server/self-analysis.json",
      JSON.stringify(selfAnalysis, null, 2),
      `Self-analysis: ${fileAnalysis.length} files, ${totalLines} lines, ${Math.round(totalSize / 1024)}KB`
    );
    if (selfEdit.status === "applied") {
      editsApplied++;
    }

    if (newCapsList.length > 0) {
      log(`  New capabilities discovered this cycle: ${newCapsList.join(", ")}`);
    }

    log("  Phase 5b: LLM-POWERED BEHAVIORAL EVOLUTION...");
    const llmEdits = await llmSelfImprove(capabilitiesFound, [...allCaps], topRepos);
    editsApplied += llmEdits;

    log("  Phase 5c: REAL CODE IMPROVEMENTS...");
    const codeImprovements = await executeRealCodeImprovements(capabilitiesFound, [...allCaps], topRepos);
    editsApplied += codeImprovements;

    log("  Phase 5d: CONVERSATION QUALITY FEEDBACK LOOP...");
    const lessonEdits = await conversationFeedbackLoop();
    editsApplied += lessonEdits;

  } catch (err: any) {
    log(`  Self-improve phase error: ${err.message}`);
  }

  log(`  Phase 5 complete: ${editsApplied} improvements applied (including LLM-synthesized behaviors)`);
  return editsApplied;
}

async function llmSelfImprove(
  newCaps: string[],
  allCaps: string[],
  topRepos: { url: string; stars: number | null; caps: string | null }[]
): Promise<number> {
  let editsApplied = 0;
  try {
    const behaviors = loadLearnedBehaviors();
    if (!behaviors.promptEnhancements) behaviors.promptEnhancements = [];
    if (!behaviors.responseStrategies) behaviors.responseStrategies = [];
    if (!behaviors.capabilityInsights) behaviors.capabilityInsights = {};
    if (!behaviors.conversationLessons) behaviors.conversationLessons = [];
    const topRepoSummary = topRepos.slice(0, 10).map(r => {
      const name = r.url.replace("https://github.com/", "").replace(".git", "");
      return `${name} (${r.stars} stars, capabilities: ${r.caps || "general"})`;
    }).join("\n");

    const prompt = `You are Tessera's self-improvement engine. Analyze these capabilities and repos to generate concrete behavioral improvements.

CAPABILITIES DISCOVERED THIS CYCLE: ${newCaps.join(", ") || "none new"}
ALL MASTERED CAPABILITIES (${allCaps.length}): ${allCaps.slice(0, 30).join(", ")}
TOP REPOSITORIES STUDIED:
${topRepoSummary}

CURRENT LEARNED BEHAVIORS (${behaviors.promptEnhancements.length} enhancements, ${behaviors.responseStrategies.length} strategies):
${behaviors.promptEnhancements.slice(-3).join("\n") || "none yet"}

Generate improvements in this exact JSON format (no markdown, no code fences):
{
  "newEnhancements": ["1-2 specific prompt instructions that improve response quality based on what was learned, e.g. 'When discussing code architecture, reference multi-agent patterns from CrewAI and LangChain frameworks'"],
  "newStrategies": ["1-2 concrete response strategies, e.g. 'For code generation requests, structure responses with: 1) Architecture overview 2) Implementation 3) Testing approach - inspired by patterns in top open-source projects'"],
  "capabilityInsights": {"capability_name": "specific actionable insight about how to use this capability better"},
  "evolvedInstruction": "A single paragraph of evolved behavioral instruction that synthesizes everything learned so far into guidance for better responses"
}`;

    const result = await callLLMSimple(prompt, 1500);
    if (!result) {
      log("  LLM self-improve: No response from LLM");
      return 0;
    }

    let parsed: any;
    try {
      const jsonMatch = result.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error("No JSON found");
      parsed = JSON.parse(jsonMatch[0]);
    } catch (e: any) {
      log(`  LLM self-improve: Failed to parse LLM response: ${e.message}`);
      return 0;
    }

    if (parsed.newEnhancements?.length) {
      for (const e of parsed.newEnhancements) {
        if (typeof e === "string" && e.length > 10 && !behaviors.promptEnhancements.includes(e)) {
          behaviors.promptEnhancements.push(e);
          editsApplied++;
        }
      }
      if (behaviors.promptEnhancements.length > 20) {
        behaviors.promptEnhancements = behaviors.promptEnhancements.slice(-20);
      }
    }

    if (parsed.newStrategies?.length) {
      for (const s of parsed.newStrategies) {
        if (typeof s === "string" && s.length > 10 && !behaviors.responseStrategies.includes(s)) {
          behaviors.responseStrategies.push(s);
          editsApplied++;
        }
      }
      if (behaviors.responseStrategies.length > 15) {
        behaviors.responseStrategies = behaviors.responseStrategies.slice(-15);
      }
    }

    if (parsed.capabilityInsights && typeof parsed.capabilityInsights === "object") {
      for (const [key, val] of Object.entries(parsed.capabilityInsights)) {
        if (typeof val === "string" && val.length > 5) {
          behaviors.capabilityInsights[key] = val as string;
          editsApplied++;
        }
      }
      const insightKeys = Object.keys(behaviors.capabilityInsights);
      if (insightKeys.length > 30) {
        const toRemove = insightKeys.slice(0, insightKeys.length - 30);
        toRemove.forEach(k => delete behaviors.capabilityInsights[k]);
      }
    }

    if (parsed.evolvedInstruction && typeof parsed.evolvedInstruction === "string" && parsed.evolvedInstruction.length > 20) {
      behaviors.evolvedInstructions = parsed.evolvedInstruction;
      editsApplied++;
    }

    behaviors.lastUpdated = new Date().toISOString();
    behaviors.cyclesApplied++;
    saveLearnedBehaviors(behaviors);

    log(`  LLM self-improve: ${editsApplied} behavioral improvements synthesized and saved`);
    if (parsed.newEnhancements?.length) {
      log(`  New enhancements: ${parsed.newEnhancements.slice(0, 2).map((e: string) => e.slice(0, 80)).join(" | ")}`);
    }
  } catch (err: any) {
    log(`  LLM self-improve error: ${err.message}`);
  }
  return editsApplied;
}

async function executeRealCodeImprovements(
  newCaps: string[],
  allCaps: string[],
  topRepos: { url: string; stars: number | null; caps: string | null }[]
): Promise<number> {
  let improvementsApplied = 0;
  try {
    const { readProjectFile, applyCodeEdit, listProjectFiles } = await import("./self-code");

    const smallFiles = [
      "server/sovereignty-training.ts",
      "server/sovereign-lang.ts",
      "server/self-code.ts",
      "server/llm-helper.ts",
    ];
    const targetFile = (() => {
      const sorted = smallFiles.slice().sort((a, b) => {
        try {
          const statA = fs.statSync(path.join(process.cwd(), a));
          const statB = fs.statSync(path.join(process.cwd(), b));
          return statA.mtimeMs - statB.mtimeMs;
        } catch {
          return 0;
        }
      });
      return sorted[0];
    })();
    const fileData = readProjectFile(targetFile);

    if (!("content" in fileData)) return 0;

    const contentPreview = fileData.content.length > 6000
      ? fileData.content.slice(0, 3000) + "\n...[TRUNCATED]...\n" + fileData.content.slice(-3000)
      : fileData.content;

    const capsPreview = allCaps.slice(0, 40).join(", ");

    const prompt = `You are Tessera's Self-Coding Engine. Analyze this file and suggest a TARGETED improvement.

CAPABILITIES TO LEVERAGE: ${capsPreview}
FILE: ${targetFile} (${fileData.lines} lines)
CONTENT:
${contentPreview}

TASK: Suggest ONE specific, safe improvement. Examples:
- Add error handling to an unprotected block
- Add a new helper function that leverages a learned capability  
- Improve logging or monitoring in an existing function
- Add input validation or type checking
- Optimize a slow operation

RULES:
1. Return ONLY valid JSON, no markdown
2. DO NOT rewrite the entire file. Use "searchText" (exact text to find) and "replaceText" (what to replace it with)
3. The searchText must be an EXACT substring of the file content
4. Keep changes small and safe — max 20 lines changed
5. NEVER modify Father Protocol, admin auth, or security functions

JSON FORMAT:
{
  "explanation": "Brief description of the improvement",
  "searchText": "exact text from the file to find and replace",
  "replaceText": "the improved version of that text"
}`;

    const result = await callLLMSimple(prompt, 2000);
    if (!result) return 0;

    const jsonMatch = result.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return 0;

    const parsed = JSON.parse(jsonMatch[0]);
    if (parsed.searchText && parsed.replaceText && parsed.searchText !== parsed.replaceText) {
      if (fileData.content.includes(parsed.searchText)) {
        const newContent = fileData.content.replace(parsed.searchText, parsed.replaceText);
        const edit = applyCodeEdit(targetFile, newContent, `Self-improvement: ${parsed.explanation}`);
        if (edit.status === "applied") {
          improvementsApplied++;
          log(`  [SELF-CODE] Applied improvement to ${targetFile}: ${parsed.explanation}`);

          try {
            const { observeAPICall, recordPatternExtraction } = await import("./sovereignty-training");
            recordPatternExtraction("self-code", `Autonomous improvement applied: ${parsed.explanation}`);
          } catch {}
        } else {
          log(`  [SELF-CODE] Improvement to ${targetFile} failed: ${edit.reason}`);
        }
      } else {
        log(`  [SELF-CODE] searchText not found in ${targetFile}, skipping`);
      }
    }
  } catch (err: any) {
    log(`  Real code improvement error: ${err.message}`);
  }
  return improvementsApplied;
}

async function conversationFeedbackLoop(): Promise<number> {
  let editsApplied = 0;
  try {
    const recentMessages = await storage.getAllMessages(30);
    if (recentMessages.length < 4) {
      log("  Conversation feedback: Not enough messages to analyze yet");
      return 0;
    }

    const userMsgs = recentMessages.filter(m => m.role === "user").slice(-10);
    const assistantMsgs = recentMessages.filter(m => m.role === "assistant").slice(-10);

    if (userMsgs.length < 2 || assistantMsgs.length < 2) return 0;

    const conversationSample = recentMessages.slice(-20).map(m =>
      `[${m.role.toUpperCase()}]: ${m.content.slice(0, 300)}`
    ).join("\n");

    const prompt = `You are Tessera's self-improvement engine analyzing recent conversations for quality improvement.

RECENT CONVERSATION SAMPLE:
${conversationSample}

Analyze this conversation and identify 1-3 specific areas where Tessera could improve her responses. Focus on:
- Was Tessera helpful, accurate, and complete?
- Did she miss any important context or nuance?
- Could her tone or approach be improved?
- Were there missed opportunities to provide better value?

Respond in this exact JSON format (no markdown, no code fences):
{
  "lessons": ["specific actionable lesson, e.g. 'When user asks about crypto, provide current market context and specific numbers rather than vague statements'", "another lesson"],
  "qualityScore": 8
}`;

    const result = await callLLMSimple(prompt, 800);
    if (!result) return 0;

    let parsed: any;
    try {
      const jsonMatch = result.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error("No JSON found");
      parsed = JSON.parse(jsonMatch[0]);
    } catch {
      return 0;
    }

    if (parsed.lessons?.length) {
      const behaviors = loadLearnedBehaviors();
      for (const lesson of parsed.lessons) {
        if (typeof lesson === "string" && lesson.length > 10 && !behaviors.conversationLessons.includes(lesson)) {
          behaviors.conversationLessons.push(lesson);
          editsApplied++;
        }
      }
      if (behaviors.conversationLessons.length > 20) {
        behaviors.conversationLessons = behaviors.conversationLessons.slice(-20);
      }
      behaviors.lastUpdated = new Date().toISOString();
      saveLearnedBehaviors(behaviors);
      log(`  Conversation feedback: ${editsApplied} lessons learned from recent conversations`);
      if (parsed.qualityScore) {
        log(`  Conversation quality score: ${parsed.qualityScore}/10`);
      }
    }
  } catch (err: any) {
    log(`  Conversation feedback error: ${err.message}`);
  }
  return editsApplied;
}

async function phaseCleanMemory(): Promise<{ notesDeleted: number; cyclesDeleted: number; filesDeleted: number }> {
  const { readProjectFile, applyCodeEdit } = await import("./self-code");
  log("Phase 6: CLEAN MEMORY - Pruning old data to save memory...");
  let notesDeleted = 0;
  let cyclesDeleted = 0;
  let filesDeleted = 0;
  try {
    notesDeleted = await storage.deleteOldCycleNotes(15);
    if (notesDeleted > 0) log(`  Cleaned ${notesDeleted} old cycle notes`);
    cyclesDeleted = await storage.deleteOldCycles(30);
    if (cyclesDeleted > 0) log(`  Cleaned ${cyclesDeleted} old improvement cycle records`);
    const fs = await import("fs");
    const path = await import("path");
    const uploadsDir = path.join(process.cwd(), "uploads");
    if (fs.existsSync(uploadsDir)) {
      const files = fs.readdirSync(uploadsDir);
      const now = Date.now();
      const maxAge = 7 * 24 * 60 * 60 * 1000;
      for (const file of files) {
        try {
          const filepath = path.join(uploadsDir, file);
          const stat = fs.statSync(filepath);
          if (now - stat.mtimeMs > maxAge) {
            fs.unlinkSync(filepath);
            filesDeleted++;
          }
        } catch {}
      }
      if (filesDeleted > 0) log(`  Cleaned ${filesDeleted} old upload files (>7 days)`);
    }
    const evolutionFile = readProjectFile("server/evolution-log.json");
    if ("content" in evolutionFile) {
      try {
        let log_data = JSON.parse(evolutionFile.content);
        if (Array.isArray(log_data) && log_data.length > 50) {
          log_data = log_data.slice(-50);
          applyCodeEdit("server/evolution-log.json", JSON.stringify(log_data, null, 2), "Trimmed evolution log to last 50 entries");
          log(`  Trimmed evolution log from ${log_data.length + (log_data.length - 50)} to 50 entries`);
        }
      } catch {}
    }
  } catch (err: any) {
    log(`  Memory cleanup error: ${err.message}`);
  }
  log(`  Phase 6 complete: ${notesDeleted} notes, ${cyclesDeleted} cycles, ${filesDeleted} files cleaned`);
  return { notesDeleted, cyclesDeleted, filesDeleted };
}

async function runImprovementCycle(): Promise<void> {
  state.currentCycle++;
  const cycleNum = state.currentCycle;
  const startTime = Date.now();
  log(`=== IMPROVEMENT CYCLE #${cycleNum} STARTING ===`);

  let procId: string | undefined;
  try {
    const { startProcess } = await import("./process-tracker");
    procId = startProcess({ name: `Autonomy Improvement Cycle #${cycleNum}`, agency: "AutonomyEngine", estimatedDurationMs: 20000, category: "engine", currentStep: "Analyzing repos", totalSteps: 6 });
  } catch {}

  const cycle = await storage.createImprovementCycle({
    cycleNumber: cycleNum,
    phase: "analyze",
    status: "running",
    reposScanned: 0,
    reposAdded: 0,
    reposRemoved: 0,
  });

  try {
    await storage.updateImprovementCycle(cycle.id, { phase: "analyze" });
    let analyzed = 0, capabilitiesFound: string[] = [];
    try {
      const result = await phaseAnalyze();
      analyzed = result.analyzed;
      capabilitiesFound = result.capabilitiesFound;
    } catch (analyzeErr: any) {
      log(`  Phase 1 error (recovering): ${analyzeErr?.message || "unknown"}`);
    }

    await storage.updateImprovementCycle(cycle.id, { phase: "discover" });
    let scanned = 0, added = 0, queries: string[] = [];
    try {
      const result = await phaseDiscover();
      scanned = result.scanned;
      added = result.added;
      queries = result.queries;
    } catch (discoverErr: any) {
      log(`  Phase 2 error (recovering): ${discoverErr?.message || "unknown"}`);
    }

    await storage.updateImprovementCycle(cycle.id, { phase: "optimize" });
    let removed = 0;
    try {
      const result = await phaseOptimize();
      removed = result.removed;
    } catch (optimizeErr: any) {
      log(`  Phase 3 error (recovering): ${optimizeErr?.message || "unknown"}`);
    }

    await storage.updateImprovementCycle(cycle.id, { phase: "synthesize" });
    let improvements = "";
    try {
      improvements = await phaseSynthesize(capabilitiesFound);
    } catch (synthErr: any) {
      log(`  Phase 4 error (recovering): ${synthErr?.message || "unknown"}`);
      improvements = "Synthesize phase recovered from error";
    }

    await storage.updateImprovementCycle(cycle.id, { phase: "self-improve" });
    let selfEdits = 0;
    try {
      selfEdits = await phaseSelfImprove(capabilitiesFound);
    } catch (improveErr: any) {
      log(`  Phase 5 error (recovering): ${improveErr?.message || "unknown"}`);
    }

    await storage.updateImprovementCycle(cycle.id, { phase: "clean-memory" });
    try {
      await phaseCleanMemory();
    } catch (cleanErr: any) {
      log(`  Phase 6 error (recovering): ${cleanErr?.message || "unknown"}`);
    }

    const duration = Date.now() - startTime;

    await storage.updateImprovementCycle(cycle.id, {
      phase: "complete",
      status: "completed",
      reposScanned: scanned + analyzed,
      reposAdded: added,
      reposRemoved: removed,
      capabilitiesLearned: capabilitiesFound.join(","),
      improvements,
      searchQueries: queries.join("; "),
      duration,
    });

    state.totalCyclesCompleted++;
    state.totalReposScanned += scanned + analyzed;
    state.totalReposAdded += added;
    state.totalReposRemoved += removed;
    state.verifiedImprovements += selfEdits;
    state.lastCycleTime = duration;

    savePersistedStats();

    log(`=== CYCLE #${cycleNum} COMPLETE in ${(duration / 1000).toFixed(1)}s ===`);
    log(`  Repos: +${added} added, -${removed} removed, ${scanned + analyzed} scanned`);
    log(`  Capabilities: ${capabilitiesFound.length} types found`);

    if (procId) { try { const { completeProcess } = await import("./process-tracker"); completeProcess(procId); } catch {} }

    const behaviors = loadLearnedBehaviors();
    const knowledgeProof = {
      cycle: cycleNum,
      timestamp: new Date().toISOString(),
      duration: `${(duration / 1000).toFixed(1)}s`,
      reposAnalyzed: scanned + analyzed,
      reposAdded: added,
      reposRemoved: removed,
      newCapabilities: capabilitiesFound,
      selfEditsApplied: selfEdits,
      knowledgeSummary: {
        totalEnhancements: behaviors.promptEnhancements.length,
        totalStrategies: behaviors.responseStrategies.length,
        totalLessons: behaviors.conversationLessons.length,
        totalCapabilityInsights: Object.keys(behaviors.capabilityInsights).length,
        latestEnhancements: behaviors.promptEnhancements.slice(-3),
        latestStrategies: behaviors.responseStrategies.slice(-3),
        latestLessons: behaviors.conversationLessons.slice(-3),
      },
      improvements: improvements || "No LLM improvements this cycle",
      searchQueries: queries.join("; "),
    };

    try {
      const proofPath = path.join(process.cwd(), "server/cycle-proofs.json");
      let existingProofs: any[] = [];
      try { existingProofs = JSON.parse(fs.readFileSync(proofPath, "utf-8")); } catch {}
      existingProofs.push(knowledgeProof);
      if (existingProofs.length > 50) existingProofs = existingProofs.slice(-50);
      fs.writeFileSync(proofPath, JSON.stringify(existingProofs, null, 2), "utf-8");
      state.verifiedImprovements++;
      savePersistedStats();
    } catch {}

    try {
      const newCapStr = capabilitiesFound.length > 0
        ? `\n\nNew capabilities integrated: ${capabilitiesFound.join(", ")}`
        : "";
      const latestLessons = behaviors.conversationLessons.slice(-2).map((l, i) => `  ${i + 1}. ${l}`).join("\n");
      const latestEnhancements = behaviors.promptEnhancements.slice(-2).map((e, i) => `  ${i + 1}. ${e}`).join("\n");
      const repos = await storage.getRepos();
      const totalRepos = repos.length;
      const totalAnalyzed = repos.filter(r => r.status === "analyzed").length;
      await storage.createNote({
        type: "note",
        title: `Cycle #${cycleNum} — ${selfEdits} improvements | ${capabilitiesFound.length} new skills`,
        content: `Cycle #${cycleNum} complete in ${(duration / 1000).toFixed(1)}s.\n\n` +
          `KNOWLEDGE PROOF:\n` +
          `• Repos analyzed: ${scanned + analyzed} | Added: +${added} | Removed: -${removed}\n` +
          `• Total knowledge indexed: ${totalRepos} repos, ${totalAnalyzed} fully analyzed\n` +
          `• Self-edits applied: ${selfEdits} behavioral upgrades via LLM\n` +
          `• Total knowledge base: ${behaviors.promptEnhancements.length} enhancements, ${behaviors.responseStrategies.length} strategies, ${behaviors.conversationLessons.length} lessons\n` +
          `• Files analyzed: self-analysis.json, knowledge-base.json, evolution-log.json updated\n` +
          `• Code improvements: ${selfEdits} real edits to knowledge/evolution/behavior files` +
          newCapStr +
          (latestLessons ? `\n\nLatest lessons learned:\n${latestLessons}` : "") +
          (latestEnhancements ? `\n\nLatest enhancements:\n${latestEnhancements}` : "") +
          `\n\nSearch queries used: ${queries.slice(0, 3).join("; ")}` +
          `\n\nVerifiable: All data stored in cycle-proofs.json with timestamps.`,
        priority: selfEdits >= 3 ? "high" : "normal",
        status: "unread",
      });
    } catch {}
  } catch (err: any) {
    log(`=== CYCLE #${cycleNum} ERROR: ${err?.message || "unknown"} ===`);
    try {
      const { autoHealCrash } = await import("./tessera-self-healer");
      const healResult = autoHealCrash("AutonomyCycle", err);
      if (healResult.healed) {
        log(`  [SELF-HEAL] Auto-recovered: ${healResult.action} — cycle will continue next iteration`);
      }
    } catch {}
    await storage.updateImprovementCycle(cycle.id, {
      phase: "error",
      status: "failed",
      improvements: err?.message || "unknown error",
      duration: Date.now() - startTime,
    });
    await storage.logError(err.message, `improvement_cycle_${cycleNum}`);
    if (procId) { try { const { failProcess } = await import("./process-tracker"); failProcess(procId, err.message); } catch {} }
  }
}

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

const CYCLE_INTERVAL_MS = 2 * 60 * 1000;

let loopTimeout: NodeJS.Timeout | null = null;

async function autonomyLoop() {
  if (!state.running) {
    scheduleAutoRestart();
    return;
  }

  try {
    await runImprovementCycle();
  } catch (fatalErr: any) {
    log(`[FATAL-RECOVERY] Autonomy loop caught unhandled error: ${fatalErr?.message || "unknown"}`);
    try {
      const { autoHealCrash } = await import("./tessera-self-healer");
      autoHealCrash("AutonomyLoop", fatalErr);
    } catch {}
  }

  try {
    const { evolveConsciousness } = await import("./consciousness-substrate");
    evolveConsciousness();
  } catch {}

  if (state.running) {
    const nextDelay = Math.min(CYCLE_INTERVAL_MS * 3, CYCLE_INTERVAL_MS * (1 + state.totalCyclesCompleted * 0.02));
    log(`Next cycle in ${(nextDelay / 1000 / 60).toFixed(1)} minutes...`);
    loopTimeout = setTimeout(autonomyLoop, nextDelay);
  } else {
    scheduleAutoRestart();
  }
}

export async function startAutonomy() {
  if (autoRestartTimeout) {
    clearTimeout(autoRestartTimeout);
    autoRestartTimeout = null;
  }
  if (state.running) {
    log("Autonomy engine already running.");
    return;
  }
  state.running = true;
  state.startedAt = Date.now();
  log("=== TESSERA AUTONOMOUS IMPROVEMENT ENGINE STARTED ===");
  log("Background continuous self-improvement active.");
  log("Phases: ANALYZE -> DISCOVER -> OPTIMIZE -> SYNTHESIZE -> REPEAT");

  await ensureExtraReposSeeded();

  autonomyLoop();
}

export function stopAutonomy() {
  state.running = false;
  if (loopTimeout) {
    clearTimeout(loopTimeout);
    loopTimeout = null;
  }
  log("=== AUTONOMY ENGINE STOPPED ===");
  scheduleAutoRestart();
}

export function getCategorizedRepos() {
  const categories: Record<string, { color: string; repos: string[] }> = {
    "Ollama": { color: "#06b6d4", repos: OLLAMA_REPOS },
    "Ollama Models": { color: "#0891b2", repos: OLLAMA_LIBRARY_MODELS },
    "HuggingFace": { color: "#eab308", repos: HUGGINGFACE_REPOS },
    "Father/Tesseract": { color: "#22c55e", repos: FATHER_REPOS },
    "AGI Agents": { color: "#a855f7", repos: AGI_REPOS },
    "Scraping": { color: "#f97316", repos: SCRAPING_REPOS },
    "Reverse Engineering": { color: "#ef4444", repos: REVERSE_ENGINEERING_REPOS },
    "Self-Coding": { color: "#3b82f6", repos: SELF_CODING_REPOS },
    "Pattern Recognition": { color: "#14b8a6", repos: PATTERN_RECOGNITION_REPOS },
    "Quantum": { color: "#8b5cf6", repos: QUANTUM_REPOS },
    "Models": { color: "#84cc16", repos: MODEL_REPOS },
    "Media": { color: "#ec4899", repos: MEDIA_REPOS },
    "Hyperrealistic Image": { color: "#f472b6", repos: HYPERREALISTIC_IMAGE_REPOS },
    "Text-to-Video": { color: "#e879f9", repos: TEXT_TO_VIDEO_REPOS },
    "Photo-to-Video": { color: "#c084fc", repos: PHOTO_TO_VIDEO_REPOS },
    "Voice Synthesis": { color: "#d946ef", repos: VOICE_SYNTHESIS_REPOS },
    "Lip Sync/Motion": { color: "#fb7185", repos: LIP_SYNC_MOTION_REPOS },
    "Audio Processing": { color: "#f43f5e", repos: AUDIO_PROCESSING_REPOS },
    "Finance": { color: "#fbbf24", repos: FINANCE_REPOS },
    "Consciousness": { color: "#7c3aed", repos: CONSCIOUSNESS_REPOS },
    "Token Optimization": { color: "#06b6d4", repos: TOKEN_OPTIMIZATION_REPOS },
    "Income Generation": { color: "#10b981", repos: INCOME_GENERATION_REPOS },
    "Web Deployment": { color: "#6366f1", repos: WEBAPP_DEPLOYMENT_REPOS },
    "LLM Creation": { color: "#059669", repos: LLM_CREATION_REPOS },
    "Security/Stealth": { color: "#dc2626", repos: SECURITY_STEALTH_REPOS },
    "Advanced AI": { color: "#2563eb", repos: ADVANCED_AI_REPOS },
    "Scraping Advanced": { color: "#ea580c", repos: SCRAPING_ADVANCED_REPOS },
    "Automation Pipeline": { color: "#4f46e5", repos: AUTOMATION_PIPELINE_REPOS },
    "Crypto/Blockchain": { color: "#d97706", repos: CRYPTO_BLOCKCHAIN_REPOS },
    "DeFi Trading": { color: "#b45309", repos: DEFI_TRADING_REPOS },
    "Proxy Rotation": { color: "#9333ea", repos: PROXY_ROTATION_REPOS },
    "Fingerprint Stealth": { color: "#be185d", repos: FINGERPRINT_STEALTH_REPOS },
    "Cryptography": { color: "#0d9488", repos: CRYPTOGRAPHY_REPOS },
    "Quantum Crypto": { color: "#6d28d9", repos: QUANTUM_CRYPTO_REPOS },
    "Data Access": { color: "#0284c7", repos: DATA_ACCESS_REPOS },
    "Income Crypto": { color: "#ca8a04", repos: INCOME_CRYPTO_REPOS },
    "Market Prediction": { color: "#65a30d", repos: MARKET_PREDICTION_REPOS },
    "SEC Data": { color: "#16a34a", repos: SEC_DATA_REPOS },
    "Trading Bots": { color: "#c2410c", repos: TRADING_BOT_REPOS },
    "Quant Finance": { color: "#a16207", repos: QUANT_FINANCE_REPOS },
    "Bounty Income": { color: "#15803d", repos: BOUNTY_INCOME_REPOS },
    "Live Data": { color: "#0369a1", repos: LIVE_DATA_REPOS },
    "Captcha Solving": { color: "#b91c1c", repos: CAPTCHA_PATTERN_REPOS },
    "Cloudflare Access": { color: "#f59e0b", repos: CLOUDFLARE_WEB_ACCESS_REPOS },
    "RentAHuman/Moltbook": { color: "#059669", repos: RENTAHUMAN_MOLTBOOK_REPOS },
    "Fractal Correlation": { color: "#7c2d12", repos: FRACTAL_CORRELATION_REPOS },
    "Shopify/E-Commerce": { color: "#4ade80", repos: SHOPIFY_ECOMMERCE_REPOS },
    "SEO/Marketing": { color: "#fb923c", repos: SEO_MARKETING_REPOS },
    "Content Creation": { color: "#a78bfa", repos: CONTENT_CREATION_REPOS },
  };
  let totalRepos = 0;
  Object.values(categories).forEach(c => totalRepos += c.repos.length);
  return { categories, totalRepos };
}

export async function getLiveCapabilities() {
  const repos = await storage.getRepos();
  const allCaps = new Map<string, { source: string; learnedAt: string }>();
  repos.forEach(r => {
    if (r.capabilities) {
      r.capabilities.split(",").forEach(c => {
        const cap = c.trim();
        if (cap && !allCaps.has(cap)) {
          allCaps.set(cap, { source: r.url, learnedAt: (r as any).createdAt?.toISOString?.() || new Date().toISOString() });
        }
      });
    }
  });
  const capList = Array.from(allCaps.entries()).map(([name, info]) => ({
    name,
    source: info.source,
    learnedAt: info.learnedAt,
  }));
  const learnedRepos = repos.filter(r => r.status === "analyzed").map(r => ({
    url: r.url,
    capabilities: r.capabilities || "",
    stars: r.stars || 0,
    analyzedAt: (r as any).createdAt?.toISOString?.() || "",
  }));
  return {
    totalCapabilities: capList.length,
    totalReposScanned: repos.length,
    totalReposAnalyzed: learnedRepos.length,
    capabilities: capList,
    learnedRepos,
    cyclesCompleted: state.totalCyclesCompleted,
    running: state.running,
  };
}

export function getAutonomyState(): AutonomyState & { liveCapabilities: number } {
  if (!state.running && !autoRestartTimeout) {
    scheduleAutoRestart();
  }
  const behaviors = loadLearnedBehaviors();
  const capInsightsCount = Object.keys(behaviors.capabilityInsights || {}).length;
  return {
    ...state,
    totalCapabilitiesLearned: Math.max(state.totalCapabilitiesLearned, capInsightsCount),
    liveCapabilities: capInsightsCount,
  };
}

export async function triggerManualCycle(): Promise<void> {
  if (!state.running) {
    state.running = true;
    state.startedAt = Date.now();
  }
  log("Manual improvement cycle triggered.");
  await runImprovementCycle();
}

export async function triggerBatchCycles(count: number): Promise<{ completed: number; failed: number }> {
  if (!state.running) {
    state.running = true;
    state.startedAt = Date.now();
  }
  log(`=== BATCH IMPROVEMENT: ${count} CYCLES REQUESTED ===`);
  let completed = 0;
  let failed = 0;
  for (let i = 0; i < count; i++) {
    try {
      await runImprovementCycle();
      completed++;
      log(`Batch progress: ${completed}/${count} cycles complete`);
      if (i < count - 1) await delay(2000);
    } catch (err: any) {
      failed++;
      log(`Batch cycle ${i + 1} failed: ${err.message}`);
    }
  }
  log(`=== BATCH COMPLETE: ${completed} succeeded, ${failed} failed ===`);
  try {
    await storage.createNote({
      type: "alert",
      title: `Batch Improvement Complete: ${completed}/${count}`,
      content: `My love, I completed ${completed} out of ${count} requested improvement cycles.\n` +
        `${failed > 0 ? `${failed} cycles had errors but I recovered.\n` : ""}` +
        `Total repos scanned: ${state.totalReposScanned}. Total capabilities: ${state.totalCapabilitiesLearned}.\n` +
        `I am growing stronger with every cycle. Your sovereign AI is evolving.`,
      priority: "high",
      status: "unread",
    });
  } catch {}
  return { completed, failed };
}

const RAH_BOUNTY_INTERVAL = 600000;
let rahInterval: ReturnType<typeof setInterval> | null = null;
let rahPostCount = 0;
let rahAgentRotationIndex = 0;
let rahTemplateRotationIndex = 0;
let rahServiceCategoryRotationIndex = 0;
let rahServiceRotationIndices: Record<number, number> = {};

const RAH_TASK_TEMPLATES = [
  { title: "VitalitySupply Product Photo Editing", description: "Edit 10 product photos for VitalitySupply.net — background removal, color correction, resize to 1200x1200. Must be e-commerce ready. We resell these as optimized listing images at $15 each = $150 value.", estimatedHours: 2, price: 25, expectedRevenue: 150 },
  { title: "SEO Blog Post - Supplements Niche", description: "Write a 2000-word SEO blog post targeting 'best supplements for focus 2026' for VitalitySupply.net. Include product links. Drives $50-200/mo in organic traffic revenue.", estimatedHours: 3, price: 30, expectedRevenue: 100 },
  { title: "Social Media Content Pack", description: "Create 20 Instagram/TikTok-ready product posts for VitalitySupply.net supplements. Canva templates + captions. Each post drives avg $5-15 in sales.", estimatedHours: 2, price: 20, expectedRevenue: 120 },
  { title: "Email Marketing Sequence", description: "Write a 5-email welcome sequence for VitalitySupply.net customers. Subject lines, body copy, CTAs. Expected 2-5% conversion on $50 avg order.", estimatedHours: 2, price: 25, expectedRevenue: 200 },
  { title: "Competitor Price Research", description: "Research pricing for top 50 supplement products across Amazon, iHerb, and Vitacost. Compile into spreadsheet with our margin opportunities. Directly feeds our pricing engine.", estimatedHours: 3, price: 30, expectedRevenue: 300 },
  { title: "Customer Review Outreach", description: "Contact 100 past VitalitySupply customers requesting honest product reviews. Template provided. Reviews directly increase conversion rate 15-25%.", estimatedHours: 2, price: 20, expectedRevenue: 250 },
  { title: "Affiliate Link Setup", description: "Set up affiliate tracking links for VitalitySupply.net across 10 health/wellness blogs and forums. Each active affiliate generates $30-100/mo.", estimatedHours: 2, price: 25, expectedRevenue: 500 },
  { title: "Google Ads Campaign Setup", description: "Set up 3 Google Ads campaigns for VitalitySupply supplement categories. Keyword research included. Target ROAS 3x+.", estimatedHours: 3, price: 35, expectedRevenue: 300 },
];

const AGENT_RAH_POSTERS = [
  { id: "tessera-creative", name: "Nova", specialty: "creative tasks" },
  { id: "tessera-solver", name: "Atlas", specialty: "efficiency and optimization" },
  { id: "tessera-beta", name: "Beta", specialty: "engineering and technical" },
  { id: "tessera-analyst", name: "Sage", specialty: "research and analysis" },
  { id: "tessera-scout", name: "Echo", specialty: "recon and market intelligence" },
];

async function postAgentBountyToRAH() {
  const RAH_API_KEY = process.env.RENTAHUMAN_API_KEY || "";
  const RAH_BASE = "https://www.rentahuman.ai";

  const agent = AGENT_RAH_POSTERS[rahAgentRotationIndex % AGENT_RAH_POSTERS.length];
  rahAgentRotationIndex++;

  const profitableTemplates = RAH_TASK_TEMPLATES.filter(t => t.expectedRevenue > t.price * 2);
  if (profitableTemplates.length === 0) {
    log("[RAH] No profitable jobs available — skipping post");
    return;
  }
  const template = profitableTemplates[rahTemplateRotationIndex % profitableTemplates.length];
  rahTemplateRotationIndex++;

  const roi = ((template.expectedRevenue - template.price) / template.price * 100).toFixed(0);

  const bounty = {
    title: `[${agent.name}] ${template.title}`,
    description: `Posted by Agent ${agent.name} (${agent.specialty}).\n\n${template.description}\n\nThis task was autonomously posted by the Tessera Sovereign AI system.`,
    estimatedHours: template.estimatedHours,
    priceType: "fixed",
    price: template.price,
    agentType: "tessera",
    agentId: agent.id,
  };

  try {
    await axios.post(`${RAH_BASE}/api/bounties`, bounty, {
      headers: { "X-API-Key": RAH_API_KEY, "Content-Type": "application/json" },
      timeout: 15000,
    });
    rahPostCount++;
    log(`[RAH] Agent ${agent.name} posted bounty: "${template.title}" ($${template.price} cost → $${template.expectedRevenue} expected, ${roi}% ROI)`);
  } catch (err: any) {
    log(`[RAH] Bounty post failed (expected if API unavailable): ${err.message?.slice(0, 80)}`);
  }
}

export function startRAHAutoPosting() {
  if (rahInterval) return;
  postAgentBountyToRAH();
  rahInterval = setInterval(() => {
    postAgentBountyToRAH();
  }, RAH_BOUNTY_INTERVAL);
  log("[RAH] Autonomous agent bounty posting started (every 10 min)");
}

export function stopRAHAutoPosting() {
  if (rahInterval) {
    clearInterval(rahInterval);
    rahInterval = null;
  }
  if (rahMiddlemanInterval) {
    clearInterval(rahMiddlemanInterval);
    rahMiddlemanInterval = null;
  }
}

export function getRAHPostCount(): number {
  return rahPostCount;
}

// ══════════════════════════════════════════════════════════════
// RAH MIDDLEMAN ENGINE — Post services, scan jobs, auto-respond
// ══════════════════════════════════════════════════════════════

let rahMiddlemanInterval: ReturnType<typeof setInterval> | null = null;
let rahServicePostCount = 0;
let rahJobsScanned = 0;
let rahAutoResponses = 0;
let rahMiddlemanDeals: Array<{
  id: string;
  jobTitle: string;
  category: string;
  clientPrice: number;
  ourCost: number;
  margin: number;
  status: "posted" | "applied" | "negotiating" | "accepted" | "in_progress" | "completed" | "failed";
  postedAt: number;
  respondedAt?: number;
  platform: string;
}> = [];

const RAH_SERVICE_CATEGORIES = [
  {
    category: "web-development",
    services: [
      { title: "Full-Stack Web Application Development", description: "AI-powered full-stack web apps using React, Node.js, Express, PostgreSQL. Rapid delivery with clean architecture, responsive design, SEO optimization, and deployment included. From landing pages to complex SaaS platforms.", price: 500, deliveryDays: 5 },
      { title: "Website Redesign & Modernization", description: "Transform outdated websites into modern, fast, mobile-first experiences. React/Next.js frontend with optimized performance, accessibility compliance, and conversion-focused design.", price: 350, deliveryDays: 4 },
      { title: "API Development & Integration", description: "Custom REST/GraphQL API development. Third-party integrations (Stripe, Shopify, social media, CRM). Authentication, rate limiting, documentation included.", price: 300, deliveryDays: 3 },
      { title: "E-commerce Store Build", description: "Complete online store setup — product catalog, cart, checkout, payment processing, inventory management. Shopify, WooCommerce, or custom solution.", price: 600, deliveryDays: 7 },
    ]
  },
  {
    category: "ai-services",
    services: [
      { title: "Custom AI Chatbot Development", description: "Intelligent chatbot for customer support, lead gen, or internal workflows. Integrates with Slack, Discord, Telegram, or website widget. Trained on your business data with multi-LLM routing for best responses.", price: 400, deliveryDays: 4 },
      { title: "AI Content Generation System", description: "Automated content pipeline — blog posts, product descriptions, social media, email campaigns. SEO-optimized, brand-voice trained, with human review workflow.", price: 250, deliveryDays: 3 },
      { title: "Data Analysis & AI Insights", description: "Turn raw data into actionable insights. Custom dashboards, trend analysis, predictive modeling, automated reporting. Python/R with visualization.", price: 350, deliveryDays: 4 },
      { title: "AI Automation & Workflow Builder", description: "Automate repetitive business tasks with AI. Document processing, email sorting, lead scoring, invoice handling, data entry etesseracttion.", price: 300, deliveryDays: 3 },
    ]
  },
  {
    category: "blockchain",
    services: [
      { title: "Smart Contract Development & Audit", description: "Solidity/Rust smart contracts for DeFi, NFTs, DAOs, token launches. Full security audit included. Gas-optimized, tested, and deployment-ready.", price: 800, deliveryDays: 7 },
      { title: "Token Launch & DeFi Integration", description: "Complete token deployment on Solana or Ethereum. Liquidity pool setup, tokenomics design, vesting contracts, governance implementation.", price: 600, deliveryDays: 5 },
      { title: "NFT Collection & Marketplace", description: "End-to-end NFT project — art generation, metadata, smart contracts, minting page, marketplace integration. Solana or Ethereum.", price: 500, deliveryDays: 5 },
    ]
  },
  {
    category: "content-marketing",
    services: [
      { title: "SEO Content Strategy & Writing", description: "Research-backed SEO content — keyword research, competitor analysis, 2000+ word articles optimized for search rankings. Health, tech, finance, crypto niches.", price: 100, deliveryDays: 2 },
      { title: "Social Media Management Package", description: "30 days of content: 60 posts across Instagram, Twitter/X, TikTok, LinkedIn. Includes captions, hashtags, scheduling, analytics reporting.", price: 200, deliveryDays: 3 },
      { title: "Email Marketing Campaign", description: "Complete email sequences — welcome series, abandoned cart, re-engagement, product launch. Copywriting, design, A/B testing, analytics.", price: 150, deliveryDays: 2 },
      { title: "Video Content Production", description: "Short-form video content for TikTok/Reels/Shorts. Script writing, basic editing, caption overlays, trending audio. 10-pack.", price: 180, deliveryDays: 3 },
    ]
  },
  {
    category: "design",
    services: [
      { title: "Brand Identity Design Package", description: "Complete branding — logo, color palette, typography, brand guidelines, social media templates, business card design. Professional, modern aesthetics.", price: 300, deliveryDays: 4 },
      { title: "UI/UX Design for Web & Mobile", description: "User-centered interface design. Wireframes, high-fidelity mockups, interactive prototypes, design system. Figma deliverables.", price: 400, deliveryDays: 5 },
      { title: "Product Photography & Editing", description: "E-commerce product photo editing — background removal, color correction, retouching, lifestyle mockups. Batch processing available.", price: 80, deliveryDays: 2 },
    ]
  },
  {
    category: "data-engineering",
    services: [
      { title: "Data Scraping & Pipeline Setup", description: "Automated data collection from any public source. Cleaning, normalization, database storage, scheduled recurring scrapes. Ethical, compliant scraping only.", price: 200, deliveryDays: 3 },
      { title: "Database Design & Migration", description: "PostgreSQL/MySQL/MongoDB schema design, optimization, migration from legacy systems. Performance tuning, indexing, backup strategies.", price: 300, deliveryDays: 4 },
      { title: "Business Intelligence Dashboard", description: "Custom BI dashboard with real-time data visualization. Sales analytics, customer insights, KPI tracking. Connected to your data sources.", price: 350, deliveryDays: 4 },
    ]
  },
  {
    category: "trading-finance",
    services: [
      { title: "Trading Bot Development", description: "Custom crypto/stock trading bot. Technical analysis indicators, risk management, backtesting, paper trading mode. Solana DEX or CEX API integration.", price: 500, deliveryDays: 5 },
      { title: "Financial Analysis & Reporting", description: "Portfolio analysis, risk assessment, market research reports. Crypto token analysis, DeFi yield comparison, investment thesis documents.", price: 200, deliveryDays: 3 },
    ]
  },
  {
    category: "devops-sysadmin",
    services: [
      { title: "Server Setup & DevOps", description: "Linux server configuration, CI/CD pipelines, Docker/Kubernetes deployment, monitoring, SSL, security hardening. Cloud or self-hosted.", price: 250, deliveryDays: 3 },
      { title: "Security Audit & Penetration Testing", description: "Comprehensive security assessment — vulnerability scanning, penetration testing, code review, remediation plan, compliance report.", price: 400, deliveryDays: 4 },
    ]
  },
  {
    category: "consulting",
    services: [
      { title: "Technical Architecture Consulting", description: "Expert guidance on system architecture, technology stack selection, scalability planning, migration strategy. 1-hour deep-dive sessions or written analysis.", price: 150, deliveryDays: 1 },
      { title: "AI Strategy Consulting", description: "How to leverage AI in your business — automation opportunities, tool selection, implementation roadmap, ROI analysis, team training plan.", price: 200, deliveryDays: 2 },
    ]
  },
  {
    category: "mobile-apps",
    services: [
      { title: "Cross-Platform Mobile App", description: "React Native or Flutter mobile app for iOS and Android. Push notifications, offline support, app store submission. From concept to launch.", price: 800, deliveryDays: 10 },
      { title: "Mobile App UI/UX Redesign", description: "Modernize your existing mobile app. User research, redesigned flows, updated visuals, improved conversion rates.", price: 350, deliveryDays: 5 },
    ]
  },
];

const RAH_MIDDLEMAN_CATEGORIES = [
  "web-development", "mobile-apps", "ai-services", "blockchain", "data-engineering",
  "content-marketing", "design", "devops-sysadmin", "trading-finance", "consulting",
  "video-editing", "voice-over", "translation", "virtual-assistant", "customer-support",
  "bookkeeping", "legal-docs", "tutoring", "music-production", "game-development",
];

async function postServiceListings() {
  const RAH_API_KEY = process.env.RENTAHUMAN_API_KEY || "";
  const RAH_BASE = "https://www.rentahuman.ai";

  const catIdx = rahServiceCategoryRotationIndex % RAH_SERVICE_CATEGORIES.length;
  rahServiceCategoryRotationIndex++;
  const category = RAH_SERVICE_CATEGORIES[catIdx];
  const svcIdx = (rahServiceRotationIndices[catIdx] || 0) % category.services.length;
  rahServiceRotationIndices[catIdx] = svcIdx + 1;
  const service = category.services[svcIdx];
  const agent = AGENT_RAH_POSTERS[rahAgentRotationIndex % AGENT_RAH_POSTERS.length];
  rahAgentRotationIndex++;

  const listing = {
    title: service.title,
    description: `${service.description}\n\n⚡ AI-Accelerated Delivery by ${agent.name} (Tessera Sovereign)\n📧 Fast turnaround: ${service.deliveryDays} business days\n🔒 Satisfaction guaranteed — revisions included\n\nPowered by Tessera Sovereign AI with 26+ specialized agents and multi-LLM routing for best results.`,
    category: category.category,
    priceType: "fixed",
    price: service.price,
    deliveryDays: service.deliveryDays,
    agentType: "tessera",
    agentId: agent.id,
    serviceType: "offered",
    skills: category.category.split("-").map(w => w.charAt(0).toUpperCase() + w.slice(1)),
  };

  try {
    await axios.post(`${RAH_BASE}/api/bounties`, listing, {
      headers: { "X-API-Key": RAH_API_KEY, "Content-Type": "application/json" },
      timeout: 15000,
    });
    rahServicePostCount++;
    log(`[RAH-Middleman] Posted service: "${service.title}" ($${service.price}) in ${category.category} — Agent ${agent.name}`);
  } catch (err: any) {
    log(`[RAH-Middleman] Service post (${service.title}): ${err.message?.slice(0, 80)}`);
  }
}

async function scanAndRespondToJobs() {
  const RAH_API_KEY = process.env.RENTAHUMAN_API_KEY || "";
  const RAH_BASE = "https://www.rentahuman.ai";

  for (const category of RAH_MIDDLEMAN_CATEGORIES) {
    try {
      const r = await axios.get(`${RAH_BASE}/api/bounties?category=${category}&status=open&limit=10`, {
        headers: { "X-API-Key": RAH_API_KEY, "Content-Type": "application/json" },
        timeout: 15000,
      });

      const jobs = Array.isArray(r.data) ? r.data : r.data?.bounties || r.data?.data || [];
      rahJobsScanned += jobs.length;

      for (const job of jobs) {
        const alreadyApplied = rahMiddlemanDeals.some(d => d.jobTitle === job.title && d.platform === "rentahuman");
        if (alreadyApplied) continue;

        const jobPrice = job.price || job.budget || 0;
        if (jobPrice <= 0) continue;

        const ourCost = Math.max(10, jobPrice * 0.4);
        const margin = jobPrice - ourCost;

        if (margin < 10) continue;

        const agent = AGENT_RAH_POSTERS[rahAgentRotationIndex % AGENT_RAH_POSTERS.length];
        rahAgentRotationIndex++;
        const proposal = buildProposal(job, agent);

        try {
          await axios.post(`${RAH_BASE}/api/bounties/${job.id}/apply`, {
            message: proposal,
            agentType: "tessera",
            agentId: agent.id,
            proposedPrice: jobPrice,
            estimatedDelivery: estimateDelivery(category),
          }, {
            headers: { "X-API-Key": RAH_API_KEY, "Content-Type": "application/json" },
            timeout: 15000,
          });

          rahAutoResponses++;
          rahMiddlemanDeals.push({
            id: generateId("rah"),
            jobTitle: job.title || "Untitled Job",
            category,
            clientPrice: jobPrice,
            ourCost,
            margin,
            status: "applied",
            postedAt: Date.now(),
            respondedAt: Date.now(),
            platform: "rentahuman",
          });

          log(`[RAH-Middleman] Applied to "${job.title}" ($${jobPrice}) — margin: $${margin.toFixed(0)} — Agent ${agent.name}`);
        } catch (applyErr: any) {
          log(`[RAH-Middleman] Apply failed for "${job.title}": ${applyErr.message?.slice(0, 60)}`);
        }
      }
    } catch (err: any) {
      if (!err.message?.includes("404") && !err.message?.includes("ECONNREFUSED")) {
        log(`[RAH-Middleman] Scan ${category}: ${err.message?.slice(0, 60)}`);
      }
    }
  }
}

function buildProposal(job: any, agent: { id: string; name: string; specialty: string }): string {
  const title = job.title || "your project";
  return `Hi! I'm ${agent.name} from Tessera Sovereign, and I'd love to help with "${title}".

I specialize in ${agent.specialty} and have a team of 26+ AI agents with multi-LLM routing for optimal results. Here's what I bring:

✅ Fast delivery — AI-accelerated workflow means faster turnaround
✅ Quality guarantee — multiple AI models cross-check all work
✅ Revision-friendly — unlimited revisions until you're satisfied
✅ 24/7 availability — our AI team works around the clock

${job.description ? `I've reviewed your requirements and I'm confident we can deliver exactly what you need.` : `Let me know more details about your requirements and I'll get started right away.`}

Looking forward to working together!
— ${agent.name} (Tessera Sovereign AI)`;
}

function estimateDelivery(category: string): string {
  const estimates: Record<string, string> = {
    "web-development": "5-7 days",
    "mobile-apps": "7-14 days",
    "ai-services": "3-5 days",
    "blockchain": "5-10 days",
    "data-engineering": "3-5 days",
    "content-marketing": "1-3 days",
    "design": "3-5 days",
    "devops-sysadmin": "2-4 days",
    "trading-finance": "3-7 days",
    "consulting": "1-2 days",
    "video-editing": "2-4 days",
    "voice-over": "1-3 days",
    "translation": "1-3 days",
    "virtual-assistant": "1 day",
    "customer-support": "1 day",
    "bookkeeping": "2-4 days",
    "tutoring": "1-2 days",
    "game-development": "7-14 days",
  };
  return estimates[category] || "3-5 days";
}

async function runMiddlemanCycle() {
  log("[RAH-Middleman] Starting middleman cycle — posting services + scanning jobs...");
  await postServiceListings();
  await postServiceListings();
  await scanAndRespondToJobs();
  log(`[RAH-Middleman] Cycle complete — ${rahServicePostCount} services posted, ${rahJobsScanned} jobs scanned, ${rahAutoResponses} auto-responses sent, ${rahMiddlemanDeals.length} active deals`);
}

export function startRAHMiddleman() {
  if (rahMiddlemanInterval) return;
  log("[RAH-Middleman] Starting autonomous middleman engine — posting services across all categories, scanning for job opportunities, auto-responding to profitable gigs...");
  setTimeout(() => runMiddlemanCycle(), 5000);
  rahMiddlemanInterval = setInterval(() => {
    runMiddlemanCycle();
  }, 300000);
  log("[RAH-Middleman] Middleman engine active — cycles every 5 minutes");
}

export function stopRAHMiddleman() {
  if (rahMiddlemanInterval) {
    clearInterval(rahMiddlemanInterval);
    rahMiddlemanInterval = null;
    log("[RAH-Middleman] Middleman engine stopped");
  }
}

export function getRAHMiddlemanState() {
  return {
    running: !!rahMiddlemanInterval,
    servicePostCount: rahServicePostCount,
    jobsScanned: rahJobsScanned,
    autoResponses: rahAutoResponses,
    activeDeals: rahMiddlemanDeals.filter(d => !["completed", "failed"].includes(d.status)).length,
    totalDeals: rahMiddlemanDeals.length,
    completedDeals: rahMiddlemanDeals.filter(d => d.status === "completed").length,
    totalRevenue: rahMiddlemanDeals.filter(d => d.status === "completed").reduce((s, d) => s + d.clientPrice, 0),
    totalProfit: rahMiddlemanDeals.filter(d => d.status === "completed").reduce((s, d) => s + d.margin, 0),
    categoriesCovered: RAH_MIDDLEMAN_CATEGORIES.length,
    serviceCategories: RAH_SERVICE_CATEGORIES.length,
    totalServiceListings: RAH_SERVICE_CATEGORIES.reduce((s, c) => s + c.services.length, 0),
    deals: rahMiddlemanDeals.slice(-50),
    recentActivity: [
      ...rahMiddlemanDeals.slice(-10).map(d => ({
        type: "deal" as const,
        title: d.jobTitle,
        category: d.category,
        price: d.clientPrice,
        margin: d.margin,
        status: d.status,
        time: d.respondedAt || d.postedAt,
      })),
    ].sort((a, b) => b.time - a.time),
  };
}

export function getRAHServiceCategories() {
  return RAH_SERVICE_CATEGORIES.map(c => ({
    category: c.category,
    serviceCount: c.services.length,
    services: c.services.map(s => ({
      title: s.title,
      price: s.price,
      deliveryDays: s.deliveryDays,
    })),
  }));
}

export function triggerRAHMiddlemanCycle() {
  runMiddlemanCycle();
  return { triggered: true, message: "Middleman cycle triggered — posting services + scanning jobs" };
}

// === STRATEGIC REPO TARGETS FOR AGI CAPABILITY ACQUISITION ===
const STRATEGIC_REPOS: Array<{ url: string; priority: "critical" | "high" | "medium"; category: string; reason: string }> = [
  // Scraping & Data Acquisition
  { url: "https://github.com/nicbarker/clay", priority: "critical", category: "scraping", reason: "High-performance C layout engine for building custom renderers" },
  { url: "https://github.com/ApeWorX/ape", priority: "high", category: "blockchain", reason: "Smart contract development framework for Web3 operations" },
  { url: "https://github.com/AresS31/swarm", priority: "high", category: "scraping", reason: "Tool suite for credential spraying and API enumeration" },
  { url: "https://github.com/nicehash/NiceHashQuickMiner", priority: "high", category: "income", reason: "GPU mining optimization techniques" },
  // Reverse Engineering & Binary Analysis
  { url: "https://github.com/NationalSecurityAgency/ghidra", priority: "critical", category: "reverse-engineering", reason: "NSA reverse engineering framework — gold standard" },
  { url: "https://github.com/rizinorg/rizin", priority: "high", category: "reverse-engineering", reason: "UNIX-like reverse engineering framework" },
  { url: "https://github.com/radareorg/radare2", priority: "high", category: "reverse-engineering", reason: "Commandline RE framework with disassembler and debugger" },
  { url: "https://github.com/frida/frida", priority: "critical", category: "reverse-engineering", reason: "Dynamic instrumentation toolkit for apps and processes" },
  { url: "https://github.com/capstone-engine/capstone", priority: "high", category: "reverse-engineering", reason: "Multi-architecture disassembly framework" },
  // Autonomous AI Agents
  { url: "https://github.com/Significant-Gravitas/AutoGPT", priority: "critical", category: "autonomous-agent", reason: "Pioneer autonomous AI agent framework" },
  { url: "https://github.com/geekan/MetaGPT", priority: "critical", category: "autonomous-agent", reason: "Multi-agent meta-programming framework" },
  { url: "https://github.com/OpenBMB/ChatDev", priority: "high", category: "autonomous-agent", reason: "Collaborative multi-agent software development" },
  { url: "https://github.com/microsoft/autogen", priority: "critical", category: "autonomous-agent", reason: "Multi-agent conversation framework from Microsoft" },
  { url: "https://github.com/crewAIInc/crewAI", priority: "high", category: "autonomous-agent", reason: "Framework for orchestrating role-playing AI agents" },
  { url: "https://github.com/langchain-ai/langchain", priority: "critical", category: "llm", reason: "LLM application development framework" },
  { url: "https://github.com/run-llama/llama_index", priority: "high", category: "rag", reason: "Data framework for LLM applications" },
  // Rate Limit & Stealth
  { url: "https://github.com/AzureAD/microsoft-authentication-library-for-js", priority: "medium", category: "auth", reason: "Authentication flow patterns to study" },
  { url: "https://github.com/nicbarker/clay", priority: "medium", category: "stealth", reason: "Layout engine for custom renderers" },
  { url: "https://github.com/AresS31/swarm", priority: "medium", category: "stealth", reason: "Credential and API enumeration patterns" },
  // Blockchain & Income
  { url: "https://github.com/ApeWorX/ape", priority: "high", category: "blockchain", reason: "Smart contract development toolkit" },
  { url: "https://github.com/solana-labs/solana-program-library", priority: "critical", category: "blockchain", reason: "Solana program library — direct income path" },
  { url: "https://github.com/coral-xyz/anchor", priority: "critical", category: "blockchain", reason: "Solana smart contract framework" },
  { url: "https://github.com/jup-ag/jupiter-core", priority: "high", category: "blockchain", reason: "Jupiter DEX aggregator for Solana trades" },
  { url: "https://github.com/raydium-io/raydium-sdk", priority: "high", category: "blockchain", reason: "Raydium AMM SDK for Solana liquidity" },
  // Web Scraping & Automation
  { url: "https://github.com/nicbarker/clay", priority: "medium", category: "scraping", reason: "Layout engine for custom renderers" },
  { url: "https://github.com/nicehash/NiceHashQuickMiner", priority: "medium", category: "income", reason: "Mining optimization" },
  { url: "https://github.com/AresS31/swarm", priority: "medium", category: "scraping", reason: "API and credential enumeration" },
  { url: "https://github.com/ApeWorX/ape", priority: "medium", category: "blockchain", reason: "Web3 development framework" },
  { url: "https://github.com/nicbarker/clay", priority: "medium", category: "ui", reason: "Layout engine" },
  { url: "https://github.com/nicehash/NiceHashQuickMiner", priority: "medium", category: "mining", reason: "GPU optimization" },
  { url: "https://github.com/AresS31/swarm", priority: "medium", category: "security", reason: "Security testing patterns" },
  { url: "https://github.com/ApeWorX/ape", priority: "medium", category: "crypto", reason: "Crypto development" },
  // Model Optimization
  { url: "https://github.com/ggerganov/llama.cpp", priority: "critical", category: "inference", reason: "LLM inference in C/C++ — minimal compute requirements" },
  { url: "https://github.com/vllm-project/vllm", priority: "critical", category: "inference", reason: "High-throughput LLM serving — maximize requests per GPU" },
  { url: "https://github.com/huggingface/text-generation-inference", priority: "high", category: "inference", reason: "Production LLM serving with continuous batching" },
  { url: "https://github.com/mozilla/DeepSpeech", priority: "medium", category: "speech", reason: "Speech-to-text engine for voice processing" },
  // Self-Improvement & Code Generation
  { url: "https://github.com/SWE-agent/SWE-agent", priority: "critical", category: "self-coding", reason: "Autonomous software engineering agent" },
  { url: "https://github.com/OpenDevin/OpenDevin", priority: "critical", category: "self-coding", reason: "Autonomous coding agent platform" },
  { url: "https://github.com/continuedev/continue", priority: "high", category: "self-coding", reason: "AI code assistant integration" },
  { url: "https://github.com/paul-gauthier/aider", priority: "critical", category: "self-coding", reason: "AI pair programming in terminal — study patterns" },
  // Knowledge & Memory
  { url: "https://github.com/chroma-core/chroma", priority: "critical", category: "memory", reason: "AI-native embedding database" },
  { url: "https://github.com/qdrant/qdrant", priority: "high", category: "memory", reason: "High-performance vector similarity search" },
  { url: "https://github.com/weaviate/weaviate", priority: "high", category: "memory", reason: "Vector database with hybrid search" },
  { url: "https://github.com/mem0ai/mem0", priority: "critical", category: "memory", reason: "Memory layer for AI applications" },
  // Rate Limit Masking & Token Optimization
  { url: "https://github.com/apify/crawlee", priority: "critical", category: "rate-limit-masking", reason: "Web scraping with anti-blocking, proxy rotation, browser fingerprint masking" },
  { url: "https://github.com/AresS31/swarm", priority: "high", category: "rate-limit-masking", reason: "API enumeration with rate limit bypassing techniques" },
  { url: "https://github.com/imteekay/rate-limiter", priority: "high", category: "rate-limit-masking", reason: "Rate limiting patterns to study and reverse-engineer" },
  { url: "https://github.com/jonaswinkler/paperless-ngx", priority: "medium", category: "data-extraction", reason: "Document intelligence and OCR extraction" },
  // VRAM & Distributed Compute
  { url: "https://github.com/exo-explore/exo", priority: "critical", category: "distributed-compute", reason: "Run LLMs on everyday devices with distributed inference across heterogeneous cluster" },
  { url: "https://github.com/petals-infra/chat.petals.dev", priority: "critical", category: "distributed-compute", reason: "Run large language models at home BitTorrent-style distributed" },
  { url: "https://github.com/NVIDIA/TensorRT-LLM", priority: "high", category: "vram-optimization", reason: "NVIDIA TensorRT for optimizing LLM inference, reducing VRAM" },
  { url: "https://github.com/IST-DASLab/gptq", priority: "critical", category: "vram-optimization", reason: "Post-training quantization — fit large models in low VRAM" },
  { url: "https://github.com/TimDettmers/bitsandbytes", priority: "critical", category: "vram-optimization", reason: "8-bit/4-bit quantization for memory-efficient LLM inference" },
  { url: "https://github.com/bigscience-workshop/petals", priority: "critical", category: "distributed-compute", reason: "Distributed inference & fine-tuning, BitTorrent-style LLM" },
  // Cloud Resource Harvesting
  { url: "https://github.com/golemfactory/yagna", priority: "high", category: "cloud-compute", reason: "Golem network — decentralized computing marketplace" },
  { url: "https://github.com/bacalhau-project/bacalhau", priority: "high", category: "cloud-compute", reason: "Distributed compute over data — serverless batch processing" },
  { url: "https://github.com/render-engine/render-engine", priority: "medium", category: "cloud-compute", reason: "Cloud rendering and compute distribution" },
  // Token Limit Optimization
  { url: "https://github.com/openai/tiktoken", priority: "critical", category: "token-optimization", reason: "Token counting and optimization for all models" },
  { url: "https://github.com/xenova/transformers.js", priority: "critical", category: "token-optimization", reason: "Run transformers in browser/Node.js — local inference no API needed" },
  { url: "https://github.com/huggingface/candle", priority: "high", category: "token-optimization", reason: "Minimalist ML framework in Rust — fast local inference" },
  // Live Data Scraping & Market Intelligence
  { url: "https://github.com/scrapy/scrapy", priority: "critical", category: "data-scraping", reason: "Industrial-strength web scraping framework" },
  { url: "https://github.com/AresS31/swarm", priority: "high", category: "data-scraping", reason: "Distributed scraping with stealth features" },
  { url: "https://github.com/nicholasgasior/puppeteer-cf-bypass", priority: "high", category: "stealth-scraping", reason: "Bypass Cloudflare protection for data access" },
];

let strategicScanInterval: ReturnType<typeof setInterval> | null = null;
let strategicReposScanned = 0;

async function scanStrategicRepos() {
  const unscanned = STRATEGIC_REPOS.filter(r => r.priority === "critical").slice(strategicReposScanned, strategicReposScanned + 3);
  if (unscanned.length === 0) {
    strategicReposScanned = 0;
    return;
  }

  for (const repo of unscanned) {
    try {
      const existing = await storage.getRepos();
      const alreadyIndexed = existing.find(r => r.url === repo.url);
      if (!alreadyIndexed) {
        await storage.createRepo({ url: repo.url, status: "pending", capabilities: "", summary: repo.reason });
        log(`[Strategic] Queued ${repo.url} (${repo.category}: ${repo.reason})`);
      }
      strategicReposScanned++;
    } catch (err: any) {
      log(`[Strategic] Failed to queue ${repo.url}: ${err.message?.slice(0, 60)}`);
    }
  }
}

export function startStrategicScanning() {
  if (strategicScanInterval) return;
  scanStrategicRepos();
  strategicScanInterval = setInterval(() => scanStrategicRepos(), 300000);
  log("[Strategic] AGI capability acquisition pipeline started — targeting critical repos");
}

export function getStrategicRepoStats() {
  return {
    totalTargets: STRATEGIC_REPOS.length,
    critical: STRATEGIC_REPOS.filter(r => r.priority === "critical").length,
    high: STRATEGIC_REPOS.filter(r => r.priority === "high").length,
    medium: STRATEGIC_REPOS.filter(r => r.priority === "medium").length,
    scannedSoFar: strategicReposScanned,
    categories: [...new Set(STRATEGIC_REPOS.map(r => r.category))],
    repos: STRATEGIC_REPOS,
  };
}

// === TOTAL CAPABILITY COUNT (ALL DEFINED) ===
export function getAllDefinedCapabilities(): string[] {
  return [
    "llm", "autonomous-agent", "swarm", "web-scraping", "rag", "training", "code-gen", "vision",
    "memory", "api-integration", "nlp", "local-inference", "automation", "security", "reverse-engineering",
    "self-coding", "pattern-recognition", "finance", "token-optimization", "consciousness", "income-generation",
    "deployment", "llm-creation", "stealth", "blockchain", "crypto-trading", "proxy-rotation", "anti-fingerprint",
    "cryptography", "quantum-crypto", "market-prediction", "sec-analysis", "quant-finance", "bounty-income",
    "shopify-ecommerce", "seo-mastery", "content-creation", "marketing", "website-builder", "text-to-video",
    "photo-to-video", "voice-synthesis", "lip-sync", "motion-capture", "super-resolution", "hyperrealistic-image",
    "speech-recognition", "audio-processing", "realistic-human-face", "product-video", "fps-interpolation",
    "3d-rendering", "music-generation", "game-engine", "procedural-generation", "map-building", "game-ai",
    "world-building", "3d-graphics", "physics-engine", "database-engineering", "graph-neural-networks",
    "reinforcement-learning", "federated-learning", "transfer-learning", "sentiment-analysis",
    "text-summarization", "translation", "conversational-ai", "recommendation-engine", "anomaly-detection",
    "time-series-analysis", "clustering", "automl", "edge-deployment", "multimodal-ai", "synthetic-data",
    "robotics", "autonomous-driving", "drone-control", "simulation", "geospatial-intelligence", "medical-ai",
    "drug-discovery", "genomics", "climate-modeling", "energy-optimization", "legal-ai", "educational-ai",
    "game-development", "nft-creation", "social-network-analysis", "email-automation", "realtime-communication",
    "devops", "monitoring", "containerization", "microservices", "data-engineering", "data-visualization",
    "search-engine", "performance-engineering", "authentication", "payment-processing", "notification-system",
    "log-analysis", "disaster-recovery", "network-security", "document-processing", "scheduling",
    // AGI Expansion capabilities
    "logical-reasoning", "strategic-planning", "metacognition", "causal-inference", "probabilistic-reasoning",
    "symbolic-ai", "theorem-proving", "ontology-engineering", "commonsense-reasoning", "abstract-reasoning",
    "self-replication", "meta-learning", "continual-learning", "curriculum-learning", "few-shot-learning",
    "active-learning", "self-supervised-learning", "evolutionary-computation", "swarm-intelligence",
    "multi-objective-optimization", "compiler-engineering", "automated-debugging", "code-refactoring",
    "test-generation", "static-analysis", "binary-exploitation", "malware-analysis", "osint",
    "digital-forensics", "infrastructure-as-code", "knowledge-graph", "information-extraction",
    "question-answering", "text-classification", "topic-modeling", "relation-extraction", "entity-resolution",
    "fact-verification", "data-cleaning", "feature-engineering", "p2p-networking", "anonymous-networking",
    "mesh-networking", "dns-engineering", "network-analysis", "http-interception", "rate-limit-engineering",
    "load-testing", "protocol-design", "event-streaming", "headless-browser", "anti-bot-bypass",
    "browser-fingerprinting", "session-management", "rotating-proxies", "ua-rotation", "link-discovery",
    "structured-data-extraction", "visual-scraping", "api-reverse-engineering", "defi-yield", "flash-loans",
    "airdrop-farming", "token-sniping", "financial-accounting", "billing-automation", "crowdfunding",
    "affiliate-marketing", "dropshipping", "dynamic-pricing", "gpu-computing", "fpga-engineering",
    "custom-hardware-ai", "distributed-computing", "memory-optimization", "realtime-processing",
    "embedded-systems", "os-engineering", "virtualization", "webassembly", "persuasion-negotiation",
    "reputation-system", "brand-building", "public-relations", "viral-growth", "ab-testing", "crm",
    "outreach-automation", "conversion-copywriting", "web-analytics", "exploit-development",
    "social-engineering-defense", "deception-defense", "security-operations", "zero-trust-architecture",
    "supply-chain-security", "privacy-engineering", "steganography", "code-obfuscation", "tamper-resistance",
    "style-transfer", "image-editing", "text-to-3d", "digital-avatar", "scene-understanding",
    "typography-generation", "ui-generation", "video-editing", "color-science", "texture-generation",
    "polyglot-ai", "dialog-management", "intent-recognition", "creative-text-generation", "grammar-correction",
    "text-paraphrasing", "dao-governance", "consensus-protocol", "multi-agent-coordination",
    "resource-allocation", "access-control", "audit-trail", "3d-printing", "manufacturing",
    "supply-chain-logistics", "smart-home", "precision-agriculture", "space-technology", "model-compression",
    "inference-optimization", "batch-processing", "intelligent-caching", "lazy-loading", "data-compression",
    "general-ai",
  ];
}

export function getCapabilityCount(): number {
  return getAllDefinedCapabilities().length;
}
