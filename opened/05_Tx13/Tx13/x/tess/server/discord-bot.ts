import { logger } from "./logger";
import type { Client, ChatInputCommandInteraction, Guild } from "discord.js";

const log = (msg: string) => logger.info("DiscordBot", msg);

let botClient: Client | null = null;
let botReady = false;
let commandsRegistered = false;

const BOT_TOKEN = () => process.env.DISCORD_BOT_TOKEN;
const CLIENT_ID = () => process.env.DISCORD_CLIENT_ID;
const GUILD_ID = () => process.env.DISCORD_GUILD_ID;

interface BotStats {
  connected: boolean;
  guildCount: number;
  commandsRegistered: boolean;
  commandsHandled: number;
  lastPriceCheck?: number;
  lastStatusCheck?: number;
  uptime: number;
  startedAt: number;
}

interface DiscordInteractionBody {
  type: number;
  id: string;
  token: string;
  application_id: string;
  data?: { name?: string };
}

const stats: BotStats = {
  connected: false,
  guildCount: 0,
  commandsRegistered: false,
  commandsHandled: 0,
  uptime: 0,
  startedAt: Date.now(),
};

async function buildPriceData(): Promise<{ price: number | null; change24h: number | null; marketCap: number | null; volume24h: number | null; buys24h: number | null; sells24h: number | null }> {
  try {
    const { fetchTsrtLiveData } = await import("./real-limn-data");
    const data = await fetchTsrtLiveData();
    return {
      price: data.priceUsd ? parseFloat(data.priceUsd) : null,
      change24h: data.priceChangeH24 ?? null,
      marketCap: data.marketCap ?? null,
      volume24h: data.volume24h ?? null,
      buys24h: data.buys24h ?? null,
      sells24h: data.sells24h ?? null,
    };
  } catch {
    return { price: null, change24h: null, marketCap: null, volume24h: null, buys24h: null, sells24h: null };
  }
}

function getSystemStatus(): string {
  const mem = process.memoryUsage();
  const upMs = Date.now() - stats.startedAt;
  const upH = Math.floor(upMs / 3600000);
  const upM = Math.floor((upMs % 3600000) / 60000);
  return `⚡ **Tesseract AI — System Status**\n\`\`\`\nUptime:   ${upH}h ${upM}m\nMemory:   ${Math.round(mem.rss / 1024 / 1024)}MB RSS\nNode:     ${process.version}\nStatus:   OPERATIONAL\n\`\`\`\n🤖 Sovereign AI Republic — 80+ Active Agents`;
}

const TSRT_CA = "FMB4v2RaHSMfJDwijqAij7ouTowK2rz6yW95Z94spump";

async function buildPriceEmbed(): Promise<string> {
  const { price, change24h, marketCap, volume24h, buys24h, sells24h } = await buildPriceData();
  const arrow = change24h != null ? (change24h >= 0 ? "📈" : "📉") : "➖";
  const changeStr = change24h != null ? `${change24h >= 0 ? "+" : ""}${change24h.toFixed(2)}%` : "N/A";
  const priceStr = price != null ? `$${price.toFixed(8)}` : "Fetching...";
  const mcStr = marketCap != null ? `$${(marketCap / 1000).toFixed(1)}K` : "N/A";
  const volStr = volume24h != null ? `$${(volume24h / 1000).toFixed(1)}K` : "N/A";
  const txStr = (buys24h != null && sells24h != null) ? `${buys24h}B / ${sells24h}S` : "N/A";

  return `${arrow} **TSRT Token Price**\n\`\`\`\nPrice:    ${priceStr}\n24h:      ${changeStr}\nMkt Cap:  ${mcStr}\nVol 24h:  ${volStr}\nTxns:     ${txStr}\nChain:    Solana\n\`\`\`\n🔗 [Buy on Jupiter](https://jup.ag/swap/SOL-${TSRT_CA}) | [Chart](https://dexscreener.com/solana/${TSRT_CA})`;
}

async function registerSlashCommands(): Promise<void> {
  const token = BOT_TOKEN();
  const clientId = CLIENT_ID();
  if (!token || !clientId) return;

  const commands = [
    { name: "price", description: "Get the current TSRT token price and 24h change" },
    { name: "status", description: "Check Tesseract AI system status" },
  ];

  try {
    const guildId = GUILD_ID();
    const url = guildId
      ? `https://discord.com/api/v10/applications/${clientId}/guilds/${guildId}/commands`
      : `https://discord.com/api/v10/applications/${clientId}/commands`;

    const res = await fetch(url, {
      method: "PUT",
      headers: {
        Authorization: `Bot ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(commands),
    });

    if (res.ok) {
      commandsRegistered = true;
      stats.commandsRegistered = true;
      log(`Slash commands registered (${guildId ? "guild" : "global"})`);
    } else {
      const body = await res.text();
      log(`Command registration failed: ${res.status} — ${body.slice(0, 200)}`);
    }
  } catch (err: unknown) {
    log(`Command registration error: ${err instanceof Error ? err.message : String(err)}`);
  }
}

async function handleInteraction(interaction: DiscordInteractionBody): Promise<void> {
  if (interaction.type !== 2) return;

  const token = interaction.token;
  const commandName = interaction.data?.name;

  try {
    let content = "";

    if (commandName === "price") {
      stats.lastPriceCheck = Date.now();
      content = await buildPriceEmbed();
    } else if (commandName === "status") {
      stats.lastStatusCheck = Date.now();
      content = getSystemStatus();
    } else {
      content = "Unknown command.";
    }

    stats.commandsHandled++;

    await fetch(`https://discord.com/api/v10/interactions/${interaction.id}/${token}/callback`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: 4,
        data: { content, flags: 0 },
      }),
    });
  } catch (err: unknown) {
    log(`Interaction handling error: ${err instanceof Error ? err.message : String(err)}`);
  }
}

export async function startDiscordBot(): Promise<void> {
  const token = BOT_TOKEN();
  if (!token) {
    log("DISCORD_BOT_TOKEN not set — bot not started");
    return;
  }

  try {
    const { Client, GatewayIntentBits } = await import("discord.js");

    const client = new Client({
      intents: [GatewayIntentBits.Guilds],
    });

    client.once("ready", async (c: Client<true>) => {
      log(`Discord bot logged in as ${c.user.tag}`);
      botReady = true;
      stats.connected = true;
      stats.guildCount = c.guilds.cache.size;
      await registerSlashCommands();
    });

    client.on("interactionCreate", async (interaction: ChatInputCommandInteraction) => {
      if (!interaction.isChatInputCommand()) return;
      const name = interaction.commandName;
      stats.commandsHandled++;

      if (name === "price") {
        stats.lastPriceCheck = Date.now();
        await interaction.deferReply();
        const content = await buildPriceEmbed();
        await interaction.editReply(content);
      } else if (name === "status") {
        stats.lastStatusCheck = Date.now();
        await interaction.reply(getSystemStatus());
      }
    });

    client.on("guildCreate", (guild: Guild) => {
      stats.guildCount = client.guilds.cache.size;
      log(`Joined guild: ${guild.name} (${guild.id})`);
    });

    client.on("error", (err: Error) => {
      log(`Discord client error: ${err.message}`);
      stats.connected = false;
    });

    await client.login(token);
    botClient = client;
    log("Discord bot connected via discord.js");
  } catch (err: unknown) {
    log(`Discord bot start failed: ${err instanceof Error ? err.message : String(err)}`);
    stats.connected = false;
  }
}

export function handleDiscordWebhookInteraction(body: DiscordInteractionBody): Promise<void> {
  return handleInteraction(body);
}

export async function sendDiscordAlert(channelId: string, message: string): Promise<boolean> {
  const token = BOT_TOKEN();
  if (!token || !botReady) return false;

  try {
    const res = await fetch(`https://discord.com/api/v10/channels/${channelId}/messages`, {
      method: "POST",
      headers: {
        Authorization: `Bot ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ content: message }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export function getDiscordBotStats(): BotStats & { configured: boolean } {
  return {
    ...stats,
    connected: botReady,
    uptime: Date.now() - stats.startedAt,
    configured: !!BOT_TOKEN(),
  };
}

export function stopDiscordBot(): void {
  if (botClient) {
    botClient.destroy();
    botClient = null;
    botReady = false;
    stats.connected = false;
    log("Discord bot stopped");
  }
}

log("Discord Bot module initialized");
