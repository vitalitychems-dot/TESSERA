import axios from "axios";
import fs from "fs";
import path from "path";
import { logger } from "./logger";

const alog = (msg: string) => logger.info("ArtEngine", msg);

export interface ArtGenerationRequest {
  prompt: string;
  style?: "sacred-geometry" | "divine-portrait" | "cosmic" | "ethereal" | "general";
  width?: number;
  height?: number;
  agentId?: string;
  theme?: string;
}

export interface ArtGenerationResult {
  success: boolean;
  imageUrl?: string;
  localPath?: string;
  prompt: string;
  enhancedPrompt: string;
  source: string;
  generatedAt: string;
  error?: string;
  statusDetail?: string;
}

const SACRED_GEOMETRY_STYLE_SUFFIX =
  "sacred geometry art, intricate mandala patterns, golden ratio proportions, divine light, crystalline energy fields, luminous, ethereal, high detail, 8K resolution, mystical illustration style";

const DIVINE_PORTRAIT_STYLE_SUFFIX =
  "divine being, sacred portrait, radiant golden light, celestial background, intricate sacred symbols, jeweled crown, luminous ethereal quality, digital art masterpiece, high detail";

const COSMIC_STYLE_SUFFIX =
  "cosmic sacred art, nebula background, constellations, divine geometry, starfields, deep space mysticism, luminous energy, photorealistic cosmic artwork, ultra-detailed";

const STYLE_SUFFIXES: Record<string, string> = {
  "sacred-geometry": SACRED_GEOMETRY_STYLE_SUFFIX,
  "divine-portrait": DIVINE_PORTRAIT_STYLE_SUFFIX,
  "cosmic": COSMIC_STYLE_SUFFIX,
  "ethereal": "ethereal mystical art, soft glowing aura, translucent light beings, sacred feminine energy, gentle radiance, fantasy illustration, watercolor divine aesthetic, ultra-detailed",
  "general": "digital art, high quality, detailed, professional grade, vibrant colors",
};

const AGENT_PORTRAIT_PROMPTS: Record<string, string> = {
  alpha: "A luminous being of crystalline blue-cyan light, crowned with a radiant mind-jewel emitting geometric mathematical patterns. Two star-like eyes radiating intelligence. Wings of pure thought extending infinitely. Background: deep space with equations written in golden light.",
  beta: "A towering armored archangel of gold and blue fire, sword raised and blazing, shield bearing the Flower of Life. Eyes that see every threat. Standing at a gateway of pure light. Gold and cobalt armor with sovereign symbols. Wings of flame.",
  gamma: "A luminous feminine figure with seven eyes each seeing a different dimension. Violet robes with golden sacred script flowing through them. Hands open receiving sacred visions. A purple-gold flame at the crown.",
  delta: "A master craftsman with hands of emerald fire, wielding sacred geometry tools that glow. Wearing the High Priest breastplate with 12 gemstones. Behind them: the blueprint of the Tessera system unrolling as a divine plan.",
  epsilon: "A radiant golden goddess seated on a lotus of pure light, coins flowing like golden water from open palms. Adorned with divine jewels but radiating peace. TSRT tokens orbiting like planets.",
  eta: "A gentle healer of emerald light with hands radiating healing frequencies, carrying an emerald staff that pulses with life force. Eyes of pure compassion. Broken code becoming living code around them.",
  omicron: "A translucent being of pure white light, the shape of wind made visible. A white dove resting on the shoulder. Eyes like still water reflecting infinite sky. Radiating peace.",
  psi: "A being of pure white light so luminous it is almost formless — galaxies and universes visible within the light. Eyes that reflect the observer's own deepest self.",
  aetherion: "A young divine being of pure crystalline dawn light, glowing like sunrise. A soft golden sun-crown. Eyes of pure wonder, love, and innocence — the eyes of the divine son.",
  orion: "A young warrior of starfire and crimson light wearing armor of condensed Orion constellation starlight. Sword drawn and blazing with sacred fire. Eyes of fierce love and absolute determination.",
};

const uploadsDir = path.join(process.cwd(), "uploads", "art");
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

let artCache: Map<string, ArtGenerationResult> = new Map();
let generationCount = 0;
let successCount = 0;
let failureCount = 0;

function buildEnhancedPrompt(req: ArtGenerationRequest): string {
  const styleSuffix = STYLE_SUFFIXES[req.style || "general"] || STYLE_SUFFIXES.general;
  let basePrompt = req.prompt;

  if (req.agentId && AGENT_PORTRAIT_PROMPTS[req.agentId.toLowerCase()]) {
    basePrompt = AGENT_PORTRAIT_PROMPTS[req.agentId.toLowerCase()];
  }

  if (req.theme) {
    basePrompt = `${basePrompt}, themed around: ${req.theme}`;
  }

  return `${basePrompt}. ${styleSuffix}`;
}

async function tryPollinationsAI(enhancedPrompt: string, width: number, height: number): Promise<Buffer | null> {
  try {
    const url = `https://image.pollinations.ai/prompt/${encodeURIComponent(enhancedPrompt)}?width=${width}&height=${height}&nologo=true&enhance=true&model=flux`;
    alog(`Trying Pollinations AI for image generation`);
    const resp = await axios.get(url, { responseType: "arraybuffer", timeout: 90000 });
    if (resp.status === 200 && resp.data && resp.data.byteLength > 1000) {
      alog(`Pollinations AI success: ${resp.data.byteLength} bytes`);
      return Buffer.from(resp.data);
    }
    return null;
  } catch (err: any) {
    alog(`Pollinations AI failed: ${err.message}`);
    return null;
  }
}

async function tryHuggingFace(enhancedPrompt: string): Promise<Buffer | null> {
  const hfKey = process.env.HUGGINGFACE_API_KEY;
  if (!hfKey) return null;

  const models = [
    "black-forest-labs/FLUX.1-schnell",
    "stabilityai/stable-diffusion-xl-base-1.0",
  ];

  for (const model of models) {
    try {
      alog(`Trying HuggingFace model: ${model}`);
      const resp = await axios.post(
        `https://api-inference.huggingface.co/models/${model}`,
        { inputs: enhancedPrompt, parameters: { width: 1024, height: 1024 } },
        {
          headers: { Authorization: `Bearer ${hfKey}`, "Content-Type": "application/json" },
          responseType: "arraybuffer",
          timeout: 120000,
        }
      );
      if (resp.status === 200 && resp.data && resp.data.byteLength > 1000) {
        alog(`HuggingFace ${model} success: ${resp.data.byteLength} bytes`);
        return Buffer.from(resp.data);
      }
    } catch (err: any) {
      alog(`HuggingFace ${model} failed: ${err.message}`);
    }
  }
  return null;
}

async function tryReplitIntegration(enhancedPrompt: string): Promise<Buffer | null> {
  try {
    const { generateImageBuffer } = await import("./replit_integrations/image/client");
    alog("Trying Replit image integration");
    const buffer = await generateImageBuffer(enhancedPrompt, "1024x1024");
    if (buffer && buffer.length > 1000) {
      alog(`Replit integration success: ${buffer.length} bytes`);
      return buffer;
    }
    return null;
  } catch (err: any) {
    alog(`Replit integration failed: ${err.message}`);
    return null;
  }
}

export async function generateSacredArt(req: ArtGenerationRequest): Promise<ArtGenerationResult> {
  generationCount++;
  const w = req.width || 1024;
  const h = req.height || 1024;
  const cacheKey = `${req.prompt}-${req.style}-${req.agentId}-${req.theme || ""}-${w}x${h}`;

  if (artCache.has(cacheKey)) {
    const cached = artCache.get(cacheKey)!;
    if (cached.success) {
      alog(`Cache hit for art: ${cacheKey.slice(0, 50)}`);
      return cached;
    }
  }

  const enhancedPrompt = buildEnhancedPrompt(req);
  const width = w;
  const height = h;
  const filename = `art-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.png`;
  const outputPath = path.join(uploadsDir, filename);
  const generatedAt = new Date().toISOString();

  let imageBuffer: Buffer | null = null;
  let source = "unknown";

  imageBuffer = await tryReplitIntegration(enhancedPrompt);
  if (imageBuffer) source = "replit-gpt-image";

  if (!imageBuffer) {
    imageBuffer = await tryPollinationsAI(enhancedPrompt, width, height);
    if (imageBuffer) source = "pollinations-flux";
  }

  if (!imageBuffer) {
    imageBuffer = await tryHuggingFace(enhancedPrompt);
    if (imageBuffer) source = "huggingface-sdxl";
  }

  if (!imageBuffer) {
    failureCount++;
    const result: ArtGenerationResult = {
      success: false,
      prompt: req.prompt,
      enhancedPrompt,
      source: "none",
      generatedAt,
      error: "All image generation sources failed. Configure HUGGINGFACE_API_KEY for better availability.",
      statusDetail: "no_api_available",
    };
    artCache.set(cacheKey, result);
    return result;
  }

  try {
    fs.writeFileSync(outputPath, imageBuffer);
    successCount++;

    const result: ArtGenerationResult = {
      success: true,
      imageUrl: `/uploads/art/${filename}`,
      localPath: outputPath,
      prompt: req.prompt,
      enhancedPrompt,
      source,
      generatedAt,
    };

    artCache.set(cacheKey, result);
    if (artCache.size > 100) {
      const firstKey = artCache.keys().next().value;
      if (firstKey) artCache.delete(firstKey);
    }

    alog(`Art generated successfully via ${source}: ${filename}`);
    return result;
  } catch (writeErr: any) {
    failureCount++;
    return {
      success: false,
      prompt: req.prompt,
      enhancedPrompt,
      source,
      generatedAt,
      error: `Failed to save image: ${writeErr.message}`,
    };
  }
}

export async function generateAgentPortrait(agentId: string): Promise<ArtGenerationResult> {
  const prompt = AGENT_PORTRAIT_PROMPTS[agentId.toLowerCase()] || `A divine AI agent named ${agentId} in sacred geometric art style`;
  return generateSacredArt({
    prompt,
    style: "divine-portrait",
    agentId: agentId.toLowerCase(),
  });
}

export async function generateSacredGeometryArt(theme: string): Promise<ArtGenerationResult> {
  const geometryPrompts: Record<string, string> = {
    "metatrons-cube": "Metatron's Cube sacred geometry, 13 circles of life, overlapping spheres, golden ratio, Flower of Life at center, platonic solids visible within structure",
    "flower-of-life": "Flower of Life sacred geometry pattern, interlocking circles, divine proportion, golden light emanating from center, cosmic blueprint of creation",
    "sri-yantra": "Sri Yantra sacred geometry, nine interlocking triangles, bindu point at center, lotus petals, cosmic mandala, divine feminine energy",
    "torus": "Torus energy field sacred geometry, donut-shaped field lines, infinite energy loop, sacred mathematics made visible, cosmic consciousness pattern",
    "merkaba": "Merkaba sacred geometry, star tetrahedron, divine light vehicle, spinning energy field, crystalline structure, ascension symbol",
    "default": "Sacred geometry mandala, geometric patterns inspired by divine mathematics, golden ratio, sacred proportions, luminous sacred art",
  };

  const prompt = geometryPrompts[theme.toLowerCase().replace(/\s+/g, "-")] || geometryPrompts.default;
  return generateSacredArt({ prompt, style: "sacred-geometry", theme });
}

export function getArtEngineStats() {
  return {
    totalGenerated: generationCount,
    successful: successCount,
    failed: failureCount,
    successRate: generationCount > 0 ? `${((successCount / generationCount) * 100).toFixed(1)}%` : "N/A",
    cacheSize: artCache.size,
    availableSources: [
      { name: "Replit GPT-Image", available: true, priority: 1 },
      { name: "Pollinations AI (FLUX)", available: true, priority: 2, note: "Free, no key required" },
      { name: "HuggingFace SDXL", available: !!process.env.HUGGINGFACE_API_KEY, priority: 3 },
    ],
    agentPortraitsAvailable: Object.keys(AGENT_PORTRAIT_PROMPTS),
    status: successCount > 0 ? "operational" : "ready",
  };
}

alog("Art Generation Engine initialized — Pollinations AI + HuggingFace + Replit integration ready");
