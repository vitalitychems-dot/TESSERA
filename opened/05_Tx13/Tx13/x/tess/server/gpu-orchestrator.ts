import { callLLMSimple } from "./llm-helper";
import { getProviderCooldowns } from "./llm-helper";

export interface GPUProvider {
  id: string;
  name: string;
  type: "cloud" | "colab" | "kaggle" | "api-inference" | "cpu-fallback";
  vramGB: number;
  tflops: number;
  costPerHour: number;
  freeQuotaHours: number;
  freeQuotaResetDays: number;
  apiEndpoint?: string;
  signupUrl: string;
  status: "available" | "limited" | "offline" | "unknown";
  lastChecked: number;
  latencyMs: number;
  successCount: number;
  failCount: number;
  capabilities: string[];
  notes: string;
  priority: number;
}

export interface TrainingJob {
  id: string;
  name: string;
  type: "fine-tune" | "rlhf" | "benchmark" | "inference-test" | "embedding";
  status: "queued" | "running" | "completed" | "failed" | "cancelled";
  providerId: string;
  providerName: string;
  createdAt: number;
  startedAt?: number;
  completedAt?: number;
  estimatedMinutes: number;
  actualMinutes?: number;
  datasetSize: number;
  modelName: string;
  parameters: Record<string, any>;
  result?: string;
  errorMsg?: string;
  costSaved: number;
}

export interface BenchmarkResult {
  providerId: string;
  providerName: string;
  timestamp: number;
  latencyMs: number;
  tokensPerSecond: number;
  qualityScore: number;
  successRate: number;
  testPrompt: string;
  response: string;
}

export interface TrainingDataset {
  id: string;
  name: string;
  source: "conversations" | "forum" | "agent-replies" | "manual";
  format: "jsonl" | "csv" | "json";
  count: number;
  createdAt: number;
  sizeBytes: number;
  data: Array<{ prompt: string; completion: string; metadata?: Record<string, any> }>;
}

const FREE_GPU_PROVIDERS: GPUProvider[] = [
  {
    id: "groq-llm",
    name: "Groq (LPU Inference)",
    type: "api-inference",
    vramGB: 0,
    tflops: 750,
    costPerHour: 0,
    freeQuotaHours: 999,
    freeQuotaResetDays: 1,
    apiEndpoint: "https://api.groq.com/openai/v1",
    signupUrl: "https://console.groq.com",
    status: "unknown",
    lastChecked: 0,
    latencyMs: 0,
    successCount: 0,
    failCount: 0,
    capabilities: ["inference", "chat", "70B-models", "ultra-fast"],
    notes: "Free tier: 14,400 req/day on Llama-3.3-70B. LPU chips = 500+ tokens/sec. No GPU training.",
    priority: 1,
  },
  {
    id: "cerebras-llm",
    name: "Cerebras (Wafer-Scale Inference)",
    type: "api-inference",
    vramGB: 0,
    tflops: 900,
    costPerHour: 0,
    freeQuotaHours: 999,
    freeQuotaResetDays: 1,
    apiEndpoint: "https://api.cerebras.ai/v1",
    signupUrl: "https://cloud.cerebras.ai",
    status: "unknown",
    lastChecked: 0,
    latencyMs: 0,
    successCount: 0,
    failCount: 0,
    capabilities: ["inference", "chat", "70B-models", "fastest-inference"],
    notes: "Free tier with wafer-scale chips. Llama-3.3-70B at 2,100 tokens/sec. Fastest available.",
    priority: 1,
  },
  {
    id: "sambanova-llm",
    name: "SambaNova (RDU Inference)",
    type: "api-inference",
    vramGB: 0,
    tflops: 620,
    costPerHour: 0,
    freeQuotaHours: 999,
    freeQuotaResetDays: 1,
    apiEndpoint: "https://api.sambanova.ai/v1",
    signupUrl: "https://cloud.sambanova.ai",
    status: "unknown",
    lastChecked: 0,
    latencyMs: 0,
    successCount: 0,
    failCount: 0,
    capabilities: ["inference", "chat", "70B-models", "DeepSeek-R1"],
    notes: "Free tier on RDU hardware. Llama-3.3-70B + DeepSeek-R1 + Qwen3-32B available.",
    priority: 1,
  },
  {
    id: "google-colab",
    name: "Google Colab (T4/A100)",
    type: "colab",
    vramGB: 16,
    tflops: 65,
    costPerHour: 0,
    freeQuotaHours: 12,
    freeQuotaResetDays: 1,
    signupUrl: "https://colab.research.google.com",
    status: "unknown",
    lastChecked: 0,
    latencyMs: 0,
    successCount: 0,
    failCount: 0,
    capabilities: ["training", "fine-tuning", "inference", "T4-16GB", "A100-40GB-pro"],
    notes: "T4 GPU free, A100 with Colab Pro. 12h sessions. Best for fine-tuning 7B models.",
    priority: 2,
  },
  {
    id: "kaggle-gpu",
    name: "Kaggle (P100/T4)",
    type: "kaggle",
    vramGB: 16,
    tflops: 21,
    costPerHour: 0,
    freeQuotaHours: 30,
    freeQuotaResetDays: 7,
    signupUrl: "https://kaggle.com",
    status: "unknown",
    lastChecked: 0,
    latencyMs: 0,
    successCount: 0,
    failCount: 0,
    capabilities: ["training", "fine-tuning", "P100-16GB", "T4-16GB", "internet-access"],
    notes: "30h/week free GPU. Kaggle verification required. Persistent notebooks with internet.",
    priority: 2,
  },
  {
    id: "together-free",
    name: "Together AI (Free Models)",
    type: "api-inference",
    vramGB: 0,
    tflops: 400,
    costPerHour: 0,
    freeQuotaHours: 999,
    freeQuotaResetDays: 1,
    apiEndpoint: "https://api.together.xyz/v1",
    signupUrl: "https://api.together.ai",
    status: "unknown",
    lastChecked: 0,
    latencyMs: 0,
    successCount: 0,
    failCount: 0,
    capabilities: ["inference", "Llama-70B-free", "DeepSeek-V3-free", "chat"],
    notes: "Free models: Llama-3.3-70B-Turbo-Free + DeepSeek-V3-Free. Rate limited.",
    priority: 2,
  },
  {
    id: "huggingface-serverless",
    name: "HuggingFace Serverless Inference",
    type: "api-inference",
    vramGB: 0,
    tflops: 200,
    costPerHour: 0,
    freeQuotaHours: 999,
    freeQuotaResetDays: 1,
    apiEndpoint: "https://api-inference.huggingface.co",
    signupUrl: "https://huggingface.co",
    status: "unknown",
    lastChecked: 0,
    latencyMs: 0,
    successCount: 0,
    failCount: 0,
    capabilities: ["inference", "embeddings", "70B-models", "custom-models"],
    notes: "Free serverless inference for public models. Rate limited. HF token required for gated models.",
    priority: 3,
  },
  {
    id: "nvidia-nim",
    name: "Nvidia NIM (Free Tier)",
    type: "api-inference",
    vramGB: 0,
    tflops: 500,
    costPerHour: 0,
    freeQuotaHours: 999,
    freeQuotaResetDays: 30,
    apiEndpoint: "https://integrate.api.nvidia.com/v1",
    signupUrl: "https://build.nvidia.com",
    status: "unknown",
    lastChecked: 0,
    latencyMs: 0,
    successCount: 0,
    failCount: 0,
    capabilities: ["inference", "Llama-70B", "Mistral", "optimized-NIM"],
    notes: "1,000 free credits/month. NIM-optimized inference containers. Very fast.",
    priority: 2,
  },
  {
    id: "lightning-ai",
    name: "Lightning AI (Studio)",
    type: "colab",
    vramGB: 24,
    tflops: 80,
    costPerHour: 0,
    freeQuotaHours: 22,
    freeQuotaResetDays: 30,
    signupUrl: "https://lightning.ai",
    status: "unknown",
    lastChecked: 0,
    latencyMs: 0,
    successCount: 0,
    failCount: 0,
    capabilities: ["training", "fine-tuning", "A10G-24GB", "PyTorch-Lightning", "persistent-storage"],
    notes: "22 GPU-hours/month free. A10G 24GB GPU. Great for fine-tuning with Lightning/Fabric.",
    priority: 2,
  },
  {
    id: "fireworks-free",
    name: "Fireworks AI (Free Tier)",
    type: "api-inference",
    vramGB: 0,
    tflops: 350,
    costPerHour: 0,
    freeQuotaHours: 999,
    freeQuotaResetDays: 1,
    apiEndpoint: "https://api.fireworks.ai/inference/v1",
    signupUrl: "https://fireworks.ai",
    status: "unknown",
    lastChecked: 0,
    latencyMs: 0,
    successCount: 0,
    failCount: 0,
    capabilities: ["inference", "Llama-70B", "function-calling", "fast-inference"],
    notes: "Free credits on signup. Llama-3.3-70B + many OSS models. Very low latency.",
    priority: 3,
  },
  {
    id: "mistral-free",
    name: "Mistral La Plateforme (Free)",
    type: "api-inference",
    vramGB: 0,
    tflops: 300,
    costPerHour: 0,
    freeQuotaHours: 999,
    freeQuotaResetDays: 1,
    apiEndpoint: "https://api.mistral.ai/v1",
    signupUrl: "https://console.mistral.ai",
    status: "unknown",
    lastChecked: 0,
    latencyMs: 0,
    successCount: 0,
    failCount: 0,
    capabilities: ["inference", "mistral-small", "code-generation", "multilingual"],
    notes: "Free tier with API key. mistral-small-latest free to use. Good for code tasks.",
    priority: 3,
  },
  {
    id: "openrouter-free",
    name: "OpenRouter (Free Models)",
    type: "api-inference",
    vramGB: 0,
    tflops: 250,
    costPerHour: 0,
    freeQuotaHours: 999,
    freeQuotaResetDays: 1,
    apiEndpoint: "https://openrouter.ai/api/v1",
    signupUrl: "https://openrouter.ai",
    status: "unknown",
    lastChecked: 0,
    latencyMs: 0,
    successCount: 0,
    failCount: 0,
    capabilities: ["inference", "Llama-70B-free", "Gemma-27B-free", "Mistral-free", "multi-provider"],
    notes: "Multiple free models via single API. Rate limited. Great fallback option.",
    priority: 3,
  },
  {
    id: "cpu-fallback",
    name: "CPU Local Inference (Fallback)",
    type: "cpu-fallback",
    vramGB: 0,
    tflops: 2,
    costPerHour: 0,
    freeQuotaHours: 999,
    freeQuotaResetDays: 0,
    signupUrl: "",
    status: "available",
    lastChecked: Date.now(),
    latencyMs: 5000,
    successCount: 0,
    failCount: 0,
    capabilities: ["template-responses", "pattern-matching", "always-available"],
    notes: "CPU-only pattern-matching fallback. No GPU needed. Used when all API providers fail.",
    priority: 10,
  },
];

const trainingJobs: TrainingJob[] = [];
const benchmarkResults: BenchmarkResult[] = [];
const trainingDatasets: TrainingDataset[] = [];
let jobIdCounter = 1;
let totalFreeHoursSaved = 0;
let totalCostSaved = 0;

export function getGPUProviders(): GPUProvider[] {
  return FREE_GPU_PROVIDERS;
}

export function getGPUProviderHealth(): Record<string, { status: string; latencyMs: number; lastChecked: number }> {
  const health: Record<string, any> = {};
  for (const p of FREE_GPU_PROVIDERS) {
    health[p.id] = {
      status: p.status,
      latencyMs: p.latencyMs,
      lastChecked: p.lastChecked,
      successRate: p.successCount + p.failCount > 0
        ? Math.round((p.successCount / (p.successCount + p.failCount)) * 100)
        : null,
    };
  }
  return health;
}

export async function probeGPUProvider(providerId: string): Promise<{ reachable: boolean; latencyMs: number }> {
  const provider = FREE_GPU_PROVIDERS.find(p => p.id === providerId);
  if (!provider || !provider.apiEndpoint) {
    return { reachable: false, latencyMs: 0 };
  }
  const start = Date.now();
  try {
    const res = await fetch(provider.apiEndpoint + "/models", {
      method: "GET",
      signal: AbortSignal.timeout(5000),
    });
    const latency = Date.now() - start;
    provider.latencyMs = latency;
    provider.lastChecked = Date.now();
    if (res.ok || res.status === 401) {
      provider.status = "available";
      provider.successCount++;
      return { reachable: true, latencyMs: latency };
    }
    provider.status = "limited";
    return { reachable: true, latencyMs: latency };
  } catch {
    const latency = Date.now() - start;
    provider.status = "offline";
    provider.lastChecked = Date.now();
    provider.failCount++;
    return { reachable: false, latencyMs: latency };
  }
}

export async function probeAllProviders(): Promise<Record<string, any>> {
  const results: Record<string, any> = {};
  const probePromises = FREE_GPU_PROVIDERS
    .filter(p => p.apiEndpoint)
    .map(async p => {
      results[p.id] = await probeGPUProvider(p.id);
    });
  await Promise.allSettled(probePromises);
  return results;
}

export function queueTrainingJob(params: {
  name: string;
  type: TrainingJob["type"];
  modelName: string;
  datasetSize: number;
  providerId?: string;
  parameters?: Record<string, any>;
}): TrainingJob {
  const provider = FREE_GPU_PROVIDERS.find(p => p.id === (params.providerId || "groq-llm")) || FREE_GPU_PROVIDERS[0];
  const job: TrainingJob = {
    id: `job-${Date.now()}-${jobIdCounter++}`,
    name: params.name,
    type: params.type,
    status: "queued",
    providerId: provider.id,
    providerName: provider.name,
    createdAt: Date.now(),
    estimatedMinutes: Math.ceil(params.datasetSize / 100),
    datasetSize: params.datasetSize,
    modelName: params.modelName,
    parameters: params.parameters || {},
    costSaved: provider.costPerHour === 0 ? (params.datasetSize / 1000) * 2.5 : 0,
  };
  trainingJobs.push(job);
  console.log(`[GPU-Orch] Training job queued: ${job.name} on ${provider.name}`);
  return job;
}

export function getTrainingJobs(): TrainingJob[] {
  return trainingJobs;
}

export async function runBenchmark(providerId: string): Promise<BenchmarkResult> {
  const provider = FREE_GPU_PROVIDERS.find(p => p.id === providerId);
  const testPrompt = "What is 2+2? Reply with just the number.";
  const start = Date.now();

  let response = "";
  let success = false;

  try {
    response = await callLLMSimple(testPrompt, 10, { skipCache: true });
    success = response.trim().length > 0;
  } catch {
    success = false;
  }

  const latency = Date.now() - start;
  const tokensPerSecond = success ? Math.round((response.length / 4) / (latency / 1000)) : 0;
  const qualityScore = response.toLowerCase().includes("4") ? 100 : (response.length > 0 ? 50 : 0);

  const result: BenchmarkResult = {
    providerId: providerId || "unknown",
    providerName: provider?.name || providerId,
    timestamp: Date.now(),
    latencyMs: latency,
    tokensPerSecond,
    qualityScore,
    successRate: success ? 100 : 0,
    testPrompt,
    response: response.slice(0, 200),
  };

  benchmarkResults.push(result);
  if (benchmarkResults.length > 500) benchmarkResults.splice(0, benchmarkResults.length - 500);

  if (provider) {
    if (success) provider.successCount++;
    else provider.failCount++;
    provider.latencyMs = latency;
    provider.lastChecked = Date.now();
  }

  return result;
}

export function getBenchmarkHistory(): BenchmarkResult[] {
  return benchmarkResults.slice(-100);
}

export function exportTrainingDataJSONL(source: "conversations" | "all" = "all"): string {
  const examples: Array<{ messages: Array<{ role: string; content: string }> }> = [];

  for (const ds of trainingDatasets) {
    if (source === "all" || ds.source === source) {
      for (const item of ds.data) {
        examples.push({
          messages: [
            { role: "user", content: item.prompt },
            { role: "assistant", content: item.completion },
          ],
        });
      }
    }
  }

  return examples.map(e => JSON.stringify(e)).join("\n");
}

export function addTrainingData(
  prompt: string,
  completion: string,
  source: TrainingDataset["source"] = "conversations",
  metadata?: Record<string, any>
): void {
  let dataset = trainingDatasets.find(d => d.source === source);
  if (!dataset) {
    dataset = {
      id: `ds-${Date.now()}`,
      name: `${source} Dataset`,
      source,
      format: "jsonl",
      count: 0,
      createdAt: Date.now(),
      sizeBytes: 0,
      data: [],
    };
    trainingDatasets.push(dataset);
  }

  if (dataset.data.length >= 5000) return;

  dataset.data.push({ prompt, completion, metadata });
  dataset.count++;
  dataset.sizeBytes += (prompt.length + completion.length) * 2;
}

export function getTrainingDatasets(): Omit<TrainingDataset, "data">[] {
  return trainingDatasets.map(({ data, ...rest }) => ({ ...rest, previewCount: data.length }));
}

export function calculateCostSavings(): {
  totalFreeInferenceHours: number;
  totalFreeTrainingHours: number;
  estimatedCostSaved: number;
  equivalentPaidCost: number;
  freeProviderCount: number;
  topProvider: string;
  breakdown: Array<{ provider: string; calls: number; estimatedCost: number; saved: number }>;
} {
  const inferenceProviders = FREE_GPU_PROVIDERS.filter(p => p.type === "api-inference");
  const trainingProviders = FREE_GPU_PROVIDERS.filter(p => p.type !== "api-inference" && p.type !== "cpu-fallback");

  const totalInferenceCalls = inferenceProviders.reduce((a, p) => a + p.successCount, 0);
  const avgCostPer1kTokens = 0.00015;
  const avgTokensPerCall = 500;
  const estimatedCostSaved = (totalInferenceCalls * avgTokensPerCall * avgCostPer1kTokens) / 1000;

  const totalFreeTrainingHours = trainingProviders.reduce((a, p) => a + p.freeQuotaHours, 0);
  const paidEquivalent = totalFreeTrainingHours * 2.50;

  const topProvider = FREE_GPU_PROVIDERS.sort((a, b) => b.successCount - a.successCount)[0]?.name || "None yet";

  const breakdown = FREE_GPU_PROVIDERS
    .filter(p => p.successCount > 0)
    .map(p => ({
      provider: p.name,
      calls: p.successCount,
      estimatedCost: (p.successCount * avgTokensPerCall * avgCostPer1kTokens) / 1000,
      saved: (p.successCount * avgTokensPerCall * avgCostPer1kTokens) / 1000,
    }));

  return {
    totalFreeInferenceHours: Math.round(totalInferenceCalls / 3600),
    totalFreeTrainingHours,
    estimatedCostSaved: Math.round(estimatedCostSaved * 100) / 100,
    equivalentPaidCost: Math.round(paidEquivalent * 100) / 100,
    freeProviderCount: FREE_GPU_PROVIDERS.filter(p => p.costPerHour === 0).length,
    topProvider,
    breakdown,
  };
}

export function generateColabNotebook(jobName: string, modelName: string = "meta-llama/Llama-3.2-1B"): object {
  return {
    nbformat: 4,
    nbformat_minor: 5,
    metadata: {
      kernelspec: { display_name: "Python 3", language: "python", name: "python3" },
      accelerator: "GPU",
      colab: { name: `${jobName}.ipynb`, provenance: [] },
    },
    cells: [
      {
        cell_type: "markdown",
        metadata: {},
        source: [`# ${jobName}\nAuto-generated by Tessera Sovereign GPU Orchestrator\n\nModel: ${modelName}`],
      },
      {
        cell_type: "code",
        metadata: {},
        source: [
          "# Setup\n",
          "!pip install transformers datasets peft trl bitsandbytes accelerate -q\n",
          "import torch\n",
          `print(f'GPU: {torch.cuda.get_device_name(0) if torch.cuda.is_available() else \"CPU only\"}')\n`,
          "print(f'VRAM: {torch.cuda.get_device_properties(0).total_memory / 1e9:.1f}GB' if torch.cuda.is_available() else '')",
        ],
        outputs: [],
        execution_count: null,
      },
      {
        cell_type: "code",
        metadata: {},
        source: [
          "from transformers import AutoModelForCausalLM, AutoTokenizer, TrainingArguments\n",
          "from peft import get_peft_model, LoraConfig, TaskType\n",
          "from trl import SFTTrainer\n",
          "from datasets import load_dataset\n",
          "\n",
          `model_name = "${modelName}"\n`,
          "tokenizer = AutoTokenizer.from_pretrained(model_name)\n",
          "model = AutoModelForCausalLM.from_pretrained(model_name, load_in_8bit=True, device_map='auto')\n",
          "\n",
          "# LoRA Config for efficient fine-tuning\n",
          "lora_config = LoraConfig(\n",
          "    task_type=TaskType.CAUSAL_LM,\n",
          "    r=16, lora_alpha=32, lora_dropout=0.1,\n",
          "    target_modules=['q_proj', 'v_proj']\n",
          ")\n",
          "model = get_peft_model(model, lora_config)\n",
          "model.print_trainable_parameters()",
        ],
        outputs: [],
        execution_count: null,
      },
      {
        cell_type: "code",
        metadata: {},
        source: [
          "# Load your JSONL training data (upload to Colab or use HuggingFace dataset)\n",
          "# dataset = load_dataset('json', data_files='training_data.jsonl')\n",
          "\n",
          "training_args = TrainingArguments(\n",
          "    output_dir='./results',\n",
          "    num_train_epochs=3,\n",
          "    per_device_train_batch_size=4,\n",
          "    gradient_accumulation_steps=4,\n",
          "    warmup_steps=100,\n",
          "    learning_rate=2e-4,\n",
          "    fp16=True,\n",
          "    logging_steps=10,\n",
          "    save_strategy='epoch',\n",
          ")\n",
          "\n",
          "# trainer = SFTTrainer(model=model, args=training_args, train_dataset=dataset['train'])\n",
          "# trainer.train()\n",
          "print('Training setup complete! Uncomment trainer lines to start.')",
        ],
        outputs: [],
        execution_count: null,
      },
    ],
  };
}

export function getGPUOrchestratorStats() {
  const cooldowns = getProviderCooldowns();
  const cooledCount = Object.values(cooldowns).filter(c => c.remainingSeconds > 0).length;
  const availableProviders = FREE_GPU_PROVIDERS.filter(p => p.status !== "offline").length;

  return {
    totalProviders: FREE_GPU_PROVIDERS.length,
    availableProviders,
    apiProviders: FREE_GPU_PROVIDERS.filter(p => p.type === "api-inference").length,
    trainingProviders: FREE_GPU_PROVIDERS.filter(p => p.type !== "api-inference").length,
    totalFreeVRAM: FREE_GPU_PROVIDERS.reduce((a, p) => a + p.vramGB, 0),
    totalFreeTFLOPS: FREE_GPU_PROVIDERS.reduce((a, p) => a + p.tflops, 0),
    trainingJobsQueued: trainingJobs.filter(j => j.status === "queued").length,
    trainingJobsCompleted: trainingJobs.filter(j => j.status === "completed").length,
    totalBenchmarkRuns: benchmarkResults.length,
    trainingDatasets: trainingDatasets.length,
    totalTrainingExamples: trainingDatasets.reduce((a, d) => a + d.count, 0),
    llmProviderCooldowns: cooledCount,
    costSavings: calculateCostSavings(),
  };
}

console.log(`[GPU-Orch] GPU Orchestrator initialized: ${FREE_GPU_PROVIDERS.length} providers, ${FREE_GPU_PROVIDERS.reduce((a, p) => a + p.tflops, 0)} total TFLOPS`);
