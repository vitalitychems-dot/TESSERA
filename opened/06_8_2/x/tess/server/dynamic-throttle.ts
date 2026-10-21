import { setUserChatPriority } from "./llm-helper";

const log = (msg: string) => console.log(`[DynamicThrottle] ${msg}`);

let lastUserMessageTime = 0;
let backgroundPaused = false;
const USER_CHAT_COOLDOWN_MS = 30000;

export function recordUserActivity() {
  lastUserMessageTime = Date.now();
  if (!backgroundPaused) {
    backgroundPaused = true;
    setUserChatPriority(true);
    log("User active — background LLM calls paused");
  }
}

export function isBackgroundAllowed(): boolean {
  const elapsed = Date.now() - lastUserMessageTime;
  if (elapsed > USER_CHAT_COOLDOWN_MS) {
    if (backgroundPaused) {
      backgroundPaused = false;
      log("User idle 30s — background LLM calls resumed");
    }
    return true;
  }
  return false;
}

export function shouldThrottleBackground(): boolean {
  return !isBackgroundAllowed();
}

export function getThrottleStatus() {
  const elapsed = Date.now() - lastUserMessageTime;
  return {
    backgroundPaused,
    lastUserMessageTime,
    secondsSinceLastMessage: Math.round(elapsed / 1000),
    resumesIn: backgroundPaused ? Math.max(0, Math.round((USER_CHAT_COOLDOWN_MS - elapsed) / 1000)) : 0,
    cooldownMs: USER_CHAT_COOLDOWN_MS,
  };
}

setInterval(() => {
  isBackgroundAllowed();
}, 5000);

log("Dynamic throttling initialized — background pauses when user is chatting, resumes 30s after");
