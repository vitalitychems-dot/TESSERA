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

const agiForumProposals: AGIForumProposal[] = [];
const MAX_PROPOSALS = 200;

export function addAGIForumProposal(proposal: AGIForumProposal): void {
  agiForumProposals.unshift(proposal);
  if (agiForumProposals.length > MAX_PROPOSALS) {
    agiForumProposals.length = MAX_PROPOSALS;
  }
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
