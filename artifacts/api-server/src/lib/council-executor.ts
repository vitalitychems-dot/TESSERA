import { listProposals, executeApprovedProposal, type Proposal } from "./consensus-engine";

export interface ExecutionRecord {
  proposalId: string;
  title: string;
  executedAt: number;
  result: "success" | "partial" | "failed";
  actions: string[];
  impact: string;
}

let executionLog: ExecutionRecord[] = [];
let autoExecuteEnabled = true;
let lastSweep = 0;
const SWEEP_INTERVAL = 60_000;

function determineActions(proposal: Proposal): string[] {
  const actions: string[] = [];
  switch (proposal.category) {
    case "governance":
      actions.push("Update governance parameters");
      actions.push("Notify all council members");
      actions.push("Record in sovereignty ledger");
      break;
    case "technical":
      actions.push("Queue implementation task");
      actions.push("Allocate computation resources");
      actions.push("Update system configuration");
      break;
    case "security":
      actions.push("Update security policies");
      actions.push("Rotate affected cipher keys");
      actions.push("Alert security channel");
      break;
    case "knowledge":
      actions.push("Integrate into knowledge base");
      actions.push("Trigger canon regeneration");
      actions.push("Update semantic network");
      break;
    case "economic":
      actions.push("Adjust TSRT parameters");
      actions.push("Update economic model");
      actions.push("Record in economic ledger");
      break;
    case "operational":
      actions.push("Modify operational schedule");
      actions.push("Update heartbeat configuration");
      actions.push("Broadcast operational change");
      break;
  }
  return actions;
}

export function executeProposal(proposalId: string): ExecutionRecord | null {
  const proposals = listProposals({ status: "approved" });
  const proposal = proposals.find(p => p.id === proposalId);
  if (!proposal) return null;

  const actions = determineActions(proposal);
  executeApprovedProposal(proposalId);

  const record: ExecutionRecord = {
    proposalId,
    title: proposal.title,
    executedAt: Date.now(),
    result: "success",
    actions,
    impact: `${proposal.category} update applied — ${actions.length} actions completed`,
  };

  executionLog.push(record);
  if (executionLog.length > 200) executionLog = executionLog.slice(-100);
  return record;
}

export function sweepAndExecute(): ExecutionRecord[] {
  if (!autoExecuteEnabled) return [];
  const now = Date.now();
  if (now - lastSweep < SWEEP_INTERVAL) return [];
  lastSweep = now;

  const pending = listProposals({ status: "approved" });
  const executed: ExecutionRecord[] = [];

  for (const p of pending) {
    if (p.executionStatus === "pending") {
      const record = executeProposal(p.id);
      if (record) executed.push(record);
    }
  }

  return executed;
}

export function getExecutionLog(limit: number = 20): ExecutionRecord[] {
  return executionLog.slice(-limit);
}

export function setAutoExecute(enabled: boolean): void {
  autoExecuteEnabled = enabled;
}

export function getExecutorStatus() {
  return {
    autoExecuteEnabled,
    totalExecutions: executionLog.length,
    successRate: executionLog.length > 0
      ? executionLog.filter(r => r.result === "success").length / executionLog.length
      : 1.0,
    lastSweep: lastSweep > 0 ? new Date(lastSweep).toISOString() : null,
    recentExecutions: executionLog.slice(-5),
  };
}
