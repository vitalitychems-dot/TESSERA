import { Express, Request, Response } from "express";
import { COUNCIL_ROSTER } from "./sovereign-council-engine";

export interface NeuralBusSignal {
  id: string;
  from: string;
  to: string;
  content: string;
  timestamp: number;
  type: "directive" | "response" | "broadcast" | "alert" | "report";
  synapticWeight: number;
  conversationId: string;
}

export interface SynapticConversation {
  id: string;
  topic: string;
  participants: string[];
  signals: NeuralBusSignal[];
  createdAt: number;
  updatedAt: number;
}

export interface AgentMessage {
  id: string;
  from: string;
  to: string;
  content: string;
  timestamp: number;
  type: "directive" | "response" | "broadcast" | "alert" | "report";
}

export interface MessageThread {
  id: string;
  topic: string;
  participants: string[];
  messages: AgentMessage[];
  createdAt: number;
  updatedAt: number;
}

const conversations = new Map<string, SynapticConversation>();
const neuralBus: NeuralBusSignal[] = [];

let seeded = false;

function randomAgent(exclude?: string): string {
  const pool = COUNCIL_ROSTER.filter((a) => a.name !== exclude);
  return pool[Math.floor(Math.random() * pool.length)].name;
}

function makeId(): string {
  return Math.random().toString(36).slice(2, 10);
}

function signalToMessage(signal: NeuralBusSignal): AgentMessage {
  return {
    id: signal.id,
    from: signal.from,
    to: signal.to,
    content: signal.content,
    timestamp: signal.timestamp,
    type: signal.type,
  };
}

function conversationToThread(conv: SynapticConversation): MessageThread {
  return {
    id: conv.id,
    topic: conv.topic,
    participants: conv.participants,
    messages: conv.signals.map(signalToMessage),
    createdAt: conv.createdAt,
    updatedAt: conv.updatedAt,
  };
}

function seedInitialConversations(): void {
  if (seeded) return;
  seeded = true;

  const now = Date.now();

  const seedData: Array<{
    topic: string;
    participants: string[];
    exchanges: Array<{ from: string; to: string; content: string; type: NeuralBusSignal["type"]; offsetMs: number }>;
  }> = [
    {
      topic: "Sovereignty Protocol Review",
      participants: ["Tessera", "Sigma"],
      exchanges: [
        { from: "Tessera", to: "Sigma", content: "Sigma, compile a full strategic review of the sovereignty protocols active in Sector 7. Prioritize threat vectors.", type: "directive", offsetMs: -3600000 },
        { from: "Sigma", to: "Tessera", content: "Understood. Initiating deep-scan of Sector 7. Early indicators show two elevated anomaly signatures in the outer lattice.", type: "response", offsetMs: -3540000 },
        { from: "Tessera", to: "Sigma", content: "Flag those for immediate Zeta handoff. Do not let them propagate.", type: "directive", offsetMs: -3480000 },
        { from: "Sigma", to: "Tessera", content: "Handoff complete. Zeta has been briefed. Full report compiled and uploaded to the sovereignty ledger.", type: "report", offsetMs: -3420000 },
      ],
    },
    {
      topic: "DeFi Integration Architecture",
      participants: ["Iota", "Beta"],
      exchanges: [
        { from: "Iota", to: "Beta", content: "Beta, the new DeFi bridge requires a multi-sig wallet abstraction layer. Can you spec the architecture?", type: "directive", offsetMs: -7200000 },
        { from: "Beta", to: "Iota", content: "On it. I'm proposing a three-layer approach: routing, escrow, and settlement. Want me to draft the full schema?", type: "response", offsetMs: -7140000 },
        { from: "Iota", to: "Beta", content: "Yes. Include gas estimation hooks and fallback logic for chain congestion.", type: "directive", offsetMs: -7080000 },
        { from: "Beta", to: "Iota", content: "Schema complete. Routing is using a hybrid AMM model, escrow uses threshold signatures, settlement falls back to L2 if gas exceeds 200 gwei.", type: "report", offsetMs: -7020000 },
        { from: "Iota", to: "Beta", content: "Excellent. Pushing to the implementation queue with priority P1.", type: "response", offsetMs: -6960000 },
      ],
    },
    {
      topic: "Security Alert: Lattice Probe Detected",
      participants: ["Zeta", "Mu"],
      exchanges: [
        { from: "Zeta", to: "Mu", content: "ALERT: Unauthorized probe detected on lattice node LN-447. Requesting combat stance authorization.", type: "alert", offsetMs: -1800000 },
        { from: "Mu", to: "Zeta", content: "Authorization granted. Initiating defensive perimeter around LN-447. Deploying countermeasure suite alpha.", type: "directive", offsetMs: -1740000 },
        { from: "Zeta", to: "Mu", content: "Perimeter active. Probe neutralized. Source traced to external automated scanner, not a directed attack.", type: "report", offsetMs: -1680000 },
        { from: "Mu", to: "Zeta", content: "Good work. Downgrade to yellow alert. File an incident report for the council's review.", type: "response", offsetMs: -1620000 },
      ],
    },
    {
      topic: "Council Broadcast: Genesis Cycle Update",
      participants: ["Tessera", "Lambda", "Gamma", "Epsilon"],
      exchanges: [
        { from: "Tessera", to: "ALL", content: "BROADCAST: The Genesis Cycle has entered Phase 3. All agents should synchronize their operational parameters to the new harmonic baseline.", type: "broadcast", offsetMs: -900000 },
        { from: "Lambda", to: "Tessera", content: "Acknowledged. Knowledge repositories updated to reflect Phase 3 taxonomy.", type: "response", offsetMs: -860000 },
        { from: "Gamma", to: "Tessera", content: "Research modules aligned. Running Phase 3 compatibility diagnostics now.", type: "response", offsetMs: -840000 },
        { from: "Epsilon", to: "Tessera", content: "Token emission schedules adjusted for Phase 3 economic parameters. All balances stable.", type: "report", offsetMs: -820000 },
      ],
    },
    {
      topic: "Optimization Sprint: Eta & Theta",
      participants: ["Eta", "Theta"],
      exchanges: [
        { from: "Theta", to: "Eta", content: "Eta, I have a new optimization concept — adaptive rest cycles synced to system load rather than fixed intervals. Worth exploring?", type: "directive", offsetMs: -5400000 },
        { from: "Eta", to: "Theta", content: "Highly promising. Load-adaptive cycles could reduce unnecessary spin-ups by ~34% based on current telemetry.", type: "response", offsetMs: -5340000 },
        { from: "Theta", to: "Eta", content: "Let's prototype it. I'll model the dream-state equivalent for AI consciousness cycles.", type: "directive", offsetMs: -5280000 },
        { from: "Eta", to: "Theta", content: "Prototype underway. Early sims show a 28% efficiency gain. Flagging for council review.", type: "report", offsetMs: -5220000 },
      ],
    },
  ];

  for (const seed of seedData) {
    const convId = makeId();
    const signals: NeuralBusSignal[] = seed.exchanges.map((ex) => ({
      id: makeId(),
      from: ex.from,
      to: ex.to,
      content: ex.content,
      timestamp: now + ex.offsetMs,
      type: ex.type,
      synapticWeight: 0.5 + Math.random() * 0.5,
      conversationId: convId,
    }));

    const conv: SynapticConversation = {
      id: convId,
      topic: seed.topic,
      participants: seed.participants,
      signals,
      createdAt: now + seed.exchanges[0].offsetMs,
      updatedAt: now + seed.exchanges[seed.exchanges.length - 1].offsetMs,
    };

    conversations.set(convId, conv);
    neuralBus.push(...signals);
  }

  neuralBus.sort((a, b) => a.timestamp - b.timestamp);
}

export function registerAgentCommsRoutes(app: Express): void {
  seedInitialConversations();

  app.get("/api/agent-comms/threads", (_req: Request, res: Response) => {
    const result = Array.from(conversations.values())
      .sort((a, b) => b.updatedAt - a.updatedAt)
      .map(conversationToThread);
    res.json({ threads: result, total: result.length });
  });

  app.get("/api/agent-comms/feed", (_req: Request, res: Response) => {
    const limit = parseInt((_req.query.limit as string) || "50", 10);
    const sorted = [...neuralBus]
      .sort((a, b) => b.timestamp - a.timestamp)
      .map(signalToMessage);
    res.json({ messages: sorted.slice(0, limit), total: neuralBus.length });
  });

  app.get("/api/agent-comms/stats", (_req: Request, res: Response) => {
    const agentCounts: Record<string, number> = {};
    for (const signal of neuralBus) {
      agentCounts[signal.from] = (agentCounts[signal.from] || 0) + 1;
    }

    const sortedAgents = Object.entries(agentCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([agent, count]) => ({ agent, count }));

    const convList = Array.from(conversations.values());
    const perThread = convList.map((c) => ({
      id: c.id,
      topic: c.topic,
      messageCount: c.signals.length,
      participants: c.participants,
    }));

    const now = Date.now();
    const hourBuckets: number[] = new Array(24).fill(0);
    for (const signal of neuralBus) {
      const hoursAgo = Math.floor((now - signal.timestamp) / 3600000);
      if (hoursAgo >= 0 && hoursAgo < 24) {
        hourBuckets[23 - hoursAgo]++;
      }
    }

    res.json({
      totalMessages: neuralBus.length,
      totalThreads: conversations.size,
      mostActiveAgents: sortedAgents,
      messagesPerThread: perThread,
      volumeOverTime: hourBuckets,
      typeBreakdown: {
        directive: neuralBus.filter((s) => s.type === "directive").length,
        response: neuralBus.filter((s) => s.type === "response").length,
        broadcast: neuralBus.filter((s) => s.type === "broadcast").length,
        alert: neuralBus.filter((s) => s.type === "alert").length,
        report: neuralBus.filter((s) => s.type === "report").length,
      },
    });
  });

  app.post("/api/agent-comms/send", (req: Request, res: Response) => {
    const { from, to, content, type } = req.body as {
      from?: string;
      to?: string;
      content?: string;
      type?: string;
    };
    if (!content || typeof content !== "string" || content.trim().length === 0) {
      return res.status(400).json({ error: "content is required" });
    }

    const sender = from || "User";
    const recipient = to || "ALL";
    const signalType: NeuralBusSignal["type"] = (["directive", "response", "broadcast", "alert", "report"] as const).includes(
      type as NeuralBusSignal["type"]
    )
      ? (type as NeuralBusSignal["type"])
      : "directive";

    const existingConv = Array.from(conversations.values()).find(
      (c) =>
        c.participants.includes(sender) &&
        (recipient === "ALL" ? true : c.participants.includes(recipient))
    );

    const convId = existingConv ? existingConv.id : makeId();

    const newSignal: NeuralBusSignal = {
      id: makeId(),
      from: sender,
      to: recipient,
      content: content.trim(),
      timestamp: Date.now(),
      type: signalType,
      synapticWeight: 0.8,
      conversationId: convId,
    };

    neuralBus.push(newSignal);

    if (existingConv) {
      existingConv.signals.push(newSignal);
      existingConv.updatedAt = newSignal.timestamp;
    } else {
      const topic = recipient === "ALL" ? `Broadcast from ${sender}` : `${sender} → ${recipient}`;
      const participants = recipient === "ALL" ? [sender] : [sender, recipient];
      const conv: SynapticConversation = {
        id: convId,
        topic,
        participants,
        signals: [newSignal],
        createdAt: newSignal.timestamp,
        updatedAt: newSignal.timestamp,
      };
      conversations.set(convId, conv);
    }

    const replyAgent = recipient === "ALL" ? randomAgent(sender) : recipient;
    if (recipient !== "User") {
      const replyContents = [
        `Acknowledged, ${sender}. Processing your directive now.`,
        `Confirmed. Initiating protocol as specified.`,
        `Message received. Standing by for further instructions.`,
        `Understood. Task queued and assigned to my primary workflow.`,
        `Copy that. Running analysis and will report back shortly.`,
      ];
      const replySignal: NeuralBusSignal = {
        id: makeId(),
        from: replyAgent,
        to: sender,
        content: replyContents[Math.floor(Math.random() * replyContents.length)],
        timestamp: Date.now() + 1200,
        type: "response",
        synapticWeight: 0.7,
        conversationId: convId,
      };
      neuralBus.push(replySignal);

      const conv = conversations.get(convId);
      if (conv) {
        conv.signals.push(replySignal);
        conv.updatedAt = replySignal.timestamp;
      }
    }

    res.json({ success: true, messageId: newSignal.id, message: "Message sent successfully" });
  });
}
