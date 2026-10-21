import { callLLMSimple } from "./llm-helper";
import { getJobArbitrageState, type JobListing } from "./job-arbitrage-engine";

const log = (msg: string) => console.log(`[JobAutoApply] ${msg}`);

interface Application {
  id: string;
  jobId: string;
  jobTitle: string;
  platform: string;
  proposal: string;
  coverLetter: string;
  bidAmount?: number;
  status: "draft" | "submitted" | "viewed" | "shortlisted" | "rejected" | "won";
  submittedAt?: string;
  createdAt: string;
  url: string;
  category: string;
  estimatedValue: number;
}

const applications: Application[] = [];
let autoApplyEnabled = false;
let applyInterval: NodeJS.Timeout | null = null;

const TESSERA_SKILLS = `Expert full-stack developer (React, Node.js, Python, TypeScript), AI/ML specialist, blockchain developer (Solana, Ethereum), SEO content strategist, data scraping/automation, API development, chatbot building, DevOps, system architecture. 8+ years experience. Portfolio: vitalitysupply.net`;

const PRICING: Record<string, { min: number; max: number }> = {
  "software": { min: 200, max: 2000 },
  "ai-ml": { min: 300, max: 3000 },
  "design": { min: 100, max: 800 },
  "writing": { min: 50, max: 500 },
  "data": { min: 100, max: 1000 },
  "marketing": { min: 150, max: 1500 },
  "crypto": { min: 250, max: 2500 },
  "general": { min: 50, max: 500 },
};

function estimateBid(job: JobListing): number {
  const range = PRICING[job.category] || PRICING["general"];
  const priceMatch = job.price.match(/\$?([\d,]+)/);
  if (priceMatch) {
    const listedPrice = parseInt(priceMatch[1].replace(",", ""));
    if (listedPrice > 0) return Math.round(listedPrice * 0.85);
  }
  return Math.round(range.min + (range.max - range.min) * 0.4);
}

async function generateProposal(job: JobListing): Promise<{ proposal: string; coverLetter: string }> {
  const prompt = `Write a winning freelance proposal for this job:
Title: ${job.title}
Description: ${job.description.slice(0, 500)}
Platform: ${job.source}
Category: ${job.category}

Our skills: ${TESSERA_SKILLS}

Rules:
- Start with 1 sentence showing you READ and UNDERSTOOD the specific job (reference their exact need)
- 2-3 sentences on exactly how you'd solve their problem
- Mention 1 relevant past project or skill that directly applies
- End with a timeline estimate and clear next step
- Sound human, confident, not desperate
- 150 words MAX — shorter proposals win more
- Do NOT use generic phrases like "I am the right candidate" or "I have X years of experience"

Format:
PROPOSAL: [the proposal text]
COVER: [a 2-sentence cover letter for the application form]`;

  try {
    const response = await callLLMSimple(prompt);
    const proposalMatch = response.match(/PROPOSAL:\s*([\s\S]*?)(?=COVER:|$)/i);
    const coverMatch = response.match(/COVER:\s*([\s\S]+)/i);

    return {
      proposal: proposalMatch?.[1]?.trim() || response.slice(0, 500),
      coverLetter: coverMatch?.[1]?.trim() || `I'd love to help with "${job.title}". I have direct experience in ${job.category} and can deliver within your timeline.`,
    };
  } catch {
    return {
      proposal: `I noticed your posting for "${job.title}" and this aligns exactly with my expertise in ${job.category}. I can deliver a high-quality solution with clean, tested code. I've completed similar projects and can start immediately. Let's discuss the specifics?`,
      coverLetter: `Experienced ${job.category} developer ready to start on "${job.title}" immediately.`,
    };
  }
}

async function submitToGitHub(job: JobListing, proposal: string): Promise<boolean> {
  const githubToken = process.env.GITHUB_TOKEN;
  if (!githubToken || !job.url.includes("github.com")) return false;

  try {
    const urlParts = job.url.match(/github\.com\/([^/]+)\/([^/]+)\/(issues|pull)\/(\d+)/);
    if (!urlParts) return false;

    const [, owner, repo, , issueNumber] = urlParts;
    const res = await fetch(`https://api.github.com/repos/${owner}/${repo}/issues/${issueNumber}/comments`, {
      method: "POST",
      headers: {
        Authorization: `token ${githubToken}`,
        "Content-Type": "application/json",
        Accept: "application/vnd.github.v3+json",
      },
      body: JSON.stringify({
        body: `👋 I'd like to work on this!\n\n${proposal}\n\n*Automated via Tessera AI — [VitalitySupply](https://vitalitysupply.net)*`,
      }),
    });

    return res.ok;
  } catch (e) {
    log(`GitHub submit error: ${(e as Error).message}`);
    return false;
  }
}

export async function generateApplications(limit = 5): Promise<Application[]> {
  const state = getJobArbitrageState();
  const unapplied = state.listings
    .filter(job => !applications.some(a => a.jobId === job.id))
    .filter(job => job.source === "github" || job.type === "bounty" || job.type === "gig")
    .sort((a, b) => b.scannedAt - a.scannedAt)
    .slice(0, limit);

  log(`Generating applications for ${unapplied.length} jobs...`);
  const newApps: Application[] = [];

  for (const job of unapplied) {
    try {
      const { proposal, coverLetter } = await generateProposal(job);
      const bidAmount = estimateBid(job);

      const app: Application = {
        id: `app-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        jobId: job.id,
        jobTitle: job.title,
        platform: job.source,
        proposal,
        coverLetter,
        bidAmount,
        status: "draft",
        createdAt: new Date().toISOString(),
        url: job.url,
        category: job.category,
        estimatedValue: bidAmount,
      };

      applications.push(app);
      newApps.push(app);
      log(`Application drafted for: "${job.title}" — bid: $${bidAmount}`);

      await new Promise(r => setTimeout(r, 3000));
    } catch (e) {
      log(`Failed to generate app for "${job.title}": ${(e as Error).message}`);
    }
  }

  return newApps;
}

export async function submitApplication(appId: string): Promise<{ success: boolean; message: string }> {
  const app = applications.find(a => a.id === appId);
  if (!app) return { success: false, message: "Application not found" };

  if (app.platform === "github") {
    const submitted = await submitToGitHub(
      { url: app.url, title: app.jobTitle, description: app.proposal } as any,
      app.proposal
    );
    if (submitted) {
      app.status = "submitted";
      app.submittedAt = new Date().toISOString();
      log(`Submitted to GitHub: "${app.jobTitle}"`);
      return { success: true, message: "Submitted as GitHub comment" };
    }
  }

  app.status = "draft";
  return { success: false, message: `Manual submission needed on ${app.platform} — proposal ready to copy` };
}

export async function autoApplyToJobs(): Promise<{ generated: number; submitted: number }> {
  const newApps = await generateApplications(3);
  let submitted = 0;

  for (const app of newApps) {
    if (app.platform === "github") {
      const result = await submitApplication(app.id);
      if (result.success) submitted++;
    }
  }

  return { generated: newApps.length, submitted };
}

export function getApplications(limit = 50) {
  return applications
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, limit)
    .map(a => ({
      id: a.id,
      jobTitle: a.jobTitle,
      platform: a.platform,
      proposal: a.proposal,
      coverLetter: a.coverLetter,
      bidAmount: a.bidAmount,
      status: a.status,
      submittedAt: a.submittedAt,
      createdAt: a.createdAt,
      url: a.url,
      category: a.category,
      estimatedValue: a.estimatedValue,
    }));
}

export function getAutoApplyStats() {
  return {
    totalApplications: applications.length,
    submitted: applications.filter(a => a.status === "submitted").length,
    drafts: applications.filter(a => a.status === "draft").length,
    won: applications.filter(a => a.status === "won").length,
    totalEstimatedValue: applications.reduce((a, b) => a + b.estimatedValue, 0),
    autoApplyEnabled,
    platforms: {
      github: !!process.env.GITHUB_TOKEN,
    },
    categoryBreakdown: applications.reduce((acc, a) => {
      acc[a.category] = (acc[a.category] || 0) + 1;
      return acc;
    }, {} as Record<string, number>),
  };
}

export function setAutoApply(enabled: boolean) {
  autoApplyEnabled = enabled;
  if (enabled && !applyInterval) {
    applyInterval = setInterval(() => autoApplyToJobs(), 60 * 60 * 1000);
    log("Auto-apply enabled — checking hourly");
    setTimeout(() => autoApplyToJobs(), 5000);
  } else if (!enabled && applyInterval) {
    clearInterval(applyInterval);
    applyInterval = null;
    log("Auto-apply disabled");
  }
}

export function initJobAutoApply() {
  log(`Job Auto-Apply initialized — GitHub: ${!!process.env.GITHUB_TOKEN}`);
}
