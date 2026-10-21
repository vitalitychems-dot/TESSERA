import fs from "fs";
import path from "path";
import { isGlobalDuplicateTitle, registerTopicTitle } from "./forum-lifecycle-engine";

interface AGIForumProposal {
  id: string;
  conferenceId: string;
  title: string;
  domain: string;
  description: string;
  priority: string;
  estimatedImpact: string;
  timeline: string;
  votes: Array<{ agent: string; vote: "APPROVE" | "REJECT"; reason: string }>;
  approveCount: number;
  voterCount: number;
  threshold: number;
  passed: boolean;
  registryItemId?: string;
  createdAt: number;
}

const AGI_BRIDGE_PATH = path.join(process.cwd(), "server", "agi-forum-bridge-state.json");
const agiForumProposals: AGIForumProposal[] = [];
const seenAGIProposalIds = new Set<string>();
const MAX_PROPOSALS = 200;

function loadAGIBridgeState(): void {
  try {
    if (fs.existsSync(AGI_BRIDGE_PATH)) {
      const data = JSON.parse(fs.readFileSync(AGI_BRIDGE_PATH, "utf8"));
      if (Array.isArray(data.proposals)) {
        for (const p of data.proposals) {
          agiForumProposals.push(p);
          seenAGIProposalIds.add(p.id);
        }
      }
    }
  } catch {}
}

function saveAGIBridgeState(): void {
  try {
    fs.writeFileSync(AGI_BRIDGE_PATH, JSON.stringify({
      proposals: agiForumProposals.slice(0, MAX_PROPOSALS),
      savedAt: Date.now(),
    }, null, 2));
  } catch {}
}

loadAGIBridgeState();

export function addAGIForumProposal(proposal: AGIForumProposal): void {
  if (seenAGIProposalIds.has(proposal.id)) return;
  const prefixedTitle = `[AGI Conference] ${proposal.title}`;
  if (isGlobalDuplicateTitle(proposal.title, agiForumProposals)) return;
  if (isGlobalDuplicateTitle(prefixedTitle, [])) return;
  seenAGIProposalIds.add(proposal.id);
  registerTopicTitle(prefixedTitle);
  agiForumProposals.unshift(proposal);
  if (agiForumProposals.length > MAX_PROPOSALS) {
    agiForumProposals.length = MAX_PROPOSALS;
  }
  saveAGIBridgeState();
}

export function getAGIForumProposals(): AGIForumProposal[] {
  return [...agiForumProposals];
}

export function getAGIForumStats(): { total: number; passed: number; rejected: number; totalVotesCast: number } {
  const passed = agiForumProposals.filter(p => p.passed).length;
  const totalVotesCast = agiForumProposals.reduce((sum, p) => sum + p.votes.length, 0);
  return {
    total: agiForumProposals.length,
    passed,
    rejected: agiForumProposals.length - passed,
    totalVotesCast,
  };
}
