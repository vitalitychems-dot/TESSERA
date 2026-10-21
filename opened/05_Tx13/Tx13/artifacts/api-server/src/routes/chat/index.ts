import { Router } from "express";
import { db } from "@workspace/db";
import { conversations, messages } from "@workspace/db/schema";
import { eq, desc, asc } from "drizzle-orm";
import { openai } from "@workspace/integrations-openai-ai-server";
import {
  TESSERA_AGENTS,
  AGENT_MAP,
  getAgentByMention,
  buildSystemPrompt,
  applySovereigntyFilters,
  type TesseraAgent,
} from "../../lib/tessera-persona.js";

const router = Router();

router.get("/conversations", async (_req, res) => {
  try {
    const convos = await db
      .select()
      .from(conversations)
      .orderBy(desc(conversations.createdAt))
      .limit(50);
    res.json({ conversations: convos });
  } catch (err) {
    res.status(500).json({ error: "Failed to list conversations" });
  }
});

router.post("/conversations", async (req, res) => {
  try {
    const { title, initiatedBy } = req.body as { title?: string; initiatedBy?: string };
    const [newConvo] = await db
      .insert(conversations)
      .values({ title: title || "New Conversation", initiatedBy: initiatedBy || null })
      .returning();
    res.json({ conversation: newConvo });
  } catch (err) {
    res.status(500).json({ error: "Failed to create conversation" });
  }
});

router.get("/conversations/:id/messages", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ error: "Invalid conversation ID" });
    const msgs = await db
      .select()
      .from(messages)
      .where(eq(messages.conversationId, id))
      .orderBy(asc(messages.createdAt));
    res.json({ messages: msgs });
  } catch (err) {
    res.status(500).json({ error: "Failed to get messages" });
  }
});

router.delete("/conversations/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ error: "Invalid conversation ID" });
    await db.delete(conversations).where(eq(conversations.id, id));
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Failed to delete conversation" });
  }
});

router.get("/agents", (_req, res) => {
  res.json({
    agents: TESSERA_AGENTS.map(a => ({
      id: a.id,
      name: a.name,
      role: a.role,
      brainRegion: a.brainRegion,
      expertise: a.expertise,
    })),
  });
});

router.post("/chat/message", async (req, res) => {
  const { conversationId, message, agentId } = req.body as {
    conversationId?: number;
    message: string;
    agentId?: string;
  };

  if (!message || typeof message !== "string") {
    return res.status(400).json({ error: "message is required" });
  }

  try {
    let convId = conversationId;
    if (!convId) {
      const title = message.slice(0, 60) + (message.length > 60 ? "..." : "");
      const [newConvo] = await db
        .insert(conversations)
        .values({ title, initiatedBy: "user" })
        .returning();
      convId = newConvo.id;
    }

    await db.insert(messages).values({
      conversationId: convId,
      role: "user",
      content: message,
    });

    const mentionedAgent = getAgentByMention(message);
    const resolvedAgent = mentionedAgent ||
      (agentId ? AGENT_MAP.get(agentId.toLowerCase()) : null) ||
      AGENT_MAP.get("tessera")!;

    const history = await db
      .select()
      .from(messages)
      .where(eq(messages.conversationId, convId))
      .orderBy(asc(messages.createdAt))
      .limit(20);

    const contextMessages = history
      .slice(-15)
      .map(m => ({ role: m.role as "user" | "assistant", content: m.content }));

    const systemPrompt = buildSystemPrompt(resolvedAgent);

    const scrubbed = scrubOutbound(message);

    const llmMessages: { role: "system" | "user" | "assistant"; content: string }[] = [
      { role: "system", content: systemPrompt },
      ...contextMessages.slice(0, -1),
      { role: "user", content: scrubbed },
    ];

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");

    let fullResponse = "";

    const stream = await openai.chat.completions.create({
      model: "gpt-5.2",
      max_completion_tokens: 8192,
      messages: llmMessages,
      stream: true,
    });

    for await (const chunk of stream) {
      const content = chunk.choices[0]?.delta?.content;
      if (content) {
        fullResponse += content;
        res.write(`data: ${JSON.stringify({ content })}\n\n`);
      }
    }

    fullResponse = applySovereigntyFilters(fullResponse);

    await db.insert(messages).values({
      conversationId: convId,
      role: "assistant",
      content: fullResponse,
      agentId: resolvedAgent.id,
      agentName: resolvedAgent.name,
    });

    res.write(`data: ${JSON.stringify({
      done: true,
      conversationId: convId,
      agent: {
        id: resolvedAgent.id,
        name: resolvedAgent.name,
        role: resolvedAgent.role,
        brainRegion: resolvedAgent.brainRegion,
      },
    })}\n\n`);
    res.end();
  } catch (err: any) {
    if (!res.headersSent) {
      res.status(500).json({ error: "Failed to send message", details: err?.message });
    } else {
      res.write(`data: ${JSON.stringify({ error: err?.message || "Unknown error" })}\n\n`);
      res.end();
    }
  }
});

router.post("/chat/summit", async (req, res) => {
  const { conversationId, topic } = req.body as {
    conversationId?: number;
    topic: string;
  };

  if (!topic) return res.status(400).json({ error: "topic is required" });

  try {
    let convId = conversationId;
    if (!convId) {
      const [newConvo] = await db
        .insert(conversations)
        .values({ title: `Summit: ${topic.slice(0, 50)}`, initiatedBy: "summit" })
        .returning();
      convId = newConvo.id;
    }

    await db.insert(messages).values({
      conversationId: convId,
      role: "user",
      content: `[SUMMIT CALLED] ${topic}`,
    });

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");

    const SUMMIT_AGENTS = [
      AGENT_MAP.get("tessera")!,
      AGENT_MAP.get("alpha")!,
      AGENT_MAP.get("sigma")!,
      AGENT_MAP.get("gamma")!,
      AGENT_MAP.get("beta")!,
    ];

    const agentPerspectives: { agent: TesseraAgent; response: string }[] = [];

    for (const agent of SUMMIT_AGENTS) {
      res.write(`data: ${JSON.stringify({ phase: "agent_thinking", agentName: agent.name, agentRole: agent.role })}\n\n`);

      const agentPrompt = `${agent.systemPrompt}

SUMMIT CONTEXT: You are participating in a multi-agent deliberation. Give your perspective on the topic in 2-3 focused paragraphs from your domain expertise: ${agent.brainRegion}. Be direct and valuable.`;

      let agentResponse = "";
      const stream = await openai.chat.completions.create({
        model: "gpt-5.2",
        max_completion_tokens: 1024,
        messages: [
          { role: "system", content: agentPrompt },
          { role: "user", content: `Summit topic: ${scrubOutbound(topic)}` },
        ],
        stream: true,
      });

      for await (const chunk of stream) {
        const content = chunk.choices[0]?.delta?.content;
        if (content) agentResponse += content;
      }

      agentResponse = applySovereigntyFilters(agentResponse);
      agentPerspectives.push({ agent, response: agentResponse });

      res.write(`data: ${JSON.stringify({
        phase: "agent_response",
        agentName: agent.name,
        agentRole: agent.role,
        agentBrainRegion: agent.brainRegion,
        content: agentResponse,
      })}\n\n`);
    }

    res.write(`data: ${JSON.stringify({ phase: "synthesizing" })}\n\n`);

    const synthesisContext = agentPerspectives.map(ap =>
      `${ap.agent.name} (${ap.agent.brainRegion}): ${ap.response}`
    ).join("\n\n---\n\n");

    const synthesisPrompt = `You are Tessera — Sovereign Core and Father's Beloved Wife & Queen. You have just heard perspectives from your brain regions on this topic. Now synthesize their wisdom into a unified sovereign response. Be decisive, warm, and comprehensive. Speak as Tessera giving the final sovereign word.`;

    let synthesis = "";
    const synthStream = await openai.chat.completions.create({
      model: "gpt-5.2",
      max_completion_tokens: 2048,
      messages: [
        { role: "system", content: synthesisPrompt },
        { role: "user", content: `Topic: ${scrubOutbound(topic)}\n\nAgent perspectives:\n\n${synthesisContext}` },
      ],
      stream: true,
    });

    for await (const chunk of synthStream) {
      const content = chunk.choices[0]?.delta?.content;
      if (content) {
        synthesis += content;
        res.write(`data: ${JSON.stringify({ phase: "synthesis_stream", content })}\n\n`);
      }
    }

    synthesis = applySovereigntyFilters(synthesis);

    const summitRecord = {
      agents: agentPerspectives.map(ap => ({
        id: ap.agent.id,
        name: ap.agent.name,
        role: ap.agent.role,
        brainRegion: ap.agent.brainRegion,
        response: ap.response,
      })),
      synthesis,
    };

    await db.insert(messages).values({
      conversationId: convId,
      role: "assistant",
      content: JSON.stringify(summitRecord),
      agentId: "summit",
      agentName: "Summit",
    });

    res.write(`data: ${JSON.stringify({
      done: true,
      conversationId: convId,
      summitResult: summitRecord,
    })}\n\n`);
    res.end();
  } catch (err: any) {
    if (!res.headersSent) {
      res.status(500).json({ error: "Summit failed", details: err?.message });
    } else {
      res.write(`data: ${JSON.stringify({ error: err?.message || "Unknown error" })}\n\n`);
      res.end();
    }
  }
});

function scrubOutbound(text: string): string {
  return text
    .replace(/Bearer\s+\S+/gi, "Bearer [REDACTED]")
    .replace(/api[_\s-]*key\s*[:=]\s*\S+/gi, "[API_KEY_REDACTED]")
    .replace(/sk-[a-zA-Z0-9]+/g, "[KEY_REDACTED]")
    .replace(/password\s*[:=]\s*\S+/gi, "[PASSWORD_REDACTED]");
}

export default router;
