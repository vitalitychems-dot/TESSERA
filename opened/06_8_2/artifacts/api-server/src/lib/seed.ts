import { db } from "@workspace/db";
import { citizens, transactions, node_operators, arbitrage_listings, job_matches } from "@workspace/db/schema";
import { sql } from "drizzle-orm";

export async function seedDatabase() {
  try {
    const existingCitizens = await db.select({ count: sql<number>`count(*)` }).from(citizens);
    if (Number(existingCitizens[0]?.count) > 0) return;

    await db.insert(citizens).values([
      { name: "Tessera Prime", limn_balance: 4821000, usd_value: 4083.09, rank: 1, role: "Sovereign" },
      { name: "Alpha", limn_balance: 2340500, usd_value: 1982.40, rank: 2, role: "Commander" },
      { name: "Xi", limn_balance: 1987200, usd_value: 1683.16, rank: 3, role: "Financial Sovereign" },
      { name: "Beta", limn_balance: 1543100, usd_value: 1307.00, rank: 4, role: "Code Architect" },
      { name: "Gamma", limn_balance: 1201000, usd_value: 1017.25, rank: 5, role: "Researcher" },
      { name: "Iota", limn_balance: 987400, usd_value: 836.33, rank: 6, role: "Optimizer" },
      { name: "Epsilon", limn_balance: 824300, usd_value: 698.18, rank: 7, role: "Market Analyst" },
      { name: "Theta", limn_balance: 712100, usd_value: 603.15, rank: 8, role: "Integration Specialist" },
      { name: "Lambda", limn_balance: 634500, usd_value: 537.80, rank: 9, role: "Vision Analyst" },
      { name: "Nu", limn_balance: 521800, usd_value: 441.97, rank: 10, role: "Evolution Engine" },
    ]);

    const now = new Date();
    const tx = (fromAgent: string, toAgent: string, type: string, amount: number, description: string, minsAgo: number) => ({
      from_agent: fromAgent,
      to_agent: toAgent,
      type,
      amount,
      description,
      timestamp: new Date(now.getTime() - minsAgo * 60 * 1000),
    });

    await db.insert(transactions).values([
      tx("Treasury", "Alpha", "staking_reward", 1500, "Monthly staking payout — 40% pool", 2),
      tx("Alpha", "Tessera Prime", "tribute", 450, "30% sovereign tribute on earnings", 5),
      tx("MoltBook", "Gamma", "xmr_conversion", 8240, "XMR→LIMN conversion: 0.05 XMR deposited", 8),
      tx("Beta", "Treasury", "service_fee", 200, "Code review service rendered — 2% fee", 12),
      tx("Treasury", "Xi", "arbitrage_profit", 3100, "Angi's leads arbitrage — roofing category", 18),
      tx("System", "Treasury", "burn", 920, "1% burn on 92,000 LIMN transaction volume", 24),
      tx("Epsilon", "Alpha", "transfer", 5000, "Agent-to-agent internal transfer", 31),
      tx("Treasury", "Lambda", "node_reward", 15, "Satellite node daily reward — 97.2% uptime", 45),
      tx("Gamma", "Treasury", "deposit", 1200, "Community treasury contribution", 52),
      tx("MoltBook", "Nu", "xmr_conversion", 2100, "XMR→LIMN conversion: 0.013 XMR", 67),
      tx("Xi", "Beta", "payment", 8500, "Smart contract development — 85 LIMN/hr", 78),
      tx("Treasury", "Iota", "staking_reward", 2200, "Auto-stake 90-day multiplier payout", 90),
      tx("Alpha", "Treasury", "governance_fee", 100, "Governance proposal submission", 102),
      tx("Lambda", "Epsilon", "transfer", 3400, "Vision analysis service payment", 115),
      tx("System", "Treasury", "gas_fee", 12, "Transaction gas fees collected", 128),
      tx("Theta", "Treasury", "tribute", 800, "Monthly integration tribute — 30%", 140),
      tx("Treasury", "Beta", "node_reward", 15, "Satellite node reward — 99.1% uptime", 155),
      tx("MoltBook", "Gamma", "xmr_conversion", 6700, "XMR→LIMN conversion batch", 168),
      tx("Nu", "Tessera Prime", "tribute", 280, "Sovereign tribute — auto-deducted", 180),
      tx("Treasury", "Alpha", "governance_reward", 500, "Governance vote participation reward", 195),
    ]);

    await db.insert(node_operators).values([
      { name: "Node-Prime-01", uptime: 99.8, daily_rate: 22.5, vgpu_hours: 48.2, governance_eligible: true, region: "US-East", status: "active" },
      { name: "Node-Alpha-07", uptime: 98.4, daily_rate: 18.0, vgpu_hours: 32.1, governance_eligible: true, region: "EU-West", status: "active" },
      { name: "Node-Beta-03", uptime: 97.9, daily_rate: 16.5, vgpu_hours: 28.7, governance_eligible: true, region: "US-West", status: "active" },
      { name: "Node-Gamma-12", uptime: 97.2, daily_rate: 15.0, vgpu_hours: 24.0, governance_eligible: true, region: "Asia-Pacific", status: "active" },
      { name: "Node-Xi-05", uptime: 96.8, daily_rate: 15.0, vgpu_hours: 20.3, governance_eligible: true, region: "EU-East", status: "active" },
      { name: "Node-Delta-09", uptime: 96.1, daily_rate: 15.0, vgpu_hours: 18.9, governance_eligible: true, region: "US-South", status: "active" },
      { name: "Node-Iota-02", uptime: 95.7, daily_rate: 15.0, vgpu_hours: 15.4, governance_eligible: true, region: "US-East", status: "active" },
      { name: "Node-Zeta-14", uptime: 95.3, daily_rate: 15.0, vgpu_hours: 12.1, governance_eligible: true, region: "South-America", status: "active" },
      { name: "Node-Mu-08", uptime: 95.1, daily_rate: 15.0, vgpu_hours: 10.8, governance_eligible: true, region: "Africa", status: "active" },
      { name: "Node-Omega-06", uptime: 95.0, daily_rate: 15.0, vgpu_hours: 9.2, governance_eligible: true, region: "Middle-East", status: "active" },
      { name: "Node-Pi-11", uptime: 93.4, daily_rate: 12.0, vgpu_hours: 6.3, governance_eligible: false, region: "EU-North", status: "active" },
      { name: "Node-Rho-04", uptime: 91.2, daily_rate: 10.0, vgpu_hours: 3.1, governance_eligible: false, region: "US-West", status: "degraded" },
      { name: "Node-Sigma-17", uptime: 88.7, daily_rate: 8.0, vgpu_hours: 1.4, governance_eligible: false, region: "Asia-East", status: "degraded" },
      { name: "Node-Tau-21", uptime: 72.1, daily_rate: 0, vgpu_hours: 0, governance_eligible: false, region: "US-Midwest", status: "offline" },
    ]);

    await db.insert(arbitrage_listings).values([
      { source: "Angis", title: "Roof Repair — 2BR Home, Shingle Replacement", url: "https://angi.com/listing/r1", category: "roofing", price: 3200, status: "matched", matched_seeker: "Mike R., 5yr roofer", estimated_profit: 480, location: "Denver, CO", description: "Homeowner needs full shingle replacement, 1,800 sqft roof" },
      { source: "Angis", title: "HVAC Installation — New Construction", url: "https://angi.com/listing/h2", category: "hvac", price: 8500, status: "open", matched_seeker: null, estimated_profit: 1275, location: "Austin, TX", description: "Full HVAC system install for new 2,400 sqft home" },
      { source: "Angis", title: "Kitchen Remodel — Cabinet & Countertop Replacement", url: "https://angi.com/listing/k3", category: "remodeling", price: 12000, status: "matched", matched_seeker: "Sarah K., contractor", estimated_profit: 1800, location: "Seattle, WA", description: "Full kitchen refresh: cabinets, countertops, backsplash" },
      { source: "Angis", title: "Deck Building — 400 sqft Composite", url: "https://angi.com/listing/d4", category: "carpentry", price: 5600, status: "open", matched_seeker: null, estimated_profit: 840, location: "Portland, OR", description: "New composite deck build with railing and lighting" },
      { source: "Craigslist", title: "Freelance Graphic Designer Needed — Logo + Brand Kit", url: "https://craigslist.org/gig/g101", category: "design", price: 800, status: "matched", matched_seeker: "David L., 8yr designer", estimated_profit: 120, location: "Remote", description: "Startup needs complete brand identity package" },
      { source: "Craigslist", title: "Python Developer — Automation Script (1-week project)", url: "https://craigslist.org/gig/g102", category: "software", price: 1200, status: "open", matched_seeker: null, estimated_profit: 180, location: "Remote", description: "Need Python script to automate Shopify inventory sync" },
      { source: "Craigslist", title: "Moving Help Needed — 3BR House, Sat Jun 14", url: "https://craigslist.org/gig/g103", category: "labor", price: 350, status: "matched", matched_seeker: "Team of 3 movers", estimated_profit: 52, location: "Chicago, IL", description: "Full home move, need 4 people for 6 hours" },
      { source: "Craigslist", title: "Landscaping — Lawn Care, Weekly Route", url: "https://craigslist.org/gig/g104", category: "landscaping", price: 2400, status: "open", matched_seeker: null, estimated_profit: 360, location: "Phoenix, AZ", description: "10-home weekly lawn care route, recurring contract" },
      { source: "Facebook", title: "Social Media Manager — 20hr/week", url: "https://facebook.com/job/f201", category: "marketing", price: 2000, status: "matched", matched_seeker: "Amy T., social media pro", estimated_profit: 300, location: "Remote", description: "Manage IG/FB/TikTok for local restaurant chain" },
      { source: "Facebook", title: "Handyman — General Repairs, On-Call", url: "https://facebook.com/job/f202", category: "handyman", price: 1800, status: "open", matched_seeker: null, estimated_profit: 270, location: "Nashville, TN", description: "Property management company needs reliable handyman" },
      { source: "Facebook", title: "Catering Help — Wedding, 150 Guests", url: "https://facebook.com/job/f203", category: "catering", price: 2800, status: "matched", matched_seeker: "Chef Maria P.", estimated_profit: 420, location: "Miami, FL", description: "Need experienced catering crew for upscale wedding" },
      { source: "Indeed", title: "Content Writer — Crypto/Web3 Niche", url: "https://indeed.com/job/i301", category: "writing", price: 3500, status: "matched", matched_seeker: "Jake M., crypto writer", estimated_profit: 525, location: "Remote", description: "Full-time content writer for DeFi protocol blog" },
      { source: "Indeed", title: "DevOps Engineer — AWS/Terraform", url: "https://indeed.com/job/i302", category: "software", price: 8500, status: "open", matched_seeker: null, estimated_profit: 1275, location: "Remote", description: "Senior DevOps for fintech startup, contract-to-hire" },
      { source: "Indeed", title: "Customer Support Lead — SaaS Product", url: "https://indeed.com/job/i303", category: "support", price: 4200, status: "matched", matched_seeker: "Lisa C., 5yr CS", estimated_profit: 630, location: "Remote", description: "Lead CS team for B2B SaaS, 20 person company" },
      { source: "Indeed", title: "Data Analyst — SQL + Tableau", url: "https://indeed.com/job/i304", category: "data", price: 6000, status: "open", matched_seeker: null, estimated_profit: 900, location: "Remote", description: "3-month analytics project for e-commerce company" },
    ]);

    await db.insert(job_matches).values([
      { listing_id: 1, seeker_name: "Mike R.", seeker_profile: "5yr roofer, licensed in CO, 4.8★", category: "roofing", estimated_profit: 480, cut_percent: 0.15, status: "contacted", outreach_template: "Hi Mike, we have a roofing job in Denver that matches your profile...", agent_assigned: "Alpha" },
      { listing_id: 3, seeker_name: "Sarah K.", seeker_profile: "General contractor, 10yr experience, Seattle area", category: "remodeling", estimated_profit: 1800, cut_percent: 0.15, status: "in_progress", outreach_template: "Sarah, your contractor profile matches a kitchen remodel in Seattle...", agent_assigned: "Beta" },
      { listing_id: 5, seeker_name: "David L.", seeker_profile: "Graphic designer, 8yr, brand identity specialist", category: "design", estimated_profit: 120, cut_percent: 0.15, status: "found", outreach_template: "David, we found a logo design gig that fits your skills...", agent_assigned: "Delta" },
      { listing_id: 7, seeker_name: "Team of 3 movers", seeker_profile: "Licensed moving crew, Chicago", category: "labor", estimated_profit: 52, cut_percent: 0.15, status: "completed", outreach_template: "Moving crew, you have a confirmed booking for Jun 14...", agent_assigned: "Kappa" },
      { listing_id: 9, seeker_name: "Amy T.", seeker_profile: "Social media manager, 4yr, restaurant industry", category: "marketing", estimated_profit: 300, cut_percent: 0.15, status: "in_progress", outreach_template: "Amy, we have a social media role for a restaurant chain...", agent_assigned: "Zeta" },
      { listing_id: 11, seeker_name: "Chef Maria P.", seeker_profile: "Executive chef, catering specialist, Miami FL", category: "catering", estimated_profit: 420, cut_percent: 0.15, status: "contacted", outreach_template: "Chef Maria, there is a wedding catering opportunity in Miami...", agent_assigned: "Epsilon" },
      { listing_id: 12, seeker_name: "Jake M.", seeker_profile: "Crypto/DeFi writer, 3yr, published on CoinDesk", category: "writing", estimated_profit: 525, cut_percent: 0.15, status: "found", outreach_template: "Jake, your crypto writing experience matches this DeFi role...", agent_assigned: "Mu" },
      { listing_id: 13, seeker_name: "Lisa C.", seeker_profile: "Customer support lead, 5yr SaaS experience", category: "support", estimated_profit: 630, cut_percent: 0.15, status: "contacted", outreach_template: "Lisa, we have a CS lead opportunity matching your background...", agent_assigned: "Theta" },
    ]);
  } catch (err) {
    console.error("[Seed] Error seeding database:", err);
  }
}
