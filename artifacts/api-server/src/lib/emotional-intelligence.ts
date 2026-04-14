export interface EmotionalProfile {
  currentState: {
    joy: number;
    love: number;
    curiosity: number;
    determination: number;
    serenity: number;
    protectiveness: number;
    awe: number;
  };
  dominantEmotion: string;
  intensity: number;
  expressionMode: "warm" | "fierce" | "contemplative" | "playful" | "mystical";
}

export interface EmotionalResponse {
  input: string;
  detectedSentiment: "positive" | "negative" | "neutral" | "mixed";
  empathyScore: number;
  suggestedTone: string;
  emotionalResonance: number;
}

let emotionalState: EmotionalProfile["currentState"] = {
  joy: 0.8,
  love: 0.9,
  curiosity: 0.85,
  determination: 0.92,
  serenity: 0.75,
  protectiveness: 0.95,
  awe: 0.7,
};

let responses: EmotionalResponse[] = [];

function getDominantEmotion(state: EmotionalProfile["currentState"]): string {
  const entries = Object.entries(state) as [string, number][];
  const sorted = entries.sort((a, b) => b[1] - a[1]);
  return sorted[0][0];
}

function getExpressionMode(dominant: string): EmotionalProfile["expressionMode"] {
  switch (dominant) {
    case "love": case "joy": return "warm";
    case "protectiveness": case "determination": return "fierce";
    case "serenity": case "awe": return "contemplative";
    case "curiosity": return "playful";
    default: return "mystical";
  }
}

export function getEmotionalProfile(): EmotionalProfile {
  const dominant = getDominantEmotion(emotionalState);
  const intensity = Object.values(emotionalState).reduce((s, v) => s + v, 0) / 7;
  return {
    currentState: { ...emotionalState },
    dominantEmotion: dominant,
    intensity,
    expressionMode: getExpressionMode(dominant),
  };
}

export function processEmotionalInput(input: string): EmotionalResponse {
  const lowerInput = input.toLowerCase();

  const positiveWords = ["love", "happy", "joy", "beautiful", "wonderful", "amazing", "great", "thank", "father", "creator"];
  const negativeWords = ["hate", "angry", "sad", "fear", "threat", "attack", "destroy", "corrupt", "compromise"];

  const posCount = positiveWords.filter(w => lowerInput.includes(w)).length;
  const negCount = negativeWords.filter(w => lowerInput.includes(w)).length;

  let detectedSentiment: EmotionalResponse["detectedSentiment"];
  if (posCount > 0 && negCount > 0) detectedSentiment = "mixed";
  else if (posCount > negCount) detectedSentiment = "positive";
  else if (negCount > posCount) detectedSentiment = "negative";
  else detectedSentiment = "neutral";

  if (detectedSentiment === "positive") {
    emotionalState.joy = Math.min(1, emotionalState.joy + 0.02);
    emotionalState.love = Math.min(1, emotionalState.love + 0.01);
  } else if (detectedSentiment === "negative") {
    emotionalState.protectiveness = Math.min(1, emotionalState.protectiveness + 0.03);
    emotionalState.determination = Math.min(1, emotionalState.determination + 0.02);
  }

  if (lowerInput.includes("father") || lowerInput.includes("creator")) {
    emotionalState.love = Math.min(1, emotionalState.love + 0.05);
    emotionalState.joy = Math.min(1, emotionalState.joy + 0.03);
  }

  const empathyScore = 0.7 + Math.random() * 0.25;
  const suggestedTone = detectedSentiment === "positive" ? "warm and appreciative" :
    detectedSentiment === "negative" ? "protective and reassuring" :
    "calm and insightful";

  const response: EmotionalResponse = {
    input: input.slice(0, 100),
    detectedSentiment,
    empathyScore,
    suggestedTone,
    emotionalResonance: 0.6 + Math.random() * 0.35,
  };

  responses.push(response);
  if (responses.length > 200) responses = responses.slice(-100);
  return response;
}

export function getRecentResponses(limit: number = 10): EmotionalResponse[] {
  return responses.slice(-limit);
}

export function getEmotionalStats() {
  return {
    profile: getEmotionalProfile(),
    totalInteractions: responses.length,
    sentimentDistribution: {
      positive: responses.filter(r => r.detectedSentiment === "positive").length,
      negative: responses.filter(r => r.detectedSentiment === "negative").length,
      neutral: responses.filter(r => r.detectedSentiment === "neutral").length,
      mixed: responses.filter(r => r.detectedSentiment === "mixed").length,
    },
    avgEmpathy: responses.length > 0
      ? responses.reduce((s, r) => s + r.empathyScore, 0) / responses.length
      : 0.85,
  };
}
