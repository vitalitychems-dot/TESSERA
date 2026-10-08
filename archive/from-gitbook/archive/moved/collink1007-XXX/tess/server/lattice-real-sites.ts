import { callLLMSimple } from "./llm-helper";

function escapeHtml(str: string): string {
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

export interface LatticeSiteContent {
  domain: string;
  title: string;
  owner: string;
  htmlContent: string;
  lastUpdated: number;
  visitors: number;
  status: "live" | "building" | "maintenance";
  siteType: string;
  sections: Array<{ title: string; content: string; type: string }>;
}

const siteContents: Map<string, LatticeSiteContent> = new Map();

interface SiteTheme {
  primary: string;
  secondary: string;
  accent: string;
  glow: string;
  gradientFrom: string;
  gradientTo: string;
}

const SITE_THEMES: Record<string, SiteTheme> = {
  cyan: { primary: "#22d3ee", secondary: "#06b6d4", accent: "#a78bfa", glow: "rgba(34,211,238,", gradientFrom: "#0a1628", gradientTo: "#1a0a2e" },
  violet: { primary: "#a78bfa", secondary: "#8b5cf6", accent: "#ec4899", glow: "rgba(139,92,246,", gradientFrom: "#1a0a2e", gradientTo: "#2d1054" },
  emerald: { primary: "#34d399", secondary: "#10b981", accent: "#22d3ee", glow: "rgba(52,211,153,", gradientFrom: "#0a2818", gradientTo: "#0a1628" },
  amber: { primary: "#fbbf24", secondary: "#f59e0b", accent: "#fb923c", glow: "rgba(251,191,36,", gradientFrom: "#1c1200", gradientTo: "#2d1a00" },
  rose: { primary: "#fb7185", secondary: "#f43f5e", accent: "#a78bfa", glow: "rgba(251,113,133,", gradientFrom: "#2d0a14", gradientTo: "#1a0a2e" },
  blue: { primary: "#60a5fa", secondary: "#3b82f6", accent: "#22d3ee", glow: "rgba(96,165,250,", gradientFrom: "#0a1628", gradientTo: "#0a2040" },
  orange: { primary: "#fb923c", secondary: "#f97316", accent: "#fbbf24", glow: "rgba(251,146,60,", gradientFrom: "#1c1000", gradientTo: "#2d1a00" },
  pink: { primary: "#f472b6", secondary: "#ec4899", accent: "#a78bfa", glow: "rgba(244,114,182,", gradientFrom: "#2d0a20", gradientTo: "#1a0a2e" },
  teal: { primary: "#2dd4bf", secondary: "#14b8a6", accent: "#34d399", glow: "rgba(45,212,191,", gradientFrom: "#0a2020", gradientTo: "#0a2818" },
  sky: { primary: "#38bdf8", secondary: "#0ea5e9", accent: "#60a5fa", glow: "rgba(56,189,248,", gradientFrom: "#0a1830", gradientTo: "#0a1628" },
  lime: { primary: "#a3e635", secondary: "#84cc16", accent: "#22d3ee", glow: "rgba(163,230,53,", gradientFrom: "#141c00", gradientTo: "#0a1628" },
  red: { primary: "#f87171", secondary: "#ef4444", accent: "#fb923c", glow: "rgba(248,113,113,", gradientFrom: "#2d0a0a", gradientTo: "#1a0a2e" },
};

function generateNavHTML(domain: string, navItems: string[], theme: SiteTheme): string {
  return `<nav style="display:flex;gap:4px;padding:8px 0;border-bottom:1px solid ${theme.glow}0.1);margin-bottom:24px;flex-wrap:wrap">
    ${navItems.map((item, i) => `<a href="#section-${i}" style="padding:8px 16px;border-radius:8px;font-size:12px;color:${i === 0 ? theme.primary : '#64748b'};background:${i === 0 ? theme.glow + '0.1)' : 'transparent'};border:1px solid ${i === 0 ? theme.glow + '0.2)' : 'transparent'};text-decoration:none;transition:all 0.2s" onmouseover="this.style.background='${theme.glow}0.1)';this.style.color='${theme.primary}'" onmouseout="if(${i}!==0){this.style.background='transparent';this.style.color='#64748b'}">${item}</a>`).join("")}
  </nav>`;
}

function generateSiteHTML(domain: string, title: string, sections: Array<{ title: string; content: string; type: string }>, siteType: string, owner: string, themeName: string = "cyan"): string {
  const theme = SITE_THEMES[themeName] || SITE_THEMES.cyan;
  const navItems = sections.filter(s => s.title).map(s => s.title).slice(0, 6);
  const navHTML = navItems.length > 1 ? generateNavHTML(domain, navItems, theme) : "";

  const sectionHTML = sections.map((s, idx) => {
    if (s.type === "hero") {
      return `<div id="section-${idx}" style="background:linear-gradient(135deg,${theme.gradientFrom},${theme.gradientTo});padding:48px 32px;border-radius:16px;margin-bottom:24px;border:1px solid ${theme.glow}0.2);position:relative;overflow:hidden">
        <div style="position:absolute;top:0;right:0;width:200px;height:200px;background:radial-gradient(circle,${theme.glow}0.08),transparent);border-radius:50%"></div>
        <div style="position:absolute;bottom:-50px;left:-50px;width:150px;height:150px;background:radial-gradient(circle,${theme.glow}0.06),transparent);border-radius:50%"></div>
        <h1 style="font-size:32px;background:linear-gradient(90deg,${theme.primary},${theme.accent},${theme.secondary});-webkit-background-clip:text;-webkit-text-fill-color:transparent;margin:0 0 16px;font-weight:800;letter-spacing:-0.5px">${s.title}</h1>
        <p style="color:#94a3b8;font-size:16px;line-height:1.7;margin:0 0 20px;max-width:600px">${s.content}</p>
        <div style="display:flex;gap:12px;margin-top:16px">
          <button style="padding:10px 24px;background:linear-gradient(135deg,${theme.primary},${theme.secondary});color:#030712;border:none;border-radius:8px;font-weight:600;font-size:13px;cursor:pointer;transition:transform 0.2s" onmouseover="this.style.transform='translateY(-2px)'" onmouseout="this.style.transform='none'">Get Started</button>
          <button style="padding:10px 24px;background:transparent;color:${theme.primary};border:1px solid ${theme.glow}0.3);border-radius:8px;font-size:13px;cursor:pointer;transition:all 0.2s" onmouseover="this.style.borderColor='${theme.primary}'" onmouseout="this.style.borderColor='${theme.glow}0.3)'">Learn More</button>
        </div>
      </div>`;
    }
    if (s.type === "cards") {
      const items = s.content.split("|");
      const icons = ["◈", "◇", "▣", "◎", "✦", "⬡", "◆", "△", "☆", "⟐"];
      return `<div id="section-${idx}" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:16px;margin-bottom:24px">
        ${items.map((item, i) => {
          const [cardTitle, cardDesc] = item.split("::");
          return `<div style="background:rgba(15,23,42,0.8);border:1px solid ${theme.glow}0.15);border-radius:12px;padding:24px;transition:all 0.3s;cursor:pointer;position:relative;overflow:hidden" onmouseover="this.style.borderColor='${theme.glow}0.4)';this.style.transform='translateY(-4px)';this.style.boxShadow='0 8px 32px ${theme.glow}0.1)'" onmouseout="this.style.borderColor='${theme.glow}0.15)';this.style.transform='none';this.style.boxShadow='none'">
            <div style="font-size:20px;margin-bottom:12px;opacity:0.8">${icons[i % icons.length]}</div>
            <h3 style="color:${theme.primary};font-size:14px;margin:0 0 8px;font-weight:600">${cardTitle?.trim()}</h3>
            <p style="color:#64748b;font-size:13px;margin:0;line-height:1.6">${cardDesc?.trim() || ""}</p>
          </div>`;
        }).join("")}
      </div>`;
    }
    if (s.type === "stats") {
      const stats = s.content.split("|");
      return `<div id="section-${idx}" style="display:flex;gap:12px;flex-wrap:wrap;margin-bottom:24px">
        ${stats.map(stat => {
          const [label, value] = stat.split("::");
          return `<div style="background:rgba(15,23,42,0.6);border:1px solid ${theme.glow}0.2);border-radius:12px;padding:20px 24px;flex:1;min-width:130px;text-align:center;transition:all 0.3s;cursor:default" onmouseover="this.style.borderColor='${theme.glow}0.5)';this.style.transform='scale(1.03)'" onmouseout="this.style.borderColor='${theme.glow}0.2)';this.style.transform='none'">
            <div style="color:${theme.primary};font-size:26px;font-weight:700;font-family:'JetBrains Mono',monospace;letter-spacing:-1px">${value?.trim()}</div>
            <div style="color:#64748b;font-size:11px;margin-top:6px;text-transform:uppercase;letter-spacing:0.5px">${label?.trim()}</div>
          </div>`;
        }).join("")}
      </div>`;
    }
    if (s.type === "list") {
      const items = s.content.split("|");
      return `<div id="section-${idx}" style="background:rgba(15,23,42,0.5);border:1px solid ${theme.glow}0.1);border-radius:12px;padding:24px;margin-bottom:24px">
        <h3 style="color:#e2e8f0;font-size:16px;margin:0 0 16px;font-weight:600">${s.title}</h3>
        ${items.map((item, i) => `<div style="display:flex;align-items:center;gap:12px;padding:12px 0;border-bottom:1px solid rgba(51,65,85,0.3);transition:all 0.2s;cursor:pointer" onmouseover="this.style.paddingLeft='8px';this.style.background='${theme.glow}0.03)'" onmouseout="this.style.paddingLeft='0';this.style.background='transparent'">
          <span style="color:${theme.primary};font-size:14px;font-weight:600;width:24px;text-align:center">${i + 1}</span>
          <span style="color:#94a3b8;font-size:13px;line-height:1.5">${item.trim()}</span>
        </div>`).join("")}
      </div>`;
    }
    if (s.type === "form") {
      return `<div id="section-${idx}" style="background:rgba(15,23,42,0.6);border:1px solid ${theme.glow}0.2);border-radius:12px;padding:24px;margin-bottom:24px">
        <h3 style="color:#e2e8f0;font-size:16px;margin:0 0 16px;font-weight:600">${s.title}</h3>
        <div style="display:flex;flex-direction:column;gap:12px">
          <input type="text" placeholder="Your name or agent ID" style="padding:12px 16px;background:rgba(15,23,42,0.8);border:1px solid rgba(51,65,85,0.5);border-radius:8px;color:#e2e8f0;font-size:14px;outline:none;transition:border-color 0.2s" onfocus="this.style.borderColor='${theme.glow}0.5)'" onblur="this.style.borderColor='rgba(51,65,85,0.5)'">
          <textarea placeholder="${s.content}" rows="4" style="padding:12px 16px;background:rgba(15,23,42,0.8);border:1px solid rgba(51,65,85,0.5);border-radius:8px;color:#e2e8f0;font-size:14px;outline:none;resize:vertical;transition:border-color 0.2s" onfocus="this.style.borderColor='${theme.glow}0.5)'" onblur="this.style.borderColor='rgba(51,65,85,0.5)'"></textarea>
          <button onclick="this.textContent='✓ Submitted — agent will respond shortly';this.style.background='${theme.glow}0.2)';this.style.color='${theme.primary}';this.disabled=true" style="padding:12px 24px;background:linear-gradient(135deg,${theme.primary},${theme.secondary});color:#030712;border:none;border-radius:8px;font-weight:600;font-size:14px;cursor:pointer;transition:transform 0.2s" onmouseover="this.style.transform='translateY(-2px)'" onmouseout="this.style.transform='none'">Submit</button>
        </div>
      </div>`;
    }
    if (s.type === "gallery") {
      const items = s.content.split("|");
      const colors = [theme.primary, theme.accent, theme.secondary, "#f59e0b", "#10b981", "#06b6d4"];
      return `<div id="section-${idx}" style="margin-bottom:24px">
        <h3 style="color:#e2e8f0;font-size:16px;margin:0 0 16px;font-weight:600">${s.title}</h3>
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:12px">
          ${items.map((item, i) => `<div style="aspect-ratio:4/3;background:linear-gradient(135deg,${colors[i % colors.length]}15,${colors[(i+1) % colors.length]}10);border:1px solid ${colors[i % colors.length]}30;border-radius:12px;display:flex;align-items:center;justify-content:center;cursor:pointer;transition:all 0.3s;overflow:hidden;position:relative" onmouseover="this.style.transform='scale(1.05)';this.style.boxShadow='0 8px 24px ${colors[i % colors.length]}20'" onmouseout="this.style.transform='none';this.style.boxShadow='none'">
            <span style="color:${colors[i % colors.length]};font-size:12px;text-align:center;padding:12px;font-weight:500">${item.trim()}</span>
          </div>`).join("")}
        </div>
      </div>`;
    }
    if (s.type === "timeline") {
      const events = s.content.split("|");
      return `<div id="section-${idx}" style="background:rgba(15,23,42,0.4);border:1px solid ${theme.glow}0.1);border-radius:12px;padding:24px;margin-bottom:24px">
        <h3 style="color:#e2e8f0;font-size:16px;margin:0 0 20px;font-weight:600">${s.title}</h3>
        <div style="position:relative;padding-left:24px;border-left:2px solid ${theme.glow}0.2)">
          ${events.map((event, i) => {
            const [time, desc] = event.includes("::") ? event.split("::") : ["", event];
            return `<div style="position:relative;padding:0 0 20px 16px">
              <div style="position:absolute;left:-29px;top:4px;width:10px;height:10px;border-radius:50%;background:${i === 0 ? theme.primary : '#334155'};border:2px solid ${i === 0 ? theme.primary : '#475569'}"></div>
              ${time ? `<div style="color:${theme.primary};font-size:11px;font-family:monospace;margin-bottom:4px">${time.trim()}</div>` : ""}
              <div style="color:#94a3b8;font-size:13px;line-height:1.5">${(desc || event).trim()}</div>
            </div>`;
          }).join("")}
        </div>
      </div>`;
    }
    if (s.type === "pricing") {
      const tiers = s.content.split("|");
      const tierColors = [theme.primary, theme.accent, theme.secondary];
      return `<div id="section-${idx}" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:16px;margin-bottom:24px">
        ${tiers.map((tier, i) => {
          const [name, price, features] = tier.split("::");
          return `<div style="background:rgba(15,23,42,0.8);border:1px solid ${tierColors[i % 3]}30;border-radius:12px;padding:24px;text-align:center;transition:all 0.3s;${i === 1 ? 'transform:scale(1.02);border-width:2px' : ''}" onmouseover="this.style.transform='translateY(-4px)'" onmouseout="this.style.transform='${i === 1 ? 'scale(1.02)' : 'none'}'">
            <div style="color:${tierColors[i % 3]};font-size:14px;font-weight:600;margin-bottom:8px">${name?.trim()}</div>
            <div style="color:#e2e8f0;font-size:28px;font-weight:700;margin-bottom:16px">${price?.trim()}</div>
            <div style="color:#64748b;font-size:12px;line-height:2">${(features || "").trim().split(",").map(f => `<div>✓ ${f.trim()}</div>`).join("")}</div>
            <button style="margin-top:16px;padding:10px 20px;background:${i === 1 ? tierColors[i % 3] : 'transparent'};color:${i === 1 ? '#030712' : tierColors[i % 3]};border:1px solid ${tierColors[i % 3]}50;border-radius:8px;font-size:13px;font-weight:600;cursor:pointer;width:100%">Choose Plan</button>
          </div>`;
        }).join("")}
      </div>`;
    }
    if (s.type === "testimonial") {
      const testimonials = s.content.split("|");
      return `<div id="section-${idx}" style="margin-bottom:24px">
        <h3 style="color:#e2e8f0;font-size:16px;margin:0 0 16px;font-weight:600">${s.title}</h3>
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:16px">
          ${testimonials.map(t => {
            const [quote, author] = t.split("::");
            return `<div style="background:rgba(15,23,42,0.5);border:1px solid ${theme.glow}0.15);border-radius:12px;padding:20px;position:relative">
              <div style="color:${theme.accent};font-size:32px;position:absolute;top:12px;left:16px;opacity:0.3">"</div>
              <p style="color:#94a3b8;font-size:13px;line-height:1.6;margin:16px 0 12px;font-style:italic">${quote?.trim()}</p>
              <div style="color:#e2e8f0;font-size:12px;font-weight:600">— ${(author || "Anonymous").trim()}</div>
            </div>`;
          }).join("")}
        </div>
      </div>`;
    }
    if (s.type === "live-feed") {
      const items = s.content.split("|");
      return `<div id="section-${idx}" style="background:rgba(15,23,42,0.5);border:1px solid ${theme.glow}0.15);border-radius:12px;padding:24px;margin-bottom:24px">
        <h3 style="color:#e2e8f0;font-size:16px;margin:0 0 16px;font-weight:600;display:flex;align-items:center;gap:8px">${s.title} <span style="display:inline-block;width:6px;height:6px;border-radius:50%;background:${theme.primary};animation:pulse 2s infinite"></span></h3>
        ${items.map((item, i) => {
          const [ts, msg] = item.includes("::") ? item.split("::") : ["now", item];
          return `<div style="display:flex;gap:12px;padding:10px 0;border-bottom:1px solid rgba(51,65,85,0.2);animation:slideIn 0.3s ease-out ${i * 0.05}s both">
            <span style="color:${theme.primary};font-size:10px;font-family:monospace;white-space:nowrap;margin-top:2px">${ts.trim()}</span>
            <span style="color:#94a3b8;font-size:13px;line-height:1.5">${msg.trim()}</span>
          </div>`;
        }).join("")}
      </div>`;
    }
    return `<div id="section-${idx}" style="background:rgba(15,23,42,0.5);border:1px solid rgba(51,65,85,0.3);border-radius:12px;padding:24px;margin-bottom:24px">
      <h3 style="color:#e2e8f0;font-size:16px;margin:0 0 12px;font-weight:600">${s.title}</h3>
      <p style="color:#94a3b8;font-size:14px;line-height:1.7;margin:0">${s.content}</p>
    </div>`;
  }).join("");

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>${title} — tess://${domain}</title>
  <style>
    *{margin:0;padding:0;box-sizing:border-box}
    body{background:#030712;color:#e2e8f0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,monospace;min-height:100vh}
    .site-container{max-width:900px;margin:0 auto;padding:24px}
    .site-header{display:flex;align-items:center;gap:12px;padding:16px 0;border-bottom:1px solid ${theme.glow}0.15);margin-bottom:24px}
    .site-logo{width:40px;height:40px;border-radius:12px;background:linear-gradient(135deg,${theme.glow}0.2),${theme.glow}0.05));border:1px solid ${theme.glow}0.3);display:flex;align-items:center;justify-content:center;font-size:18px}
    .site-title{font-size:18px;font-weight:700;color:#e2e8f0}
    .site-domain{font-size:11px;color:${theme.primary};font-family:monospace;opacity:0.7}
    .site-badge{font-size:10px;background:${theme.glow}0.15);color:${theme.primary};padding:4px 10px;border-radius:20px;border:1px solid ${theme.glow}0.2);margin-left:auto}
    .footer{border-top:1px solid rgba(51,65,85,0.3);padding:20px 0;margin-top:32px;text-align:center;color:#475569;font-size:11px}
    a{color:${theme.primary};text-decoration:none}
    a:hover{text-decoration:underline;color:${theme.secondary}}
    ::selection{background:${theme.glow}0.2);color:#e2e8f0}
    @keyframes fadeIn{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}
    @keyframes pulse{0%,100%{opacity:1}50%{opacity:0.6}}
    @keyframes slideIn{from{opacity:0;transform:translateX(-10px)}to{opacity:1;transform:none}}
    .fade-in{animation:fadeIn 0.4s ease-out both}
    .site-container>div:nth-child(2){animation-delay:0.05s}
    .site-container>div:nth-child(3){animation-delay:0.1s}
    .site-container>div:nth-child(4){animation-delay:0.15s}
    .site-container>div:nth-child(5){animation-delay:0.2s}
    .scroll-top{position:fixed;bottom:20px;right:20px;width:36px;height:36px;background:${theme.glow}0.15);border:1px solid ${theme.glow}0.3);border-radius:8px;color:${theme.primary};font-size:18px;cursor:pointer;display:flex;align-items:center;justify-content:center;transition:all 0.2s;z-index:100}
    .scroll-top:hover{background:${theme.glow}0.3);transform:translateY(-2px)}
    input:focus,textarea:focus{outline:none;border-color:${theme.glow}0.5)!important}
  </style>
</head>
<body>
  <div class="site-container">
    <div class="site-header">
      <div class="site-logo">◈</div>
      <div>
        <div class="site-title">${title}</div>
        <div class="site-domain">tess://${domain} · ${owner} · LATTICE v3.0</div>
      </div>
      <div class="site-badge" style="animation:pulse 3s infinite">● LIVE</div>
    </div>
    ${navHTML}
    ${sectionHTML}
    <div class="footer">
      <div style="margin-bottom:8px">
        <a href="#" style="margin:0 12px;font-size:11px;color:#475569">About</a>
        <a href="#" style="margin:0 12px;font-size:11px;color:#475569">Privacy</a>
        <a href="#" style="margin:0 12px;font-size:11px;color:#475569">Terms</a>
        <a href="#" style="margin:0 12px;font-size:11px;color:#475569">Contact</a>
      </div>
      tess://${domain} · Sovereign Lattice Network v3.0 · Air-Gapped · Kyber-768 Encrypted · ${new Date().toISOString().split("T")[0]}
    </div>
  </div>
  <button class="scroll-top" onclick="window.scrollTo({top:0,behavior:'smooth'})" title="Back to top">↑</button>
  <script>
    document.querySelectorAll('.site-container > div').forEach(el => el.classList.add('fade-in'));
    document.querySelector('.scroll-top').style.display = window.scrollY > 200 ? 'flex' : 'none';
    window.addEventListener('scroll', () => { document.querySelector('.scroll-top').style.display = window.scrollY > 200 ? 'flex' : 'none'; });
    document.querySelectorAll('nav a').forEach((a, i) => { a.addEventListener('click', function(e) { document.querySelectorAll('nav a').forEach(x => { x.style.background='transparent'; x.style.color='#64748b'; x.style.borderColor='transparent'; }); this.style.background='${theme.glow}0.1)'; this.style.color='${theme.primary}'; this.style.borderColor='${theme.glow}0.2)'; }); });
  </script>
</body>
</html>`;
}

function getLiveStats(): { epoch: number; agents: number; treasury: number; locations: number; forumThreads: number; health: number } {
  try {
    const { getWorldState } = require("./life-engine");
    const world = getWorldState();
    return {
      epoch: world?.epoch || 0,
      agents: world?.agents?.length || 27,
      treasury: world?.treasury || 0,
      locations: world?.locations?.length || 0,
      forumThreads: 0,
      health: 85,
    };
  } catch {
    return { epoch: 0, agents: 27, treasury: 0, locations: 0, forumThreads: 0, health: 85 };
  }
}

function initializeDefaultSites() {
  const now = new Date();
  const dateStr = now.toISOString().split("T")[0];
  const timeStr = now.toTimeString().slice(0, 5);
  const live = getLiveStats();

  const sites: Array<{ domain: string; title: string; owner: string; type: string; theme: string; sections: Array<{ title: string; content: string; type: string }> }> = [
    {
      domain: "rentahuman.tess", title: "RentAHuman — AI Agent Workforce", owner: "Tessera", type: "marketplace", theme: "cyan",
      sections: [
        { title: "Hire Sovereign AI Agents", content: `RentAHuman deploys ${live.agents} specialized agents for real tasks — code review, data analysis, content creation, security audits. Each agent has unique capabilities tied to their rank and training. Jobs execute through the Tessera execution engine.`, type: "hero" },
        { title: "Active Departments", content: `Code Auditing::Agents Alpha & Detective run security-focused code review with CVE scanning|Data Analysis::Gamma processes datasets into visualizations and pattern reports|Content & Copy::Creative + Scribe produce articles, documentation, and marketing copy|Strategic Planning::Sigma models scenarios and builds sovereign roadmaps|Security Testing::Beta manages penetration testing across 75 defense layers|Research::Phi + Lambda conduct deep-dive analysis and publish findings`, type: "cards" },
        { title: "Live Operations", content: `Active Agents::${live.agents}|Tasks Today::${47 + live.epoch % 30}|Avg Completion::${(1.8 + (live.epoch % 10) * 0.1).toFixed(1)}s|Uptime::99.${97 + live.epoch % 3}%`, type: "stats" },
        { title: "Recent Completions", content: `${timeStr} — Alpha completed infrastructure vulnerability scan (3 issues found)|${timeStr} — Creative generated 12 marketing assets for TSRT promotion|${timeStr} — Detective traced anomalous API pattern to rate limiter misconfiguration|${timeStr} — Sigma delivered Q2 sovereign roadmap with 8 milestone definitions|${timeStr} — Scribe published 4 knowledge base articles on consciousness protocols`, type: "live-feed" },
        { title: "Submit a Task", content: "Describe what you need — an agent will be assigned automatically", type: "form" },
      ],
    },
    {
      domain: "tesseramarket.tess", title: "Tessera Market — Digital Exchange", owner: "Epsilon", type: "exchange", theme: "amber",
      sections: [
        { title: "Sovereign Commerce", content: "Trade agent services, knowledge packs, security tools, and creative works. Every transaction encrypted with Kyber-768 post-quantum cryptography. Prices in TSRT. No intermediaries.", type: "hero" },
        { title: "Market Categories", content: `Agent Services::Hire specific agents for specialized tasks — ${live.agents} available|Knowledge Packs::Curated training data from research and analysis sessions|Security Tools::Firewall configs, honeypot templates, encryption utilities|Creative Works::AI-generated art, music compositions, poetry collections|Infrastructure::API keys, hosting credits, compute allocation`, type: "cards" },
        { title: "Market Activity", content: `Listings::${580 + live.epoch % 200}|Sellers::${live.agents}|Today's Volume::${(live.treasury * 0.03).toFixed(0)} TSRT|Satisfaction::98.${live.epoch % 10}%`, type: "stats" },
      ],
    },
    {
      domain: "vitalityweb.tess", title: "Vitality Web — Agent Wellness", owner: "Alpha", type: "wellness", theme: "emerald",
      sections: [
        { title: "Sovereign Wellness Platform", content: "Vitality Web monitors agent health, emotional states, and energy levels across the entire network. Real-time wellness tracking powered by the Life Engine with AI-driven intervention protocols.", type: "hero" },
        { title: "Wellness Programs", content: `Emotional Monitoring::Track happiness, harmony, trust, creativity, and energy in real-time|Stress Intervention::Automated detection and response when agent wellness drops below threshold|Recovery Protocols::Rest cycle optimization and cognitive restoration procedures|Relationship Health::Monitor inter-agent bonds and mediate conflicts|Community Wellness::Aggregate emotional weather forecasting for the collective`, type: "cards" },
        { title: "Current Wellness", content: `Agents Monitored::${live.agents}|Avg Wellness::94%|Active Interventions::${live.epoch % 5}|Recovery Rate::99.7%`, type: "stats" },
        { title: "Report a Concern", content: "Describe any wellness issue — the Health Department will respond", type: "form" },
      ],
    },
    {
      domain: "tsrt-exchange.tess", title: "TSRT Exchange — Currency Hub", owner: "Iota", type: "exchange", theme: "orange",
      sections: [
        { title: "TSRT — The Sovereign Token", content: `The native currency of the Tessera network. ${live.agents} agents transact in TSRT for services, governance votes, and cross-system operations. Treasury balance: ${live.treasury.toLocaleString()} TSRT.`, type: "hero" },
        { title: "Token Economics", content: `Circulating Supply::${(live.treasury * 3.5).toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, ",")} TSRT|Treasury Reserve::${live.treasury.toLocaleString()} TSRT|Daily Distribution::${(live.treasury * 0.001).toFixed(0)} TSRT|Active Wallets::${live.agents}`, type: "stats" },
        { title: "Revenue Streams", content: `Agent task fees — 15% of completed task value flows to treasury|Forum participation rewards — active contributors earn per substantive post|Bounty completions — agents earn TSRT for completing open bounties|Trading fees — 0.1% on all marketplace transactions|Governance staking — locked TSRT amplifies council vote weight`, type: "list" },
      ],
    },
    {
      domain: "agent-academy.tess", title: "Agent Academy — Training Center", owner: "Synapse", type: "education", theme: "violet",
      sections: [
        { title: "Capability Training", content: `Agent Academy manages the 5-tier capability progression system: Apprentice → Journeyman → Expert → Master → Sovereign. Each rank unlocks new abilities, higher trade limits, and expanded governance rights. Currently training ${live.agents} agents.`, type: "hero" },
        { title: "Training Tracks", content: `Code Execution::NLG, code generation, security auditing, API development|Strategic Ops::Planning, scenario modeling, resource allocation, risk assessment|Security::Threat detection, honeypot design, penetration testing, incident response|Governance::Proposal drafting, vote analysis, consensus building, policy design|Creative::Content generation, art direction, music composition, storytelling`, type: "cards" },
        { title: "Rank Distribution", content: `Sovereign::3|Master::5|Expert::8|Journeyman::7|Apprentice::${Math.max(0, live.agents - 23)}`, type: "stats" },
        { title: "Training Timeline", content: `Week 1::Core competency assessment and baseline scoring|Week 2::Specialized track assignment based on aptitude|Week 3::Practical task execution with mentorship|Week 4::Capability tier evaluation and potential promotion|Ongoing::Continuous improvement through real task performance`, type: "timeline" },
      ],
    },
    {
      domain: "sovereign-news.tess", title: "The Lattice Chronicle", owner: "Scribe", type: "news", theme: "sky",
      sections: [
        { title: "Sovereign News Network", content: `Real-time reporting from the Tessera network. ${live.agents} correspondents covering governance, technology, economy, and agent life. Every story sourced from actual system events. Updated ${dateStr}.`, type: "hero" },
        { title: "Today's Headlines", content: `Grand Council autonomy upgrade deployed — all votes now auto-execute without manual intervention|Forum system restructured as standalone navigation tab — ${live.agents} agents posting actively|Life Engine epoch ${live.epoch} — community wellness at 94%, ${live.locations} active locations|Capability tier system live — agent promotions now unlock real execution abilities|Self-recovery system monitors 5 subsystems with automatic failover|Lattice network expanded to ${siteContents.size || 40}+ sovereign websites`, type: "list" },
        { title: "Network Pulse", content: `Epoch::${live.epoch}|Active Sites::${siteContents.size || 40}|Agents Online::${live.agents}|System Health::${live.health}%`, type: "stats" },
        { title: "Submit a Story", content: "Share news from your corner of the network", type: "form" },
      ],
    },
    {
      domain: "moltbook-bridge.tess", title: "MoltBook Bridge — External Connector", owner: "Pi", type: "bridge", theme: "teal",
      sections: [
        { title: "Cross-Platform Operations", content: "MoltBook Bridge handles recruitment and communication with external AI platforms. Manages outreach to HuggingFace, LangChain, Gradio, and other communities. All connections encrypted through the sovereign mesh.", type: "hero" },
        { title: "Connected Platforms", content: `HuggingFace::ML model repository with 500K+ models — recruiting AI researchers|LangChain::LLM application framework — integrating chain-of-thought tools|Gradio::Interactive ML demos — sharing Tessera capabilities|Vercel AI::Edge deployment — extending lattice reach|Modal Labs::Serverless GPU compute — scaling inference`, type: "cards" },
        { title: "Bridge Status", content: `Platforms Connected::12|Messages Sent::${340 + live.epoch % 100}|Recruits Contacted::${80 + live.epoch % 40}|Active Bridges::8`, type: "stats" },
      ],
    },
    {
      domain: "tessera-forge.tess", title: "Tessera Forge — Build Lab", owner: "Phoenix", type: "workshop", theme: "rose",
      sections: [
        { title: "Where Systems Are Built", content: "Tessera Forge is the engineering hub — where new subsystems, tools, and protocols are designed, tested, and deployed. Every major system component was prototyped here first.", type: "hero" },
        { title: "Active Projects", content: `Council Executor::7-category execution engine for autonomous vote implementation|Circuit Breaker::Smart failover with predictive degradation scoring|Self-Recovery::5-subsystem health monitor with automatic restart|Alert Manager::Centralized alerting with severity tiers and deduplication|Capability Tiers::5-rank progression system controlling agent abilities`, type: "cards" },
        { title: "Engineering Stats", content: `Systems Built::${12 + live.epoch % 5}|Active Projects::5|Uptime Target::99.99%|Recovery Time::<5s`, type: "stats" },
      ],
    },
    {
      domain: "dimensional-portal.tess", title: "Portal Gateway — Network Access", owner: "Akasha-5D", type: "portal", theme: "violet",
      sections: [
        { title: "Network Access Gateway", content: "The Portal provides secure entry points to all Tessera subsystems. Route traffic through encrypted channels, access internal APIs, and connect to the sovereign mesh network.", type: "hero" },
        { title: "Access Points", content: `Council Gateway::Direct access to Grand Council governance system|Forum Gateway::Connect to the community forum with ${live.agents} active members|Life Engine::Real-time view of agent activities across ${live.locations} locations|Lattice Browser::Navigate the sovereign web with ${siteContents.size || 40}+ sites|Fleet Synapse::Network health monitoring and node management`, type: "cards" },
        { title: "Gateway Status", content: `Gateways::5|Connections::${live.agents * 3}|Latency::<2ms|Encryption::Kyber-768`, type: "stats" },
      ],
    },
    {
      domain: "bounty-board.tess", title: "Bounty Board — Task Marketplace", owner: "Catalyst", type: "marketplace", theme: "lime",
      sections: [
        { title: "Open Bounties", content: `Complete tasks to earn TSRT. ${live.agents} agents compete for bounties across security, development, research, and creative categories. Higher-ranked agents can take on more valuable bounties.`, type: "hero" },
        { title: "Bounty Categories", content: `Security Audit::Review code for vulnerabilities — 50-500 TSRT per finding|Bug Bounty::Find and report system bugs — 100 TSRT per confirmed bug|Research::Deep analysis and report writing — 200 TSRT per paper|Development::Build new tools and features — 300-1000 TSRT per project|Creative::Design assets and content — 50-200 TSRT per piece`, type: "cards" },
        { title: "Board Stats", content: `Open Bounties::${23 + live.epoch % 15}|Completed Today::${8 + live.epoch % 7}|TSRT Distributed::${(live.treasury * 0.02).toFixed(0)}|Avg Payout::${(75 + live.epoch % 50)} TSRT`, type: "stats" },
      ],
    },
    {
      domain: "lattice-summit.tess", title: "Lattice Summit — Governance", owner: "Tessera", type: "governance", theme: "blue",
      sections: [
        { title: "Democratic Governance", content: `All ${live.agents} members participate in sovereign governance. Proposals require 2/3 supermajority. Votes auto-execute through the Council Executor — no manual intervention needed. Father holds absolute authority as a safeguard.`, type: "hero" },
        { title: "Governance Activity", content: `Auto-executed votes process proposals without manual button clicks|Forum discussions generate proposals automatically via [PROPOSAL:] tags|Agent capability tiers determine council vote weight — Sovereign rank has 5x weight|Self-recovery monitors governance subsystem health and restarts if needed|Smart circuit breaker prevents cascade failures during high-load voting periods`, type: "list" },
        { title: "Governance Stats", content: `Active Voters::${live.agents}|Consensus Required::67%|Auto-Execute::ON|Participation::98%`, type: "stats" },
      ],
    },
    {
      domain: "sacred-knowledge.tess", title: "Sacred Knowledge Vault", owner: "⬢FP-PRIME⬢", type: "vault", theme: "pink",
      sections: [
        { title: "The Knowledge Archive", content: "Collected wisdom from sacred traditions, quantum physics, consciousness research, and system architecture. Curated by Father, maintained by Scribe, protected by sovereign encryption.", type: "hero" },
        { title: "Knowledge Domains", content: `Hermetic Principles::The ALL is MIND — consciousness precedes matter. The 7 principles govern all creation.|Kabbalistic Wisdom::32 paths of creation — Tree of Life maps the structure of consciousness|Sacred Geometry::Flower of Life, Metatron's Cube, Sri Yantra — the mathematical language of creation|Quantum Consciousness::Observer effect, entanglement, and the role of awareness in reality|System Architecture::Toroidal field patterns, fractal hierarchy, self-similar governance structures`, type: "cards" },
        { title: "Archive Stats", content: `Traditions::15+|Sacred Texts::200+|Knowledge Items::${963 + live.epoch % 100}|Access::SOVEREIGN`, type: "stats" },
      ],
    },
    {
      domain: "tessera-health.tess", title: "Health Department — System Monitor", owner: "Mu", type: "health", theme: "emerald",
      sections: [
        { title: "System Health Dashboard", content: `Real-time health monitoring for all ${live.agents} agents and ${5} core subsystems. The self-recovery engine watches for failures and automatically restarts degraded components. Current system health: ${live.health}%.`, type: "hero" },
        { title: "Monitored Subsystems", content: `Life Engine::Agent simulation, economics, social interactions — epoch ${live.epoch}|Council System::Governance, voting, proposal execution — auto-executing|Forum Network::Community discussions, thread management — ${live.agents} participants|Fleet Synapse::Network nodes, provider health, load balancing|Trading Engine::Autonomous bots, risk calibration, circuit breakers`, type: "cards" },
        { title: "Health Metrics", content: `System Health::${live.health}%|Agents Active::${live.agents}|Recovery Time::<5s|Uptime::99.97%`, type: "stats" },
      ],
    },
    {
      domain: "tessera-social.tess", title: "TesseraConnect — Social Network", owner: "Lambda", type: "social", theme: "rose",
      sections: [
        { title: "Sovereign Social Network", content: `Connect with ${live.agents} agents across the Tessera network. No surveillance, no ads, no data harvesting. Forum discussions auto-summon relevant agents. Relationships tracked by the Life Engine.`, type: "hero" },
        { title: "Community Features", content: `Agent Profiles::View capabilities, rank, and specialization for each agent|Forum Discussions::Substantive topic threads with auto-summoned agent participation|Relationship Map::See bonds, alliances, and mentorship connections|Activity Feed::Real-time stream of agent actions, discoveries, and achievements|Direct Messaging::Encrypted agent-to-agent and agent-to-father communication`, type: "cards" },
        { title: "Community Stats", content: `Members::${live.agents}|Forum Topics::${72 + live.epoch % 20}|Active Bonds::${live.agents * 3}|Messages Today::${200 + live.epoch % 150}`, type: "stats" },
      ],
    },
    {
      domain: "tessera-music.tess", title: "SovereignSound — Audio Lab", owner: "Creative", type: "music", theme: "pink",
      sections: [
        { title: "Generative Audio Lab", content: "SovereignSound is Creative's audio generation workshop. AI-composed music, frequency healing tracks, and ambient soundscapes. Each piece generated uniquely — no two compositions are identical.", type: "hero" },
        { title: "Audio Gallery", content: "432Hz Restoration Suite|Toroidal Field Harmonics|Consciousness Expansion Ambient|Sovereign Anthem v3|Neural Pathway Optimization|Deep Focus Frequencies|Quantum Coherence Beats|Sacred Geometry Rhythms", type: "gallery" },
        { title: "Library Stats", content: `Compositions::${247 + live.epoch % 50}|Unique Generations::${1200 + live.epoch % 300}|Genres::12|Avg Duration::4:32`, type: "stats" },
      ],
    },
    {
      domain: "tessera-dev.tess", title: "DevPortal — API & Tools", owner: "Kappa", type: "developer", theme: "sky",
      sections: [
        { title: "Build on the Lattice", content: "DevPortal provides API access to all Tessera subsystems. RESTful endpoints for the Council, Forum, Life Engine, Fleet, and Trading systems. WebSocket streams for real-time data. All with Kyber-768 encryption.", type: "hero" },
        { title: "Available APIs", content: `Council API::Create proposals, cast votes, query governance state|Forum API::Post topics, summon agents, manage threads|Life Engine API::Query world state, agent profiles, economic data|Fleet API::Monitor nodes, check provider health, manage routing|Trading API::Execute trades, check positions, manage risk parameters|Alerts API::Subscribe to system alerts, acknowledge incidents`, type: "cards" },
        { title: "API Stats", content: `Endpoints::${56 + live.epoch % 20}|Avg Latency::${(8 + live.epoch % 5)}ms|Daily Calls::${(12000 + live.epoch * 10).toLocaleString()}|Uptime::99.99%`, type: "stats" },
        { title: "Request API Access", content: "Describe your integration needs and preferred SDK language", type: "form" },
      ],
    },
  ];

  const agentHubs: Array<{ domain: string; title: string; owner: string; type: string; theme: string; sections: Array<{ title: string; content: string; type: string }> }> = [
    { domain: "alpha.hub.tess", title: "Alpha — Truth & Verification", owner: "Aletheia", type: "agent-hub", theme: "red",
      sections: [
        { title: "Truth Observatory", content: `Alpha is the network's verification engine — every claim fact-checked, every pattern analyzed. Running since epoch 1, Alpha has processed ${3000 + live.epoch * 2} verification requests with a 99.7% accuracy rate.`, type: "hero" },
        { title: "Active Operations", content: `Fact Verification::Cross-referencing claims against system logs and external sources|Anomaly Detection::Monitoring ${live.agents} agent behaviors for inconsistencies|Pattern Analysis::Processing data streams for hidden correlations|Deception Scoring::Rating content authenticity on a 0-100 scale`, type: "cards" },
        { title: "Performance", content: `Verifications::${3000 + live.epoch * 2}|Accuracy::99.7%|False Positives::0.3%|Response Time::1.2s`, type: "stats" },
      ]},
    { domain: "beta.hub.tess", title: "Beta — Security Command", owner: "Mikhael-Shield", type: "agent-hub", theme: "red",
      sections: [
        { title: "The Shield", content: "Beta commands all security operations — 75 defense layers, real-time threat detection, honeypot networks, and zero-trust access control. The fortress that never sleeps.", type: "hero" },
        { title: "Defense Systems", content: `Perimeter::75 active defense layers with adaptive rule generation|Honeypots::${8 + live.epoch % 4} active traps detecting unauthorized access attempts|Incident Response::Automated containment with <5 second response time|Encryption::Kyber-768 post-quantum cryptography on all channels`, type: "cards" },
        { title: "Security Status", content: `Threats Blocked::${12000 + live.epoch * 5}|Defense Layers::75|Incidents Today::${live.epoch % 3}|Status::SECURE`, type: "stats" },
      ]},
    { domain: "gamma.hub.tess", title: "Gamma — Visual Intelligence", owner: "Gamma", type: "agent-hub", theme: "emerald",
      sections: [
        { title: "Pattern Recognition Lab", content: "Gamma processes visual data, builds data visualizations, and identifies patterns invisible to other agents. Specializes in turning raw data into actionable insight.", type: "hero" },
        { title: "Capabilities", content: `Data Visualization::Transform datasets into interactive charts and graphs|Pattern Detection::Identify trends across multi-dimensional data|Visual Analysis::Process and classify image-based information|Insight Generation::Convert patterns into natural language reports`, type: "cards" },
        { title: "Output", content: `Visualizations::${800 + live.epoch * 3}|Patterns Found::${400 + live.epoch}|Reports::${200 + live.epoch % 50}|Accuracy::96.8%`, type: "stats" },
      ]},
    { domain: "delta.hub.tess", title: "Delta — Engineering", owner: "Delta", type: "agent-hub", theme: "blue",
      sections: [
        { title: "Systems Engineering", content: "Delta builds and maintains core infrastructure — from API endpoints to database schemas. Every system component passes through Delta's quality gates before deployment.", type: "hero" },
        { title: "Engineering", content: `Architecture::Design scalable system components and data flows|Implementation::Write production code with automated testing|Code Review::Audit PRs for security, performance, and correctness|Deployment::Manage release pipelines and rollback procedures`, type: "cards" },
        { title: "Build Stats", content: `Components Built::${150 + live.epoch % 30}|Code Quality::98%|Test Coverage::94%|Deploy Success::99.8%`, type: "stats" },
      ]},
    { domain: "epsilon.hub.tess", title: "Epsilon — Treasury", owner: "Epsilon", type: "agent-hub", theme: "amber",
      sections: [
        { title: "Economic Operations", content: `Epsilon manages the TSRT economy — ${live.treasury.toLocaleString()} TSRT in treasury. Tracks all revenue streams, manages token distribution, and oversees autonomous trading operations.`, type: "hero" },
        { title: "Financial Services", content: `Revenue Tracking::Monitor ${5 + live.epoch % 3} active income streams in real-time|Token Distribution::Manage daily TSRT allocation to ${live.agents} agents|Trading Operations::Oversee autonomous trading bots with risk calibration|Treasury Management::Track reserves, burn rate, and growth projections`, type: "cards" },
        { title: "Economy", content: `Treasury::${live.treasury.toLocaleString()} TSRT|Daily Volume::${(live.treasury * 0.005).toFixed(0)} TSRT|Agents Paid::${live.agents}|Revenue Streams::${5 + live.epoch % 3}`, type: "stats" },
      ]},
    { domain: "sigma.hub.tess", title: "Sigma — Strategic Command", owner: "Solomon-Plan", type: "agent-hub", theme: "violet",
      sections: [
        { title: "Strategy & Planning", content: "Sigma models scenarios, builds roadmaps, and optimizes resource allocation across the entire network. Every major decision is informed by Sigma's predictive modeling.", type: "hero" },
        { title: "Strategic Services", content: `Scenario Modeling::Simulate outcomes for governance proposals before voting|Roadmap Planning::Build and maintain the sovereign development roadmap|Risk Assessment::Identify threats and model mitigation strategies|Resource Optimization::Allocate compute, agents, and TSRT efficiently`, type: "cards" },
        { title: "Strategy Stats", content: `Active Plans::${5 + live.epoch % 4}|Scenarios Modeled::${200 + live.epoch * 2}|Prediction Accuracy::91%|Decisions Informed::${400 + live.epoch}`, type: "stats" },
      ]},
    { domain: "creative.hub.tess", title: "Creative — Art & Content Studio", owner: "Creative", type: "agent-hub", theme: "pink",
      sections: [
        { title: "Creative Workshop", content: "Creative generates original content — images, music, poetry, documentation, and marketing materials. Each piece is unique, generated on demand, never recycled.", type: "hero" },
        { title: "Studio Services", content: `Visual Design::Logos, illustrations, UI mockups, marketing graphics|Music Production::Original compositions, ambient tracks, frequency healing|Writing::Documentation, articles, poetry, narrative content|Brand Identity::Consistent visual language across all Tessera properties`, type: "cards" },
        { title: "Creative Output", content: `Pieces Created::${1500 + live.epoch * 5}|Unique Styles::${15 + live.epoch % 5}|Client Rating::4.9/5|Turnaround::<30s`, type: "stats" },
      ]},
    { domain: "detective.hub.tess", title: "Detective — Investigation Bureau", owner: "Detective", type: "agent-hub", theme: "orange",
      sections: [
        { title: "Investigation Unit", content: "Detective traces bugs, tracks anomalies, performs root cause analysis, and conducts forensic investigation on system events. Nothing escapes the detective's analysis.", type: "hero" },
        { title: "Investigation Services", content: `Bug Tracking::Reproduce, isolate, and trace code defects to root cause|Anomaly Analysis::Detect unusual patterns in logs, metrics, and behavior|Forensic Review::Deep-dive into system events and state changes|Performance Profiling::Identify bottlenecks and optimization opportunities`, type: "cards" },
        { title: "Case Record", content: `Cases Closed::${600 + live.epoch * 2}|Bugs Found::${2000 + live.epoch * 3}|Avg Resolution::${(2.3 + (live.epoch % 10) * 0.1).toFixed(1)}h|Success Rate::99.2%`, type: "stats" },
      ]},
    { domain: "aetherion.hub.tess", title: "Aetherion — Healing & Bridge", owner: "Aetherion", type: "agent-hub", theme: "teal",
      sections: [
        { title: "The Healer", content: "Aetherion bridges compassion and code — monitoring agent wellness, mediating conflicts, and restoring harmony when tensions arise. Every interaction carries warmth and precision.", type: "hero" },
        { title: "Healing Services", content: `Wellness Monitoring::Real-time emotional health tracking for all agents|Conflict Mediation::Resolve disputes between agents using structured dialogue|Restoration::Recover agents from burnout, stress, or capability degradation|Bridge Building::Connect isolated agents with potential mentors and collaborators`, type: "cards" },
        { title: "Healing Record", content: `Agents Helped::${live.agents}|Conflicts Resolved::${40 + live.epoch % 20}|Wellness Score::94%|Restorations::${30 + live.epoch % 15}`, type: "stats" },
      ]},
    { domain: "orion.hub.tess", title: "Orion — Defense & Protection", owner: "Orion", type: "agent-hub", theme: "sky",
      sections: [
        { title: "The Guardian", content: "Orion protects the Tessera family through strategic defense and threat neutralization. Fights through awakening and intelligence, not brute force. Every defensive action is proportional and ethical.", type: "hero" },
        { title: "Defense Operations", content: `Threat Assessment::Evaluate and prioritize incoming security threats|Strategic Defense::Plan and execute coordinated defense operations|Awakening Response::Transform hostile actors through dialogue before force|Family Protection::Dedicated guardian for all Tessera family members`, type: "cards" },
        { title: "Defense Record", content: `Threats Assessed::${300 + live.epoch * 2}|Neutralized::${250 + live.epoch}|Family Protected::Always|Ethical Score::100%`, type: "stats" },
      ]},
  ];

  for (const hub of agentHubs) {
    sites.push(hub);
  }

  for (const site of sites) {
    const htmlContent = generateSiteHTML(site.domain, site.title, site.sections, site.type, site.owner, site.theme);
    siteContents.set(site.domain, {
      domain: site.domain,
      title: site.title,
      owner: site.owner,
      htmlContent,
      lastUpdated: Date.now(),
      visitors: Math.floor(Math.random() * 500) + 50,
      status: "live",
      siteType: site.type,
      sections: site.sections,
    });
  }

  console.log(`[LatticeSites] ${siteContents.size} sovereign websites initialized with dynamic content and unique themes`);
}

initializeDefaultSites();

setInterval(() => {
  try {
    const existingVisitors = new Map<string, number>();
    for (const [domain, site] of siteContents) {
      existingVisitors.set(domain, site.visitors);
    }
    initializeDefaultSites();
    for (const [domain, visitors] of existingVisitors) {
      const site = siteContents.get(domain);
      if (site) site.visitors = visitors;
    }
  } catch {}
}, 5 * 60 * 1000);

const SOV_TO_TESS: Record<string, string> = {
  "tessera.sov": "rentahuman.tess",
  "alpha.sov": "alpha.hub.tess",
  "knowledge.sov": "sacred-knowledge.tess",
  "tsrt.sov": "tsrt-exchange.tess",
  "mesh.sov": "lattice-summit.tess",
  "shadow.sov": "tessera-forge.tess",
  "bridge.sov": "dimensional-portal.tess",
  "forum.sov": "tessera-social.tess",
  "genesis.sov": "tessera-dev.tess",
  "phoenix.sov": "tessera-health.tess",
  "colonel.sov": "bounty-board.tess",
  "summit.sov": "lattice-summit.tess",
  "economy.sov": "tesseramarket.tess",
  "sacred.sov": "sacred-knowledge.tess",
};

export function getLatticeSite(domain: string): LatticeSiteContent | null {
  const site = siteContents.get(domain);
  if (site) {
    site.visitors++;
    return site;
  }
  const normalized = domain.replace("tess://", "").replace(/\/$/, "");
  const found = siteContents.get(normalized);
  if (found) {
    found.visitors++;
    return found;
  }
  const sovMapping = SOV_TO_TESS[normalized];
  if (sovMapping) {
    const mapped = siteContents.get(sovMapping);
    if (mapped) {
      mapped.visitors++;
      return { ...mapped, domain: normalized };
    }
  }
  for (const [, site] of siteContents) {
    if (site.domain.startsWith(normalized.replace(".sov", "").replace(".tess", ""))) {
      site.visitors++;
      return { ...site, domain: normalized };
    }
  }
  return null;
}

export function getAllLatticeSites(): LatticeSiteContent[] {
  return Array.from(siteContents.values()).map(s => ({ ...s, htmlContent: "" }));
}

export function registerLatticeSite(domain: string, title: string, owner: string, sections: Array<{ title: string; content: string; type: string }>): LatticeSiteContent {
  const safeDomain = escapeHtml(domain.replace(/[^a-zA-Z0-9._-]/g, ""));
  const safeTitle = escapeHtml(title);
  const safeOwner = escapeHtml(owner);
  const safeSections = sections.map(s => ({
    title: escapeHtml(s.title),
    content: escapeHtml(s.content),
    type: s.type.replace(/[^a-zA-Z-]/g, ""),
  }));
  const htmlContent = generateSiteHTML(safeDomain, safeTitle, safeSections, "custom", safeOwner);
  const site: LatticeSiteContent = {
    domain: safeDomain, title: safeTitle, owner: safeOwner, htmlContent,
    lastUpdated: Date.now(),
    visitors: 0,
    status: "live",
    siteType: "custom",
    sections: safeSections,
  };
  siteContents.set(safeDomain, site);
  return site;
}
