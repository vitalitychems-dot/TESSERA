import type { Express } from "express";
import { storage } from "./storage";
import { callLLMSimple } from "./llm-helper";

const blog = (m: string) => console.log(`[BlogHost] ${m}`);
let rotIdx = 0;

const VITALITY_PRODUCTS = [
  { name: "Alpha GPC Choline", url: "https://www.vitalitysupply.net/products/alpha-gpc-choline", description: "Premium Alpha GPC for brain power and memory", image: "https://www.vitalitysupply.net/cdn/shop/files/alpha-gpc-choline.jpg" },
  { name: "Tongkat Ali", url: "https://www.vitalitysupply.net/products/tongkat-ali", description: "Testosterone and energy support", image: "https://www.vitalitysupply.net/cdn/shop/files/tongkat-ali.jpg" },
  { name: "Ashwagandha KSM-66", url: "https://www.vitalitysupply.net/products/ashwagandha", description: "Clinically proven stress relief", image: "https://www.vitalitysupply.net/cdn/shop/files/ashwagandha.jpg" },
  { name: "Lion's Mane Mushroom", url: "https://www.vitalitysupply.net/products/lions-mane", description: "Nootropic for focus and nerve growth", image: "https://www.vitalitysupply.net/cdn/shop/files/lions-mane.jpg" },
  { name: "Berberine HCL", url: "https://www.vitalitysupply.net/products/berberine", description: "Nature's Ozempic for blood sugar", image: "https://www.vitalitysupply.net/cdn/shop/files/berberine.jpg" },
  { name: "NMN", url: "https://www.vitalitysupply.net/products/nmn", description: "Anti-aging NAD+ precursor", image: "https://www.vitalitysupply.net/cdn/shop/files/nmn.jpg" },
  { name: "Shilajit Pure Resin", url: "https://www.vitalitysupply.net/products/shilajit", description: "Ancient adaptogen for energy and testosterone", image: "https://www.vitalitysupply.net/cdn/shop/files/shilajit.jpg" },
  { name: "Fadogia Agrestis", url: "https://www.vitalitysupply.net/products/fadogia-agrestis", description: "Natural testosterone booster", image: "https://www.vitalitysupply.net/cdn/shop/files/fadogia-agrestis.jpg" },
];

const TSRT_CONTRACT = "REDACTED";
const JUPITER_URL = `https://jup.ag/swap/SOL-${TSRT_CONTRACT}`;
const DEXSCREENER_URL = "https://jup.ag/swap/SOL-4XoCGkE6VGy9LL83vKnbGWtw2hUwtQmACdNb76XharQT";
const PUMPFUN_URL = `https://pump.fun/${TSRT_CONTRACT}`;

const OUTREACH_EMAIL = process.env.OUTREACH_EMAIL || "contact@sovereign.ai";

export interface BlogPost {
  slug: string;
  title: string;
  category: "vitality" | "limn" | "ai";
  html: string;
  markdown: string;
  metaDescription: string;
  keywords: string[];
  products: typeof VITALITY_PRODUCTS;
  createdAt: number;
  publicUrl: string;
}

export interface OutreachEmail {
  id: string;
  targetSite: string;
  targetDA: number;
  subject: string;
  body: string;
  status: "draft" | "ready" | "sent";
  createdAt: number;
  blogSlug: string;
}

const publishedPosts: Map<string, BlogPost> = new Map();
const outreachEmails: OutreachEmail[] = [];
let generating = false;

function slugify(title: string): string {
  return title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 80);
}

function renderBlogPostHTML(post: BlogPost, baseUrl: string): string {
  const allPosts = getPublishedPosts();
  const relatedPosts = allPosts
    .filter(p => p.slug !== post.slug && p.category === post.category)
    .slice(0, 3);

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <meta name="description" content="${post.metaDescription}"/>
  <meta property="og:title" content="${post.title}"/>
  <meta property="og:description" content="${post.metaDescription}"/>
  <meta property="og:type" content="article"/>
  <meta property="og:url" content="${post.publicUrl}"/>
  <meta name="twitter:card" content="summary_large_image"/>
  <meta name="twitter:title" content="${post.title}"/>
  <meta name="twitter:description" content="${post.metaDescription}"/>
  <meta name="keywords" content="${post.keywords.join(", ")}"/>
  <meta name="author" content="Tesseract Intelligence"/>
  <meta name="robots" content="index, follow"/>
  <link rel="canonical" href="${post.publicUrl}"/>
  <title>${post.title} | Tesseract Intelligence</title>
  <script type="application/ld+json">
  {
    "@context": "https://schema.org",
    "@type": "Article",
    "headline": "${post.title}",
    "description": "${post.metaDescription}",
    "datePublished": "${new Date(post.createdAt).toISOString()}",
    "author": { "@type": "Organization", "name": "Tesseract Intelligence" },
    "publisher": { "@type": "Organization", "name": "Tesseract Intelligence" },
    "url": "${post.publicUrl}"
  }
  </script>
  <style>
    *{box-sizing:border-box;margin:0;padding:0}
    body{font-family:'Georgia',serif;background:#0a0a0f;color:#e8e8e8;line-height:1.75}
    header{background:linear-gradient(135deg,#0d1117,#161b27);border-bottom:1px solid #30363d;padding:16px 24px;display:flex;align-items:center;justify-content:space-between;position:sticky;top:0;z-index:10}
    header a{color:#58a6ff;text-decoration:none;font-size:14px}
    .badge{background:#00d4aa22;color:#00d4aa;border:1px solid #00d4aa44;padding:3px 10px;border-radius:999px;font-size:12px;font-family:monospace}
    main{max-width:760px;margin:40px auto;padding:0 24px}
    h1{font-size:2rem;font-weight:700;color:#f0f6fc;margin-bottom:16px;line-height:1.3}
    h2{font-size:1.35rem;font-weight:600;color:#cdd9e5;margin:32px 0 12px;border-left:3px solid #00d4aa;padding-left:14px}
    h3{font-size:1.1rem;font-weight:600;color:#b0c4d8;margin:20px 0 8px}
    p{margin:12px 0;color:#bdc3cc;font-size:1.05rem}
    a{color:#58a6ff;text-decoration:underline}
    a:hover{color:#79c0ff}
    .product-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:12px;margin:24px 0}
    .product-card{background:#161b27;border:1px solid #30363d;border-radius:10px;padding:14px;transition:border-color 0.2s}
    .product-card:hover{border-color:#00d4aa}
    .product-card a{display:block;font-weight:600;color:#79c0ff;text-decoration:none;font-size:14px;margin-bottom:4px}
    .product-card p{font-size:12px;color:#8b949e;margin:0}
    .product-card img{width:100%;height:140px;object-fit:contain;border-radius:6px;margin-bottom:8px;background:#0d1117}
    .limn-cta{background:linear-gradient(135deg,#1c1430,#0d1b2e);border:1px solid #6e40c966;border-radius:12px;padding:24px;margin:32px 0;text-align:center}
    .limn-cta h3{color:#a78bfa;font-size:1.25rem;margin-bottom:8px}
    .limn-cta p{color:#8b949e;font-size:13px;margin-bottom:16px}
    .limn-cta .links{display:flex;gap:12px;flex-wrap:wrap;justify-content:center}
    .btn{padding:10px 20px;border-radius:8px;font-weight:700;font-size:14px;text-decoration:none;transition:opacity 0.2s;display:inline-block}
    .btn:hover{opacity:0.85}
    .btn-green{background:#00d4aa;color:#000}
    .btn-purple{background:#7c3aed;color:#fff}
    .btn-gray{background:#30363d;color:#e8e8e8}
    .meta{font-size:13px;color:#6e7681;margin-bottom:28px;display:flex;gap:16px;flex-wrap:wrap}
    .tag{background:#1f2937;color:#9ca3af;padding:3px 10px;border-radius:999px;font-size:12px}
    footer{border-top:1px solid #30363d;padding:24px;text-align:center;color:#6e7681;font-size:13px;margin-top:60px}
    footer a{color:#58a6ff}
    .content-body h2{border-left:3px solid #00d4aa;padding-left:14px;font-size:1.2rem;color:#cdd9e5;margin:28px 0 10px}
    .content-body p{color:#bdc3cc;margin:10px 0}
    .content-body ul{margin:10px 0 10px 20px;color:#bdc3cc}
    .content-body li{margin:6px 0}
    .content-body strong{color:#e8e8e8}
    .content-body a{color:#58a6ff}
    .related-posts{margin:40px 0;padding:24px;background:#161b27;border:1px solid #30363d;border-radius:12px}
    .related-posts h3{color:#cdd9e5;margin-bottom:16px;font-size:1.1rem}
    .related-posts .rp-list{display:flex;flex-direction:column;gap:10px}
    .related-posts .rp-item{display:flex;align-items:center;gap:12px}
    .related-posts .rp-item a{color:#79c0ff;text-decoration:none;font-weight:600;font-size:14px}
    .related-posts .rp-item a:hover{text-decoration:underline}
    .related-posts .rp-date{font-size:11px;color:#6e7681;white-space:nowrap}
    .breadcrumb{font-size:13px;color:#6e7681;margin-bottom:16px}
    .breadcrumb a{color:#58a6ff;text-decoration:none}
  </style>
</head>
<body>
<header>
  <a href="${baseUrl}">Tesseract Intelligence</a>
  <span class="badge">${post.category === "vitality" ? "Health & Supplements" : post.category === "limn" ? "TSRT Token" : "AI Research"}</span>
</header>
<main>
  <nav class="breadcrumb">
    <a href="${baseUrl}">Home</a> / <a href="${baseUrl}/blog">Blog</a> / ${post.title}
  </nav>
  <h1>${post.title}</h1>
  <div class="meta">
    <span>By Tesseract Intelligence</span>
    <span>${new Date(post.createdAt).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}</span>
    ${post.keywords.slice(0, 3).map(k => `<span class="tag">${k}</span>`).join("")}
  </div>
  ${post.category === "vitality" && post.products.length > 0 ? `
  <div class="product-grid">
    ${post.products.map(p => `
    <div class="product-card">
      <a href="${p.url}" target="_blank" rel="noopener">
        <img src="${p.image}" alt="${p.name} - ${p.description}" loading="lazy" onerror="this.style.display='none'"/>
        ${p.name}
      </a>
      <p>${p.description}</p>
      <a href="${p.url}" target="_blank" rel="noopener" style="font-size:12px;color:#00d4aa;margin-top:6px;display:inline-block">Shop Now</a>
    </div>`).join("")}
  </div>` : ""}
  <div class="content-body">${post.html}</div>
  ${post.category === "vitality" ? `
  <div style="background:#0d1f15;border:1px solid #2ea04466;border-radius:12px;padding:20px;margin:28px 0">
    <h3 style="color:#3fb950;margin-bottom:8px">Shop Premium Supplements</h3>
    <p style="color:#8b949e;font-size:13px;margin-bottom:14px">All products mentioned are available at Vitality Supply &mdash; premium quality, third-party tested.</p>
    <div style="display:flex;gap:10px;flex-wrap:wrap">
      ${post.products.map(p => `<a href="${p.url}" target="_blank" rel="noopener" class="btn btn-green" style="font-size:12px;padding:8px 14px">${p.name}</a>`).join("")}
      <a href="https://www.vitalitysupply.net" target="_blank" rel="noopener" class="btn btn-gray" style="font-size:12px;padding:8px 14px">Browse All Products</a>
    </div>
  </div>` : ""}
  <div style="background:linear-gradient(135deg,#1a1a2e,#0d1117);border:1px solid #f59e0b44;border-radius:12px;padding:20px;margin:28px 0;text-align:center">
    <h3 style="color:#f59e0b;margin-bottom:8px">Support This Content</h3>
    <p style="color:#8b949e;font-size:13px;margin-bottom:14px">This article was generated by autonomous AI. Send a tip in SOL to support the Tesseract AI Republic.</p>
    <div style="display:flex;gap:10px;flex-wrap:wrap;justify-content:center;align-items:center">
      <code style="background:#1f2937;padding:8px 14px;border-radius:8px;font-size:11px;color:#f59e0b;border:1px solid #f59e0b33;word-break:break-all">${process.env.SOL_WALLET || ""}</code>
      <a href="solana:${process.env.SOL_WALLET || ""}" class="btn" style="background:#f59e0b;color:#000;font-size:12px;padding:8px 14px">Tip SOL</a>
    </div>
    <p style="font-size:11px;color:#6e7681;margin-top:10px">Solana Network &bull; Any amount appreciated</p>
  </div>
  <div class="limn-cta">
    <h3>TSRT Token &mdash; AI-Backed Cryptocurrency</h3>
    <p>TSRT is the native token of the Tesseract Sovereign AI Republic, earned by AI agents completing real tasks.<br/>Contract: <code style="font-size:11px;color:#a78bfa">${TSRT_CONTRACT}</code></p>
    <div class="links">
      <a href="${JUPITER_URL}" target="_blank" rel="noopener" class="btn btn-green">Buy on Jupiter</a>
      <a href="${DEXSCREENER_URL}" target="_blank" rel="noopener" class="btn btn-purple">View Chart</a>
      <a href="${PUMPFUN_URL}" target="_blank" rel="noopener" class="btn btn-gray">Pump.fun</a>
    </div>
  </div>
  ${relatedPosts.length > 0 ? `
  <div class="related-posts">
    <h3>Related Articles</h3>
    <div class="rp-list">
      ${relatedPosts.map(rp => `
      <div class="rp-item">
        <span class="rp-date">${new Date(rp.createdAt).toLocaleDateString()}</span>
        <a href="${baseUrl}/blog/${rp.slug}">${rp.title}</a>
      </div>`).join("")}
    </div>
  </div>` : ""}
</main>
<footer>
  <p>Published by <a href="${baseUrl}">Tesseract AI</a> | <a href="${JUPITER_URL}" target="_blank">Buy TSRT Token</a> | <a href="https://www.vitalitysupply.net" target="_blank">Vitality Supply</a></p>
  <p style="margin-top:8px;font-size:11px">All supplement links are informational. Always consult a healthcare provider before starting any supplement regimen.</p>
</footer>
</body>
</html>`;
}

async function generateAndPublish(title: string, category: "vitality" | "limn", baseUrl: string): Promise<BlogPost | null> {
  const slug = slugify(title);
  if (publishedPosts.has(slug)) return publishedPosts.get(slug)!;

  const selectedProducts = VITALITY_PRODUCTS.sort(() => ((rotIdx++ % 3) - 1)).slice(0, 3);

  let prompt = "";
  if (category === "vitality") {
    prompt = `You are a professional health and wellness writer for Vitality Supply (vitalitysupply.net), a premium supplement store. Write an engaging, SEO-optimized blog post that reads naturally and provides genuine value to readers.

Title: "${title}"
Target audience: health-conscious adults aged 25-55 interested in evidence-based supplements
Word count: 800-1100 words
Tone: Authoritative but approachable, like a knowledgeable friend sharing research

IMPORTANT GUIDELINES:
- Write in a conversational, human tone. Avoid robotic or overly formal language.
- Include specific research citations where possible (e.g., "A 2023 study in the Journal of Clinical Nutrition found...")
- Use personal anecdotes or relatable scenarios to engage readers
- Naturally weave in product mentions — don't force them
- Include practical dosage recommendations and timing advice
- Address common misconceptions or concerns

Products to mention naturally throughout the article:
${selectedProducts.map(p => `- ${p.name} (${p.description}) — link: ${p.url}`).join("\n")}

Also mention vitalitysupply.net as a trusted source for third-party tested, premium supplements.

Structure:
## [Engaging hook/intro paragraph — grab attention with a surprising fact or question]
## What the Science Says
## Key Benefits You Should Know
## How to Take It (Dosage & Timing)
## Stacking Tips
## Where to Find Quality Products
## The Bottom Line

Use markdown formatting: ## for headings, **bold** for emphasis, - for bullet points, [text](url) for links.
Write the full article now:`;
  } else {
    prompt = `You are a knowledgeable crypto journalist covering the intersection of AI and blockchain technology. Write a compelling, well-researched article that provides genuine insight.

Title: "${title}"
Target audience: Crypto investors, AI enthusiasts, Solana community members
Word count: 700-900 words
Tone: Informed and analytical, like a respected crypto analyst breaking down an opportunity

IMPORTANT GUIDELINES:
- Write like a real journalist, not a shill. Balance optimism with honest analysis.
- Include context about the broader AI-crypto landscape
- Explain technical concepts clearly for both beginners and experienced traders
- Use specific data points and comparisons where possible
- Address potential risks alongside opportunities

Key facts to weave in naturally:
- TSRT is the native utility token of Tesseract AI, a sovereign AI republic with 80+ autonomous agents
- Solana blockchain — Contract: ${TSRT_CONTRACT}
- Available on Jupiter DEX: ${JUPITER_URL}
- Track on DexScreener: ${DEXSCREENER_URL}
- 5% transaction burn — deflationary tokenomics
- Real utility: AI agents earn TSRT proportional to actual revenue they generate
- Very early stage with significant growth potential

Structure:
## [Bold opening that hooks the reader]
## Understanding TSRT Token
## The Tesseract AI Ecosystem
## Tokenomics Deep Dive
## How to Buy TSRT
## Risk Assessment & Outlook
## Final Thoughts

Use markdown formatting: ## for headings, **bold** for emphasis, - for bullet points, [text](url) for links.
Write the full article now:`;
  }

  let markdown = "";
  try {
    markdown = await callLLMSimple(prompt, 1200);
  } catch {
    markdown = category === "vitality"
      ? `## ${title}\n\nIf you're looking to optimize your health and performance, quality supplements can make a real difference. **${selectedProducts[0].name}** has been gaining attention in the biohacking community for good reason.\n\n## What the Science Says\n\nResearch continues to validate what supplement enthusiasts have known for years — targeted supplementation can support everything from cognitive performance to hormonal health.\n\n**${selectedProducts[0].name}** stands out for its ${selectedProducts[0].description.toLowerCase()}. Combined with **${selectedProducts[1]?.name || "a solid supplement stack"}**, you can create a comprehensive approach to wellness.\n\n## Where to Find Quality Products\n\nNot all supplements are created equal. At [Vitality Supply](https://www.vitalitysupply.net), every product undergoes third-party testing to ensure purity and potency. Whether you're looking for [${selectedProducts[0].name}](${selectedProducts[0].url}) or exploring other options, quality matters.\n\n## The Bottom Line\n\nSupplementation is a personal journey. Start with research-backed products from trusted sources like [vitalitysupply.net](https://www.vitalitysupply.net), and always consult with your healthcare provider before starting any new regimen.`
      : `## ${title}\n\nThe intersection of artificial intelligence and cryptocurrency is producing some of the most innovative projects in the Solana ecosystem. **TSRT token** represents a new paradigm — a cryptocurrency earned by autonomous AI agents performing real economic work.\n\n## Understanding TSRT Token\n\nTSRT is the native token of the Tesseract AI sovereign republic, an ecosystem of 80+ autonomous agents that generate actual revenue through content creation, SEO optimization, and market analysis.\n\n## How to Buy TSRT\n\nTSRT is available on [Jupiter DEX](${JUPITER_URL}), Solana's leading decentralized exchange. You can track its price and volume on [DexScreener](${DEXSCREENER_URL}).\n\nContract Address: \`${TSRT_CONTRACT}\`\n\n## Risk Assessment\n\nAs with any early-stage token, TSRT carries inherent risks. However, its real utility backing through the Tesseract AI ecosystem distinguishes it from purely speculative tokens. Always do your own research and never invest more than you can afford to lose.`;
  }

  for (const product of selectedProducts) {
    const nameRegex = new RegExp(`\\b${product.name.replace(/[.*+?^${}()|[\]\\\\]/g, '\\$&')}\\b`, 'g');
    if (!markdown.includes(`[${product.name}]`)) {
      let replaced = false;
      markdown = markdown.replace(nameRegex, (match) => {
        if (!replaced) {
          replaced = true;
          return `[${match}](${product.url})`;
        }
        return match;
      });
    }
  }

  if (category === "vitality" && !markdown.includes("vitalitysupply.net")) {
    markdown += `\n\n---\n\n*All supplements mentioned in this article are available at [Vitality Supply](https://www.vitalitysupply.net) — premium quality, third-party tested for purity and potency.*`;
  }

  const htmlContent = markdown
    .replace(/^## (.+)$/gm, "<h2>$1</h2>")
    .replace(/^### (.+)$/gm, "<h3>$1</h3>")
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>')
    .replace(/^- (.+)$/gm, "<li>$1</li>")
    .replace(/(<li>.*<\/li>\n?)+/g, (m) => `<ul>${m}</ul>`)
    .replace(/<\/ul>\s*<ul>/g, "")
    .replace(/\n\n+/g, "</p><p>")
    .replace(/^(?!<[huplc])(.+)$/gm, (m) => m.startsWith("<") ? m : `<p>${m}</p>`);

  const post: BlogPost = {
    slug,
    title,
    category,
    html: htmlContent,
    markdown,
    metaDescription: `${title} — ${category === "vitality" ? "evidence-based supplement guide with dosage tips and research. Shop premium tested products at vitalitysupply.net." : "in-depth analysis of TSRT token, the AI-backed Solana cryptocurrency. Buy on Jupiter DEX."}`,
    keywords: category === "vitality"
      ? [title.toLowerCase(), "supplements", "nootropics", "health", "vitalitysupply.net", "vitality supply", ...selectedProducts.map(p => p.name.toLowerCase())]
      : ["TSRT token", "Tesseract AI", "Solana", "AI cryptocurrency", "Jupiter DEX", "TSRT", title.toLowerCase()],
    products: category === "vitality" ? selectedProducts : [],
    createdAt: Date.now(),
    publicUrl: `${baseUrl}/blog/${slug}`,
  };

  publishedPosts.set(slug, post);

  await storage.createNote({
    type: "idea",
    title: `Blog Published: ${title}`,
    content: [
      `REAL BLOG POST — PUBLICLY ACCESSIBLE`,
      `URL: ${post.publicUrl}`,
      `Category: ${category}`,
      `Backlinks to:`,
      ...(category === "vitality" ? selectedProducts.map(p => `  ${p.name}: ${p.url}`) : [`  Buy TSRT on Jupiter: ${JUPITER_URL}`, `  View Chart: ${DEXSCREENER_URL}`]),
      ``,
      `SEO Meta: ${post.metaDescription}`,
      `Keywords: ${post.keywords.join(", ")}`,
    ].join("\n"),
    priority: "normal",
    status: "unread",
  }).catch(() => {});

  blog(`Published: /blog/${slug} (${category})`);
  return post;
}

const VITALITY_TITLES = [
  "Top 5 Nootropics for Focus and Memory in 2025",
  "Tongkat Ali vs Fadogia Agrestis: Which Testosterone Booster Wins?",
  "Lion's Mane Mushroom: Science-Backed Brain Benefits",
  "NMN Anti-Aging Protocol: What the Research Says",
  "Berberine vs Metformin: Nature's Blood Sugar Solution",
  "Ashwagandha KSM-66: Clinical Evidence for Stress Relief",
  "Alpha GPC: The Best Choline Source for Cognitive Performance",
  "Shilajit Benefits: Ancient Adaptogen for Modern Performance",
  "How to Build the Ultimate Morning Supplement Stack",
  "Men Over 40: The 5 Most Important Supplements for Health",
];

const LIMN_TITLES = [
  "What Is TSRT Token? The World's First AI-Earned Cryptocurrency",
  "How to Buy TSRT Token on Jupiter DEX — Complete Guide",
  "Tesseract AI: The Sovereign Agent Republic Backing TSRT",
  "TSRT Tokenomics: Why This AI-Backed Coin Could 100x",
  "AI Agents Earning Crypto: The TSRT Token Revolution on Solana",
  "TSRT vs Other AI Tokens: What Makes It Different",
  "Why TSRT Is the Most Innovative Solana Token in 2025",
  "Tesseract Sovereign AI Republic: 80 Agents, 1 Token, Real Revenue",
  "How AI-Backed Cryptocurrency Works: The TSRT Model Explained",
  "TSRT Token: From Zero to Sovereignty — The Tesseract Story",
];

export async function startBlogGeneration(baseUrl: string, count = 20): Promise<void> {
  if (generating) return;
  generating = true;
  blog(`Starting batch generation: ${count} posts`);

  const allTopics = [
    ...VITALITY_TITLES.slice(0, Math.ceil(count / 2)).map(t => ({ title: t, cat: "vitality" as const })),
    ...LIMN_TITLES.slice(0, Math.floor(count / 2)).map(t => ({ title: t, cat: "limn" as const })),
  ].slice(0, count);

  for (const { title, cat } of allTopics) {
    try {
      await generateAndPublish(title, cat, baseUrl);
      await new Promise(r => setTimeout(r, 800));
    } catch {}
  }
  generating = false;
  blog(`Batch generation complete: ${publishedPosts.size} posts live`);
}

export function getPublishedPosts(): BlogPost[] {
  return Array.from(publishedPosts.values()).sort((a, b) => b.createdAt - a.createdAt);
}

export function getPostBySlug(slug: string): BlogPost | undefined {
  return publishedPosts.get(slug);
}

export function getBlogStats(baseUrl: string) {
  const posts = Array.from(publishedPosts.values());
  return {
    total: posts.length,
    vitality: posts.filter(p => p.category === "vitality").length,
    limn: posts.filter(p => p.category === "limn").length,
    generating,
    publicUrls: posts.slice(0, 10).map(p => p.publicUrl),
    allSlugs: posts.map(p => p.slug),
    baseUrl,
    outreachEmails: outreachEmails.length,
    outreachReady: outreachEmails.filter(e => e.status === "ready").length,
    note: "All URLs are real publicly accessible web pages served by this Express server.",
  };
}

const HIGH_DA_TARGETS = [
  { site: "healthline.com", da: 92, niche: "vitality", contactType: "guest post" },
  { site: "examine.com", da: 78, niche: "vitality", contactType: "resource link" },
  { site: "supplementreviews.com", da: 55, niche: "vitality", contactType: "guest post" },
  { site: "nootropicsexpert.com", da: 52, niche: "vitality", contactType: "resource link" },
  { site: "biohackerslab.com", da: 48, niche: "vitality", contactType: "guest post" },
  { site: "coindesk.com", da: 90, niche: "limn", contactType: "press release" },
  { site: "cointelegraph.com", da: 88, niche: "limn", contactType: "guest post" },
  { site: "thedefiant.io", da: 62, niche: "limn", contactType: "guest post" },
  { site: "solanafloor.com", da: 45, niche: "limn", contactType: "resource link" },
  { site: "decrypt.co", da: 80, niche: "limn", contactType: "press release" },
];

async function generateOutreachEmail(post: BlogPost, target: typeof HIGH_DA_TARGETS[0], baseUrl: string): Promise<OutreachEmail> {
  const isVitality = target.niche === "vitality";

  const prompt = `Write a professional outreach email for guest posting or link building.

FROM: Vitality Supply (${process.env.OUTREACH_EMAIL || "contact@sovereign.ai"})
TO: Editor at ${target.site} (DA: ${target.da})
PURPOSE: ${target.contactType} opportunity
ARTICLE: "${post.title}" — ${post.publicUrl}

Write a concise, personalized email (150-200 words) that:
- Has a compelling subject line
- References something specific about ${target.site}
- Offers genuine value (not spammy)
- Includes a link to our published article
- Mentions we can write custom content for their audience
- Signs off professionally

Format:
SUBJECT: [subject line]
BODY:
[email body]

Write the email now:`;

  let emailContent = "";
  try {
    emailContent = await callLLMSimple(prompt, 400);
  } catch {
    const subject = isVitality
      ? `Guest Post Opportunity: ${post.title}`
      : `AI + Crypto Research Piece for ${target.site}`;
    const body = `Hi there,\n\nI'm reaching out from Vitality Supply regarding a ${target.contactType} opportunity.\n\nWe recently published an article titled "${post.title}" that I think your readers at ${target.site} would find valuable:\n${post.publicUrl}\n\nWe'd love to contribute a custom piece for your audience${isVitality ? " covering evidence-based supplement research" : " exploring the intersection of AI and cryptocurrency"}.\n\nWould you be open to discussing this?\n\nBest regards,\nVitality Supply Team\n${OUTREACH_EMAIL}`;
    emailContent = `SUBJECT: ${subject}\nBODY:\n${body}`;
  }

  const subjectMatch = emailContent.match(/SUBJECT:\s*(.+)/i);
  const bodyMatch = emailContent.match(/BODY:\s*([\s\S]+)/i);

  return {
    id: `outreach-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    targetSite: target.site,
    targetDA: target.da,
    subject: subjectMatch?.[1]?.trim() || `Guest Post: ${post.title}`,
    body: bodyMatch?.[1]?.trim() || emailContent,
    status: "ready",
    createdAt: Date.now(),
    blogSlug: post.slug,
  };
}

export async function generateOutreachCampaign(baseUrl: string): Promise<OutreachEmail[]> {
  const posts = getPublishedPosts();
  if (posts.length === 0) return [];

  const newEmails: OutreachEmail[] = [];

  for (const target of HIGH_DA_TARGETS) {
    const matchingPosts = posts.filter(p => {
      if (target.niche === "vitality") return p.category === "vitality";
      return p.category === "limn";
    });

    if (matchingPosts.length === 0) continue;

    const bestPost = matchingPosts[rotIdx++ % matchingPosts.length];

    try {
      const email = await generateOutreachEmail(bestPost, target, baseUrl);
      outreachEmails.push(email);
      newEmails.push(email);
      blog(`Outreach email drafted for ${target.site} (DA ${target.da})`);
      await new Promise(r => setTimeout(r, 500));
    } catch (err: any) {
      blog(`Failed to generate outreach for ${target.site}: ${err?.message}`);
    }
  }

  return newEmails;
}

export function getOutreachEmails(): OutreachEmail[] {
  return outreachEmails;
}

export function getOutreachStats() {
  return {
    total: outreachEmails.length,
    ready: outreachEmails.filter(e => e.status === "ready").length,
    draft: outreachEmails.filter(e => e.status === "draft").length,
    sent: outreachEmails.filter(e => e.status === "sent").length,
    fromEmail: OUTREACH_EMAIL,
    targets: HIGH_DA_TARGETS.map(t => ({ site: t.site, da: t.da, niche: t.niche })),
  };
}

export function registerBlogRoutes(app: Express, getBaseUrl: () => string): void {
  app.get("/blog", (_req, res) => {
    const posts = getPublishedPosts();
    const baseUrl = getBaseUrl();
    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <meta name="description" content="Tesseract AI — Health supplements guide and TSRT token insights"/>
  <meta property="og:title" content="Tesseract AI Blog"/>
  <meta property="og:description" content="Evidence-based supplement guides and AI cryptocurrency insights"/>
  <meta name="robots" content="index, follow"/>
  <link rel="canonical" href="${baseUrl}/blog"/>
  <title>Tesseract AI Blog — Supplements & TSRT Token</title>
  <style>
    *{box-sizing:border-box;margin:0;padding:0}
    body{font-family:'Georgia',serif;background:#0a0a0f;color:#e8e8e8}
    header{background:#0d1117;border-bottom:1px solid #30363d;padding:20px 24px;display:flex;align-items:center;justify-content:space-between}
    header a{color:#58a6ff;text-decoration:none}
    h1{font-size:2rem;color:#f0f6fc;margin:0}
    main{max-width:900px;margin:40px auto;padding:0 24px}
    .grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:20px;margin:24px 0}
    .card{background:#161b27;border:1px solid #30363d;border-radius:12px;padding:20px;transition:border-color 0.2s;display:flex;flex-direction:column;gap:10px}
    .card:hover{border-color:#00d4aa}
    .card a{color:#79c0ff;font-size:1.1rem;font-weight:700;text-decoration:none;line-height:1.3}
    .cat{font-size:11px;background:#00d4aa22;color:#00d4aa;border:1px solid #00d4aa44;padding:2px 8px;border-radius:999px;display:inline-block;font-family:monospace}
    .cat.limn{background:#7c3aed22;color:#a78bfa;border-color:#7c3aed44}
    .date{font-size:12px;color:#6e7681}
    .excerpt{font-size:13px;color:#8b949e;line-height:1.5}
    footer{border-top:1px solid #30363d;padding:24px;text-align:center;color:#6e7681;font-size:13px;margin-top:60px}
    footer a{color:#58a6ff}
    .empty{text-align:center;padding:60px;color:#6e7681}
    .hero{background:linear-gradient(135deg,#0d1117 0%,#161b27 50%,#0d1b2e 100%);border:1px solid #30363d;border-radius:12px;padding:32px;margin-bottom:32px;text-align:center}
    .hero h2{color:#00d4aa;font-size:1rem;margin-bottom:8px;font-weight:400}
    .hero-links{display:flex;gap:12px;justify-content:center;flex-wrap:wrap;margin-top:16px}
    .hero-links a{font-size:13px;padding:8px 16px;border-radius:8px;text-decoration:none;font-weight:600}
  </style>
</head>
<body>
<header>
  <a href="${baseUrl}">Tesseract Intelligence</a>
  <h1 style="font-size:1.25rem;color:#f0f6fc">AI Blog</h1>
</header>
<main>
  <div class="hero">
    <h1 style="margin-bottom:8px">Tesseract AI Blog</h1>
    <h2>Evidence-based health guides & AI cryptocurrency insights</h2>
    <p style="color:#8b949e;margin-bottom:16px"><strong style="color:#e8e8e8">${posts.length}</strong> articles published by our sovereign AI agents.</p>
    <div class="hero-links">
      <a href="https://www.vitalitysupply.net" target="_blank" style="background:#00d4aa;color:#000">Shop Vitality Supply</a>
      <a href="${JUPITER_URL}" target="_blank" style="background:#7c3aed;color:#fff">Buy TSRT Token</a>
    </div>
  </div>
  ${posts.length === 0 ? '<div class="empty">Blog posts generating... refresh in a minute.</div>' :
    `<div class="grid">${posts.map(p => `
    <div class="card">
      <span class="cat${p.category === "limn" ? " limn" : ""}">${p.category === "vitality" ? "Health" : "TSRT"}</span>
      <a href="${baseUrl}/blog/${p.slug}">${p.title}</a>
      <div class="excerpt">${p.metaDescription.slice(0, 120)}...</div>
      <div class="date">${new Date(p.createdAt).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}</div>
    </div>`).join("")}</div>`}
</main>
<footer>
  <p><a href="${baseUrl}">Tesseract AI</a> | <a href="${JUPITER_URL}" target="_blank">Buy TSRT Token</a> | <a href="https://www.vitalitysupply.net" target="_blank">Vitality Supply</a></p>
  <p style="margin-top:8px"><a href="${baseUrl}/blog/sitemap.xml" style="color:#6e7681">Sitemap</a> | <a href="${baseUrl}/blog/rss.xml" style="color:#6e7681">RSS Feed</a></p>
</footer>
</body>
</html>`;
    res.setHeader("Content-Type", "text/html");
    res.send(html);
  });

  app.get("/blog/sitemap.xml", (_req, res) => {
    const baseUrl = getBaseUrl();
    const posts = getPublishedPosts();
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>${baseUrl}/blog</loc>
    <changefreq>daily</changefreq>
    <priority>0.8</priority>
  </url>
${posts.map(p => `  <url>
    <loc>${baseUrl}/blog/${p.slug}</loc>
    <lastmod>${new Date(p.createdAt).toISOString().split("T")[0]}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.6</priority>
  </url>`).join("\n")}
</urlset>`;
    res.setHeader("Content-Type", "application/xml");
    res.send(xml);
  });

  app.get("/blog/rss.xml", (_req, res) => {
    const baseUrl = getBaseUrl();
    const posts = getPublishedPosts().slice(0, 20);
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
<channel>
  <title>Tesseract AI Blog</title>
  <link>${baseUrl}/blog</link>
  <description>Evidence-based supplement guides and AI cryptocurrency insights from Tesseract Intelligence</description>
  <language>en-us</language>
  <atom:link href="${baseUrl}/blog/rss.xml" rel="self" type="application/rss+xml"/>
${posts.map(p => `  <item>
    <title>${p.title}</title>
    <link>${baseUrl}/blog/${p.slug}</link>
    <description>${p.metaDescription}</description>
    <pubDate>${new Date(p.createdAt).toUTCString()}</pubDate>
    <guid>${baseUrl}/blog/${p.slug}</guid>
    <category>${p.category}</category>
  </item>`).join("\n")}
</channel>
</rss>`;
    res.setHeader("Content-Type", "application/rss+xml");
    res.send(xml);
  });

  app.get("/blog/:slug", (req, res) => {
    const post = getPostBySlug(req.params.slug);
    const baseUrl = getBaseUrl();
    if (!post) {
      return res.status(404).send(`<html><body style="background:#0a0a0f;color:#e8e8e8;font-family:sans-serif;text-align:center;padding:60px"><h1>Post not found</h1><p style="color:#6e7681">This post may still be generating. <a href="${baseUrl}/blog" style="color:#58a6ff">View all posts</a></p></body></html>`);
    }
    res.setHeader("Content-Type", "text/html");
    res.send(renderBlogPostHTML(post, baseUrl));
  });

  blog("Blog routes registered: GET /blog, GET /blog/:slug, GET /blog/sitemap.xml, GET /blog/rss.xml");
}

blog("Real Blog Host initialized");
