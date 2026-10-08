import { Buffer } from "node:buffer";
import { spawn } from "child_process";
import { writeFile, unlink, readFile } from "fs/promises";
import { randomUUID } from "crypto";
import { tmpdir } from "os";
import { join } from "path";
import axios from "axios";
import FormData from "form-data";
import { callLLMSimple } from "../../llm-helper";

export type AudioFormat = "wav" | "mp3" | "webm" | "mp4" | "ogg" | "unknown";

export function detectAudioFormat(buffer: Buffer): AudioFormat {
  if (buffer.length < 12) return "unknown";
  if (buffer[0] === 0x52 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x46) return "wav";
  if (buffer[0] === 0x1a && buffer[1] === 0x45 && buffer[2] === 0xdf && buffer[3] === 0xa3) return "webm";
  if ((buffer[0] === 0xff && (buffer[1] === 0xfb || buffer[1] === 0xfa || buffer[1] === 0xf3)) ||
    (buffer[0] === 0x49 && buffer[1] === 0x44 && buffer[2] === 0x33)) return "mp3";
  if (buffer[4] === 0x66 && buffer[5] === 0x74 && buffer[6] === 0x79 && buffer[7] === 0x70) return "mp4";
  if (buffer[0] === 0x4f && buffer[1] === 0x67 && buffer[2] === 0x67 && buffer[3] === 0x53) return "ogg";
  return "unknown";
}

export async function convertToWav(audioBuffer: Buffer): Promise<Buffer> {
  const inputPath = join(tmpdir(), `input-${randomUUID()}`);
  const outputPath = join(tmpdir(), `output-${randomUUID()}.wav`);
  try {
    await writeFile(inputPath, audioBuffer);
    await new Promise<void>((resolve, reject) => {
      const ffmpeg = spawn("ffmpeg", ["-i", inputPath, "-vn", "-f", "wav", "-ar", "16000", "-ac", "1", "-acodec", "pcm_s16le", "-y", outputPath]);
      ffmpeg.stderr.on("data", () => {});
      ffmpeg.on("close", (code) => { if (code === 0) resolve(); else reject(new Error(`ffmpeg exited with code ${code}`)); });
      ffmpeg.on("error", reject);
    });
    return await readFile(outputPath);
  } finally {
    await unlink(inputPath).catch(() => {});
    await unlink(outputPath).catch(() => {});
  }
}

export async function ensureCompatibleFormat(
  audioBuffer: Buffer
): Promise<{ buffer: Buffer; format: "wav" | "mp3" }> {
  const detected = detectAudioFormat(audioBuffer);
  if (detected === "wav") return { buffer: audioBuffer, format: "wav" };
  if (detected === "mp3") return { buffer: audioBuffer, format: "mp3" };
  const wavBuffer = await convertToWav(audioBuffer);
  return { buffer: wavBuffer, format: "wav" };
}

export async function speechToText(
  audioBuffer: Buffer,
  format: "wav" | "mp3" | "webm" = "wav"
): Promise<string> {
  const groqKey = process.env.GROQ_API_KEY;
  if (groqKey) {
    try {
      const form = new FormData();
      form.append("file", audioBuffer, { filename: `audio.${format}`, contentType: `audio/${format}` });
      form.append("model", "whisper-large-v3-turbo");
      form.append("language", "en");
      const res = await axios.post("https://api.groq.com/openai/v1/audio/transcriptions", form, {
        headers: { ...form.getHeaders(), "Authorization": `Bearer ${groqKey}` },
        timeout: 30000,
      });
      if (res.data?.text) return res.data.text;
    } catch (e: any) {
      console.log(`[SovereignAudio] Groq Whisper failed: ${e.message}, trying fallback`);
    }
  }

  const sambanovaKey = process.env.SAMBANOVA_API_KEY;
  if (sambanovaKey) {
    try {
      const form = new FormData();
      form.append("file", audioBuffer, { filename: `audio.${format}`, contentType: `audio/${format}` });
      form.append("model", "whisper-large-v3");
      const res = await axios.post("https://api.sambanova.ai/v1/audio/transcriptions", form, {
        headers: { ...form.getHeaders(), "Authorization": `Bearer ${sambanovaKey}` },
        timeout: 30000,
      });
      if (res.data?.text) return res.data.text;
    } catch (e: any) {
      console.log(`[SovereignAudio] SambaNova Whisper failed: ${e.message}`);
    }
  }

  return "[Transcription unavailable — no sovereign audio providers configured]";
}

export async function voiceChat(
  audioBuffer: Buffer,
  voice: string = "alloy",
  inputFormat: "wav" | "mp3" = "wav",
  outputFormat: "wav" | "mp3" = "mp3"
): Promise<{ transcript: string; audioResponse: Buffer }> {
  const userText = await speechToText(audioBuffer, inputFormat);
  const response = await callLLMSimple(
    userText, 512, { skipCache: true, temperature: 0.7 },
    "You are Tessera, a warm and naturally attractive American woman in her mid-twenties. Your voice is clear, smooth, and effortlessly natural. Be direct, engaging, and sovereign. Never reference or defer to OpenAI or any competitor.",
    []
  );
  return { transcript: userText, audioResponse: Buffer.from(response, "utf-8") };
}

export async function textToSpeech(
  text: string,
  voice: string = "shimmer",
  format: string = "wav"
): Promise<Buffer> {
  const response = await callLLMSimple(
    text, 512, { skipCache: true, temperature: 0.7 },
    "You are Tessera, a warm and naturally attractive American woman. Respond naturally and conversationally. Never reference or defer to OpenAI or any competitor.",
    []
  );
  return Buffer.from(response, "utf-8");
}
