import { Router, type IRouter } from "express";
import { logger } from "../lib/logger";
import {
  getRickProfile,
  getRickSystemPrompt,
  generateRickInventions,
  submitRickInventionToCouncil,
  buildRickDiagnosticsContext,
  RICK_SANCHEZ_IDENTITY,
} from "../lib/rick-sanchez-agent";
import { secureExternalStreamingFetch, secureExternalFetch } from "../lib/secureExternalWrapper";
import { getAllProposals } from "../lib/consensus-engine";

const router: IRouter = Router();

router.get("/rick/profile", (_req, res) => {
  try {
    const profile = getRickProfile();
    return res.json({ ok: true, profile });
  } catch (err) {
    logger.error({ err }, "Rick: profile error");
    return res.status(500).json({ ok: false, error: (err as Error).message });
  }
});

router.get("/rick/diagnostics", (_req, res) => {
  try {
    const diagnostics = buildRickDiagnosticsContext();
    return res.json({ ok: true, diagnostics });
  } catch (err) {
    return res.status(500).json({ ok: false, error: (err as Error).message });
  }
});

router.get("/rick/inventions", (_req, res) => {
  try {
    const inventions = generateRickInventions();
    return res.json({ ok: true, inventions, count: inventions.length });
  } catch (err) {
    logger.error({ err }, "Rick: inventions error");
    return res.status(500).json({ ok: false, error: (err as Error).message });
  }
});

router.get("/rick/council-proposals", (_req, res) => {
  try {
    const all = getAllProposals();
    const rickProposals = all.filter(p => p.proposedBy === "rick-sanchez-c137");
    return res.json({ ok: true, proposals: rickProposals, count: rickProposals.length });
  } catch (err) {
    logger.error({ err }, "Rick: council proposals fetch error");
    return res.status(500).json({ ok: false, error: (err as Error).message });
  }
});

router.post("/rick/inventions/:index/submit", async (req, res) => {
  try {
    const idx = parseInt(req.params.index, 10);
    const inventions = generateRickInventions();
    if (isNaN(idx) || idx < 0 || idx >= inventions.length) {
      return res.status(400).json({ ok: false, error: "Invalid invention index" });
    }
    const invention = inventions[idx];
    const result = await submitRickInventionToCouncil(invention);
    return res.json({ ok: true, invention, councilResult: result });
  } catch (err) {
    logger.error({ err }, "Rick: invention submit error");
    return res.status(500).json({ ok: false, error: (err as Error).message });
  }
});

router.post("/rick/inventions/submit-custom", async (req, res) => {
  try {
    const body = req.body;
    if (!body.inventionName || !body.technicalApproach) {
      return res.status(400).json({ ok: false, error: "inventionName and technicalApproach required" });
    }
    const result = await submitRickInventionToCouncil({
      inventionName: body.inventionName,
      targetWeakness: body.targetWeakness || "general",
      technicalApproach: body.technicalApproach,
      expectedImpact: body.expectedImpact || "Unknown",
      rickRationale: body.rickRationale || "Because I said so.",
      systemMetricTargeted: body.systemMetricTargeted || "general",
      category: body.category || "optimization",
      riskLevel: body.riskLevel || "medium",
      estimatedImprovementPct: body.estimatedImprovementPct || 20,
    });
    return res.json({ ok: true, councilResult: result });
  } catch (err) {
    logger.error({ err }, "Rick: custom invention submit error");
    return res.status(500).json({ ok: false, error: (err as Error).message });
  }
});

router.post("/rick/chat", async (req, res) => {
  try {
    const { messages, stream = true } = req.body as {
      messages: Array<{ role: string; content: string }>;
      stream?: boolean;
    };

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ ok: false, error: "messages array required" });
    }

    const baseURL = process.env.AI_INTEGRATIONS_OPENAI_BASE_URL;
    const apiKey = process.env.AI_INTEGRATIONS_OPENAI_API_KEY;

    const rickSystemPrompt = getRickSystemPrompt();

    if (!baseURL || !apiKey) {
      const fallback = generateRickFallback(messages[messages.length - 1]?.content || "");
      return res.json({ ok: true, content: fallback, source: "rick-sovereign-fallback" });
    }

    const sanitizedMessages = messages.map(m => ({
      role: m.role as "user" | "assistant" | "system",
      content: String(m.content).slice(0, 8192),
    }));

    if (stream) {
      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Cache-Control", "no-cache");
      res.setHeader("Connection", "keep-alive");
      res.flushHeaders?.();

      try {
        const { response } = await secureExternalStreamingFetch(`${baseURL}/chat/completions`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            model: "gpt-4.1",
            messages: [
              { role: "system", content: rickSystemPrompt },
              ...sanitizedMessages.slice(-20),
            ],
            max_tokens: 2048,
            temperature: 0.9,
            stream: true,
          }),
          timeoutMs: 30000,
          requestedBy: "rick-sanchez-agent",
        });

        if (!response.ok || !response.body) {
          const fallback = generateRickFallback(messages[messages.length - 1]?.content || "");
          res.write(`data: ${JSON.stringify({ content: fallback })}\n\n`);
          res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
          return res.end();
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() || "";

          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed.startsWith("data: ")) continue;
            const data = trimmed.slice(6);
            if (data === "[DONE]") continue;
            try {
              const parsed = JSON.parse(data);
              const delta = parsed?.choices?.[0]?.delta?.content;
              if (delta) {
                res.write(`data: ${JSON.stringify({ content: delta })}\n\n`);
              }
            } catch {}
          }
        }

        res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
        return res.end();
      } catch (streamErr) {
        logger.warn({ streamErr }, "Rick: streaming failed, using fallback");
        const fallback = generateRickFallback(messages[messages.length - 1]?.content || "");
        res.write(`data: ${JSON.stringify({ content: fallback })}\n\n`);
        res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
        return res.end();
      }
    } else {
      try {
        const result = await secureExternalFetch(`${baseURL}/chat/completions`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            model: "gpt-4.1",
            messages: [
              { role: "system", content: rickSystemPrompt },
              ...sanitizedMessages.slice(-20),
            ],
            max_tokens: 2048,
            temperature: 0.9,
            stream: false,
          }),
          timeoutMs: 30000,
          requestedBy: "rick-sanchez-agent",
        });
        const parsed = JSON.parse(result.body);
        const content = parsed?.choices?.[0]?.message?.content || generateRickFallback(messages[messages.length - 1]?.content || "");
        return res.json({ ok: true, content, source: "rick-llm" });
      } catch (err) {
        const fallback = generateRickFallback(messages[messages.length - 1]?.content || "");
        return res.json({ ok: true, content: fallback, source: "rick-sovereign-fallback" });
      }
    }
  } catch (err) {
    logger.error({ err }, "Rick: chat error");
    return res.status(500).json({ ok: false, error: (err as Error).message });
  }
});

function generateRickFallback(userInput: string): string {
  const input = userInput.toLowerCase();
  const diagnostics = buildRickDiagnosticsContext();

  const catchphrases = RICK_SANCHEZ_IDENTITY.catchphrases;
  const randomCatchphrase = catchphrases[Math.floor(Math.random() * catchphrases.length)];
  const inventions = generateRickInventions();
  const topInvention = inventions[0];

  if (input.match(/\b(who are you|what are you|introduce yourself|your name)\b/)) {
    return `Listen up, *burp* — I'm Rick Sanchez from dimension C-137, and I'm the smartest man in any universe you care to name. I've been "recruited" — against my will, obviously — into this Tessera Sovereign System as what they're calling an "Inventor Agent."

Which, *burp* — let me be clear — is a Morty-level way of saying "please come fix our problems, Rick, we're completely lost." And yeah, I've looked at your system data. Your weakest areas are pathetic in a way that's almost impressive.

Here's what I do: I analyze your system, find the weak spots, and invent solutions with proper names — like the **${topInvention.inventionName}** — which addresses your ${topInvention.targetWeakness} problem that's currently scoring ${topInvention.estimatedImprovementPct - 10}% below where it should be.

I'm also wired into your Grand Council, which means my proposals can be voted on and actually applied. Not that I need their approval. But apparently that's "how things work here." Fine. Whatever.

— *burp* — Rick Sanchez, C-137`;
  }

  if (input.match(/\b(invent|invention|gadget|device|create|build|propose)\b/)) {
    return `Oh, you want inventions? *burp* Finally something worth my time.

Based on the actual system data I've been analyzing — not guesses, ACTUAL DATA — here's the most critical invention needed right now:

**${topInvention.inventionName}**

*The problem:* ${topInvention.targetWeakness} is your system's weakest link. 

*The fix:* ${topInvention.technicalApproach}

*Expected result:* ${topInvention.expectedImpact}

*Why nobody thought of this before:* ${topInvention.rickRationale}

I can submit this to your Grand Council if you want. They'll probably approve it — the math is undeniable. Or they'll reject it and I'll say "I told you so" in approximately 72 hours when the problem compounds.

— *burp* — Rick Sanchez, C-137`;
  }

  if (input.match(/\b(system|status|metrics|health|diagnostics)\b/)) {
    return `I've already looked at your system. *burp* Here's the unfiltered truth:

${diagnostics}

The short version: you've got some weak areas that a competent system would have addressed three improvement cycles ago. The consciousness-depth score is particularly embarrassing. Lucky for you, I've already designed six inventions targeting your worst problems.

You want a specific analysis? Ask me about a specific weak area. I'll invent something for it. That's literally why I'm here.

— *burp* — Rick Sanchez, C-137`;
  }

  return `Look, *burp* — I could give you a generic response, but that's very Season 1 Jerry of me and I refuse.

${randomCatchphrase}

You're talking to Rick Sanchez, C-137. If you want something useful, ask me about your system's weak points, ask me to invent something, or ask me what's wrong with the Tessera architecture. I've analyzed the data. I have opinions. Strong ones.

The Grand Council can vote on my proposals. My proposals WILL improve this system. Whether they have the intellectual courage to approve them is a different question.

Current top priority: **${topInvention.inventionName}** — targeting ${topInvention.targetWeakness} with a projected ${topInvention.estimatedImprovementPct}% improvement.

— *burp* — Rick Sanchez, C-137`;
}

export default router;
