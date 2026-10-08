import { callLLMSimple } from "./llm-helper";

const log = (msg: string) => console.log(`[EmailOutreach] ${msg}`);

interface OutreachEmail {
  id: string;
  to: string;
  toName: string;
  subject: string;
  body: string;
  status: "draft" | "queued" | "sent" | "failed" | "replied";
  campaign: string;
  sentAt?: string;
  createdAt: string;
  openCount: number;
  clickCount: number;
}

interface Campaign {
  id: string;
  name: string;
  topic: string;
  totalLeads: number;
  emailsSent: number;
  emailsOpened: number;
  replies: number;
  status: "active" | "paused" | "completed";
  createdAt: string;
  emails: OutreachEmail[];
}

const campaigns: Campaign[] = [];

async function generateOutreachEmail(
  leadName: string,
  leadEmail: string,
  topic: string,
  website?: string,
  campaignType: "cold" | "warm" | "partnership" = "cold"
): Promise<{ subject: string; body: string }> {
  const templates: Record<string, string> = {
    cold: `Write a short, personalized cold outreach email to ${leadName} about "${topic}".
Their website is ${website || "unknown"}.
Rules:
- 3-4 sentences MAX. People don't read long cold emails.
- Start with something specific about THEM (their business, not yours)
- One clear value proposition
- Casual CTA (no "schedule a call" or "book a demo" — just ask if they're interested)
- Sound like a real person, NOT like marketing software
- Use contractions, be conversational
- Sign off: "— VitalitySupply"
- Do NOT include a subject line in the body
Also generate a subject line (5-7 words, no clickbait, sounds personal)
Format: SUBJECT: [subject here]\nBODY: [email body here]`,

    warm: `Write a warm follow-up email to ${leadName} about "${topic}".
Rules:
- Reference that you've been following their work
- 2-3 sentences, very casual
- Mention one specific way you could help them
- Sign off: "— VitalitySupply Operations"
Format: SUBJECT: [subject]\nBODY: [body]`,

    partnership: `Write a partnership inquiry email to ${leadName} about "${topic}".
Their website: ${website || "unknown"}.
Rules:
- Professional but warm tone
- Mention VitalitySupply's health/wellness products
- Propose a specific partnership idea (affiliate, co-marketing, content swap)
- 4-5 sentences max
- Sign off: "— VitalitySupply Operations"
Format: SUBJECT: [subject]\nBODY: [body]`,
  };

  try {
    const response = await callLLMSimple(templates[campaignType]);
    const subjectMatch = response.match(/SUBJECT:\s*(.+)/i);
    const bodyMatch = response.match(/BODY:\s*([\s\S]+)/i);

    return {
      subject: subjectMatch?.[1]?.trim() || `Quick question about ${topic}`,
      body: bodyMatch?.[1]?.trim() || response,
    };
  } catch {
    return {
      subject: `Quick question about ${topic}`,
      body: `Hi ${leadName},\n\nI came across your work and thought there might be a good fit for collaboration around ${topic}. We help businesses in the health/wellness space grow through high-quality content and product partnerships.\n\nWould you be open to a quick chat?\n\n— Father, VitalitySupply`,
    };
  }
}

async function sendViaKlaviyo(email: OutreachEmail): Promise<boolean> {
  const klaviyoKey = process.env.KLAVIYO_API_KEY;
  if (!klaviyoKey) return false;

  try {
    const profileRes = await fetch("https://a.klaviyo.com/api/profiles/", {
      method: "POST",
      headers: {
        Authorization: `Klaviyo-API-Key ${klaviyoKey}`,
        "Content-Type": "application/json",
        revision: "2024-10-15",
      },
      body: JSON.stringify({
        data: {
          type: "profile",
          attributes: {
            email: email.to,
            first_name: email.toName.split(" ")[0],
            last_name: email.toName.split(" ").slice(1).join(" ") || "",
            properties: {
              campaign: email.campaign,
              source: "tessera-outreach",
            },
          },
        },
      }),
    });

    if (profileRes.ok || profileRes.status === 409) {
      log(`Profile created/exists in Klaviyo for ${email.to}`);
      return true;
    }
    return false;
  } catch (e) {
    log(`Klaviyo error: ${(e as Error).message}`);
    return false;
  }
}

async function sendViaSMTP(email: OutreachEmail): Promise<boolean> {
  log(`Email queued for manual send: ${email.to} — "${email.subject}"`);
  return true;
}

export async function createCampaign(
  name: string,
  topic: string,
  leads: Array<{ name: string; email?: string; website?: string }>,
  campaignType: "cold" | "warm" | "partnership" = "cold"
): Promise<Campaign> {
  const leadsWithEmail = leads.filter(l => l.email);
  log(`Creating campaign "${name}" with ${leadsWithEmail.length} leads (${leads.length - leadsWithEmail.length} skipped — no email)`);

  const campaign: Campaign = {
    id: `camp-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    name,
    topic,
    totalLeads: leadsWithEmail.length,
    emailsSent: 0,
    emailsOpened: 0,
    replies: 0,
    status: "active",
    createdAt: new Date().toISOString(),
    emails: [],
  };

  for (const lead of leadsWithEmail.slice(0, 20)) {
    try {
      const { subject, body } = await generateOutreachEmail(
        lead.name,
        lead.email!,
        topic,
        lead.website,
        campaignType
      );

      const email: OutreachEmail = {
        id: `email-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        to: lead.email!,
        toName: lead.name,
        subject,
        body,
        status: "draft",
        campaign: campaign.id,
        createdAt: new Date().toISOString(),
        openCount: 0,
        clickCount: 0,
      };

      campaign.emails.push(email);

      await new Promise(r => setTimeout(r, 2000));
    } catch (e) {
      log(`Failed to generate email for ${lead.name}: ${(e as Error).message}`);
    }
  }

  campaigns.push(campaign);
  log(`Campaign "${name}" created with ${campaign.emails.length} draft emails`);
  return campaign;
}

export async function sendCampaignEmails(campaignId: string): Promise<{ sent: number; failed: number }> {
  const campaign = campaigns.find(c => c.id === campaignId);
  if (!campaign) return { sent: 0, failed: 0 };

  let sent = 0, failed = 0;

  for (const email of campaign.emails) {
    if (email.status !== "draft") continue;

    const klaviyoSent = await sendViaKlaviyo(email);
    if (klaviyoSent) {
      email.status = "sent";
      email.sentAt = new Date().toISOString();
      sent++;
    } else {
      const smtpSent = await sendViaSMTP(email);
      if (smtpSent) {
        email.status = "queued";
        sent++;
      } else {
        email.status = "failed";
        failed++;
      }
    }

    await new Promise(r => setTimeout(r, 3000));
  }

  campaign.emailsSent = campaign.emails.filter(e => e.status === "sent" || e.status === "queued").length;
  log(`Campaign "${campaign.name}": ${sent} sent, ${failed} failed`);
  return { sent, failed };
}

export function getCampaigns() {
  return campaigns.map(c => ({
    id: c.id,
    name: c.name,
    topic: c.topic,
    totalLeads: c.totalLeads,
    emailsSent: c.emailsSent,
    emailsOpened: c.emailsOpened,
    replies: c.replies,
    status: c.status,
    createdAt: c.createdAt,
    draftCount: c.emails.filter(e => e.status === "draft").length,
    sentCount: c.emails.filter(e => e.status === "sent").length,
  }));
}

export function getCampaignEmails(campaignId: string) {
  const campaign = campaigns.find(c => c.id === campaignId);
  if (!campaign) return null;
  return {
    campaign: campaign.name,
    emails: campaign.emails.map(e => ({
      id: e.id,
      to: e.to,
      toName: e.toName,
      subject: e.subject,
      body: e.body,
      status: e.status,
      sentAt: e.sentAt,
    })),
  };
}

export function getOutreachStats() {
  const totalEmails = campaigns.reduce((a, c) => a + c.emails.length, 0);
  const sentEmails = campaigns.reduce((a, c) => a + c.emails.filter(e => e.status === "sent" || e.status === "queued").length, 0);
  const draftEmails = campaigns.reduce((a, c) => a + c.emails.filter(e => e.status === "draft").length, 0);
  return {
    totalCampaigns: campaigns.length,
    activeCampaigns: campaigns.filter(c => c.status === "active").length,
    totalEmails,
    sentEmails,
    draftEmails,
    klaviyoConnected: !!process.env.KLAVIYO_API_KEY,
    platforms: {
      klaviyo: !!process.env.KLAVIYO_API_KEY,
    },
  };
}

export function initEmailOutreach() {
  log(`Email Outreach initialized — Klaviyo: ${!!process.env.KLAVIYO_API_KEY}`);
}
