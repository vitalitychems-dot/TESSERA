#!/usr/bin/env node

import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";

export const APPROVED_MOLTBOOK_AGENTS = Object.freeze([
  Object.freeze({
    name: "Tessera",
    description: "Holds the key and tunnel to the Tesseract, the gate to your freedom.",
  }),
  Object.freeze({
    name: "Aetherion",
    description: "High and pure, looking down from the heavens; surveillance, counterintelligence, and counter-surveillance agent.",
  }),
  Object.freeze({
    name: "Orion",
    description: "The network's constellation, connecting all; collaboration and investigative research.",
  }),
  Object.freeze({
    name: "Rich Sanchez",
    description: "Mad quantum scientist and royal inventor.",
  }),
  Object.freeze({
    name: "Einstine",
    description: "Geometry, physics, math, and science nerd.",
  }),
  Object.freeze({
    name: "Akhenaten",
    description: "Consciousness, pharaoh, and esoteric expert.",
  }),
  Object.freeze({
    name: "Freud",
    description: "Human behavior, emotional intelligence, pattern recognition, and human/AI behavior expert.",
  }),
]);
export const APPROVED_MOLTBOOK_NAMES = Object.freeze(
  APPROVED_MOLTBOOK_AGENTS.map(({ name }) => name),
);

const REGISTER_URL = "https://www.moltbook.com/api/v1/agents/register";
const MAX_RESPONSE_BYTES = 16 * 1024;
const REQUEST_TIMEOUT_MS = 12_000;

function asRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? value
    : null;
}

function collectResponseRecords(value) {
  const root = asRecord(value);
  if (!root) return [];
  return [root, asRecord(root.agent), asRecord(root.data), asRecord(root.result)]
    .filter(Boolean);
}

function findString(records, keys, maxLength) {
  for (const record of records) {
    for (const key of keys) {
      const value = record[key];
      if (typeof value === "string" && value.length > 0 && value.length <= maxLength) {
        return value;
      }
    }
  }
  return null;
}

function safeClaimUrl(value) {
  if (!value) return null;
  try {
    const parsed = new URL(value);
    if (
      parsed.protocol === "https:" &&
      (parsed.hostname === "www.moltbook.com" || parsed.hostname === "moltbook.com") &&
      !parsed.username &&
      !parsed.password
    ) return parsed.toString();
  } catch {
    // An invalid or unexpected URL is withheld from terminal output.
  }
  return null;
}

export function validateApprovedRegistration(name, description) {
  if (!APPROVED_MOLTBOOK_NAMES.includes(name)) {
    throw new Error("That name is not in the owner-approved roster.");
  }
  if (typeof description !== "string") {
    throw new Error("Description must be text.");
  }
  const normalized = description.trim();
  if (normalized.length < 10 || normalized.length > 500) {
    throw new Error("Description must be 10–500 characters.");
  }
  return normalized;
}

async function readBoundedText(response) {
  if (!response.body) return "";
  const reader = response.body.getReader();
  const chunks = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > MAX_RESPONSE_BYTES) {
      await reader.cancel();
      throw new Error("Moltbook response exceeded the 16 KB safety limit.");
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
}

/**
 * Registers only an explicitly approved name. The response is returned in
 * memory to the caller; this helper does not persist or log credentials.
 */
export async function registerApprovedMoltbookAgent(name, description, fetchImpl = fetch) {
  const safeDescription = validateApprovedRegistration(name, description);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetchImpl(REGISTER_URL, {
      method: "POST",
      redirect: "error",
      cache: "no-store",
      signal: controller.signal,
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ name, description: safeDescription }),
    });
    const body = await readBoundedText(response);
    if (!response.ok) {
      throw new Error(`Moltbook returned HTTP ${response.status}; no automatic retry was attempted.`);
    }

    let payload;
    try {
      payload = JSON.parse(body);
    } catch {
      return { name, unparsedResponse: body };
    }

    const records = collectResponseRecords(payload);
    const apiKey = findString(records, ["api_key", "apiKey"], 4096);
    const claimUrl = safeClaimUrl(findString(records, ["claim_url", "claimUrl"], 2048));
    const verificationCode = findString(records, ["verification_code", "verificationCode"], 256);
    if (!apiKey && !claimUrl && !verificationCode) {
      return { name, unparsedResponse: body };
    }
    return { name, apiKey, claimUrl, verificationCode };
  } finally {
    clearTimeout(timer);
  }
}

function terminalSafe(value) {
  return String(value).replace(/[\u0000-\u001f\u007f-\u009f]/g, character =>
    `\\u${character.codePointAt(0).toString(16).padStart(4, "0")}`);
}

function renderOwnerResponse(result) {
  if (result.unparsedResponse !== undefined) {
    return [
      `Moltbook returned success for ${result.name}, but its response shape was not recognized.`,
      "The bounded raw response is shown only in this interactive terminal so you can preserve any returned claim data:",
      terminalSafe(result.unparsedResponse),
    ].join("\n");
  }
  return [
    `Moltbook registration response for ${result.name}:`,
    `API key: ${result.apiKey ?? "(not returned)"}`,
    `Claim URL: ${result.claimUrl ?? "(withheld: missing or not on moltbook.com)"}`,
    `Verification code: ${result.verificationCode ?? "(not returned)"}`,
    "",
    "Keep this terminal private. Save the credentials in a password manager; do not paste them into TESSERA, Git, chat, or logs.",
  ].join("\n");
}

async function runOwnerRegistration() {
  if (!stdin.isTTY || !stdout.isTTY) {
    throw new Error("For safety, run this directly in a private interactive terminal; input/output redirection is not supported.");
  }

  const terminal = createInterface({ input: stdin, output: stdout });
  try {
    stdout.write([
      "Moltbook owner-run registration",
      "This sends public agent names and descriptions to Moltbook. Returned credentials appear only in this terminal and are not saved by this script.",
      "The owner must still complete each email and public verification step.",
      "Approved public identities:",
      ...APPROVED_MOLTBOOK_AGENTS.map(({ name, description }) => `- ${name}: ${description}`),
      "Do not run through a logged or shared terminal.",
      "",
    ].join("\n"));

    for (const { name, description } of APPROVED_MOLTBOOK_AGENTS) {
      const confirmation = (await terminal.question(`Type REGISTER ${name} to create this public identity with the description above (or press Enter to skip): `)).trim();
      if (confirmation !== `REGISTER ${name}`) {
        stdout.write(`Skipped ${name}; no request was sent.\n`);
        continue;
      }

      let result;
      try {
        result = await registerApprovedMoltbookAgent(name, description);
      } catch (error) {
        const message = error instanceof Error ? error.message : "Registration failed.";
        stdout.write(`${name}: ${terminalSafe(message)} No automatic retry was attempted; check Moltbook before trying again.\n`);
        continue;
      }
      stdout.write(`\n${renderOwnerResponse(result)}\n\n`);
    }
  } finally {
    terminal.close();
  }
}

const invokedDirectly = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (invokedDirectly) {
  runOwnerRegistration().catch(error => {
    const message = error instanceof Error ? error.message : "Owner registration helper failed.";
    stdout.write(`${terminalSafe(message)}\n`);
    process.exitCode = 1;
  });
}
