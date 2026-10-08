import { createProposalLLM, ConsensusProposal } from "./consensus-engine";
import { addActionItem } from "./action-registry";
import { callLLMSimple } from "./llm-helper";

const LOG_PREFIX = "[ConvProposalBridge]";

export interface ConversationProposalRecord {
  conversationId: string;
  proposalIds: string[];
  messageCount: number;
  triggeredAt: number;
  source: "chat" | "conference";
  sourceId?: string | number;
}

const conversationProposalMap = new Map<string, ConversationProposalRecord>();
const conversationMessageCounts = new Map<string, number>();
const conferenceProposalMap = new Map<string | number, string[]>();

const ACTIONABLE_KEYWORDS = [
  "should", "implement", "build", "fix", "create", "deploy", "add", "remove",
  "update", "improve", "enable", "disable", "integrate", "optimize", "refactor",
  "propose", "suggest", "need to", "we must", "let's", "what if we", "could we",
  "action item", "next step", "roadmap", "priority", "execute", "launch",
];

export const PROPOSAL_THRESHOLD = 5;

export function incrementConversationMessage(conversationId: string): number {
  const count = (conversationMessageCounts.get(conversationId) || 0) + 1;
  conversationMessageCounts.set(conversationId, count);
  return count;
}

export function isActionableMessage(content: string): boolean {
  if (!content || content.length < 20) return false;
  const lower = content.toLowerCase();
  return ACTIONABLE_KEYWORDS.some(kw => lower.includes(kw));
}

export function hasConversationProposals(conversationId: string): boolean {
  return conversationProposalMap.has(conversationId);
}

export function getConversationProposals(conversationId?: string): ConversationProposalRecord[] {
  if (conversationId) {
    const record = conversationProposalMap.get(conversationId);
    return record ? [record] : [];
  }
  return Array.from(conversationProposalMap.values())
    .sort((a, b) => b.triggeredAt - a.triggeredAt)
    .slice(0, 50);
}

export function getConferenceProposals(conferenceId: string | number): string[] {
  return conferenceProposalMap.get(conferenceId) || [];
}

export function getAllConferenceProposalLinks(): Array<{ conferenceId: string | number; proposalIds: string[] }> {
  return Array.from(conferenceProposalMap.entries())
    .map(([conferenceId, proposalIds]) => ({ conferenceId, proposalIds }));
}

async function extractProposalsFromText(
  text: string,
  source: string,
  maxProposals: number = 3
): Promise<Array<{ title: string; description: string; category: "feature" | "security" | "infrastructure" | "governance" | "income" | "community" }>> {
  try {
    const prompt = `Analyze this conversation/conference text and extract ${maxProposals} formal governance proposals.

TEXT:
${text.slice(0, 3000)}

Extract the most actionable, concrete proposals mentioned or implied. For each proposal:
- Focus on specific things to build, fix, implement, or change
- Avoid vague or philosophical proposals
- Prefer proposals with clear implementation paths

Respond ONLY with a JSON array:
[
  {
    "title": "Concise proposal title (max 80 chars)",
    "description": "2-3 sentence description of what should be done and why",
    "category": "feature|security|infrastructure|governance|income|community"
  }
]

Only output the JSON array, no other text.`;

    const response = await callLLMSimple(prompt, 500, {}, "You are a governance proposal extraction engine. Extract actionable proposals from discussions.", []);
    const text2 = String(response || "").trim();
    const jsonMatch = text2.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed.slice(0, maxProposals).map((p: any) => ({
          title: String(p.title || "Untitled Proposal").slice(0, 120),
          description: String(p.description || "Extracted from discussion"),
          category: ["feature", "security", "infrastructure", "governance", "income", "community"].includes(p.category)
            ? p.category
            : "feature",
        }));
      }
    }
  } catch (e: any) {
    console.error(`${LOG_PREFIX} Proposal extraction failed:`, e?.message);
  }
  return [];
}

export async function extractProposalsFromConference(
  conferenceId: number | string,
  summary: string,
  topic: string,
  decisions?: string
): Promise<ConsensusProposal[]> {
  const sourceText = `Conference Topic: ${topic}\n\nSummary:\n${summary}\n\n${decisions ? `Decisions:\n${decisions}` : ""}`;
  const proposalDefs = await extractProposalsFromText(sourceText, `Conference #${conferenceId}`, 3);

  const createdProposals: ConsensusProposal[] = [];

  for (const def of proposalDefs) {
    try {
      const proposedBy = `Conference #${conferenceId} Auto-Extract`;
      const proposal = await createProposalLLM(
        def.title,
        `[Auto-extracted from Conference #${conferenceId}: "${topic}"]\n\n${def.description}`,
        proposedBy,
        def.category,
        { source: "conference", sourceId: conferenceId, autoGenerated: true }
      );

      createdProposals.push(proposal);

      if (proposal.status === "approved") {
        addActionItem({
          title: proposal.title,
          source: `Conference #${conferenceId} → Auto-Proposal → Consensus Approved`,
          category: proposal.category,
          priority: "high",
          status: "pending",
          assignedAgent: "Tessera-Prime",
          notes: `Conference-extracted proposal approved by 2/3 vote. ${proposal.implementationNotes || ""}`,
        });
        console.log(`${LOG_PREFIX} Conference proposal APPROVED and queued: "${proposal.title}"`);
      } else {
        console.log(`${LOG_PREFIX} Conference proposal REJECTED: "${proposal.title}"`);
      }
    } catch (e: any) {
      console.error(`${LOG_PREFIX} Failed to create proposal from conference ${conferenceId}:`, e?.message);
    }
  }

  if (createdProposals.length > 0) {
    const existingIds = conferenceProposalMap.get(conferenceId) || [];
    conferenceProposalMap.set(conferenceId, [...existingIds, ...createdProposals.map(p => p.id)]);
    console.log(`${LOG_PREFIX} Conference #${conferenceId}: created ${createdProposals.length} consensus proposals`);
  }

  return createdProposals;
}

export async function checkAndTriggerChatProposal(
  conversationId: string,
  allMessages: Array<{ role: string; content: string }>,
  latestMessage: string
): Promise<ConsensusProposal[] | null> {
  const count = incrementConversationMessage(conversationId);

  if (count < PROPOSAL_THRESHOLD) return null;
  if (hasConversationProposals(conversationId) && count - PROPOSAL_THRESHOLD < 5) return null;

  const actionableMessages = allMessages.filter(m => isActionableMessage(m.content));
  if (actionableMessages.length < 2) return null;

  const conversationText = allMessages
    .slice(-10)
    .map(m => `${m.role}: ${m.content}`)
    .join("\n");

  const proposalDefs = await extractProposalsFromText(conversationText, `Chat conversation ${conversationId}`, 2);
  if (proposalDefs.length === 0) return null;

  const createdProposals: ConsensusProposal[] = [];

  for (const def of proposalDefs) {
    try {
      const proposal = await createProposalLLM(
        def.title,
        `[Auto-extracted from chat conversation]\n\n${def.description}`,
        `Chat-Auto-Extract (${conversationId.slice(0, 8)})`,
        def.category,
        { source: "chat", sourceId: conversationId.slice(0, 8), autoGenerated: true }
      );

      createdProposals.push(proposal);

      if (proposal.status === "approved") {
        addActionItem({
          title: proposal.title,
          source: `Chat Conversation → Auto-Proposal → Consensus Approved`,
          category: proposal.category,
          priority: "medium",
          status: "pending",
          assignedAgent: "Tessera-Prime",
          notes: `Chat-extracted proposal approved by 2/3 vote. ${proposal.implementationNotes || ""}`,
        });
      }
    } catch (e: any) {
      console.error(`${LOG_PREFIX} Chat proposal creation failed:`, e?.message);
    }
  }

  if (createdProposals.length > 0) {
    const record: ConversationProposalRecord = {
      conversationId,
      proposalIds: createdProposals.map(p => p.id),
      messageCount: count,
      triggeredAt: Date.now(),
      source: "chat",
    };
    conversationProposalMap.set(conversationId, record);
    console.log(`${LOG_PREFIX} Chat ${conversationId}: extracted ${createdProposals.length} proposals at message ${count}`);
  }

  return createdProposals.length > 0 ? createdProposals : null;
}

export function getPipelineStatus(): {
  totalConferenceProposalLinks: number;
  totalChatConversationsWithProposals: number;
  totalProposalsGenerated: number;
  recentActivity: Array<{ source: string; proposalCount: number; triggeredAt: number }>;
} {
  const conferenceLinks = Array.from(conferenceProposalMap.entries());
  const chatRecords = Array.from(conversationProposalMap.values());

  const totalProposalsGenerated =
    conferenceLinks.reduce((sum, [, ids]) => sum + ids.length, 0) +
    chatRecords.reduce((sum, r) => sum + r.proposalIds.length, 0);

  const recentActivity = [
    ...conferenceLinks.map(([id, ids]) => ({
      source: `Conference #${id}`,
      proposalCount: ids.length,
      triggeredAt: 0,
    })),
    ...chatRecords.map(r => ({
      source: `Chat ${r.conversationId.slice(0, 8)}`,
      proposalCount: r.proposalIds.length,
      triggeredAt: r.triggeredAt,
    })),
  ].sort((a, b) => b.triggeredAt - a.triggeredAt).slice(0, 20);

  return {
    totalConferenceProposalLinks: conferenceLinks.length,
    totalChatConversationsWithProposals: chatRecords.length,
    totalProposalsGenerated,
    recentActivity,
  };
}
