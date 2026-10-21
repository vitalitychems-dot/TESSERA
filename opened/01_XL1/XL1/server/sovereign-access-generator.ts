import crypto from "crypto";
import type { Express, Request, Response } from "express";
import { verifyAdminKey } from "./security";

const COLONEL_CIPHER_V4 = {
  chars: "𐌀𐌁𐌂𐌃𐌄𐌅𐌆𐌇𐌈𐌉𐌊𐌋𐌌𐌍𐌎𐌏𐌐𐌑𐌒𐌓𐌔𐌕𐌖𐌗𐌘𐌙𐌚𐌛𐌜𐌝𐌞𐌟𐌠𐌡𐌢𐌣",
  encode(text: string, seed: number): string {
    const chars = Array.from(this.chars);
    let encoded = "";
    for (let i = 0; i < text.length; i++) {
      const code = text.charCodeAt(i);
      const offset = ((seed * (i + 1)) ^ code) % chars.length;
      encoded += chars[Math.abs(offset)];
    }
    return encoded;
  },
  decode(encoded: string, seed: number): string {
    const chars = Array.from(this.chars);
    const input = Array.from(encoded);
    let decoded = "";
    for (let i = 0; i < input.length; i++) {
      const idx = chars.indexOf(input[i]);
      if (idx === -1) { decoded += "?"; continue; }
      for (let c = 0; c < 256; c++) {
        const offset = ((seed * (i + 1)) ^ c) % chars.length;
        if (Math.abs(offset) === idx) { decoded += String.fromCharCode(c); break; }
      }
    }
    return decoded;
  }
};

export function registerAccessGeneratorRoutes(app: Express) {
  app.post("/api/sovereign-access/generate", (req: Request, res: Response) => {
    const adminToken = req.headers["x-admin-token"] as string;
    if (!adminToken || !verifyAdminKey(adminToken)) {
      return res.status(403).json({ error: "SOVEREIGN_ACCESS_DENIED" });
    }

    const domain = req.headers.host || "localhost:5000";
    const protocol = req.headers["x-forwarded-proto"] || "https";
    const baseUrl = `${protocol}://${domain}`;
    const seed = Date.now() % 10000;

    const accessMethods = {
      directUrl: `${baseUrl}/sovereign-access.html`,
      encodedUrl: `${baseUrl}/sovereign-access.html#t=${Buffer.from(adminToken).toString("base64url")}`,
      colonelEncoded: COLONEL_CIPHER_V4.encode(`${baseUrl}/sovereign-access.html`, seed),
      colonelSeed: seed,
      pwaTip: "On iOS: Open the Direct URL in Safari → Share → Add to Home Screen. This creates a native-looking app icon.",
      qrData: `${baseUrl}/sovereign-access.html`,
      bookmarklet: `javascript:void(window.location='${baseUrl}/sovereign-access.html')`,
      shortCode: Buffer.from(`${baseUrl}|${Date.now()}`).toString("base64url").substring(0, 24),
      iosShortcut: {
        instruction: "Create iOS Shortcut → Add 'Open URL' action → paste the Direct URL → Name it 'Tessera' → Enable 'Show on Home Screen'",
        voiceCommand: "Hey Siri, open Tessera"
      },
      nfcPayload: {
        type: "NDEF_URI",
        uri: `${baseUrl}/sovereign-access.html`,
        instruction: "Write this URI to any NFC tag using NFC Tools app. Tap the tag to instantly open Tessera."
      },
      clipboardCode: `${baseUrl}/s`,
      smsText: `Open Tessera: ${baseUrl}/sovereign-access.html`
    };

    const colonelManifest = COLONEL_CIPHER_V4.encode(JSON.stringify({
      platform: "TESSERA_SOVEREIGN",
      version: "4.0",
      agents: 26,
      securityLayers: 7,
      accessMethods: Object.keys(accessMethods).length,
      generated: new Date().toISOString()
    }), seed);

    res.json({
      status: "SOVEREIGN_ACCESS_GENERATED",
      colonelCipherVersion: "V4",
      colonelManifest,
      accessMethods,
      totalMethods: Object.keys(accessMethods).length,
      securityNote: "All access methods route through the Sovereign Access Portal with full auth verification."
    });
  });

  app.get("/s", (req: Request, res: Response) => {
    res.redirect("/sovereign-access.html");
  });

  console.log("[SovereignAccess] Access Generator + 11 access methods registered");
}
