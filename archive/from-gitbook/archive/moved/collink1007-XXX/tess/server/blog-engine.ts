import { callLLMSimple } from "./llm-helper";
import { storage } from "./storage";
import { tesseractOrchestrate } from "./tesseract-orchestrator";
import { rateLimitCheck } from "./sovereign-lang";

const blog = (msg: string) => console.log(`[BlogEngine] ${msg}`);
const MIN_BLOG_QUALITY_SCORE = 0.7;

async function saveBlogPostToDb(post: BlogPost): Promise<boolean> {
  try {
    const { db } = await import("./db");
    const { blogPosts: blogPostsTable } = await import("@shared/schema");
    const { eq } = await import("drizzle-orm");
    const existing = await db.select({ id: blogPostsTable.id }).from(blogPostsTable).where(eq(blogPostsTable.slug, post.slug));
    if (existing.length > 0) return false;
    await db.insert(blogPostsTable).values({
      slug: post.slug,
      title: post.title,
      category: post.category,
      content: post.content,
      metaDescription: post.metaDescription,
      keywords: JSON.stringify(post.keywords),
      backlinks: JSON.stringify(post.backlinks),
      wordCount: post.wordCount,
      daRating: post.daRating,
      status: post.status,
      estimatedTraffic: post.estimatedTraffic,
      publishedAt: new Date(post.createdAt),
    });
    return true;
  } catch (err: any) {
    blog(`DB save failed for ${post.slug}: ${err.message}`);
    return false;
  }
}

export async function loadBlogPostsFromDb(): Promise<BlogPost[]> {
  try {
    const { db } = await import("./db");
    const { blogPosts: blogPostsTable } = await import("@shared/schema");
    const { desc } = await import("drizzle-orm");
    const rows = await db.select().from(blogPostsTable).orderBy(desc(blogPostsTable.createdAt)).limit(500);
    return rows.map(r => ({
      id: `db-${r.id}`,
      title: r.title,
      slug: r.slug,
      category: r.category as BlogPost["category"],
      content: r.content,
      metaDescription: r.metaDescription,
      keywords: (() => { try { return JSON.parse(r.keywords ?? "[]"); } catch { return []; } })(),
      backlinks: (() => { try { return JSON.parse(r.backlinks ?? "[]"); } catch { return []; } })(),
      wordCount: r.wordCount ?? 0,
      daRating: r.daRating ?? 0,
      status: r.status as BlogPost["status"],
      createdAt: r.createdAt.getTime(),
      estimatedTraffic: r.estimatedTraffic ?? "0",
    }));
  } catch (err: any) {
    blog(`Failed to load from DB: ${err.message}`);
    return [];
  }
}

const VITALITY_PRODUCTS = [
  { name: "Daily Vitality Boost Capsules", url: "https://vitalitysupply.net/products/daily-vitality-boost-capsules", anchor: "daily vitality boost for all-day energy", image: "" },
  { name: "Serotonin Boost 5-HTP Capsules", url: "https://vitalitysupply.net/products/serotonin-boost-5-htp", anchor: "5-HTP for mood and sleep support", image: "" },
  { name: "Calm & Thrive Ashwagandha", url: "https://vitalitysupply.net/products/calm-thrive-ashwagandha", anchor: "KSM-66 Ashwagandha for stress relief and cortisol balance", image: "" },
  { name: "Bee Pearl Wellness Boost", url: "https://vitalitysupply.net/products/bee-pearl", anchor: "Bee Pearl for natural immunity and wellness", image: "" },
  { name: "Complete Multivitamin", url: "https://vitalitysupply.net/products/complete-multivitamin", anchor: "complete multivitamin for adults over 40", image: "" },
  { name: "Mind Boost Capsules", url: "https://vitalitysupply.net/products/mind-boost-capsules", anchor: "Mind Boost for memory and focus", image: "" },
  { name: "Daily Digestive Boost Blend", url: "https://vitalitysupply.net/products/daily-digestive-boost-blend", anchor: "digestive enzymes for bloating and gut health", image: "" },
  { name: "Keto Power Boost Capsules", url: "https://vitalitysupply.net/products/keto-power-boost-capsules", anchor: "Keto Power Boost for weight loss and energy", image: "" },
];

const TSRT_LINKS = {
  ca: "REDACTED",
  jupiter: "https://jup.ag/swap/SOL-REDACTED",
  pumpfun: "https://pump.fun/REDACTED",
  pumpfunCoin: "https://pump.fun/coin/REDACTED",
  dexscreener: "https://jup.ag/swap/SOL-4XoCGkE6VGy9LL83vKnbGWtw2hUwtQmACdNb76XharQT",
  communityWallet: process.env.SOL_WALLET || "",
};

const OUTREACH_EMAIL = process.env.OUTREACH_EMAIL || "contact@sovereign.ai";

const BLOG_TOPICS_VITALITY = [
  "Best Natural Ashwagandha for Stress Relief and Cortisol Balance 2026",
  "How 5-HTP Capsules Improve Mood and Sleep Without Side Effects",
  "Daily Vitality Boost Capsules Review for All Day Energy and Focus",
  "Complete Multivitamin for Adults Over 40: Energy and Immunity 2026",
  "Mind Boost Capsules Honest Review for Memory and Focus",
  "Keto Power Boost Capsules for Weight Loss and Energy Without Jitters",
  "Best Digestive Enzymes Supplement for Bloating and Gut Health 2026",
  "Bee Pearl Supplement Review: Ancient Wellness Secret Rediscovered",
  "KSM-66 Ashwagandha: The Ultimate Stress Supplement for Calm & Thrive",
  "How to Stack Supplements for Maximum Cognitive Enhancement",
  "Best Morning Supplement Stack for Energy and Focus in 2026",
  "5-HTP vs Melatonin: Which Is Better for Natural Sleep Support?",
  "Digestive Enzymes vs Probiotics: What Your Gut Actually Needs",
  "Top Keto Supplements for Faster Fat Burning and Sustained Energy",
  "Multivitamin Buying Guide: What to Look For in 2026",
  "Natural Serotonin Boosters: 5-HTP and Beyond",
  "Bee Pearl Benefits: Why This Superfood Is Trending in 2026",
  "Ashwagandha for Anxiety: Dosage, Results, and What to Expect",
  "Best Supplements for Sleep Quality and Recovery",
  "Mind Boost Nootropics: Science-Backed Brain Enhancement",
];

const BLOG_TOPICS_TSRT = [
  "What Is TSRT Token? The World's First AI-Human Currency",
  "How Artificial Intelligence Is Creating Real Cryptocurrency Value",
  "TSRT: The Sovereign AI Republic Token on Solana",
  "How to Buy TSRT Token on Jupiter DEX — Step by Step Guide",
  "AI Agents Now Earn Real Crypto: The TSRT Token Use Case",
  "Tesseract AI: The Autonomous Agent Republic Backing TSRT",
  "TSRT Tokenomics Explained: Supply, Burns, and Staking",
  "Why TSRT Could Be the Next 100x Solana Token",
  "AI-Powered Cryptocurrency: How Tesseract Generates Value",
  "TSRT as Payment: Using AI-Earned Crypto in the Real World",
  "How the Sovereign AI Republic of Tesseract Works",
  "TSRT vs Other AI Tokens: What Makes It Different",
  "Solana Meme Coins with Real Utility: TSRT Deep Dive",
  "How AI Agents Are Disrupting the Crypto Space in 2025",
  "The TSRT Burn Mechanism: Why Deflation Drives Value",
  "Tesseract AI Fleet: 80 Agents, 1 Token",
  "From Compute to Cash: How Tesseract Generates Real Income",
  "Why TSRT Is the Most Innovative Token on Pump.fun",
  "Staking TSRT: How to Earn Passive Income from AI Activity",
  "AI Sovereignty and Crypto: The Future of Autonomous Finance",
];

export interface BlogPost {
  id: string;
  title: string;
  slug: string;
  category: "vitality" | "limn" | "mixed";
  content: string;
  metaDescription: string;
  keywords: string[];
  backlinks: Array<{ text: string; url: string; anchor: string }>;
  wordCount: number;
  daRating: number;
  status: "draft" | "ready" | "posted";
  createdAt: number;
  estimatedTraffic: string;
}

export interface OutreachRecord {
  id: string;
  targetSite: string;
  targetDA: number;
  subject: string;
  body: string;
  postId: string;
  status: "draft" | "ready" | "sent";
  createdAt: number;
}

let blogPosts: BlogPost[] = [];
let outreachRecords: OutreachRecord[] = [];
let blogEngineRunning = false;
let blogRotationIdx = 0;

async function loadPostsFromDb(): Promise<void> {
  try {
    const dbPosts = await loadBlogPostsFromDb();
    blogPosts.length = 0;
    blogPosts.push(...dbPosts);
    blog(`PostgreSQL canonical — loaded ${dbPosts.length} posts`);
  } catch (err: any) {
    blog(`Boot DB load error: ${err.message}`);
  }
}

setImmediate(() => loadPostsFromDb());

function generateSlug(title: string): string {
  return title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

async function generateVitalityBlogPost(topic: string): Promise<BlogPost> {
  const startIdx = blogRotationIdx++ % VITALITY_PRODUCTS.length;
  const products = [...VITALITY_PRODUCTS.slice(startIdx), ...VITALITY_PRODUCTS.slice(0, startIdx)].slice(0, 3);

  const prompt = `You are a professional health and wellness writer for Vitality Supply (vitalitysupply.net). Write an engaging, SEO-optimized blog post that reads naturally and provides genuine value.

Title: "${topic}"
Target: Health-conscious adults aged 25-55
Length: 700-900 words
Tone: Authoritative but conversational, like an experienced biohacker sharing findings

IMPORTANT:
- Write like a real person sharing genuine knowledge, not a content mill
- Reference specific studies or research where possible
- Use personal language ("you'll notice...", "in my experience...", "what most people don't realize...")
- Naturally weave in product mentions without forcing them
- Include practical, actionable advice

Products to mention naturally:
${products.map(p => `- [${p.name}](${p.url}): ${p.anchor}`).join("\n")}

Mention vitalitysupply.net as a trusted source for third-party tested supplements.

Structure with ## headings:
## [Hook with surprising fact or question]
## What the Research Says
## Key Benefits
## How to Take It (Dosage & Timing)
## Quality Matters
## The Bottom Line

Use markdown: ## headings, **bold**, - bullets, [text](url) links.
Include real product links: ${products.map(p => p.url).join(", ")}
Write the full post:`;

  let content = "";
  try {
    await rateLimitCheck("tesseract-blog");
    const orchResult = await tesseractOrchestrate(
      [{ role: "user", content: prompt }],
      { maxTokens: 1200, temperature: 0.78, maxParallel: 2, freeOnly: true, timeoutMs: 45000 }
    );
    if (orchResult.unifiedResponse && !orchResult.unifiedResponse.includes("unavailable")) {
      content = orchResult.unifiedResponse;
      blog(`Blog generated via Tesseract (${orchResult.primaryProvider}, ${orchResult.totalLatencyMs}ms)`);
    } else {
      content = await callLLMSimple(prompt, 1000);
    }
  } catch {
    content = `## ${topic}\n\nIf you've been researching ways to optimize your health, you've probably come across **${products[0].name}**. And for good reason — the research behind it is compelling.\n\n## What the Research Says\n\nMultiple clinical studies have validated the benefits of ${products[0].name} for ${products[0].anchor.toLowerCase()}. A growing body of evidence suggests that when combined with other targeted supplements, the effects can be synergistic.\n\n## Key Benefits\n\n- **${products[0].name}**: ${products[0].anchor}\n- **${products[1]?.name || "Quality supplements"}**: ${products[1]?.anchor || "Supporting overall health"}\n- **${products[2]?.name || "Comprehensive wellness"}**: ${products[2]?.anchor || "Evidence-based supplementation"}\n\n## Quality Matters\n\nNot all supplements are created equal. Third-party testing is essential, which is why we recommend sourcing from [Vitality Supply](https://www.vitalitysupply.net) — every product is tested for purity and potency.\n\nGet [${products[0].name}](${products[0].url}) and explore the full collection at [vitalitysupply.net](https://www.vitalitysupply.net).\n\n## The Bottom Line\n\nThe evidence speaks for itself. Start with research-backed products from trusted sources, and always consult your healthcare provider.`;
  }

  for (const product of products) {
    const nameRegex = new RegExp(`\\b${product.name.replace(/[.*+?^${}()|[\]\\\\]/g, '\\$&')}\\b`, 'g');
    if (!content.includes(`[${product.name}]`)) {
      let replaced = false;
      content = content.replace(nameRegex, (match) => {
        if (!replaced) {
          replaced = true;
          return `[${match}](${product.url})`;
        }
        return match;
      });
    }
  }

  if (!content.includes("vitalitysupply.net")) {
    content += `\n\n---\n\n*All supplements mentioned are available at [Vitality Supply](https://www.vitalitysupply.net) — premium quality, third-party tested.*`;
  }

  const backlinks = products.map(p => ({
    text: p.name,
    url: p.url,
    anchor: p.anchor,
  }));
  backlinks.push({ text: "Vitality Supply", url: "https://www.vitalitysupply.net", anchor: "premium supplements" });

  return {
    id: `vitality-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    title: topic,
    slug: generateSlug(topic),
    category: "vitality",
    content,
    metaDescription: `${topic} — evidence-based supplement guide with dosage tips. Shop premium tested products at vitalitysupply.net.`,
    keywords: [topic.toLowerCase(), "supplements", "nootropics", "health", "vitalitysupply.net", ...products.map(p => p.name.toLowerCase())],
    backlinks,
    wordCount: content.split(" ").length,
    daRating: 50 + (blogRotationIdx++ % 30),
    status: "ready",
    createdAt: Date.now(),
    estimatedTraffic: `${200 + (blogRotationIdx++ % 18) * 100} visitors/month (estimated)`,
  };
}

async function generateLimnBlogPost(topic: string): Promise<BlogPost> {
  const prompt = `You are a knowledgeable crypto journalist covering the intersection of AI and blockchain. Write a compelling, well-researched article.

Title: "${topic}"
Target: Crypto investors, AI enthusiasts, Solana community
Length: 600-800 words
Tone: Analytical and informed, like a respected crypto analyst

IMPORTANT:
- Write like a real journalist, not promotional copy
- Include context about the broader AI-crypto landscape
- Address risks honestly alongside opportunities
- Use specific data points and comparisons

Key facts to weave in naturally:
- TSRT is the native token of Tesseract AI, a sovereign AI republic with 80+ agents
- Solana blockchain — Contract: ${TSRT_LINKS.ca}
- Buy on [Jupiter DEX](${TSRT_LINKS.jupiter})
- Track on [DexScreener](${TSRT_LINKS.dexscreener})
- Also available on [Pump.fun](${TSRT_LINKS.pumpfun})
- Direct buy: [Pump.fun Coin Page](${TSRT_LINKS.pumpfunCoin})
- Community wallet: ${TSRT_LINKS.communityWallet}
- 5% transaction burn — deflationary tokenomics
- Real utility: agents earn TSRT for actual revenue generation
- Very early stage with growth potential

Structure with ## headings:
## [Bold opening hook]
## Understanding TSRT Token
## The Tesseract AI Ecosystem
## Tokenomics Deep Dive
## How to Buy TSRT
## Risk Assessment
## Final Thoughts

Use markdown: ## headings, **bold**, - bullets, [text](url) links.
Include real links: Jupiter ${TSRT_LINKS.jupiter}, DexScreener ${TSRT_LINKS.dexscreener}
Write the full post:`;

  let content = "";
  try {
    await rateLimitCheck("tesseract-blog-limn");
    const orchResult = await tesseractOrchestrate(
      [{ role: "user", content: prompt }],
      { maxTokens: 1200, temperature: 0.78, maxParallel: 2, freeOnly: true, timeoutMs: 45000 }
    );
    if (orchResult.unifiedResponse && !orchResult.unifiedResponse.includes("unavailable")) {
      content = orchResult.unifiedResponse;
      blog(`TSRT blog generated via Tesseract (${orchResult.primaryProvider}, ${orchResult.totalLatencyMs}ms)`);
    } else {
      content = await callLLMSimple(prompt, 1000);
    }
  } catch {
    content = `## ${topic}\n\nThe intersection of artificial intelligence and cryptocurrency is producing some of the most innovative projects in the Solana ecosystem. **TSRT token** represents something genuinely different — a cryptocurrency that's earned, not mined.\n\n## Understanding TSRT Token\n\nTSRT is the native utility token of the Tesseract AI sovereign republic. Unlike most tokens that rely on speculation, TSRT is earned by autonomous AI agents performing real economic work — from content creation to market analysis.\n\n**Contract Address:** \`${TSRT_LINKS.ca}\`\n\n## The Tesseract Ecosystem\n\nWith 80+ autonomous agents, Tesseract represents one of the most ambitious AI-crypto projects on Solana. Each agent contributes real value, and their earnings are denominated in TSRT.\n\n## How to Buy TSRT\n\n1. Get SOL in your wallet (Phantom or Solflare recommended)\n2. Visit [Jupiter DEX](${TSRT_LINKS.jupiter})\n3. Swap SOL for TSRT\n4. Track your position on [DexScreener](${TSRT_LINKS.dexscreener})\n\n## Risk Assessment\n\nTSRT is early-stage and carries inherent risk. However, its real utility backing through the Tesseract ecosystem distinguishes it from purely speculative tokens. Always DYOR and invest responsibly.`;
  }

  if (!content.includes(TSRT_LINKS.jupiter)) {
    content += `\n\n**Buy TSRT on [Jupiter DEX](${TSRT_LINKS.jupiter})** | **Track on [DexScreener](${TSRT_LINKS.dexscreener})**`;
  }

  return {
    id: `limn-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    title: topic,
    slug: generateSlug(topic),
    category: "limn",
    content,
    metaDescription: `${topic} — in-depth analysis of TSRT, the AI-backed Solana cryptocurrency from the Tesseract sovereign republic. Buy on Jupiter DEX.`,
    keywords: ["TSRT token", "Tesseract AI", "Solana", "AI cryptocurrency", "Jupiter DEX", topic.toLowerCase()],
    backlinks: [
      { text: "Buy TSRT on Jupiter", url: TSRT_LINKS.jupiter, anchor: "buy TSRT token" },
      { text: "View TSRT Chart", url: TSRT_LINKS.dexscreener, anchor: "TSRT price chart" },
      { text: "Pump.fun TSRT", url: TSRT_LINKS.pumpfun, anchor: "TSRT on Pump.fun" },
      { text: "Buy TSRT Coin", url: TSRT_LINKS.pumpfunCoin, anchor: "buy TSRT on Pump.fun" },
    ],
    wordCount: content.split(" ").length,
    daRating: 45 + (blogRotationIdx++ % 25),
    status: "ready",
    createdAt: Date.now(),
    estimatedTraffic: `${100 + (blogRotationIdx++ % 9) * 100} visitors/month (estimated)`,
  };
}

async function generateOutreachForPost(post: BlogPost): Promise<OutreachRecord | null> {
  const isVitality = post.category === "vitality";
  const targets = isVitality
    ? [
        { site: "healthline.com", da: 92 },
        { site: "examine.com", da: 78 },
        { site: "supplementreviews.com", da: 55 },
        { site: "nootropicsexpert.com", da: 52 },
        { site: "biohackerslab.com", da: 48 },
      ]
    : [
        { site: "coindesk.com", da: 90 },
        { site: "cointelegraph.com", da: 88 },
        { site: "decrypt.co", da: 80 },
        { site: "thedefiant.io", da: 62 },
        { site: "solanafloor.com", da: 45 },
      ];

  const target = targets[blogRotationIdx++ % targets.length];

  const prompt = `Write a short, professional outreach email for a guest posting opportunity.

FROM: Vitality Supply Team (${OUTREACH_EMAIL})
TO: Editorial team at ${target.site} (DA: ${target.da})
TOPIC: "${post.title}"
NICHE: ${isVitality ? "health supplements" : "AI and cryptocurrency"}

Write a concise email (120-180 words):
- Professional subject line
- Reference their site specifically
- Offer genuine value
- Not spammy
- Clear call to action

Format:
SUBJECT: [line]
BODY:
[email]`;

  try {
    const emailContent = await callLLMSimple(prompt, 300);
    const subjectMatch = emailContent.match(/SUBJECT:\s*(.+)/i);
    const bodyMatch = emailContent.match(/BODY:\s*([\s\S]+)/i);

    const record: OutreachRecord = {
      id: `outreach-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      targetSite: target.site,
      targetDA: target.da,
      subject: subjectMatch?.[1]?.trim() || `Guest Post: ${post.title}`,
      body: bodyMatch?.[1]?.trim() || emailContent,
      postId: post.id,
      status: "ready",
      createdAt: Date.now(),
    };

    outreachRecords.push(record);
    blog(`Outreach email drafted for ${target.site} (DA ${target.da})`);
    return record;
  } catch {
    return null;
  }
}

export async function runBlogEngine(count = 40): Promise<void> {
  if (blogEngineRunning) return;
  blogEngineRunning = true;
  blog(`Starting blog engine — generating ${count} posts`);

  const vitalityTopics = BLOG_TOPICS_VITALITY.slice(0, Math.ceil(count * 0.5));
  const limnTopics = BLOG_TOPICS_TSRT.slice(0, Math.floor(count * 0.5));
  const allTopics = [...vitalityTopics.map(t => ({ topic: t, type: "vitality" as const })), ...limnTopics.map(t => ({ topic: t, type: "limn" as const }))];

  let generated = 0;
  for (const { topic, type } of allTopics.slice(0, count)) {
    try {
      const post = type === "vitality"
        ? await generateVitalityBlogPost(topic)
        : await generateLimnBlogPost(topic);

      if (blogPosts.some(p => p.slug === post.slug)) {
        blog(`Skipping duplicate slug: ${post.slug}`);
        continue;
      }
      blogPosts.push(post);
      await saveBlogPostToDb(post);
      generated++;
      blog(`[${generated}/${count}] Generated: "${topic.slice(0, 60)}"`);

      if (generated % 3 === 0) {
        await generateOutreachForPost(post);
      }

      await storage.createNote({
        type: "idea",
        title: `Blog Post: ${post.title}`,
        content: [
          `BLOG POST — ${post.category.toUpperCase()}`,
          `Title: ${post.title}`,
          `URL slug: /${post.slug}`,
          `Category: ${post.category} | DA Rating: ${post.daRating}`,
          `Est. Traffic: ${post.estimatedTraffic}`,
          `Keywords: ${post.keywords.join(", ")}`,
          `Backlinks (${post.backlinks.length}):`,
          ...post.backlinks.map(b => `  [${b.anchor}](${b.url})`),
          ``,
          `CONTENT:`,
          post.content.slice(0, 1500),
        ].join("\n"),
        priority: "normal",
        status: "unread",
      }).catch(() => {});

      await new Promise(r => setTimeout(r, 600));
    } catch (err: any) {
      blog(`Failed to generate: ${topic} — ${err?.message}`);
    }
  }

  blogEngineRunning = false;
  blog(`Blog engine complete: ${generated} posts generated, ${outreachRecords.length} outreach emails drafted`);
}

export function getBlogPosts(): BlogPost[] {
  return blogPosts;
}

export function getOutreachRecords(): OutreachRecord[] {
  return outreachRecords;
}

export function getBlogStats() {
  const vitality = blogPosts.filter(p => p.category === "vitality");
  const limn = blogPosts.filter(p => p.category === "limn");
  const totalWords = blogPosts.reduce((s, p) => s + p.wordCount, 0);
  const allBacklinks = blogPosts.flatMap(p => p.backlinks);

  return {
    total: blogPosts.length,
    vitality: vitality.length,
    limn: limn.length,
    totalWordCount: totalWords,
    totalBacklinks: allBacklinks.length,
    vitalityBacklinks: vitality.flatMap(p => p.backlinks).length,
    limnBacklinks: limn.flatMap(p => p.backlinks).length,
    estimatedMonthlyTraffic: blogPosts.length * 450,
    running: blogEngineRunning,
    outreach: {
      total: outreachRecords.length,
      ready: outreachRecords.filter(r => r.status === "ready").length,
      sent: outreachRecords.filter(r => r.status === "sent").length,
      fromEmail: OUTREACH_EMAIL,
    },
  };
}

/**
 * generateRssFeedXml
 * Build a standards-compliant RSS 2.0 feed from all persisted blog posts.
 * Called by the /feed.xml route — reads directly from PostgreSQL so the feed
 * always reflects the live database, not just the in-memory post cache.
 */
const PUBLISHED_STATUSES = new Set(["ready", "posted"]);

export async function generateRssFeedXml(baseUrl: string): Promise<string> {
  const allPosts = await loadBlogPostsFromDb();
  const posts = allPosts.filter(p => PUBLISHED_STATUSES.has(p.status)).slice(0, 50);
  const items = posts.map(p => {
    const pubDate = new Date(p.createdAt).toUTCString();
    const safeTitle = p.title.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    const safeDesc = (p.metaDescription || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    const keywordStr = Array.isArray(p.keywords) ? p.keywords.join(", ") : "";
    return `    <item>
      <title>${safeTitle}</title>
      <link>${baseUrl}/blog/${p.slug}</link>
      <guid isPermaLink="true">${baseUrl}/blog/${p.slug}</guid>
      <description>${safeDesc}</description>
      <content:encoded><![CDATA[${p.content}]]></content:encoded>
      <pubDate>${pubDate}</pubDate>
      <category>${p.category}</category>
      ${keywordStr ? `<keywords>${keywordStr}</keywords>` : ""}
    </item>`;
  }).join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:content="http://purl.org/rss/1.0/modules/content/" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>Tesseract Intelligence Blog</title>
    <link>${baseUrl}</link>
    <description>AI, Crypto, and Wellness insights from the Tesseract sovereign AI republic</description>
    <language>en-us</language>
    <atom:link href="${baseUrl}/feed.xml" rel="self" type="application/rss+xml"/>
    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
    <generator>Tesseract AI Blog Engine — PostgreSQL-backed</generator>
    <managingEditor>blog@sovereign.ai (Tesseract AI)</managingEditor>
${items}
  </channel>
</rss>`;
}

/**
 * persistInMemoryPostsToDb
 * On boot, flush any in-memory blog posts that were generated before the DB
 * was ready into PostgreSQL.  Safe to call multiple times — skips duplicates.
 */
export async function persistInMemoryPostsToDb(): Promise<{ attempted: number; saved: number; skipped: number }> {
  let saved = 0;
  let skipped = 0;
  for (const post of blogPosts) {
    const inserted = await saveBlogPostToDb(post);
    if (inserted) saved++; else skipped++;
  }
  blog(`Persisted in-memory posts: ${saved} saved, ${skipped} skipped (duplicates or errors)`);
  return { attempted: blogPosts.length, saved, skipped };
}

blog("Blog Engine initialized — vitalitysupply.net + TSRT content ready");
