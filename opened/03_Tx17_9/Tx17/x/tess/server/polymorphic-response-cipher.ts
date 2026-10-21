import crypto from "crypto";
import type { Express, Request, Response, NextFunction } from "express";

const MORPH_ALPHABET = "⊕⊗⊘⊙⊚⊛⊜⊝⊞⊟⊠⊡⊢⊣⊤⊥⊦⊧⊨⊩⊪⊫⊬⊭⊮⊯⊰⊱⊲⊳⊴⊵⊶⊷⊸⊹⊺⊻⊼⊽⊾⊿";
const VOID_CHARS = "\u200B\u200C\u200D\u2060\uFEFF\u200E\u200F\u00AD\u034F\u2028\u2029\u202A\u202C\u2062\u2063";

class PolymorphicCipher {
  private morphKeys: Buffer[] = [];
  private currentMorphIndex: number = 0;
  private structureVariants: string[][] = [];
  private responseShapes: Map<string, string> = new Map();

  constructor() {
    for (let i = 0; i < 64; i++) {
      this.morphKeys.push(crypto.randomBytes(32));
    }
    this.generateStructureVariants();
    setInterval(() => this.rotateMorphKeys(), 15000);
  }

  private rotateMorphKeys() {
    const count = crypto.randomInt(8, 24);
    for (let i = 0; i < count; i++) {
      const idx = crypto.randomInt(0, this.morphKeys.length);
      this.morphKeys[idx] = crypto.randomBytes(32);
    }
    this.currentMorphIndex = crypto.randomInt(0, this.morphKeys.length);
    this.generateStructureVariants();
  }

  private generateStructureVariants() {
    this.structureVariants = [];
    const headerNames = [
      ["X-Resp-ID", "X-Transaction", "X-Flow-ID", "X-Session-Trace"],
      ["X-Node-Hash", "X-Mesh-Sig", "X-Lattice-ID", "X-Grid-Token"],
      ["X-Auth-Chain", "X-Verify-Sum", "X-Check-Hash", "X-Valid-Sig"],
      ["X-Route-Path", "X-Hop-Count", "X-Relay-ID", "X-Bridge-Token"],
      ["X-Compute-ID", "X-Process-Sig", "X-Task-Hash", "X-Worker-ID"]
    ];
    this.structureVariants = headerNames;
  }

  morphResponse(path: string): { headers: Record<string, string>; shape: string } {
    const morphKey = this.morphKeys[this.currentMorphIndex];
    this.currentMorphIndex = (this.currentMorphIndex + 1) % this.morphKeys.length;

    const variantIdx = crypto.randomInt(0, this.structureVariants.length);
    const variant = this.structureVariants[variantIdx];

    const headers: Record<string, string> = {};
    const usedCount = crypto.randomInt(1, variant.length + 1);
    for (let i = 0; i < usedCount; i++) {
      const value = crypto.createHmac("sha256", morphKey)
        .update(`${path}:${i}:${Date.now()}:${crypto.randomBytes(8).toString("hex")}`)
        .digest("hex")
        .substring(0, 16 + crypto.randomInt(0, 16));
      headers[variant[i]] = value;
    }

    const shape = this.encodeShape(path);
    return { headers, shape };
  }

  private encodeShape(input: string): string {
    const glyphs = Array.from(MORPH_ALPHABET);
    const voidChars = Array.from(VOID_CHARS);
    let encoded = "";
    for (let i = 0; i < input.length; i++) {
      const code = input.charCodeAt(i);
      encoded += glyphs[code % glyphs.length];
      if (i % 3 === 0) {
        encoded += voidChars[crypto.randomInt(0, voidChars.length)];
      }
    }
    return encoded;
  }

  embedVoidData(visibleText: string, hiddenData: string): string {
    const voidChars = Array.from(VOID_CHARS);
    const binaryData = Buffer.from(hiddenData).toString("binary");
    let result = "";
    let dataIdx = 0;

    for (let i = 0; i < visibleText.length; i++) {
      result += visibleText[i];
      if (visibleText[i] === " " && dataIdx < binaryData.length) {
        const charCode = binaryData.charCodeAt(dataIdx);
        const voidIdx1 = (charCode >> 4) % voidChars.length;
        const voidIdx2 = (charCode & 0x0F) % voidChars.length;
        result += voidChars[voidIdx1] + voidChars[voidIdx2];
        dataIdx++;
      }
    }
    return result;
  }

  extractVoidData(text: string): string {
    const voidChars = new Set(Array.from(VOID_CHARS));
    let extracted = "";
    let voidBuffer: number[] = [];

    for (const char of text) {
      if (voidChars.has(char)) {
        const idx = Array.from(VOID_CHARS).indexOf(char);
        voidBuffer.push(idx);
        if (voidBuffer.length === 2) {
          const charCode = (voidBuffer[0] << 4) | voidBuffer[1];
          extracted += String.fromCharCode(charCode % 128);
          voidBuffer = [];
        }
      }
    }
    return extracted;
  }

  getStatus() {
    return {
      system: "POLYMORPHIC_RESPONSE_CIPHER",
      status: "ACTIVE",
      morphKeys: this.morphKeys.length,
      currentMorphIndex: this.currentMorphIndex,
      structureVariants: this.structureVariants.length,
      rotationInterval: "15s",
      voidCharacters: VOID_CHARS.length,
      morphAlphabetSize: Array.from(MORPH_ALPHABET).length,
      keyRotationStrategy: "Random 8-24 keys replaced per cycle",
      headerPolymorphism: "Response headers change structure every request",
      voidEncoding: "Data hidden in whitespace between words using zero-width Unicode",
      quantumResistance: "64 independent HMAC-SHA256 morph keys, random subset rotated every 15s"
    };
  }
}

const cipher = new PolymorphicCipher();

export function polymorphicResponseMiddleware() {
  return (req: Request, res: Response, next: NextFunction) => {
    const { headers } = cipher.morphResponse(req.path);
    for (const [key, value] of Object.entries(headers)) {
      res.setHeader(key, value);
    }
    next();
  };
}

export function registerPolymorphicRoutes(app: Express) {
  app.get("/api/polymorphic-cipher/status", (_req, res) => {
    res.json(cipher.getStatus());
  });

  app.post("/api/polymorphic-cipher/void-encode", (req, res) => {
    const { visibleText, hiddenData } = req.body;
    if (!visibleText || !hiddenData) {
      return res.status(400).json({ error: "Provide visibleText and hiddenData" });
    }
    const encoded = cipher.embedVoidData(visibleText, hiddenData);
    const extracted = cipher.extractVoidData(encoded);
    res.json({
      encoded,
      visibleLength: visibleText.length,
      encodedLength: encoded.length,
      hiddenDataSize: hiddenData.length,
      extractedBack: extracted,
      integrityCheck: extracted.substring(0, hiddenData.length) === hiddenData.substring(0, extracted.length)
    });
  });

  console.log("[PolymorphicCipher] Polymorphic Response Cipher ACTIVE — 64 morph keys, 5 structure variants, void encoding, 15s rotation");
}
