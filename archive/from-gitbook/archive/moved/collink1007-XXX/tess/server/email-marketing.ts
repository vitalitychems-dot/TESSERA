/**
 * Email Marketing Automation — VitalitySupply.net
 * Agents auto-generate email sequences: welcome, education, reengagement
 */
import { callLLMSimple } from "./llm-helper";

const elog = (msg: string) => console.log("[EmailMarketing] " + msg);

export interface EmailSequence {
  id: string;
  name: string;
  trigger: "welcome" | "abandoned_cart" | "reengagement" | "supplement_education" | "tsrt_promo";
  emails: EmailTemplate[];
  active: boolean;
}

export interface EmailTemplate {
  subject: string;
  body: string;
  sendAfterDays: number;
  generatedAt: number;
}

const sequences: EmailSequence[] = [];
let initialized = false;

export async function initEmailMarketing(): Promise<void> {
  if (initialized) return;
  initialized = true;
  await generateDefaultSequences();
  elog("Email Marketing initialized — VitalitySupply sequences ready");
}

async function generateDefaultSequences(): Promise<void> {
  const defaultSeqs: Array<{ name: string; trigger: EmailSequence["trigger"]; count: number }> = [
    { name: "VitalitySupply Welcome Series", trigger: "welcome", count: 3 },
    { name: "Supplement Education Drip", trigger: "supplement_education", count: 5 },
    { name: "TSRT Token Intro", trigger: "tsrt_promo", count: 2 },
    { name: "Re-Engagement Campaign", trigger: "reengagement", count: 2 },
  ];

  for (const seq of defaultSeqs) {
    if (sequences.find(s => s.trigger === seq.trigger)) continue;
    const emails: EmailTemplate[] = [];
    for (let i = 0; i < seq.count; i++) {
      const prompt = `Write email #${i+1} of ${seq.count} for a "${seq.name}" sequence for vitalitysupply.net health supplements.
Subject line and body. Mention TSRT token in 30% of emails as an innovative payment option.
Be conversational, helpful, and never spammy. Return JSON: {"subject":"...","body":"..."}`;
      try {
        const raw = await callLLMSimple(prompt, 500);
        const parsed = JSON.parse(raw.match(/\{[\s\S]+\}/)?.[0] || "{}");
        if (parsed.subject && parsed.body) {
          emails.push({ subject: parsed.subject, body: parsed.body, sendAfterDays: i * 3, generatedAt: Date.now() });
        }
      } catch {}
      await new Promise(r => setTimeout(r, 2000));
    }
    if (emails.length > 0) {
      sequences.push({ id: `seq-${seq.trigger}`, name: seq.name, trigger: seq.trigger, emails, active: true });
      elog(`Generated ${emails.length}-email ${seq.name} sequence`);
    }
  }
}

export function getSequences(): EmailSequence[] { return sequences; }

export function getSequenceByTrigger(trigger: EmailSequence["trigger"]): EmailSequence | undefined {
  return sequences.find(s => s.trigger === trigger);
}

export async function generateCustomSequence(topic: string, emailCount = 3): Promise<EmailSequence> {
  const emails: EmailTemplate[] = [];
  for (let i = 0; i < emailCount; i++) {
    const prompt = `Write email #${i+1}/${emailCount} for topic: "${topic}". For vitalitysupply.net customers.
JSON format: {"subject":"...","body":"..."}`;
    try {
      const raw = await callLLMSimple(prompt, 500);
      const parsed = JSON.parse(raw.match(/\{[\s\S]+\}/)?.[0] || "{}");
      if (parsed.subject) emails.push({ subject: parsed.subject, body: parsed.body, sendAfterDays: i * 3, generatedAt: Date.now() });
    } catch {}
  }
  const seq: EmailSequence = { id: `seq-custom-${Date.now()}`, name: topic, trigger: "supplement_education", emails, active: true };
  sequences.push(seq);
  return seq;
}

elog("Email Marketing module loaded");
