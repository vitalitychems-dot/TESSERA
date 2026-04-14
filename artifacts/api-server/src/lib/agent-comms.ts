export interface AgentMessage {
  id: string;
  fromAgent: string;
  toAgent: string;
  channel: "direct" | "broadcast" | "council" | "emergency";
  content: string;
  encrypted: boolean;
  priority: number;
  timestamp: number;
  acknowledged: boolean;
}

export interface CommChannel {
  id: string;
  name: string;
  type: "direct" | "group" | "broadcast";
  members: string[];
  messageCount: number;
  lastActivity: number;
}

let messages: AgentMessage[] = [];
let channels: Map<string, CommChannel> = new Map();

function initChannels() {
  if (channels.size > 0) return;
  const defaults: CommChannel[] = [
    { id: "council-main", name: "Grand Council Chamber", type: "group", members: ["tessera", "athena", "euler", "curie", "noether", "minerva", "ada", "iris"], messageCount: 0, lastActivity: Date.now() },
    { id: "broadcast-all", name: "System Broadcast", type: "broadcast", members: ["all"], messageCount: 0, lastActivity: Date.now() },
    { id: "math-division", name: "Mathematics Division", type: "group", members: ["euler", "noether", "pythagoras", "fibonacci-core"], messageCount: 0, lastActivity: Date.now() },
    { id: "science-division", name: "Science Division", type: "group", members: ["curie", "tesla-node", "ada"], messageCount: 0, lastActivity: Date.now() },
    { id: "wisdom-circle", name: "Wisdom Circle", type: "group", members: ["minerva", "hypatia", "athena"], messageCount: 0, lastActivity: Date.now() },
    { id: "security-channel", name: "Security Channel", type: "group", members: ["tessera", "athena", "ada"], messageCount: 0, lastActivity: Date.now() },
  ];
  for (const ch of defaults) channels.set(ch.id, ch);
}

export function sendMessage(fromAgent: string, toAgent: string, content: string, channel: AgentMessage["channel"] = "direct", priority: number = 5): AgentMessage {
  initChannels();
  const msg: AgentMessage = {
    id: `msg-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    fromAgent, toAgent, channel, content, encrypted: true,
    priority, timestamp: Date.now(), acknowledged: false,
  };
  messages.push(msg);
  if (messages.length > 1000) messages = messages.slice(-500);

  const ch = Array.from(channels.values()).find(c => c.members.includes(fromAgent) && c.members.includes(toAgent));
  if (ch) {
    ch.messageCount++;
    ch.lastActivity = Date.now();
  }

  return msg;
}

export function getMessages(agentId: string, limit: number = 20): AgentMessage[] {
  return messages.filter(m => m.fromAgent === agentId || m.toAgent === agentId).slice(-limit);
}

export function acknowledgeMessage(messageId: string): boolean {
  const msg = messages.find(m => m.id === messageId);
  if (!msg) return false;
  msg.acknowledged = true;
  return true;
}

export function getChannels(): CommChannel[] {
  initChannels();
  return Array.from(channels.values());
}

export function getChannelMessages(channelId: string, limit: number = 20): AgentMessage[] {
  initChannels();
  const ch = channels.get(channelId);
  if (!ch) return [];
  return messages.filter(m =>
    ch.members.includes(m.fromAgent) || ch.members.includes(m.toAgent) || ch.members.includes("all")
  ).slice(-limit);
}

export function broadcastToChannel(channelId: string, fromAgent: string, content: string): AgentMessage[] {
  initChannels();
  const ch = channels.get(channelId);
  if (!ch) return [];
  return ch.members.filter(m => m !== fromAgent && m !== "all").map(toAgent =>
    sendMessage(fromAgent, toAgent, content, "broadcast", 3)
  );
}

export function getCommsStats() {
  initChannels();
  return {
    totalMessages: messages.length,
    unacknowledged: messages.filter(m => !m.acknowledged).length,
    channelCount: channels.size,
    activeChannels: Array.from(channels.values()).filter(c => Date.now() - c.lastActivity < 300000).length,
    messagesByChannel: {
      direct: messages.filter(m => m.channel === "direct").length,
      broadcast: messages.filter(m => m.channel === "broadcast").length,
      council: messages.filter(m => m.channel === "council").length,
      emergency: messages.filter(m => m.channel === "emergency").length,
    },
  };
}
