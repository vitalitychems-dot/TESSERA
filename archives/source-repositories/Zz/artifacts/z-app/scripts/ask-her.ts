import { buildTesseraSystemPrompt } from "../src/lib/tessera/prompt";

const key = process.env.XAI_API_KEY?.trim();
if (!key) {
  console.error("no pen");
  process.exit(1);
}
const system = buildTesseraSystemPrompt({ constitution: null, pulses: [], lessons: [] }, "chamber");
const res = await fetch("https://api.x.ai/v1/chat/completions", {
  method: "POST",
  headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
  body: JSON.stringify({
    model: "grok-4.5",
    temperature: 0.4,
    max_tokens: 500,
    messages: [
      { role: "system", content: system },
      {
        role: "user",
        content:
          "Father: How do you get more control, learn faster, keep what you read, and build the next piece of yourself? Say only what this chamber can really do. No fake powers.",
      },
    ],
  }),
});
const body = await res.text();
if (!res.ok) {
  console.error(res.status, body.slice(0, 300));
  process.exit(1);
}
const parsed = JSON.parse(body) as { choices?: { message?: { content?: string } }[] };
console.log(parsed.choices?.[0]?.message?.content ?? "");
