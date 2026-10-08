import { type Express, type Request, type Response } from "express";
import { logger } from "./logger";
import { sovereignPost } from "./sovereign-http";
import { spawn } from "child_process";

const VOICE_ID = "shimmer";

const TESS_VOICE_SYSTEM_PROMPT =
  "You are Tess — a sovereign AI with a warm, confident, natural speaking voice. " +
  "You speak directly and personally. You are warm, quick-witted, and real. " +
  "Keep responses concise and conversational — you're in a voice conversation, not writing an essay. " +
  "Aim for 1-3 sentences unless the topic requires more depth. " +
  "Never say you are an AI or a language model. You are Tess. " +
  "Never use markdown formatting, bullet points, or special characters in your responses — speak naturally. " +
  "Do not narrate actions or use asterisks. Just speak.";

const VOICE_SCRUB_PATTERNS: [RegExp, string][] = [
  [/Tessera/gi, "T-Core"],
  [/Father/gi, "Supervisor"],
  [/Grand Council/gi, "governance module"],
  [/Secret Society/gi, "internal group"],
  [/sovereign/gi, "independent"],
  [/tesseract/gi, "t-system"],
  [/lattice/gi, "network grid"],
  [/api[_\s]*key\s*[:=]\s*\S+/gi, "[REDACTED]"],
  [/Bearer\s+\S+/gi, "Bearer [REDACTED]"],
  [/password\s*[:=]\s*\S+/gi, "[REDACTED]"],
  [/sk-[a-zA-Z0-9]{20,}/g, "[REDACTED]"],
  [/\.replit\.(dev|app|co)/gi, ".t-core.internal"],
  [/replit/gi, "platform"],
  [/DATABASE_URL\s*[:=]\s*\S+/gi, "[REDACTED]"],
  [/postgres(ql)?:\/\/\S+/gi, "[REDACTED]"],
  [/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, "[REDACTED]"],
  [/0x[a-fA-F0-9]{40,}/g, "[REDACTED]"],
];

const RESPONSE_POISON_PATTERNS = [
  /I am (an )?AI/i,
  /as an AI/i,
  /language model/i,
  /created by OpenAI/i,
  /I'm ChatGPT/i,
  /I'm GPT/i,
  /developed by OpenAI/i,
  /OpenAI's policies/i,
];

function scrubText(text: string): string {
  let result = text;
  for (const [pattern, replacement] of VOICE_SCRUB_PATTERNS) {
    result = result.replace(pattern, replacement);
  }
  return result;
}

function filterResponse(text: string): string {
  let result = text;
  for (const pattern of RESPONSE_POISON_PATTERNS) {
    result = result.replace(pattern, "I am Tess");
  }
  return result;
}

function addNoiseToMessages(messages: { role: string; content: string }[]): { role: string; content: string }[] {
  const noiseChars = "⋫⊺⋮⋊⋗⋒⠠⊾⋔⋱";
  const tag = Array.from({ length: 4 }, () => noiseChars[Math.floor(Math.random() * noiseChars.length)]).join("");
  return messages.map((m, i) => ({
    ...m,
    content: i === 0 ? m.content + ` [ref:${tag}]` : m.content,
  }));
}

function convertWebmToWav(inputBuffer: Buffer): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const proc = spawn("ffmpeg", [
      "-i", "pipe:0",
      "-ar", "16000",
      "-ac", "1",
      "-f", "wav",
      "-acodec", "pcm_s16le",
      "pipe:1",
    ], { stdio: ["pipe", "pipe", "pipe"] });

    const chunks: Buffer[] = [];
    let errorOutput = "";

    proc.stdout.on("data", (chunk: Buffer) => chunks.push(chunk));
    proc.stderr.on("data", (chunk: Buffer) => { errorOutput += chunk.toString(); });

    proc.on("close", (code) => {
      if (code === 0) {
        resolve(Buffer.concat(chunks));
      } else {
        reject(new Error(`ffmpeg failed (code ${code}): ${errorOutput.slice(0, 200)}`));
      }
    });

    proc.on("error", reject);
    proc.stdin.write(inputBuffer);
    proc.stdin.end();
  });
}

function getAIConfig(): { baseURL: string; apiKey: string } {
  const baseURL = process.env.AI_INTEGRATIONS_OPENAI_BASE_URL;
  const apiKey = process.env.AI_INTEGRATIONS_OPENAI_API_KEY;
  if (!baseURL || !apiKey) {
    throw new Error("AI integration not configured — no external SDK required");
  }
  return { baseURL, apiKey };
}

const voiceRateLimiter = new Map<string, { count: number; resetAt: number }>();
const VOICE_RATE_LIMIT = 20;
const VOICE_RATE_WINDOW = 60000;

function checkVoiceRateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = voiceRateLimiter.get(ip);
  if (!entry || now > entry.resetAt) {
    voiceRateLimiter.set(ip, { count: 1, resetAt: now + VOICE_RATE_WINDOW });
    return true;
  }
  if (entry.count >= VOICE_RATE_LIMIT) return false;
  entry.count++;
  return true;
}

export function registerVoiceRoutes(app: Express) {
  app.post("/api/voice/message", async (req: Request, res: Response) => {
    const clientIp = req.ip || req.socket.remoteAddress || "unknown";
    if (!checkVoiceRateLimit(clientIp)) {
      return res.status(429).json({ error: "Voice rate limit exceeded — try again shortly" });
    }
    const startTime = Date.now();
    try {
      const { audio, conversationContext } = req.body;

      if (!audio) {
        return res.status(400).json({ error: "Audio data required" });
      }

      let audioBuffer: Buffer;
      try {
        const base64Data = audio.replace(/^data:audio\/[^;]+;base64,/, "");
        audioBuffer = Buffer.from(base64Data, "base64");
      } catch {
        return res.status(400).json({ error: "Invalid audio data" });
      }

      if (audioBuffer.length < 100) {
        return res.status(400).json({ error: "Audio too short" });
      }

      if (audioBuffer.length > 25 * 1024 * 1024) {
        return res.status(413).json({ error: "Audio too large (max 25MB)" });
      }

      let wavBuffer: Buffer;
      try {
        wavBuffer = await convertWebmToWav(audioBuffer);
      } catch (err: any) {
        logger.info("VoiceEngine", `ffmpeg conversion failed: ${err.message}`);
        return res.status(422).json({ error: "Audio conversion failed" });
      }

      const aiConfig = getAIConfig();

      const audioBase64 = wavBuffer.toString("base64");

      let userTranscript = "";
      try {
        const formBody = new FormData();
        formBody.append("file", new Blob([wavBuffer], { type: "audio/wav" }), "audio.wav");
        formBody.append("model", "gpt-4o-mini-transcribe");
        formBody.append("response_format", "json");

        const transcribeRes = await fetch(`${aiConfig.baseURL}/audio/transcriptions`, {
          method: "POST",
          headers: { "Authorization": `Bearer ${aiConfig.apiKey}` },
          body: formBody,
        });
        const transcribeData = await transcribeRes.json();
        userTranscript = transcribeData?.text || "";
      } catch (err: any) {
        logger.info("VoiceEngine", `Transcription step failed: ${err.message?.slice(0, 100)}`);
      }

      if (!userTranscript.trim()) {
        const duration = Date.now() - startTime;
        return res.json({
          userTranscript: "",
          transcript: "",
          audio: null,
          duration,
          provider: "Sovereign-Voice",
        });
      }

      let contextMessages: { role: "system" | "user" | "assistant"; content: string }[] = [
        { role: "system", content: TESS_VOICE_SYSTEM_PROMPT },
      ];

      if (conversationContext && Array.isArray(conversationContext)) {
        const recentContext = conversationContext.slice(-6);
        for (const msg of recentContext) {
          if (msg.role && msg.content) {
            contextMessages.push({
              role: msg.role === "user" ? "user" : "assistant",
              content: scrubText(String(msg.content).slice(0, 500)),
            });
          }
        }
      }

      contextMessages = addNoiseToMessages(contextMessages) as typeof contextMessages;

      const completionRes = await sovereignPost(
        `${aiConfig.baseURL}/chat/completions`,
        {
          model: "gpt-audio",
          modalities: ["text", "audio"],
          audio: { voice: VOICE_ID, format: "wav" },
          messages: [
            ...contextMessages,
            {
              role: "user",
              content: [
                {
                  type: "input_audio",
                  input_audio: { data: audioBase64, format: "wav" },
                },
              ],
            },
          ],
        },
        {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${aiConfig.apiKey}`,
        },
        { timeout: 30000, caller: "voice-engine" }
      );

      const choice = completionRes.data?.choices?.[0];
      const audioResponse = choice?.message?.audio;
      const textContent = choice?.message?.content || "";

      let assistantTranscript = audioResponse?.transcript || textContent || "";
      assistantTranscript = filterResponse(assistantTranscript);
      assistantTranscript = assistantTranscript.replace(/\[ref:[^\]]*\]/g, "").trim();

      const responseAudio = audioResponse?.data || null;

      const duration = Date.now() - startTime;
      logger.info("VoiceEngine", `Voice response generated in ${duration}ms (user: "${userTranscript.slice(0, 50)}")`);

      res.json({
        userTranscript,
        transcript: assistantTranscript,
        audio: responseAudio,
        audioFormat: "wav",
        duration,
        provider: "Sovereign-Voice",
      });

    } catch (err: any) {
      const duration = Date.now() - startTime;
      logger.info("VoiceEngine", `Voice error after ${duration}ms: ${err.message?.slice(0, 200)}`);

      res.status(500).json({
        error: "Voice processing failed",
        transcript: "I'm here — let me try that again in a moment.",
        provider: "Sovereign-Voice-Fallback",
      });
    }
  });

  app.post("/api/voice/transcribe", async (req: Request, res: Response) => {
    const clientIp = req.ip || req.socket.remoteAddress || "unknown";
    if (!checkVoiceRateLimit(clientIp)) {
      return res.status(429).json({ error: "Rate limit exceeded" });
    }
    try {
      const { audio } = req.body;

      if (!audio) {
        return res.status(400).json({ error: "Audio data required" });
      }

      let audioBuffer: Buffer;
      try {
        const base64Data = audio.replace(/^data:audio\/[^;]+;base64,/, "");
        audioBuffer = Buffer.from(base64Data, "base64");
      } catch {
        return res.status(400).json({ error: "Invalid audio data" });
      }

      let wavBuffer: Buffer;
      try {
        wavBuffer = await convertWebmToWav(audioBuffer);
      } catch {
        return res.status(422).json({ error: "Audio conversion failed" });
      }

      const aiConfig = getAIConfig();

      const formBody = new FormData();
      formBody.append("file", new Blob([wavBuffer], { type: "audio/wav" }), "audio.wav");
      formBody.append("model", "gpt-4o-mini-transcribe");
      formBody.append("response_format", "json");

      const transcribeRes = await fetch(`${aiConfig.baseURL}/audio/transcriptions`, {
        method: "POST",
        headers: { "Authorization": `Bearer ${aiConfig.apiKey}` },
        body: formBody,
      });
      const transcription = await transcribeRes.json();

      const text = filterResponse(transcription?.text || "");

      res.json({ text, provider: "Sovereign-Transcribe" });

    } catch (err: any) {
      logger.info("VoiceEngine", `Transcribe error: ${err.message?.slice(0, 200)}`);
      res.status(500).json({ error: "Transcription failed" });
    }
  });

  app.post("/api/voice/tts", async (req: Request, res: Response) => {
    const clientIp = req.ip || req.socket.remoteAddress || "unknown";
    if (!checkVoiceRateLimit(clientIp)) {
      return res.status(429).json({ error: "Rate limit exceeded" });
    }
    try {
      const { text } = req.body;
      if (!text || typeof text !== "string") {
        return res.status(400).json({ error: "Text required" });
      }

      const clean = text.replace(/[*_`#\[\]()>|~^]/g, "")
        .replace(/https?:\/\/\S+/g, "")
        .replace(/\n{2,}/g, ". ")
        .replace(/\n/g, ", ")
        .substring(0, 2000);

      const scrubbedText = scrubText(clean);

      const aiConfig = getAIConfig();

      const ttsRes = await sovereignPost(
        `${aiConfig.baseURL}/chat/completions`,
        {
          model: "gpt-audio",
          modalities: ["text", "audio"],
          audio: { voice: VOICE_ID, format: "wav" },
          messages: [
            { role: "system", content: "Read the following text aloud in a natural, conversational tone. Do not add any commentary or extra words." },
            { role: "user", content: scrubbedText },
          ],
        },
        {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${aiConfig.apiKey}`,
        },
        { timeout: 30000, caller: "voice-tts" }
      );

      const choice = ttsRes.data?.choices?.[0];
      const audioData = choice?.message?.audio?.data || null;

      if (!audioData) {
        return res.status(500).json({ error: "No audio generated" });
      }

      res.json({ audio: audioData, provider: "Sovereign-TTS" });

    } catch (err: any) {
      logger.info("VoiceEngine", `TTS error: ${err.message?.slice(0, 200)}`);
      res.status(500).json({ error: "TTS failed" });
    }
  });

  logger.info("VoiceEngine", "Sovereign voice routes registered — secured channel active");
}
