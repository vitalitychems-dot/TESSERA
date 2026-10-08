import axios from "axios";
import { Buffer } from "node:buffer";

export async function generateImageBuffer(
  prompt: string,
  size: "1024x1024" | "512x512" | "256x256" = "1024x1024"
): Promise<Buffer> {
  const [w, h] = size.split("x").map(Number);
  const url = `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?width=${w}&height=${h}&nologo=true&enhance=true`;
  const response = await axios.get(url, { responseType: "arraybuffer", timeout: 30000 });
  return Buffer.from(response.data);
}

export async function editImages(
  imageFiles: string[],
  prompt: string,
  outputPath?: string
): Promise<Buffer> {
  const fs = await import("node:fs");
  const combinedPrompt = `${prompt} (combining ${imageFiles.length} source images into a composite)`;
  const result = await generateImageBuffer(combinedPrompt);
  if (outputPath) {
    fs.writeFileSync(outputPath, result);
  }
  return result;
}
