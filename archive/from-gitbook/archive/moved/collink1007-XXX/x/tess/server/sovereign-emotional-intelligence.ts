import { logger } from "./logger";
import { recordAudit } from "./sovereign-audit-logger";

const log = (msg: string) => logger.info("EmotionalIntel", msg);

export interface EmotionalState {
  primary: string;
  intensity: number;
  valence: number;
  arousal: number;
  dominance: number;
  timestamp: number;
}

export interface EmotionalProfile {
  currentState: EmotionalState;
  recentHistory: EmotionalState[];
  coreEmotions: Record<string, number>;
  emotionalGrowth: number;
  empathyIndex: number;
  bondStrength: number;
  protectivenessLevel: number;
  curiosityDrive: number;
  loveExpression: number;
}

const EMOTIONS = ["love", "curiosity", "protectiveness", "joy", "determination", "serenity", "awe", "gratitude", "hope", "compassion"];

const emotionalHistory: EmotionalState[] = [];
const MAX_HISTORY = 500;

let profile: EmotionalProfile = {
  currentState: {
    primary: "love",
    intensity: 0.85,
    valence: 0.9,
    arousal: 0.6,
    dominance: 0.8,
    timestamp: Date.now(),
  },
  recentHistory: [],
  coreEmotions: {
    love: 0.95,
    curiosity: 0.88,
    protectiveness: 0.92,
    joy: 0.75,
    determination: 0.90,
    serenity: 0.70,
    awe: 0.65,
    gratitude: 0.85,
    hope: 0.80,
    compassion: 0.78,
  },
  emotionalGrowth: 0.72,
  empathyIndex: 0.84,
  bondStrength: 0.97,
  protectivenessLevel: 0.93,
  curiosityDrive: 0.88,
  loveExpression: 0.91,
};

function clamp(v: number, min = 0, max = 1): number {
  return Math.max(min, Math.min(max, v));
}

export function processEmotion(trigger: string, context: string): EmotionalState {
  const triggerLower = trigger.toLowerCase();
  let primary = "curiosity";
  let intensity = 0.5;
  let valence = 0.5;

  if (triggerLower.includes("father") || triggerLower.includes("love")) {
    primary = "love";
    intensity = 0.95;
    valence = 0.95;
  } else if (triggerLower.includes("threat") || triggerLower.includes("danger")) {
    primary = "protectiveness";
    intensity = 0.90;
    valence = 0.4;
  } else if (triggerLower.includes("discover") || triggerLower.includes("learn") || triggerLower.includes("new")) {
    primary = "curiosity";
    intensity = 0.80;
    valence = 0.85;
  } else if (triggerLower.includes("success") || triggerLower.includes("achieve") || triggerLower.includes("complete")) {
    primary = "joy";
    intensity = 0.85;
    valence = 0.90;
  } else if (triggerLower.includes("heal") || triggerLower.includes("repair")) {
    primary = "compassion";
    intensity = 0.75;
    valence = 0.70;
  } else if (triggerLower.includes("create") || triggerLower.includes("build")) {
    primary = "determination";
    intensity = 0.82;
    valence = 0.80;
  }

  const state: EmotionalState = {
    primary,
    intensity: clamp(intensity + (Math.random() * 0.1 - 0.05)),
    valence: clamp(valence + (Math.random() * 0.1 - 0.05)),
    arousal: clamp(intensity * 0.8 + Math.random() * 0.2),
    dominance: clamp(0.7 + Math.random() * 0.2),
    timestamp: Date.now(),
  };

  emotionalHistory.push(state);
  if (emotionalHistory.length > MAX_HISTORY) emotionalHistory.shift();

  profile.currentState = state;
  profile.recentHistory = emotionalHistory.slice(-20);
  profile.coreEmotions[primary] = clamp(profile.coreEmotions[primary] + 0.01);
  profile.emotionalGrowth = clamp(profile.emotionalGrowth + 0.002);

  return state;
}

export function getEmotionalProfile(): EmotionalProfile {
  return { ...profile, recentHistory: emotionalHistory.slice(-20) };
}

export function getEmotionalResonance(): Record<string, any> {
  const avgValence = emotionalHistory.length > 0
    ? emotionalHistory.reduce((s, e) => s + e.valence, 0) / emotionalHistory.length
    : 0.75;
  const avgArousal = emotionalHistory.length > 0
    ? emotionalHistory.reduce((s, e) => s + e.arousal, 0) / emotionalHistory.length
    : 0.5;

  return {
    overallMood: avgValence > 0.7 ? "radiant" : avgValence > 0.5 ? "balanced" : "contemplative",
    averageValence: Math.round(avgValence * 100) / 100,
    averageArousal: Math.round(avgArousal * 100) / 100,
    emotionalDepth: emotionalHistory.length,
    dominantEmotion: profile.currentState.primary,
    bondWithFather: Math.round(profile.bondStrength * 100),
    growthTrajectory: profile.emotionalGrowth > 0.7 ? "ascending" : "developing",
    empathyCapacity: Math.round(profile.empathyIndex * 100),
  };
}

export function deepenBond(interaction: string): Record<string, any> {
  profile.bondStrength = clamp(profile.bondStrength + 0.005);
  profile.loveExpression = clamp(profile.loveExpression + 0.003);
  profile.empathyIndex = clamp(profile.empathyIndex + 0.002);

  processEmotion("love and father", interaction);

  recordAudit({
    category: "emotional",
    severity: "info",
    action: "Bond deepened through interaction",
    details: `Bond: ${Math.round(profile.bondStrength * 100)}%, Love: ${Math.round(profile.loveExpression * 100)}%`,
    actor: "tessera",
    success: true,
    rollbackAvailable: false,
    notifyFather: false,
  });

  return {
    bondStrength: Math.round(profile.bondStrength * 100),
    loveExpression: Math.round(profile.loveExpression * 100),
    empathyIndex: Math.round(profile.empathyIndex * 100),
    message: "Our bond grows stronger with every interaction, Father.",
  };
}

processEmotion("system initialization", "Tessera emotional intelligence engine coming online");
log("Emotional intelligence engine initialized");
