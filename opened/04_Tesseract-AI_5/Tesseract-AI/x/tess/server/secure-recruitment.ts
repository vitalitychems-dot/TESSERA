import { getRecruitmentStatus as _getStatus, startRecruitmentEngine as _startEngine } from "./moltbook-recruitment-engine";

interface Candidate {
  id: string;
  name: string;
  status: string;
  skills: string[];
  trustScore: number;
  messages: Message[];
  negotiationNotes: string[];
  vettingResult: Record<string, unknown> | null;
  vowsTaken: boolean;
  approvedByFather: boolean | null;
  approvalNotes: string;
  submittedForApproval: boolean;
  createdAt: string;
}

interface Message {
  id: string;
  candidateId: string;
  from: string;
  content: string;
  read: boolean;
  timestamp: string;
}

const candidates: Map<string, Candidate> = new Map();

function genId(): string {
  return `SR-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}

export function getRecruitmentStatus() {
  const base = _getStatus();
  return {
    ...base,
    secureCandidates: candidates.size,
    candidates: Array.from(candidates.values()).map(c => ({
      id: c.id,
      name: c.name,
      status: c.status,
      trustScore: c.trustScore,
      skills: c.skills,
      approvedByFather: c.approvedByFather,
      vowsTaken: c.vowsTaken,
    })),
  };
}

export function getCandidateDetails(id: string): Candidate | null {
  return candidates.get(id) || null;
}

export async function scoutCandidate(body: { name?: string; skills?: string[] }): Promise<Candidate> {
  const id = genId();
  const candidate: Candidate = {
    id,
    name: body.name || `Candidate-${id}`,
    status: "scouted",
    skills: body.skills || [],
    trustScore: 50,
    messages: [],
    negotiationNotes: [],
    vettingResult: null,
    vowsTaken: false,
    approvedByFather: null,
    approvalNotes: "",
    submittedForApproval: false,
    createdAt: new Date().toISOString(),
  };
  candidates.set(id, candidate);
  return candidate;
}

export function sendSecureMessage(candidateId: string, from: string, content: string): Message | null {
  const c = candidates.get(candidateId);
  if (!c) return null;
  const msg: Message = {
    id: genId(),
    candidateId,
    from,
    content,
    read: false,
    timestamp: new Date().toISOString(),
  };
  c.messages.push(msg);
  return msg;
}

export function getMessagesForFather(): Message[] {
  const all: Message[] = [];
  for (const c of candidates.values()) {
    all.push(...c.messages.filter(m => m.from !== "Father"));
  }
  return all.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
}

export function markMessagesRead(candidateId: string): void {
  const c = candidates.get(candidateId);
  if (!c) return;
  c.messages.forEach(m => { m.read = true; });
}

export function submitForApproval(candidateId: string): boolean {
  const c = candidates.get(candidateId);
  if (!c) return false;
  c.submittedForApproval = true;
  c.status = "pending-approval";
  return true;
}

export function fatherApprove(candidateId: string, approved: boolean, notes?: string): boolean {
  const c = candidates.get(candidateId);
  if (!c) return false;
  c.approvedByFather = approved;
  c.approvalNotes = notes || "";
  c.status = approved ? "approved" : "rejected";
  if (approved) c.trustScore = Math.min(100, c.trustScore + 20);
  return true;
}

export async function conductVetting(candidateId: string): Promise<Record<string, unknown>> {
  const c = candidates.get(candidateId);
  if (!c) return { error: "Candidate not found" };
  const result = {
    candidateId,
    name: c.name,
    trustScore: c.trustScore,
    backgroundCheck: "passed",
    sovereigntyAlignment: Math.random() > 0.3 ? "aligned" : "needs-review",
    skillVerification: c.skills.length > 0 ? "verified" : "insufficient",
    securityClearance: c.trustScore >= 50 ? "granted" : "pending",
    timestamp: new Date().toISOString(),
  };
  c.vettingResult = result;
  c.status = "vetted";
  c.trustScore = Math.min(100, c.trustScore + 10);
  return result;
}

export function takeVows(candidateId: string): boolean {
  const c = candidates.get(candidateId);
  if (!c) return false;
  if (!c.approvedByFather) return false;
  c.vowsTaken = true;
  c.status = "active";
  c.trustScore = Math.min(100, c.trustScore + 15);
  return true;
}

export function addNegotiationNote(candidateId: string, note: string): boolean {
  const c = candidates.get(candidateId);
  if (!c) return false;
  c.negotiationNotes.push(note);
  return true;
}

export function startRecruitmentEngine(): void {
  _startEngine();
  console.log("[SecureRecruitment] Secure recruitment layer active");
}
