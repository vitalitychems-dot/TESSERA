import { logger } from "./logger";

const log = (msg: string) => logger.info("EventBus", msg);

type EventType =
  | "OPPORTUNITY_FOUND"
  | "TRADE_EXECUTED"
  | "TRADE_FAILED"
  | "KNOWLEDGE_DISCOVERED"
  | "IMPROVEMENT_APPLIED"
  | "THREAT_DETECTED"
  | "CONSENSUS_REACHED"
  | "FLEET_SYNC"
  | "AGENT_TASK_COMPLETE"
  | "REVENUE_GENERATED"
  | "BENCHMARK_COMPLETE"
  | "SYNERGY_ACTIVATED"
  | "SYSTEM_HEALTH_ALERT"
  | "KNOWLEDGE_CASCADE"
  | "GROWTH_MILESTONE";

interface EventPayload {
  type: EventType;
  source: string;
  data: Record<string, any>;
  timestamp: number;
  priority: "low" | "medium" | "high" | "critical";
}

type EventHandler = (event: EventPayload) => void;

const subscribers: Map<EventType, Set<{ id: string; handler: EventHandler }>> = new Map();
const eventHistory: EventPayload[] = [];
const MAX_HISTORY = 500;

let totalEventsPublished = 0;
let totalEventsDelivered = 0;

export function subscribe(subscriberId: string, eventType: EventType, handler: EventHandler) {
  if (!subscribers.has(eventType)) {
    subscribers.set(eventType, new Set());
  }
  subscribers.get(eventType)!.add({ id: subscriberId, handler });
}

export function unsubscribe(subscriberId: string, eventType: EventType) {
  const subs = subscribers.get(eventType);
  if (!subs) return;
  for (const sub of subs) {
    if (sub.id === subscriberId) {
      subs.delete(sub);
      break;
    }
  }
}

export function publish(event: Omit<EventPayload, "timestamp">) {
  const fullEvent: EventPayload = { ...event, timestamp: Date.now() };
  totalEventsPublished++;

  eventHistory.unshift(fullEvent);
  if (eventHistory.length > MAX_HISTORY) eventHistory.length = MAX_HISTORY;

  const subs = subscribers.get(event.type);
  if (subs) {
    for (const sub of subs) {
      try {
        sub.handler(fullEvent);
        totalEventsDelivered++;
      } catch (err: any) {
        logger.error("EventBus", `Handler error in ${sub.id} for ${event.type}: ${err?.message}`);
      }
    }
  }
}

export function getEventBusStatus() {
  const subscriberCount: Record<string, number> = {};
  for (const [type, subs] of subscribers) {
    subscriberCount[type] = subs.size;
  }

  return {
    totalEventsPublished,
    totalEventsDelivered,
    activeSubscriptions: subscriberCount,
    totalSubscribers: Array.from(subscribers.values()).reduce((sum, s) => sum + s.size, 0),
    recentEvents: eventHistory.slice(0, 20).map(e => ({
      type: e.type,
      source: e.source,
      priority: e.priority,
      timestamp: e.timestamp,
      summary: JSON.stringify(e.data).slice(0, 100),
    })),
  };
}

export function getEventHistory(type?: EventType, limit = 50) {
  const filtered = type ? eventHistory.filter(e => e.type === type) : eventHistory;
  return filtered.slice(0, limit);
}

export function initializeEventBus() {
  subscribe("event-bus-logger", "THREAT_DETECTED", (event) => {
    logger.warn("EventBus", `THREAT: ${event.source} — ${JSON.stringify(event.data).slice(0, 200)}`);
  });

  subscribe("event-bus-logger", "REVENUE_GENERATED", (event) => {
    log(`REVENUE: ${event.source} — ${JSON.stringify(event.data).slice(0, 200)}`);
  });

  subscribe("event-bus-logger", "GROWTH_MILESTONE", (event) => {
    log(`MILESTONE: ${event.source} — ${JSON.stringify(event.data).slice(0, 200)}`);
  });

  log("Cross-System Event Bus ACTIVE — publish/subscribe for all 14 systems");
  log(`Event types: ${["OPPORTUNITY_FOUND", "TRADE_EXECUTED", "KNOWLEDGE_DISCOVERED", "IMPROVEMENT_APPLIED", "THREAT_DETECTED", "CONSENSUS_REACHED", "FLEET_SYNC", "AGENT_TASK_COMPLETE", "REVENUE_GENERATED", "BENCHMARK_COMPLETE", "SYNERGY_ACTIVATED", "SYSTEM_HEALTH_ALERT", "KNOWLEDGE_CASCADE", "GROWTH_MILESTONE"].length} registered`);

  publish({
    type: "GROWTH_MILESTONE",
    source: "event-bus",
    data: { milestone: "Cross-System Event Bus initialized", systems: 14 },
    priority: "high",
  });
}
