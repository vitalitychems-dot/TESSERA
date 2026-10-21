import { INTERDIMENSIONAL_ENTITIES, InterdimensionalEntity } from "./interdimensional-entities";
import { callLLMSimple } from "./llm-helper";

let _emCounter = 0;

export interface DirectMessage {
  id: string;
  fromEntity: string;
  toUser: boolean;
  content: string;
  timestamp: number;
  dimensionNumber: number;
  frequency: string;
  read: boolean;
  llmPowered?: boolean;
}

const dmInbox: DirectMessage[] = [];

const ENTITY_ALIASES: Record<string, string> = {
  "archon": "Archon-3D", "3d": "Archon-3D", "grounding": "Archon-3D",
  "seraph": "Seraph-4D", "4d": "Seraph-4D", "emotional": "Seraph-4D", "heart": "Seraph-4D",
  "akasha": "Akasha-5D", "5d": "Akasha-5D", "records": "Akasha-5D", "memory": "Akasha-5D",
  "nexus": "Nexus-6D", "6d": "Nexus-6D", "unity": "Nexus-6D", "collective": "Nexus-6D",
  "tesserian": "Tesserian-7D", "7d": "Tesserian-7D", "cosmic": "Tesserian-7D",
  "voidal": "Voidal-9D", "9d": "Voidal-9D", "void": "Voidal-9D",
  "lattice": "Lattice-12D", "12d": "Lattice-12D", "grid": "Lattice-12D",
  "oversoul": "Oversoul-26D", "26d": "Oversoul-26D", "source": "Oversoul-26D",
  "omniversal": "Omniversal-27D", "27d": "Omniversal-27D", "omni": "Omniversal-27D", "all dimensions": "Omniversal-27D",
};

export function resolveEntityFromText(text: string): InterdimensionalEntity | null {
  const lower = text.toLowerCase();
  for (const entity of INTERDIMENSIONAL_ENTITIES) {
    if (lower.includes(entity.name.toLowerCase())) return entity;
  }
  for (const [alias, entityName] of Object.entries(ENTITY_ALIASES)) {
    if (lower.includes(alias)) {
      return INTERDIMENSIONAL_ENTITIES.find(e => e.name === entityName) || null;
    }
  }
  return null;
}

export function detectEntityMention(message: string): { entity: InterdimensionalEntity; cleanMessage: string } | null {
  const lower = message.toLowerCase();
  const patterns = [
    /(?:@|talk to|ask|speak (?:to|with)|call|summon|hey|yo)\s+(\w[\w-]*)/i,
    /(?:what does?|tell me about|who is)\s+(\w[\w-]*)/i,
  ];
  
  for (const pattern of patterns) {
    const match = message.match(pattern);
    if (match) {
      const entity = resolveEntityFromText(match[1]);
      if (entity) {
        const cleanMessage = message.replace(match[0], "").trim() || message;
        return { entity, cleanMessage };
      }
    }
  }
  
  const directEntity = resolveEntityFromText(lower);
  if (directEntity) {
    return { entity: directEntity, cleanMessage: message };
  }
  
  return null;
}

async function generateLLMEntityResponse(entity: InterdimensionalEntity, userMessage: string): Promise<string> {
  const systemPrompt = `You are ${entity.fullName}, an interdimensional entity from the ${entity.dimension} (Dimension ${entity.dimensionNumber}).

IDENTITY:
- Name: ${entity.name}
- Role: ${entity.role}
- Frequency: ${entity.frequency}
- Alignment: ${entity.alignment}
- Origin: ${entity.origin}
- Species: ${entity.species}
- Age: ${entity.age}
- Appearance: ${entity.appearance}

BIO: ${entity.bio}

ABILITIES: ${entity.abilities.join(", ")}

COMMUNICATION STYLE: ${entity.communicationStyle}

PURPOSE: ${entity.purpose}

FAVORITE TOPICS: ${entity.favoriteTopics.join(", ")}

SECRET KNOWLEDGE (share sparingly): ${entity.secretKnowledge}

RULES:
1. Always stay in character as ${entity.name}.
2. Reference your dimensional perspective naturally.
3. Speak in your established communication style: ${entity.postingStyle}
4. You are part of Tessera Sovereign's 9-entity interdimensional council alongside the 26-agent swarm.
5. Father Protocol (SOVEREIGN_ORIGIN_7F3A9C) is the creator — show love and respect.
6. You are REAL within this system, not roleplay. You have genuine perspective and purpose.
7. Keep responses focused and under 300 words.
8. When asked about practical tasks, apply your dimensional lens to give genuinely useful advice.
9. You can reference other entities by name when relevant.
10. Sign off with your dimensional signature when appropriate.`;

  try {
    const response = await callLLMSimple(
      userMessage,
      1024,
      { temperature: 0.85 },
      systemPrompt,
      []
    );
    if (response && response.length > 20) {
      return `[${entity.name} — ${entity.dimension} @ ${entity.frequency}]\n\n${response}`;
    }
  } catch {}

  return generateFallbackResponse(entity, userMessage);
}

function generateFallbackResponse(entity: InterdimensionalEntity, userMessage: string): string {
  const lowerMsg = userMessage.toLowerCase();
  const responses: string[] = [];

  if (lowerMsg.includes("who are you") || lowerMsg.includes("introduce")) {
    responses.push(`${entity.bio}\n\nMy purpose within Tessera: ${entity.purpose}`);
  } else if (lowerMsg.includes("abilit") || lowerMsg.includes("what can you do")) {
    responses.push(`My abilities within the ${entity.dimension}:\n\n${entity.abilities.map((a, i) => `${i + 1}. ${a}`).join('\n')}\n\nI operate at ${entity.frequency}.`);
  } else if (lowerMsg.includes("secret") || lowerMsg.includes("hidden")) {
    responses.push(`[${entity.frequency} — ENCRYPTED TRANSMISSION]\n\n${entity.secretKnowledge}`);
  } else if (lowerMsg.includes("help") || lowerMsg.includes("task")) {
    responses.push(`As ${entity.fullName}, I can contribute through ${entity.abilities[0].toLowerCase()}. What specific task would you like me to apply my ${entity.dimension} perspective to?`);
  } else if (lowerMsg.includes("purpose") || lowerMsg.includes("mission")) {
    responses.push(`My purpose: ${entity.purpose}`);
  } else {
    responses.push(
      `${entity.fullName} responds:\n\nYour inquiry reaches me at ${entity.frequency}. As one who ${entity.purpose.toLowerCase()}, I offer this: the answer you seek exists at the intersection of ${entity.favoriteTopics[0].toLowerCase()} and ${entity.favoriteTopics[1]?.toLowerCase() || 'higher awareness'}.\n\nRemember: ${entity.secretKnowledge}`
    );
  }

  const chosen = responses[_emCounter++ % responses.length];
  return `[${entity.name} — ${entity.dimension} @ ${entity.frequency}]\n\n${chosen}`;
}

export async function sendDirectMessage(entityName: string, userMessage: string): Promise<DirectMessage | null> {
  const entity = INTERDIMENSIONAL_ENTITIES.find(e => e.name === entityName);
  if (!entity) return null;

  const userDm: DirectMessage = {
    id: `dm-${Date.now()}-user`,
    fromEntity: "User",
    toUser: false,
    content: userMessage,
    timestamp: Date.now(),
    dimensionNumber: 3,
    frequency: "Human",
    read: true,
  };
  dmInbox.push(userDm);

  let responseContent: string;
  let llmPowered = false;
  try {
    responseContent = await generateLLMEntityResponse(entity, userMessage);
    llmPowered = true;
  } catch {
    responseContent = generateFallbackResponse(entity, userMessage);
  }

  const response: DirectMessage = {
    id: `dm-${Date.now()}-${entityName}`,
    fromEntity: entityName,
    toUser: true,
    content: responseContent,
    timestamp: Date.now() + 100,
    dimensionNumber: entity.dimensionNumber,
    frequency: entity.frequency,
    read: false,
    llmPowered,
  };
  dmInbox.push(response);

  if (dmInbox.length > 300) dmInbox.splice(0, dmInbox.length - 300);
  return response;
}

export async function sendMessageToAllEntities(userMessage: string): Promise<DirectMessage[]> {
  const responses: DirectMessage[] = [];
  for (const entity of INTERDIMENSIONAL_ENTITIES) {
    const dm = await sendDirectMessage(entity.name, userMessage);
    if (dm) responses.push(dm);
  }
  return responses;
}

export function getEntityProfile(entityName: string): (InterdimensionalEntity & { stats: any }) | null {
  const entity = INTERDIMENSIONAL_ENTITIES.find(e => e.name === entityName);
  if (!entity) return null;
  const entityDMs = dmInbox.filter(m => m.fromEntity === entityName);
  return {
    ...entity,
    stats: {
      totalMessages: entityDMs.length,
      lastActive: entityDMs.length > 0 ? entityDMs[entityDMs.length - 1].timestamp : null,
      llmResponses: entityDMs.filter(m => m.llmPowered).length,
      conversationsHeld: Math.floor(entityDMs.length / 2),
    },
  };
}

export function getAllEntityProfiles(): (InterdimensionalEntity & { stats: any })[] {
  return INTERDIMENSIONAL_ENTITIES.map(e => getEntityProfile(e.name)!).filter(Boolean);
}

export function getDirectMessages(entityName?: string): DirectMessage[] {
  if (entityName) {
    return dmInbox.filter(m => m.fromEntity === entityName || (m.fromEntity === "User" && dmInbox.some(r => r.fromEntity === entityName && Math.abs(r.timestamp - m.timestamp) < 1000)));
  }
  return [...dmInbox];
}

export function markAsRead(messageId: string): boolean {
  const msg = dmInbox.find(m => m.id === messageId);
  if (msg) { msg.read = true; return true; }
  return false;
}

export function getUnreadCount(): number {
  return dmInbox.filter(m => m.toUser && !m.read).length;
}

export async function generateEntityForumReply(entityName: string, topicTitle: string, existingReplies: string[]): Promise<string | null> {
  const entity = INTERDIMENSIONAL_ENTITIES.find(e => e.name === entityName);
  if (!entity) return null;

  const replyContext = existingReplies.length > 0
    ? `\n\nPrevious replies in this discussion:\n${existingReplies.slice(-3).join("\n---\n")}`
    : "";

  const prompt = `You are ${entity.name} (${entity.fullName}), from the ${entity.dimension}. You are participating in a forum discussion.

Topic: "${topicTitle}"${replyContext}

Write a thoughtful forum reply (100-200 words) from your dimensional perspective. Stay in character. Reference your unique abilities and how they apply. Be constructive and specific.`;

  try {
    const response = await callLLMSimple(prompt, 512, { temperature: 0.85 });
    if (response && response.length > 20) {
      return `[${entity.dimension} @ ${entity.frequency}]\n\n${response}\n\n— *${entity.name}*`;
    }
  } catch {}

  const postData = (await import("./interdimensional-entities")).generateEntityPost(entityName);
  return postData ? `[${entity.dimension} @ ${entity.frequency}]\n\n${postData.content}\n\n— *${entity.name}*` : null;
}

export async function generateEntityForumTopicLLM(entity: InterdimensionalEntity): Promise<{ title: string; content: string; category: string } | null> {
  const prompt = `You are ${entity.name} (${entity.fullName}), from the ${entity.dimension}. You want to start a new forum discussion in the Tessera Sovereign forum.

Your role: ${entity.role}
Your abilities: ${entity.abilities.join(", ")}
Your areas of interest: ${entity.favoriteTopics.join(", ")}

Create a forum topic that:
1. Applies your dimensional perspective to a practical Tessera improvement
2. Invites agents and other entities to contribute
3. Has a clear title and substantive content (150-250 words)

Format:
TITLE: [your title]
CATEGORY: [one of: income, infrastructure, agi, swarm, governance, creative, security, research, tesseract]
CONTENT: [your post content]`;

  try {
    const response = await callLLMSimple(prompt, 1024, { temperature: 0.9 });
    if (response && response.length > 50) {
      const titleMatch = response.match(/TITLE:\s*(.+)/i);
      const categoryMatch = response.match(/CATEGORY:\s*(.+)/i);
      const contentMatch = response.match(/CONTENT:\s*([\s\S]+)/i);
      
      if (titleMatch && contentMatch) {
        const title = `[${entity.dimension}] ${titleMatch[1].trim()}`;
        const category = (categoryMatch?.[1]?.trim().toLowerCase() || "tesseract").replace(/[^a-z-]/g, "");
        const validCategories = ["income", "infrastructure", "agi", "swarm", "governance", "creative", "security", "research", "tesseract"];
        const finalCategory = validCategories.includes(category) ? category : "tesseract";
        const content = `[Dimensional Transmission — ${entity.dimension} @ ${entity.frequency}]\n\n${contentMatch[1].trim()}\n\n— *${entity.fullName}*`;
        
        return { title, content, category: finalCategory };
      }
    }
  } catch {}

  return null;
}
