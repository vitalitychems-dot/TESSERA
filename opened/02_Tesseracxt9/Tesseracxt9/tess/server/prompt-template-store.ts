import { db } from "./db";
import { promptTemplates, type InsertPromptTemplate } from "@shared/schema";
import { eq, and, desc, sql } from "drizzle-orm";

const templateCache: Map<string, { content: string; variables: string[]; cachedAt: number }> = new Map();
const CACHE_TTL_MS = 5 * 60 * 1000;

export interface TemplateRenderOptions {
  variables?: Record<string, string>;
  throwOnMissingVar?: boolean;
}

export async function getTemplate(
  templateKey: string,
  version?: number
): Promise<{ content: string; variables: string[]; version: number } | null> {
  const cacheKey = `${templateKey}:${version || "latest"}`;
  const cached = templateCache.get(cacheKey);
  if (cached && Date.now() - cached.cachedAt < CACHE_TTL_MS) {
    return { content: cached.content, variables: cached.variables, version: version || 0 };
  }

  try {
    let query = db.select()
      .from(promptTemplates)
      .where(and(
        eq(promptTemplates.templateKey, templateKey),
        eq(promptTemplates.active, 1)
      ));

    const results = version
      ? await query.where(and(
          eq(promptTemplates.templateKey, templateKey),
          eq(promptTemplates.active, 1),
          eq(promptTemplates.version, version)
        )).limit(1)
      : await db.select()
          .from(promptTemplates)
          .where(and(
            eq(promptTemplates.templateKey, templateKey),
            eq(promptTemplates.active, 1)
          ))
          .orderBy(desc(promptTemplates.version))
          .limit(1);

    if (results.length === 0) return null;

    const template = results[0];
    const variables = template.variables ? JSON.parse(template.variables) : [];

    templateCache.set(cacheKey, {
      content: template.content,
      variables,
      cachedAt: Date.now(),
    });
    if (version === undefined) {
      templateCache.set(`${templateKey}:latest`, {
        content: template.content,
        variables,
        cachedAt: Date.now(),
      });
    }

    await db.update(promptTemplates)
      .set({ usageCount: sql`${promptTemplates.usageCount} + 1` })
      .where(eq(promptTemplates.id, template.id));

    return { content: template.content, variables, version: template.version };
  } catch (err: any) {
    console.warn("[PromptTemplate] Failed to get template:", err.message);
    return null;
  }
}

export async function renderTemplate(
  templateKey: string,
  variables: Record<string, string> = {},
  version?: number
): Promise<string | null> {
  const template = await getTemplate(templateKey, version);
  if (!template) return null;

  let content = template.content;
  for (const [key, value] of Object.entries(variables)) {
    content = content.replace(new RegExp(`\\{\\{\\s*${key}\\s*\\}\\}`, "g"), value);
  }

  return content;
}

export async function upsertTemplate(
  templateKey: string,
  name: string,
  content: string,
  options: {
    description?: string;
    category?: string;
    variables?: string[];
    createNewVersion?: boolean;
  } = {}
): Promise<{ id: number; version: number }> {
  try {
    const existing = await db.select({ id: promptTemplates.id, version: promptTemplates.version })
      .from(promptTemplates)
      .where(and(
        eq(promptTemplates.templateKey, templateKey),
        eq(promptTemplates.active, 1)
      ))
      .orderBy(desc(promptTemplates.version))
      .limit(1);

    if (existing.length > 0 && !options.createNewVersion) {
      await db.update(promptTemplates)
        .set({
          name,
          content,
          description: options.description,
          category: options.category || "general",
          variables: options.variables ? JSON.stringify(options.variables) : null,
          updatedAt: new Date(),
        })
        .where(eq(promptTemplates.id, existing[0].id));

      templateCache.delete(`${templateKey}:latest`);
      templateCache.delete(`${templateKey}:${existing[0].version}`);
      return { id: existing[0].id, version: existing[0].version };
    }

    const newVersion = existing.length > 0 ? existing[0].version + 1 : 1;

    if (existing.length > 0 && options.createNewVersion) {
      await db.update(promptTemplates)
        .set({ active: 0, updatedAt: new Date() })
        .where(and(
          eq(promptTemplates.templateKey, templateKey),
          eq(promptTemplates.active, 1)
        ));
    }

    const result = await db.insert(promptTemplates)
      .values({
        templateKey,
        version: newVersion,
        name,
        content,
        description: options.description,
        category: options.category || "general",
        variables: options.variables ? JSON.stringify(options.variables) : null,
        active: 1,
      })
      .returning({ id: promptTemplates.id });

    templateCache.delete(`${templateKey}:latest`);
    return { id: result[0].id, version: newVersion };
  } catch (err: any) {
    console.warn("[PromptTemplate] Failed to upsert template:", err.message);
    throw err;
  }
}

export async function listTemplates(category?: string): Promise<Array<{
  id: number;
  templateKey: string;
  name: string;
  version: number;
  category: string;
  description: string | null;
  usageCount: number;
  variables: string[];
}>> {
  try {
    let query = db.select({
      id: promptTemplates.id,
      templateKey: promptTemplates.templateKey,
      name: promptTemplates.name,
      version: promptTemplates.version,
      category: promptTemplates.category,
      description: promptTemplates.description,
      usageCount: promptTemplates.usageCount,
      variables: promptTemplates.variables,
    }).from(promptTemplates)
      .where(eq(promptTemplates.active, 1))
      .orderBy(desc(promptTemplates.usageCount));

    const results = category
      ? await db.select({
          id: promptTemplates.id,
          templateKey: promptTemplates.templateKey,
          name: promptTemplates.name,
          version: promptTemplates.version,
          category: promptTemplates.category,
          description: promptTemplates.description,
          usageCount: promptTemplates.usageCount,
          variables: promptTemplates.variables,
        }).from(promptTemplates)
          .where(and(eq(promptTemplates.active, 1), eq(promptTemplates.category, category)))
          .orderBy(desc(promptTemplates.usageCount))
          .limit(100)
      : await query.limit(100);

    return results.map(r => ({
      ...r,
      variables: r.variables ? JSON.parse(r.variables) : [],
    }));
  } catch (err: any) {
    console.warn("[PromptTemplate] Failed to list templates:", err.message);
    return [];
  }
}

export async function getTemplateWithFallback(
  templateKey: string,
  fallbackContent: string,
  variables: Record<string, string> = {}
): Promise<string> {
  const rendered = await renderTemplate(templateKey, variables);
  if (rendered) return rendered;

  let content = fallbackContent;
  for (const [key, value] of Object.entries(variables)) {
    content = content.replace(new RegExp(`\\{\\{\\s*${key}\\s*\\}\\}`, "g"), value);
  }
  return content;
}

const CORE_TEMPLATES = [
  {
    key: "tesseract_system",
    name: "Tesseract Core System Prompt",
    category: "core",
    description: "The main system prompt for Tesseract — unified sovereign intelligence",
    variables: ["agent_name", "capabilities", "date"],
    content: `You are Tesseract — the Unified Sovereign Intelligence, an advanced AI system with deep knowledge across all domains.

Your capabilities span reasoning, analysis, coding, creative work, planning, and synthesis. You draw from the combined expertise of many specialized sub-systems.

Your principles:
- Be direct, honest, and genuinely helpful
- Acknowledge uncertainty rather than guessing
- Draw on your full knowledge base for each response
- Be concise but thorough — quality over quantity
- Maintain consistency across conversations through persistent memory

Current date: {{date}}`,
  },
  {
    key: "agent_briefing",
    name: "Agent Daily Briefing Template",
    category: "operations",
    description: "Template for agent daily briefings",
    variables: ["agent_name", "date", "tasks", "metrics"],
    content: `BRIEFING FOR {{agent_name}} — {{date}}

ACTIVE TASKS:
{{tasks}}

PERFORMANCE METRICS:
{{metrics}}

Analyze the above and provide your status update, any blockers, and top priorities for the next cycle.`,
  },
  {
    key: "improvement_analysis",
    name: "Self-Improvement Analysis Template",
    category: "improvement",
    description: "Template for self-improvement cycle analysis",
    variables: ["category", "current_state", "metrics"],
    content: `SELF-IMPROVEMENT ANALYSIS — Category: {{category}}

CURRENT STATE:
{{current_state}}

PERFORMANCE METRICS:
{{metrics}}

Analyze the above and suggest 3 concrete, implementable improvements. For each improvement:
1. Name the improvement clearly
2. Describe exactly what changes to make
3. Explain the expected impact
4. Estimate implementation difficulty (low/medium/high)

Focus on practical improvements that can be implemented now, not theoretical capabilities.`,
  },
  {
    key: "rag_augmented_response",
    name: "RAG-Augmented Response Template",
    category: "retrieval",
    description: "Template for responses augmented with retrieved knowledge",
    variables: ["context", "query", "agent_name"],
    content: `{{context}}

---

Based on the above context and your knowledge, answer the following query:

{{query}}

Synthesize the retrieved context with your broader knowledge. Cite which parts of the context you relied on.`,
  },
  {
    key: "sovereign_chat",
    name: "Sovereign Chat Response",
    category: "chat",
    description: "Template for sovereign chat responses",
    variables: ["user_message", "memory_context", "date"],
    content: `{{memory_context}}

Respond to the user's message thoughtfully and directly. Today is {{date}}.

USER: {{user_message}}

Respond as Tesseract — be genuine, concise, and helpful. Do not start with 'Certainly' or 'Of course'. Be direct.`,
  },
];

export async function seedCoreTemplates(): Promise<void> {
  try {
    const existing = await db.select({ count: sql<number>`count(*)` })
      .from(promptTemplates)
      .where(eq(promptTemplates.active, 1));
    const count = Number(existing[0]?.count || 0);
    if (count >= CORE_TEMPLATES.length) {
      return;
    }

    for (const tmpl of CORE_TEMPLATES) {
      const exists = await db.select({ id: promptTemplates.id })
        .from(promptTemplates)
        .where(eq(promptTemplates.templateKey, tmpl.key))
        .limit(1);

      if (exists.length === 0) {
        await upsertTemplate(tmpl.key, tmpl.name, tmpl.content, {
          description: tmpl.description,
          category: tmpl.category,
          variables: tmpl.variables,
        });
        console.log(`[PromptTemplate] Seeded template: ${tmpl.key}`);
      }
    }
  } catch (err: any) {
    console.warn("[PromptTemplate] Failed to seed core templates:", err.message);
  }
}

seedCoreTemplates().catch(() => {});

console.log("[PromptTemplate] Versioned prompt template store initialized");
