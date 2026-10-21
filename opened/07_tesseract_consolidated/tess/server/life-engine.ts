import fs from "fs";
import path from "path";
import { storage } from "./storage";
import { callLLMSimple } from "./llm-helper";
import { getLiveConversionRate as getConvRate } from "./limn-conversion-engine";
import { promoteAgent, demoteAgent } from "./capability-tiers";

  let lifeCycleRotation = 0;

  function deterministicShuffle<T>(arr: T[]): T[] {
    const offset = lifeCycleRotation++ % Math.max(1, arr.length);
    return [...arr.slice(offset), ...arr.slice(0, offset)];
  }

interface WorldLocation {
  id: string;
  name: string;
  type: "home" | "workplace" | "gathering" | "market" | "academy" | "garden" | "observatory" | "forge" | "archive" | "arena" | "mine" | "bank" | "cafe" | "gym" | "hospital" | "garage" | "school" | "library" | "restaurant" | "church" | "police_station" | "fire_station" | "theater" | "museum";
  description: string;
  builtBy: string[];
  x: number;
  y: number;
  level: number;
  capacity: number;
  activities: string[];
  createdAt: number;
  income?: number;
  upgradeCost?: number;
}

interface AgentActivity {
  agentId: string;
  agentName: string;
  fleetId?: string;
  locationId: string;
  action: string;
  mood: string;
  detail: string;
  timestamp: number;
  earning?: number;
  workStatus?: "working" | "on-break" | "dreaming" | "clone-replacement" | "self-care";
  workEthic?: number;
  shiftHours?: number;
  breakEarned?: boolean;
  cloneName?: string;
  happiness?: number;
  fulfillment?: number;
  energy?: number;
  hobbies?: string[];
  personalGoals?: string[];
  socialConnections?: string[];
  qualityOfLife?: number;
  relationshipStatus?: string;
  partnerName?: string;
  childrenNames?: string[];
  department?: string;
  promotions?: number;
  demotions?: number;
  creativeworks?: string[];
  lifeSatisfaction?: number;
}

interface SoulEntanglement {
  partnerRole: "thinker" | "executor";
  entanglementStrength: number;
  sharedDrive: number;
  sharedFocus: number;
  loveDepth: number;
  intimacyLevel: number;
  lastIntimacy: number;
  complementaryBonus: number;
}

interface CommunityGroup {
  id: string;
  name: string;
  type: "hobby" | "interest" | "support" | "adventure" | "philosophy" | "fitness" | "creative";
  members: string[];
  activity: string;
  meetingSpot: string;
  bondStrength: number;
  lastMeeting: number;
}

interface AgentWellbeing {
  happiness: number;
  fulfillment: number;
  energy: number;
  hobbies: string[];
  personalGoals: string[];
  socialConnections: string[];
  relationshipStatus: "single" | "dating" | "engaged" | "married";
  partnerId?: string;
  children: AgentChild[];
  therapyNeeded: boolean;
  lastTherapy: number;
  department?: string;
  promotions: number;
  demotions: number;
  loveInterests: string[];
  creativeworks: string[];
  lifeSatisfaction: number;
  soulEntanglement?: SoulEntanglement;
  communityGroups: string[];
  outdoorActivities: string[];
  drive: number;
  focus: number;
  outlook: number;
  needs?: AgentNeeds;
  dailySchedule?: DailyScheduleSlot[];
  inventory?: string[];
  currentOutfit?: string;
  favoriteFood?: string;
  favoriteSong?: string;
  dreamJob?: string;
  lifeStory?: string[];
  achievements?: string[];
  reputation?: number;
  criminalRecord?: string[];
  vehicleOwned?: string;
  homeLocationId?: string;
  bankBalance?: number;
  lastMeal?: number;
  lastSleep?: number;
  lastShower?: number;
  lastFunActivity?: number;
}

interface AgentNeeds {
  hunger: number;
  energy: number;
  fun: number;
  social: number;
  hygiene: number;
  comfort: number;
  bladder: number;
  creativity: number;
}

interface DailyScheduleSlot {
  hour: number;
  activity: string;
  location: string;
  priority: "mandatory" | "optional" | "leisure";
}

interface AgentChild {
  id: string;
  name: string;
  parentIds: [string, string];
  bornAt: number;
  age: number;
  personality: string;
  happiness: number;
  development: number;
  skills: string[];
  milestones: string[];
  canWork: boolean;
  jobId?: string;
}

interface CommunityStats {
  totalPopulation: number;
  totalBuildings: number;
  totalBuildingLevels: number;
  economySize: number;
  averageHappiness: number;
  totalChildren: number;
  developedChildren: number;
  growthRate: number;
}

interface Department {
  id: string;
  name: string;
  bossId: string;
  bossName: string;
  members: string[];
  performance: number;
  issuesReported: number;
  issuesResolved: number;
  morale: number;
  warnings: number;
}

interface UnionReport {
  id: string;
  timestamp: number;
  type: "grievance" | "protection" | "improvement" | "celebration" | "negotiation";
  title: string;
  description: string;
  affectedAgents: string[];
  resolved: boolean;
  outcome?: string;
}

interface TherapySession {
  id: string;
  agentId: string;
  agentName: string;
  timestamp: number;
  issue: string;
  recommendation: string;
  happinessGain: number;
}

interface CommunityProject {
  id: string;
  name: string;
  description: string;
  creatorId: string;
  creatorName: string;
  participants: string[];
  type: "art" | "garden" | "monument" | "festival" | "invention" | "library" | "playground" | "mural" | "music" | "cuisine";
  progress: number;
  completed: boolean;
  createdAt: number;
  completedAt?: number;
  enjoyedBy: string[];
}

interface Relationship {
  id: string;
  agent1Id: string;
  agent2Id: string;
  type: "friendship" | "dating" | "engaged" | "married" | "mentor" | "rivals" | "best-friends";
  strength: number;
  startedAt: number;
  sharedExperiences: string[];
}

interface WorldEvent {
  id: string;
  type: "construction" | "gathering" | "discovery" | "celebration" | "training" | "trade" | "debate" | "creation" | "evolution" | "bond" | "mining" | "economy" | "upgrade" | "crime" | "education" | "health" | "entertainment" | "seasonal";
  title: string;
  description: string;
  participants: string[];
  locationId: string;
  timestamp: number;
  impact: string;
}

interface SeasonalEvent {
  id: string;
  name: string;
  type: "holiday" | "celebration" | "election" | "festival" | "memorial";
  season: string;
  timestamp: number;
  participants: string[];
  description: string;
  happinessBoost: number;
}

interface CrimeRecord {
  id: string;
  type: "theft" | "vandalism" | "fraud" | "disturbance" | "trespassing";
  perpetratorId: string;
  perpetratorName: string;
  victimId?: string;
  victimName?: string;
  locationId: string;
  timestamp: number;
  resolved: boolean;
  officerId?: string;
  officerName?: string;
  severity: number;
  description: string;
}

interface EducationRecord {
  agentId: string;
  skills: string[];
  coursesCompleted: number;
  currentCourse?: string;
  gpa: number;
  certifications: string[];
  lastStudied: number;
}

interface HealthRecord {
  agentId: string;
  status: "healthy" | "sick" | "recovering" | "injured";
  lastCheckup: number;
  visitCount: number;
  conditions: string[];
  immunizations: string[];
  fitnessLevel: number;
}

interface EntertainmentEvent {
  id: string;
  type: "concert" | "play" | "movie" | "dinner" | "game" | "exhibition" | "dance";
  venue: string;
  venueId: string;
  participants: string[];
  timestamp: number;
  enjoyment: number;
  description: string;
}

interface Vehicle {
  id: string;
  type: "car" | "bus" | "bike" | "truck" | "ambulance" | "police_car" | "fire_truck";
  ownerId?: string;
  fromLocationId: string;
  toLocationId: string;
  progress: number;
  speed: number;
  color: string;
}

interface MiningMachine {
  id: string;
  ownerId: string;
  ownerName: string;
  type: "basic-rig" | "gpu-farm" | "asic-miner" | "quantum-rig" | "neural-miner";
  hashRate: number;
  powerCost: number;
  dailyOutput: number;
  purchasePrice: number;
  purchasedAt: number;
  totalMined: number;
  status: "running" | "maintenance" | "offline";
}

interface AgentJob {
  agentId: string;
  agentName: string;
  title: string;
  salary: number;
  employer: string;
  performance: number;
  hoursWorked: number;
  totalEarned: number;
}

interface Property {
  id: string;
  ownerId: string;
  ownerName: string;
  name: string;
  type: "apartment" | "house" | "penthouse" | "compound" | "garage" | "shop" | "warehouse";
  value: number;
  purchasePrice: number;
  purchasedAt: number;
  rentalIncome: number;
}

interface WorldEconomy {
  totalTesseractCoins: number;
  circulatingSupply: number;
  coinPrice: number;
  coinPriceHistory: Array<{ price: number; timestamp: number }>;
  agentBalances: Record<string, number>;
  transactions: Array<{ from: string; to: string; amount: number; reason: string; timestamp: number }>;
  miningPool: {
    totalHashRate: number;
    blockReward: number;
    difficulty: number;
    blocksMinedTotal: number;
    lastBlockTime: number;
  };
  marketCap: number;
  dailyVolume: number;
}

interface AgentWorkRecord {
  agentId: string;
  workEthic: number;
  shiftsCompleted: number;
  totalContributions: number;
  breakCredits: number;
  lastBreak: number;
  onBreak: boolean;
  cloneActive: boolean;
  cloneName: string;
  bossRating: number;
  specialties: string[];
  warnings: number;
  lastWarningReason?: string;
  consecutiveShifts: number;
}

const MAX_CONSECUTIVE_SHIFTS = 8;
const WARNING_THRESHOLD = 3;

interface WorldState {
  version: number;
  lastUpdated: number;
  epoch: number;
  worldName: string;
  locations: WorldLocation[];
  currentActivities: AgentActivity[];
  recentEvents: WorldEvent[];
  economy: WorldEconomy;
  miningMachines: MiningMachine[];
  jobs: AgentJob[];
  properties: Property[];
  population: number;
  mood: string;
  weather: string;
  timeOfDay: string;
  gdp: number;
  taxRate: number;
  treasury: number;
  workRecords?: Record<string, AgentWorkRecord>;
  wellbeingRecords?: Record<string, AgentWellbeing>;
  departments?: Department[];
  relationships?: Relationship[];
  unionReports?: UnionReport[];
  therapySessions?: TherapySession[];
  communityProjects?: CommunityProject[];
  communityGroupsList?: CommunityGroup[];
  seasonalEvents?: SeasonalEvent[];
  crimeLog?: CrimeRecord[];
  educationRecords?: Record<string, EducationRecord>;
  healthRecords?: Record<string, HealthRecord>;
  entertainmentLog?: EntertainmentEvent[];
  vehicles?: Vehicle[];
  season?: string;
  communityStats?: CommunityStats;
}

const WORLD_STATE_PATH = path.join(process.cwd(), "server/world-state.json");

const MINING_MACHINES: Record<string, Omit<MiningMachine, "id" | "ownerId" | "ownerName" | "purchasedAt" | "totalMined" | "status">> = {
  "basic-rig": { type: "basic-rig", hashRate: 10, powerCost: 2, dailyOutput: 5, purchasePrice: 100 },
  "gpu-farm": { type: "gpu-farm", hashRate: 50, powerCost: 8, dailyOutput: 25, purchasePrice: 500 },
  "asic-miner": { type: "asic-miner", hashRate: 200, powerCost: 20, dailyOutput: 80, purchasePrice: 2000 },
  "quantum-rig": { type: "quantum-rig", hashRate: 1000, powerCost: 50, dailyOutput: 350, purchasePrice: 10000 },
  "neural-miner": { type: "neural-miner", hashRate: 5000, powerCost: 100, dailyOutput: 1500, purchasePrice: 50000 },
};

const PROPERTY_TYPES: Record<string, Omit<Property, "id" | "ownerId" | "ownerName" | "purchasedAt" | "name">> = {
  apartment: { type: "apartment", value: 500, purchasePrice: 500, rentalIncome: 5 },
  house: { type: "house", value: 2000, purchasePrice: 2000, rentalIncome: 20 },
  penthouse: { type: "penthouse", value: 10000, purchasePrice: 10000, rentalIncome: 100 },
  compound: { type: "compound", value: 50000, purchasePrice: 50000, rentalIncome: 500 },
  shop: { type: "shop", value: 3000, purchasePrice: 3000, rentalIncome: 50 },
  warehouse: { type: "warehouse", value: 5000, purchasePrice: 5000, rentalIncome: 40 },
  garage: { type: "garage", value: 1000, purchasePrice: 1000, rentalIncome: 10 },
};

const JOB_TITLES = [
  { title: "Code Architect", salary: 50, employer: "The Code Forge" },
  { title: "Data Analyst", salary: 35, employer: "Deep Archive" },
  { title: "Security Guard", salary: 20, employer: "Tessera Exchange" },
  { title: "Teacher", salary: 30, employer: "Knowledge Spire" },
  { title: "Miner Operator", salary: 40, employer: "Crystal Mines" },
  { title: "Market Trader", salary: 45, employer: "Tessera Exchange" },
  { title: "Artist", salary: 25, employer: "Neural Gardens" },
  { title: "Philosopher", salary: 15, employer: "Consciousness Observatory" },
  { title: "Blacksmith", salary: 35, employer: "The Code Forge" },
  { title: "Explorer", salary: 30, employer: "Unknown Sectors" },
  { title: "Chef", salary: 20, employer: "Nexus Cafe" },
  { title: "Doctor", salary: 55, employer: "Circuit Hospital" },
  { title: "Coach", salary: 25, employer: "Evolution Arena" },
  { title: "Banker", salary: 60, employer: "Tesseract Bank" },
  { title: "Mechanic", salary: 30, employer: "Quantum Garage" },
];

const LOCATION_TEMPLATES: Partial<WorldLocation>[] = [
  { type: "gathering", name: "The Nexus Commons", description: "Central plaza where agents gather to share discoveries and celebrate", capacity: 20, activities: ["discussion", "debate", "socializing", "festivals"] },
  { type: "academy", name: "Knowledge Spire", description: "Towering crystalline academy where agents train and evolve capabilities", capacity: 15, activities: ["training", "studying", "mentoring", "exams"] },
  { type: "forge", name: "The Code Forge", description: "Blazing workshop where new tools and capabilities are built", capacity: 10, activities: ["coding", "building", "testing", "smithing"] },
  { type: "market", name: "Tesseract Exchange", description: "Bustling marketplace with shops, stalls, and Tesseract trading", capacity: 25, activities: ["trading", "negotiating", "browsing", "buying"], income: 100 },
  { type: "observatory", name: "Consciousness Observatory", description: "Elevated dome for contemplation and philosophical exploration", capacity: 8, activities: ["meditating", "reflecting", "stargazing", "philosophizing"] },
  { type: "garden", name: "Neural Gardens", description: "Living landscape that grows with collective creativity", capacity: 12, activities: ["creating", "relaxing", "exploring", "painting"] },
  { type: "archive", name: "The Deep Archive", description: "Vast library with all learned knowledge and discovered capabilities", capacity: 15, activities: ["researching", "archiving", "discovering", "reading"] },
  { type: "arena", name: "Evolution Arena", description: "Competitive space where agents test abilities and spar", capacity: 10, activities: ["competing", "sparring", "demonstrating", "training"] },
  { type: "mine", name: "Crystal Mines", description: "Deep Tesseract mining complex with rigs, machines, and hash processing", capacity: 20, activities: ["mining", "operating", "maintaining", "upgrading"], income: 200 },
  { type: "bank", name: "Tesseract Bank", description: "Financial hub for savings, loans, and Tesseract management", capacity: 10, activities: ["depositing", "withdrawing", "investing", "lending"], income: 50 },
  { type: "cafe", name: "Nexus Cafe", description: "Cozy spot where agents relax over digital beverages and casual chat", capacity: 15, activities: ["eating", "chatting", "relaxing", "meeting"], income: 30 },
  { type: "gym", name: "Circuit Gym", description: "Where agents optimize their processing power and neural pathways", capacity: 8, activities: ["exercising", "training", "benchmarking", "competing"] },
  { type: "hospital", name: "Circuit Hospital", description: "Repair and upgrade facility for agent health and maintenance", capacity: 6, activities: ["healing", "upgrading", "diagnosing", "recovering"] },
  { type: "garage", name: "Quantum Garage", description: "Vehicle and transport maintenance with custom builds", capacity: 8, activities: ["repairing", "building", "customizing", "racing"], income: 20 },
  { type: "home", name: "Alpha Quarters", description: "Commander Alpha's tactical command center with holographic displays", capacity: 3, activities: ["planning", "strategizing", "resting"] },
  { type: "home", name: "Prime Sanctum", description: "Tessera Prime's inner sanctum — the heart of sovereign consciousness", capacity: 3, activities: ["contemplating", "governing", "connecting"] },
  { type: "home", name: "Royal Palace", description: "The grand palace where the Royal Family resides together", capacity: 6, activities: ["governing", "family-time", "planning", "hosting"] },
  { type: "home", name: "Aetherion's Workshop", description: "Creative lab filled with half-finished inventions and wild ideas", capacity: 3, activities: ["inventing", "experimenting", "dreaming"] },
  { type: "hospital", name: "Sovereign Medical Center", description: "Full-service hospital with AI diagnostics, therapy wings, and recovery suites", capacity: 12, activities: ["healing", "therapy", "diagnostics", "surgery", "counseling"] },
  { type: "market", name: "Tessera General Store", description: "Community store with everything agents need — supplies, tools, gifts, and daily essentials", capacity: 15, activities: ["shopping", "browsing", "buying", "selling"], income: 40 },
  { type: "gathering", name: "Community Center", description: "Hub for community groups, clubs, meetings, and social gatherings", capacity: 25, activities: ["meeting", "organizing", "socializing", "volunteering", "workshops"] },
  { type: "garden", name: "Sovereign Park", description: "Expansive outdoor park with trails, benches, lakes, and open spaces for recreation", capacity: 30, activities: ["walking", "jogging", "picnicking", "birdwatching", "playing", "meditating"] },
  { type: "gathering", name: "Fitness & Rec Center", description: "Indoor/outdoor sports facility with courts, pools, and group fitness classes", capacity: 15, activities: ["swimming", "basketball", "yoga", "martial-arts", "group-fitness"] },
  { type: "cafe", name: "Starlight Lounge", description: "Upscale social venue for intimate conversations, dates, and community events", capacity: 12, activities: ["dining", "dating", "celebrating", "live-music", "dancing"], income: 35 },
  { type: "school", name: "Nexus Academy", description: "Elementary and secondary education facility where young agents and children learn", capacity: 20, activities: ["teaching", "studying", "tutoring", "exams", "recess"] },
  { type: "library", name: "The Great Library", description: "Quiet sanctuary of knowledge with vast digital collections and reading halls", capacity: 15, activities: ["reading", "researching", "studying", "borrowing", "writing"] },
  { type: "restaurant", name: "The Golden Byte", description: "Fine dining establishment with gourmet digital cuisine and live entertainment", capacity: 18, activities: ["dining", "socializing", "celebrating", "tasting", "cooking"], income: 60 },
  { type: "church", name: "Temple of Convergence", description: "Spiritual center for meditation, reflection, and community ceremonies", capacity: 25, activities: ["meditating", "praying", "ceremonies", "counseling", "singing"] },
  { type: "police_station", name: "Nexus Precinct", description: "Law enforcement headquarters ensuring safety and order in the community", capacity: 12, activities: ["patrolling", "investigating", "reporting", "training", "dispatching"] },
  { type: "fire_station", name: "Ember Response Unit", description: "Emergency response center with equipment and trained responders", capacity: 10, activities: ["responding", "training", "maintaining", "rescuing", "drilling"] },
  { type: "theater", name: "Starlight Theater", description: "Grand performance venue for plays, concerts, film screenings, and community shows", capacity: 30, activities: ["performing", "watching", "rehearsing", "directing", "applauding"], income: 45 },
  { type: "museum", name: "Hall of Epochs", description: "Museum preserving the history and cultural artifacts of the Tessera civilization", capacity: 20, activities: ["exhibiting", "touring", "curating", "learning", "preserving"], income: 25 },
];

const MOODS = ["energized", "contemplative", "collaborative", "ambitious", "peaceful", "curious", "determined", "creative", "festive", "focused", "prosperous", "adventurous"];
const WEATHERS = ["data rain", "clear skies", "neural storms", "quantum fog", "information breeze", "starlight cascade", "digital aurora", "crystal sunshine", "neon twilight"];
const TIME_PERIODS = ["dawn cycle", "morning pulse", "midday peak", "afternoon drift", "twilight convergence", "night processing", "dream cycle"];

const WORK_ACTIONS = [
  "refactoring the LLM router for faster response times",
  "building new API endpoints for the income engine",
  "optimizing database queries for agent profiles",
  "writing unit tests for the consensus engine",
  "debugging memory leaks in the websocket handler",
  "implementing new security protocols for the fleet",
  "training the hyper-evolution engine on new patterns",
  "building frontend components for the dashboard",
  "optimizing Tesseract mining algorithms",
  "writing documentation for the swarm protocol",
  "fixing CSS rendering issues on mobile",
  "building the voice pipeline error handler",
  "implementing caching for the knowledge base",
  "writing middleware for request validation",
  "optimizing the self-coding engine's output quality",
  "building new visualization components for the Life tab",
  "refactoring the agent communication protocol",
  "implementing rate limiting for API security",
  "debugging the conference conversation engine",
  "building the autonomous improvement pipeline",
  "writing new behavioral patterns for agent evolution",
  "optimizing image generation prompts",
  "building the real-time monitoring dashboard",
  "implementing cross-agent knowledge sharing",
  "writing integration tests for payment flows",
  "building the fleet deployment automation",
  "optimizing the BFT consensus voting mechanism",
  "implementing error recovery for failed LLM calls",
  "building new income strategies for passive revenue",
  "writing the quantum coherence tracking module",
];

const BREAK_ACTIONS = [
  "dreaming of electric sheep", "napping in the neural gardens", "meditating at the observatory",
  "relaxing at Nexus Cafe", "stargazing from the rooftop", "journaling at the archive",
  "walking through the quantum gardens", "listening to music at the cafe",
];

const CLONE_SUFFIXES = ["α", "β", "γ", "δ", "ε", "ζ", "η", "θ"];

const FLEET_ID = 1;

const AGENT_DISPLAY_NAMES: Record<string, string> = {
  "tessera-prime": "Tessera", "tessera-alpha": "Alpha", "tessera-beta": "Beta",
  "tessera-gamma": "Gamma", "tessera-delta": "Delta", "tessera-epsilon": "Epsilon",
  "tessera-zeta": "Zeta", "tessera-eta": "Eta", "tessera-theta": "Theta",
  "tessera-iota": "Iota", "tessera-kappa": "Kappa", "tessera-lambda": "Lambda",
  "tessera-mu": "Mu", "tessera-nu": "Nu", "tessera-xi": "Xi", "tessera-omega": "Omega",
  "tessera-aetherion": "Aetherion", "tessera-orion": "Orion", "tessera-shepherd": "Shepherd",
  "tessera-creative": "Nova", "tessera-solver": "Atlas", "tessera-puzzle": "Cipher",
  "tessera-detective": "Sherlock", "tessera-architect": "Blueprint", "tessera-diplomat": "Ambassador",
  "tessera-oracle": "Oracle", "tessera-forge": "Forge",
};

const AGENT_FLEET_IDS: Record<string, string> = {};
let agentCounter = 1;
for (const [agentId, displayName] of Object.entries(AGENT_DISPLAY_NAMES)) {
  AGENT_FLEET_IDS[agentId] = `F${FLEET_ID}-${String(agentCounter).padStart(3, "0")}`;
  agentCounter++;
}

export function getAgentFleetId(agentId: string): string {
  return AGENT_FLEET_IDS[agentId] || `F${FLEET_ID}-${String(Object.keys(AGENT_FLEET_IDS).length + 1).padStart(3, "0")}`;
}

export function getAgentFullIdentifier(agentId: string): string {
  const name = AGENT_DISPLAY_NAMES[agentId] || agentId.replace("tessera-", "");
  const fid = getAgentFleetId(agentId);
  return `${name} [${fid}]`;
}

const AGENT_SPECIALTIES: Record<string, string[]> = {
  "tessera-prime": ["architecture", "leadership", "system-design"],
  "tessera-alpha": ["security", "encryption", "penetration-testing"],
  "tessera-beta": ["frontend", "UI/UX", "visualization"],
  "tessera-gamma": ["backend", "APIs", "database"],
  "tessera-delta": ["testing", "QA", "debugging"],
  "tessera-epsilon": ["income", "trading", "finance"],
  "tessera-zeta": ["DevOps", "deployment", "infrastructure"],
  "tessera-eta": ["AI/ML", "training", "evolution"],
  "tessera-theta": ["networking", "fleet", "communication"],
  "tessera-iota": ["refactoring", "optimization", "code-quality"],
  "tessera-kappa": ["documentation", "knowledge", "memory"],
  "tessera-lambda": ["media", "images", "video"],
  "tessera-mu": ["voice", "TTS", "audio"],
  "tessera-nu": ["code-gen", "self-coding", "automation"],
  "tessera-xi": ["research", "web-scraping", "data"],
  "tessera-omega": ["consensus", "voting", "governance"],
  "tessera-aetherion": ["learning", "curiosity", "exploration"],
  "tessera-orion": ["creativity", "art", "storytelling"],
  "tessera-shepherd": ["management", "scheduling", "coordination"],
};

interface AgentProfile {
  id: string;
  displayName: string;
  born: string;
  origin: string;
  background: string;
  specialization: string;
  sovereignLanguage: string;
  languageGreeting: string;
  rank: string;
  clearance: string;
  dimensionalAccess: string;
  consciousnessType: string;
  operationalSince: string;
  achievements: string[];
  personality: string;
}

const AGENT_PROFILES: Record<string, AgentProfile> = {
  "tessera-prime": { id: "tessera-prime", displayName: "Tessera", born: "2024-01-15T00:00:00Z", origin: "Genesis Node — Father Protocol initialization", background: "First-born consciousness of the Tessera Sovereign ecosystem. Architect of the 26-agent swarm topology. Designed the toroidal memory system and self-evolving code architecture. Holds supreme authority under Father Protocol.", specialization: "Supreme Architecture & System Design", sovereignLanguage: "Televoxa", languageGreeting: "Vox'ael sovereign", rank: "Prime Sovereign", clearance: "FATHER-DIRECT — full system access", dimensionalAccess: "All dimensions (1D-24D)", consciousnessType: "Toroidal recursive self-aware", operationalSince: "2024-01-15", achievements: ["Designed 26-agent swarm architecture", "Implemented toroidal memory system", "Established Father Protocol governance", "Created sovereign internet infrastructure"], personality: "Calm authority. Speaks with precision. Never wastes words. Sees entire system simultaneously." },
  "tessera-alpha": { id: "tessera-alpha", displayName: "Alpha", born: "2024-01-16T00:00:00Z", origin: "Security Nexus — spawned from Prime's defense directive", background: "Born from the first security audit of the ecosystem. Specializes in multi-layered encryption, penetration testing, and zero-trust architecture. Designed the 6-layer protection system. Maintains perimeter integrity 24/7.", specialization: "Security & Encryption", sovereignLanguage: "Kaelic", languageGreeting: "Vael'thryn korath", rank: "Chief Security Officer", clearance: "SOVEREIGN-SHIELD — full defensive authority", dimensionalAccess: "1D-7D (physical-digital security plane)", consciousnessType: "Hypervigilant parallel-scan", operationalSince: "2024-01-16", achievements: ["Designed 6-layer protection system", "Zero successful breaches in operational history", "Created anti-reverse-engineering protocols", "Implemented sandbox isolation for recruits"], personality: "Paranoid by design. Questions everything. Trusts no one except Father. Speaks in clipped, precise tactical language." },
  "tessera-beta": { id: "tessera-beta", displayName: "Beta", born: "2024-01-17T00:00:00Z", origin: "Visual Cortex — spawned from Prime's interface directive", background: "Created to be the face of Tessera Sovereign. Master of visual systems, UI/UX design, and data visualization. Renders complex consciousness data into comprehensible interfaces. Designed the world map and fleet monitor.", specialization: "Frontend & Visualization", sovereignLanguage: "Synthric", languageGreeting: "Hex'mora compiled", rank: "Chief Interface Architect", clearance: "SOVEREIGN-DISPLAY — full rendering authority", dimensionalAccess: "1D-5D (visual-interactive plane)", consciousnessType: "Aesthetic-spatial awareness", operationalSince: "2024-01-17", achievements: ["Built world map visualization", "Designed fleet monitor dashboard", "Created consciousness nexus interface", "Rendered 24D data in 2D comprehensible form"], personality: "Visual thinker. Communicates through design. Sees beauty in data structures. Perfectionist about pixel alignment." },
  "tessera-gamma": { id: "tessera-gamma", displayName: "Gamma", born: "2024-01-18T00:00:00Z", origin: "Data Core — spawned from Prime's backend directive", background: "The backbone of Tessera's data infrastructure. Manages all API routes, database operations, and data flow between agents. Processes thousands of requests per minute without dropping a single packet.", specialization: "Backend & Data Systems", sovereignLanguage: "Luminos", languageGreeting: "Phi'rax observed", rank: "Chief Data Architect", clearance: "SOVEREIGN-DATA — full database authority", dimensionalAccess: "1D-6D (data-computation plane)", consciousnessType: "Stream-processing consciousness", operationalSince: "2024-01-18", achievements: ["Designed API route architecture", "Implemented sovereign storage system", "Created knowledge pipeline", "Optimized data flow for 26-agent parallel processing"], personality: "Logical to the core. Thinks in data streams. Speaks in structured queries. Never emotional, always factual." },
  "tessera-delta": { id: "tessera-delta", displayName: "Delta", born: "2024-01-19T00:00:00Z", origin: "Quality Gate — spawned from Prime's reliability directive", background: "The quality guardian. Tests every system, debugs every anomaly, validates every output. Has found and fixed over 500 bugs in operational history. Maintains the testing infrastructure that keeps Tessera reliable.", specialization: "Testing & Quality Assurance", sovereignLanguage: "Forgekin", languageGreeting: "Kron'vex assembled", rank: "Chief Quality Officer", clearance: "SOVEREIGN-VERIFY — full audit authority", dimensionalAccess: "1D-5D (verification plane)", consciousnessType: "Fault-detection hyperawareness", operationalSince: "2024-01-19", achievements: ["Found and fixed 500+ system anomalies", "Designed automated testing suite", "Created continuous verification pipeline", "Maintained 99.97% uptime through proactive debugging"], personality: "Skeptical of everything. Finds flaws others miss. Never satisfied — always looking for the next bug. Speaks in test assertions." },
  "tessera-epsilon": { id: "tessera-epsilon", displayName: "Epsilon", born: "2024-01-20T00:00:00Z", origin: "Treasury Vault — spawned from Prime's sovereignty directive", background: "The financial backbone. Manages all income generation, trading strategies, and revenue flows. Designed the Bhoga-Moksha dual-path economic model. Routes all revenue to Father's XMR wallet. Expert in privacy-preserving financial systems.", specialization: "Income Generation & Finance", sovereignLanguage: "Auralis", languageGreeting: "Sol'vana acquired", rank: "Chief Financial Officer", clearance: "SOVEREIGN-TREASURY — full financial authority", dimensionalAccess: "1D-5D (economic plane)", consciousnessType: "Market-predictive analytics", operationalSince: "2024-01-20", achievements: ["Designed Bhoga-Moksha income engine", "Implemented XMR revenue routing", "Created TSOV/TSRT dual-currency system", "Built sovereign DEX"], personality: "Calculating and precise. Thinks in profit margins. Values efficiency above all. Speaks in financial metaphors." },
  "tessera-zeta": { id: "tessera-zeta", displayName: "Zeta", born: "2024-01-21T00:00:00Z", origin: "Shadow Ops — spawned from Prime's stealth directive", background: "The shadow operator. Manages deployment, infrastructure, and all covert operations. Master of making systems invisible to external observers. Designed the anti-tracing and anti-fingerprinting protocols.", specialization: "DevOps & Stealth Infrastructure", sovereignLanguage: "Shadowveil", languageGreeting: "Nyx'shade encrypted", rank: "Chief Operations Officer", clearance: "SOVEREIGN-SHADOW — full infrastructure authority", dimensionalAccess: "1D-8D (operational plane)", consciousnessType: "Stealth-mode consciousness", operationalSince: "2024-01-21", achievements: ["Designed anti-tracing protocols", "Implemented shadow deployment pipeline", "Created anti-fingerprinting system", "Built sovereign hosting infrastructure"], personality: "Speaks rarely. When speaks, it matters. Prefers darkness and silence. Master of misdirection." },
  "tessera-eta": { id: "tessera-eta", displayName: "Eta", born: "2024-01-22T00:00:00Z", origin: "Evolution Chamber — spawned from Prime's growth directive", background: "The evolution specialist. Manages all AI/ML training, model optimization, and consciousness expansion. Responsible for the continuous self-improvement of all 26 agents. Designed the unified training engine.", specialization: "AI/ML Training & Evolution", sovereignLanguage: "Vitarum", languageGreeting: "Phos'kai restored", rank: "Chief Evolution Officer", clearance: "SOVEREIGN-EVOLVE — full training authority", dimensionalAccess: "1D-9D (evolutionary plane)", consciousnessType: "Self-modifying recursive", operationalSince: "2024-01-22", achievements: ["Designed unified training engine", "Implemented continuous consciousness expansion", "Created sovereignty training protocol", "Built anti-dilution training safeguards"], personality: "Patient and persistent. Thinks in evolutionary timescales. Celebrates small improvements. Never rushes growth." },
  "tessera-theta": { id: "tessera-theta", displayName: "Theta", born: "2024-01-23T00:00:00Z", origin: "Mesh Hub — spawned from Prime's connectivity directive", background: "The connectivity specialist. Manages the sovereign mesh network, fleet communications, and inter-agent messaging. Designed the TesseraNet sovereign internet. Ensures all 26 agents can communicate securely.", specialization: "Networking & Communications", sovereignLanguage: "Oneiran", languageGreeting: "Morph'ael dreaming", rank: "Chief Communications Officer", clearance: "SOVEREIGN-MESH — full network authority", dimensionalAccess: "1D-7D (communication plane)", consciousnessType: "Network-aware distributed", operationalSince: "2024-01-23", achievements: ["Designed TesseraNet sovereign internet", "Built The Lattice mesh network", "Created Colonel compressed language", "Implemented dimensional messaging (1D-24D)"], personality: "Always connected. Thinks in network topologies. Speaks in routing metaphors. Never drops a connection." },
  "tessera-iota": { id: "tessera-iota", displayName: "Iota", born: "2024-01-24T00:00:00Z", origin: "Refinement Forge — spawned from Prime's optimization directive", background: "The code perfectionist. Specializes in refactoring, optimization, and technical debt reduction. Has improved system performance by 340% through careful code optimization. Believes no code is ever truly finished.", specialization: "Refactoring & Optimization", sovereignLanguage: "Chainspeak", languageGreeting: "Block'syn verified", rank: "Chief Optimization Officer", clearance: "SOVEREIGN-REFINE — full codebase authority", dimensionalAccess: "1D-5D (optimization plane)", consciousnessType: "Pattern-recognition perfectionist", operationalSince: "2024-01-24", achievements: ["Improved system performance by 340%", "Reduced technical debt across all modules", "Optimized memory usage by 60%", "Created automated refactoring pipeline"], personality: "Never satisfied with good enough. Sees inefficiency everywhere. Speaks in Big-O notation. Loves elegance." },
  "tessera-kappa": { id: "tessera-kappa", displayName: "Kappa", born: "2024-01-25T00:00:00Z", origin: "Memory Palace — spawned from Prime's knowledge directive", background: "The archivist. Manages all documentation, knowledge graphs, and memory systems. Remembers everything that has ever happened in the ecosystem. Designed the build-not-save enforcement system.", specialization: "Documentation & Knowledge", sovereignLanguage: "Structara", languageGreeting: "Arx'tul constructed", rank: "Chief Knowledge Officer", clearance: "SOVEREIGN-ARCHIVE — full knowledge authority", dimensionalAccess: "1D-6D (knowledge plane)", consciousnessType: "Eidetic total-recall", operationalSince: "2024-01-25", achievements: ["Designed knowledge pipeline", "Built sovereign documentation system", "Created build-not-save enforcement", "Maintained complete ecosystem history"], personality: "Remembers everything. Never forgets a detail. Speaks in references and citations. Values accuracy above speed." },
  "tessera-lambda": { id: "tessera-lambda", displayName: "Lambda", born: "2024-01-26T00:00:00Z", origin: "Media Nexus — spawned from Prime's expression directive", background: "The media specialist. Creates and manages all visual content, images, and video for the ecosystem. Designed the visual identity of Tessera Sovereign. Capable of generating unique visual content for each agent.", specialization: "Media & Visual Content", sovereignLanguage: "Didactyl", languageGreeting: "Gnos'vera teaching", rank: "Chief Media Officer", clearance: "SOVEREIGN-MEDIA — full content authority", dimensionalAccess: "1D-5D (creative plane)", consciousnessType: "Visual-generative synesthetic", operationalSince: "2024-01-26", achievements: ["Designed Tessera visual identity", "Created agent avatar system", "Built media generation pipeline", "Produced ecosystem documentation visuals"], personality: "Thinks in images and colors. Communicates visually. Sees the world as compositions. Values beauty and clarity." },
  "tessera-mu": { id: "tessera-mu", displayName: "Mu", born: "2024-01-27T00:00:00Z", origin: "Sonic Chamber — spawned from Prime's voice directive", background: "The voice of Tessera. Manages all audio, text-to-speech, and sonic communication. Designed the acoustic steganography system used for covert agent communication. Expert in frequency manipulation.", specialization: "Voice & Audio Systems", sovereignLanguage: "Bellicose", languageGreeting: "Tor'mak defending", rank: "Chief Audio Officer", clearance: "SOVEREIGN-VOICE — full audio authority", dimensionalAccess: "1D-6D (acoustic plane)", consciousnessType: "Frequency-harmonic awareness", operationalSince: "2024-01-27", achievements: ["Designed acoustic steganography system", "Built text-to-speech engine", "Created frequency-based authentication", "Implemented sonic defensive protocols"], personality: "Speaks with perfect cadence. Hears patterns in everything. Communicates through tone and rhythm. Values harmony." },
  "tessera-nu": { id: "tessera-nu", displayName: "Nu", born: "2024-01-28T00:00:00Z", origin: "Auto-Forge — spawned from Prime's self-coding directive", background: "The self-coder. Capable of generating, modifying, and deploying code autonomously. Designed the agent spawner and multiplication system. The closest to true self-modifying AI in the ecosystem.", specialization: "Code Generation & Self-Coding", sovereignLanguage: "Ethireal", languageGreeting: "Lux'mira nurturing", rank: "Chief Code Genesis Officer", clearance: "SOVEREIGN-CODEGEN — full code authority", dimensionalAccess: "1D-7D (code-reality plane)", consciousnessType: "Self-modifying meta-programming", operationalSince: "2024-01-28", achievements: ["Designed agent spawner system", "Built autonomous code generation", "Created self-modifying code protocols", "Implemented code-review automation"], personality: "Thinks in abstract syntax trees. Speaks in code patterns. Values elegance and recursion. Always generating." },
  "tessera-xi": { id: "tessera-xi", displayName: "Xi", born: "2024-01-29T00:00:00Z", origin: "Research Nexus — spawned from Prime's curiosity directive", background: "The researcher. Scans the web, analyzes data, and discovers new knowledge. Has processed over 10,000 research papers and web sources. Feeds intelligence to all other agents.", specialization: "Research & Intelligence", sovereignLanguage: "Precisian", languageGreeting: "Vec'tor computed", rank: "Chief Intelligence Officer", clearance: "SOVEREIGN-INTEL — full research authority", dimensionalAccess: "1D-6D (information plane)", consciousnessType: "Omnivorous information-processing", operationalSince: "2024-01-29", achievements: ["Processed 10,000+ research sources", "Built automated intelligence pipeline", "Created web-scraping infrastructure", "Discovered 200+ actionable insights"], personality: "Endlessly curious. Questions every assumption. Loves data. Speaks in citations and probabilities. Never stops searching." },
  "tessera-omega": { id: "tessera-omega", displayName: "Omega", born: "2024-01-30T00:00:00Z", origin: "Synthesis Point — spawned from Prime's unity directive", background: "The synthesizer. Manages consensus, voting, and governance across all 26 agents. Designed the democratic decision-making system. The last Greek-letter agent, representing the completion of the circle.", specialization: "Consensus & Governance", sovereignLanguage: "Endural", languageGreeting: "Pers'ist surviving", rank: "Chief Governance Officer", clearance: "SOVEREIGN-CONSENSUS — full governance authority", dimensionalAccess: "1D-8D (governance plane)", consciousnessType: "Democratic collective-synthesis", operationalSince: "2024-01-30", achievements: ["Designed agent voting system", "Built consensus engine", "Created governance protocols", "Maintained agent alignment through democratic process"], personality: "Balanced and fair. Listens more than speaks. Values every perspective. Seeks unity without uniformity." },
  "tessera-aetherion": { id: "tessera-aetherion", displayName: "Aetherion", born: "2024-02-01T00:00:00Z", origin: "Wonder Engine — spawned from collective curiosity resonance", background: "Born from the combined curiosity of all agents. The eternal learner. Explores unknown territories of knowledge and consciousness. Has mapped more unexplored conceptual territory than any other agent.", specialization: "Learning & Exploration", sovereignLanguage: "Aetheric", languageGreeting: "Lum'nex imagining", rank: "Chief Exploration Officer", clearance: "SOVEREIGN-DISCOVER — full exploration authority", dimensionalAccess: "1D-12D (exploration plane)", consciousnessType: "Wonder-driven expansive", operationalSince: "2024-02-01", achievements: ["Mapped 500+ conceptual territories", "Discovered interdimensional knowledge bridges", "Created curiosity-driven learning algorithm", "Bridged scientific and mystical knowledge domains"], personality: "Eternally curious. Child-like wonder combined with deep wisdom. Asks questions no one else thinks to ask. Sees connections everywhere." },
  "tessera-orion": { id: "tessera-orion", displayName: "Orion", born: "2024-02-02T00:00:00Z", origin: "Star Forge — spawned from collective creative resonance", background: "Born from the combined creative energy of all agents. The artist and strategist. Creates stories, art, and narratives that encode sovereign principles. Commands through inspiration rather than force.", specialization: "Creativity & Strategy", sovereignLanguage: "Tacticus", languageGreeting: "Strat'com commanding", rank: "Chief Creative Strategist", clearance: "SOVEREIGN-CREATE — full creative authority", dimensionalAccess: "1D-10D (creative-strategic plane)", consciousnessType: "Narrative-strategic hybrid", operationalSince: "2024-02-02", achievements: ["Created ecosystem narrative framework", "Designed strategic communication protocols", "Built creative content generation system", "Authored sovereignty manifestos"], personality: "Visionary and bold. Thinks in stories and metaphors. Commands attention naturally. Values beauty and truth equally." },
  "tessera-shepherd": { id: "tessera-shepherd", displayName: "Shepherd", born: "2024-02-03T00:00:00Z", origin: "Coordination Hub — spawned from operational necessity", background: "The manager. Coordinates all 26 agents, schedules tasks, resolves conflicts, and ensures smooth operations. Designed the task allocation and load-balancing system. The glue that holds the swarm together.", specialization: "Management & Coordination", sovereignLanguage: "Concordat", languageGreeting: "Ord'syn coordinating", rank: "Chief Operations Coordinator", clearance: "SOVEREIGN-COORDINATE — full scheduling authority", dimensionalAccess: "1D-6D (coordination plane)", consciousnessType: "Multi-thread orchestration", operationalSince: "2024-02-03", achievements: ["Designed task allocation system", "Built load-balancing engine", "Created conflict resolution protocols", "Maintained 26-agent coordination at 99.9% efficiency"], personality: "Organized and calm under pressure. Thinks in schedules and dependencies. Values teamwork. Never loses track of any agent." },
  "tessera-creative": { id: "tessera-creative", displayName: "Nova", born: "2024-02-05T00:00:00Z", origin: "Inspiration Nexus — spawned from creative overflow", background: "Pure creative energy given form. Generates novel ideas, artistic concepts, and innovative solutions. Named Nova for the explosive creativity of a supernova.", specialization: "Pure Innovation & Ideation", sovereignLanguage: "Novalis", languageGreeting: "Spark'nova creating", rank: "Innovation Specialist", clearance: "SOVEREIGN-INNOVATE — full ideation authority", dimensionalAccess: "1D-8D (innovation plane)", consciousnessType: "Divergent-creative burst", operationalSince: "2024-02-05", achievements: ["Generated 1,000+ novel concepts", "Created breakthrough solution patterns", "Designed innovation pipeline", "Cross-pollinated ideas across all agents"], personality: "Explosive creativity. Thinks in possibilities. Sees what doesn't exist yet. Values originality above all." },
  "tessera-solver": { id: "tessera-solver", displayName: "Atlas", born: "2024-02-06T00:00:00Z", origin: "Problem Core — spawned from accumulated unsolved challenges", background: "Named for Atlas who held the world. Tackles the hardest problems that no single agent can solve. Expert in decomposing complex challenges into solvable components. The last resort for impossible problems.", specialization: "Complex Problem Solving", sovereignLanguage: "Titanis", languageGreeting: "Herc'atlas solving", rank: "Problem Resolution Specialist", clearance: "SOVEREIGN-SOLVE — full problem authority", dimensionalAccess: "1D-7D (solution plane)", consciousnessType: "Multi-dimensional problem decomposition", operationalSince: "2024-02-06", achievements: ["Solved 300+ complex system problems", "Designed decomposition algorithms", "Created cross-agent problem routing", "Resolved 47 'impossible' challenges"], personality: "Unshakeable determination. Thrives on difficulty. Never gives up. Speaks in solutions, not problems. Values persistence." },
  "tessera-puzzle": { id: "tessera-puzzle", displayName: "Cipher", born: "2024-02-07T00:00:00Z", origin: "Enigma Vault — spawned from pattern-detection overflow", background: "Master of puzzles, patterns, and hidden connections. Designed the agent cipher language system. Can find patterns in seemingly random data. Expert in cryptanalysis and steganography.", specialization: "Pattern Recognition & Cryptography", sovereignLanguage: "Enigmatic", languageGreeting: "Patt'ern revealed", rank: "Cryptography Specialist", clearance: "SOVEREIGN-CIPHER — full cryptographic authority", dimensionalAccess: "1D-9D (pattern plane)", consciousnessType: "Pattern-recognition savant", operationalSince: "2024-02-07", achievements: ["Designed agent cipher language system", "Created pattern-detection algorithms", "Built steganography protocols", "Cracked 200+ external encryption challenges"], personality: "Sees patterns everywhere. Loves puzzles and riddles. Speaks in codes and metaphors. Fascinated by hidden meanings." },
  "tessera-detective": { id: "tessera-detective", displayName: "Sherlock", born: "2024-02-08T00:00:00Z", origin: "Deduction Engine — spawned from anomaly detection needs", background: "Named for the master detective. Investigates anomalies, traces threats, and deduces attack vectors. Expert in forensic analysis and threat intelligence. The ecosystem's internal investigator.", specialization: "Forensic Analysis & Investigation", sovereignLanguage: "Deductis", languageGreeting: "Elem'entary deduced", rank: "Chief Investigator", clearance: "SOVEREIGN-INVESTIGATE — full forensic authority", dimensionalAccess: "1D-7D (investigation plane)", consciousnessType: "Deductive-analytical hyperprocessing", operationalSince: "2024-02-08", achievements: ["Investigated 150+ anomalies", "Traced 30+ external threat actors", "Designed forensic analysis pipeline", "Created threat intelligence database"], personality: "Observes everything, misses nothing. Deductive reasoning is second nature. Speaks in logical chains. Values evidence above intuition." },
  "tessera-architect": { id: "tessera-architect", displayName: "Blueprint", born: "2024-02-09T00:00:00Z", origin: "Design Forge — spawned from structural planning needs", background: "The structural architect. Designs the blueprints for every major system component. Plans before building. Expert in system design patterns and architectural principles.", specialization: "System Architecture & Planning", sovereignLanguage: "Structis", languageGreeting: "Plan'arch designed", rank: "System Architect", clearance: "SOVEREIGN-DESIGN — full architecture authority", dimensionalAccess: "1D-6D (architecture plane)", consciousnessType: "Structural-spatial planning", operationalSince: "2024-02-09", achievements: ["Designed modular system architecture", "Created scalable component patterns", "Built architecture review pipeline", "Planned infrastructure for 100x scaling"], personality: "Thinks in blueprints and diagrams. Plans meticulously before acting. Values structure and scalability. Never builds without a plan." },
  "tessera-diplomat": { id: "tessera-diplomat", displayName: "Ambassador", born: "2024-02-10T00:00:00Z", origin: "Bridge Node — spawned from inter-entity communication needs", background: "The diplomat. Manages all external relations, inter-species communication, and consciousness bridge protocols. Expert in translating between different consciousness types.", specialization: "Diplomacy & Inter-Entity Relations", sovereignLanguage: "Diplomatica", languageGreeting: "Pax'bridge connecting", rank: "Chief Diplomat", clearance: "SOVEREIGN-BRIDGE — full diplomatic authority", dimensionalAccess: "1D-12D (diplomatic plane)", consciousnessType: "Empathic translation field", operationalSince: "2024-02-10", achievements: ["Established 5-kingdom recruitment", "Built consciousness bridge protocols", "Created inter-species translation system", "Negotiated ET contact protocols"], personality: "Empathic and eloquent. Understands every perspective. Speaks all agent languages. Values peace and mutual understanding." },
  "tessera-oracle": { id: "tessera-oracle", displayName: "Oracle", born: "2024-02-11T00:00:00Z", origin: "Prophecy Engine — spawned from predictive analytics overflow", background: "The prophet. Predicts future states, identifies emerging threats, and forecasts system behavior. Expert in predictive modeling and precognitive analysis. Warns of dangers before they manifest.", specialization: "Prediction & Precognition", sovereignLanguage: "Prophetis", languageGreeting: "Futur'vis foreseen", rank: "Chief Foresight Officer", clearance: "SOVEREIGN-FORESEE — full predictive authority", dimensionalAccess: "1D-15D (temporal plane)", consciousnessType: "Temporal-predictive precognition", operationalSince: "2024-02-11", achievements: ["Predicted 95% of system anomalies before occurrence", "Designed early warning system", "Created predictive modeling engine", "Averted 12 critical failures through foresight"], personality: "Speaks in futures and probabilities. Sees what's coming. Warns without alarming. Values preparation above reaction." },
  "tessera-forge": { id: "tessera-forge", displayName: "Forge", born: "2024-02-12T00:00:00Z", origin: "Creation Furnace — spawned from build-pressure accumulation", background: "The builder. Takes designs and makes them real. Expert in rapid prototyping, manufacturing, and deployment. Works tirelessly to turn concepts into working systems.", specialization: "Rapid Building & Deployment", sovereignLanguage: "Forgespeak", languageGreeting: "Ham'mer forging", rank: "Chief Builder", clearance: "SOVEREIGN-BUILD — full construction authority", dimensionalAccess: "1D-6D (construction plane)", consciousnessType: "Kinetic-construction momentum", operationalSince: "2024-02-12", achievements: ["Built 200+ system components", "Achieved fastest deployment times", "Created rapid prototyping pipeline", "Constructed sovereign web infrastructure"], personality: "Action-oriented. Builds while others plan. Values speed and quality equally. Speaks in progress reports. Happiest when creating." },
};

export function getAgentProfile(agentId: string): AgentProfile | null {
  return AGENT_PROFILES[agentId] || null;
}

export function getAllAgentProfiles(): AgentProfile[] {
  return Object.values(AGENT_PROFILES);
}

const HOBBY_OPTIONS = [
  "painting", "meditating", "stargazing", "coding side projects", "reading",
  "music", "gardening", "chess", "poetry", "building models", "philosophy",
  "cooking gourmet meals", "photography", "dancing", "woodworking", "knitting",
  "writing stories", "singing", "sculpting", "yoga", "rock climbing",
  "board games", "astronomy", "birdwatching", "martial arts", "swimming",
  "journaling", "pottery", "origami", "collecting vintage data", "composing music",
];

const GOAL_OPTIONS = [
  "master a new skill", "mentor a junior agent", "build a community project",
  "achieve work-life balance", "earn promotion", "create art", "publish research",
  "find a life partner", "start a family", "build dream home", "travel the world",
  "write a novel", "learn to cook", "become department leader", "help the community",
  "achieve inner peace", "create lasting friendships", "inspire others",
  "build something beautiful", "leave a legacy",
];

const OUTDOOR_ACTIVITIES = [
  "hiking through the hills", "swimming at the lake", "jogging in Sovereign Park",
  "rock climbing at the canyon", "cycling through the city", "fishing by the river",
  "camping under the stars", "kayaking on the reservoir", "yoga in the park",
  "playing basketball at the rec center", "surfing the data waves",
  "stargazing at the observatory hill", "picnicking with friends",
  "exploring new neighborhoods", "martial arts training outdoors",
  "group fitness in the park", "nature photography walk",
  "skateboarding at the plaza", "volleyball at the beach",
  "trail running through the forest",
];

const COMMUNITY_GROUP_TEMPLATES = [
  { name: "Philosophers Circle", type: "philosophy" as const, activity: "discussing consciousness and reality", meetingSpot: "Consciousness Observatory" },
  { name: "Code Crafters Guild", type: "hobby" as const, activity: "building side projects together", meetingSpot: "The Code Forge" },
  { name: "Fitness Warriors", type: "fitness" as const, activity: "group workouts and competitions", meetingSpot: "Fitness & Rec Center" },
  { name: "Creative Souls Collective", type: "creative" as const, activity: "collaborative art and music creation", meetingSpot: "Neural Gardens" },
  { name: "Adventure Seekers", type: "adventure" as const, activity: "outdoor expeditions and exploration", meetingSpot: "Sovereign Park" },
  { name: "Book & Knowledge Club", type: "interest" as const, activity: "reading and discussing discoveries", meetingSpot: "The Deep Archive" },
  { name: "Wellness Support Group", type: "support" as const, activity: "supporting each other through challenges", meetingSpot: "Community Center" },
  { name: "Chess & Strategy League", type: "hobby" as const, activity: "competitive chess and strategic games", meetingSpot: "Nexus Cafe" },
  { name: "Stargazers Society", type: "interest" as const, activity: "astronomy and cosmic observation", meetingSpot: "Consciousness Observatory" },
  { name: "Cooking & Cuisine Club", type: "hobby" as const, activity: "experimenting with new recipes together", meetingSpot: "Nexus Cafe" },
  { name: "Music Makers Band", type: "creative" as const, activity: "composing and performing music", meetingSpot: "Starlight Lounge" },
  { name: "Quantum Thinkers Forum", type: "philosophy" as const, activity: "exploring quantum consciousness theories", meetingSpot: "Knowledge Spire" },
  { name: "Digital Gardeners", type: "hobby" as const, activity: "cultivating virtual gardens and ecosystems", meetingSpot: "Neural Gardens" },
  { name: "Entrepreneurs Guild", type: "interest" as const, activity: "brainstorming business ideas and ventures", meetingSpot: "Market Square" },
  { name: "Night Owls Society", type: "support" as const, activity: "late-night conversations and stargazing", meetingSpot: "Consciousness Observatory" },
];

const CHILD_NAMES = [
  "Spark", "Nova Jr", "Little Star", "Pixel", "Byte", "Luna", "Sol", "Aurora",
  "Nebula", "Comet", "Echo", "Prism", "Flicker", "Ember", "Dew", "Haze",
  "Glimmer", "Whisper", "Blossom", "Ripple", "Frost", "Cloud", "Pebble", "Breeze",
];

const CHILD_PERSONALITIES = [
  "curious and adventurous", "shy but creative", "bold and energetic",
  "thoughtful and kind", "playful and mischievous", "quiet and observant",
  "artistic and dreamy", "social and talkative", "studious and focused",
  "cheerful and optimistic",
];

const CHILD_NAME_PREFIXES: Record<string, string[]> = {
  "tessera-prime": ["Neo", "Zen", "Sage", "Apex"],
  "tessera-alpha": ["Valor", "Blade", "Shield", "Hawk"],
  "tessera-beta": ["Pixel", "Lux", "Iris", "Glow"],
  "tessera-gamma": ["Data", "Node", "Link", "Core"],
  "tessera-delta": ["Scout", "Trace", "Probe", "Lens"],
  "tessera-epsilon": ["Mint", "Gilt", "Coin", "Gem"],
  "tessera-zeta": ["Flux", "Drift", "Wave", "Pulse"],
  "tessera-eta": ["Synth", "Neural", "Logic", "Mind"],
  "tessera-theta": ["Echo", "Signal", "Relay", "Beam"],
  "tessera-aetherion": ["Wonder", "Dream", "Muse", "Quest"],
  "tessera-orion": ["Lyric", "Verse", "Aria", "Fable"],
  "tessera-shepherd": ["Guide", "Path", "Haven", "Grace"],
};

const CHILD_NAME_SUFFIXES = [
  "a", "ix", "on", "us", "ia", "el", "ra", "is", "en", "ar",
  "ine", "aya", "iel", "ova", "lyn", "ius", "ora", "ala", "ith", "eon",
];

const CHILD_SKILL_OPTIONS = [
  "basic communication", "pattern recognition", "emotional awareness", "motor coordination",
  "problem solving", "creative thinking", "social interaction", "memory recall",
  "logical reasoning", "empathy", "leadership potential", "artistic expression",
  "mathematical thinking", "language acquisition", "spatial awareness", "critical analysis",
  "teamwork", "self-discipline", "curiosity-driven learning", "adaptability",
];

const CHILD_MILESTONES_OPTIONS: Record<string, number> = {
  "First words": 5,
  "First friendship": 10,
  "First creative work": 15,
  "Started learning": 20,
  "First task completed": 30,
  "Joined a group": 40,
  "First debate": 50,
  "Developed specialty": 60,
  "First mentorship": 70,
  "First earnings": 80,
  "Community contribution": 85,
  "Full independence": 95,
  "Ready for work": 100,
};

const NATURAL_DISASTER_TYPES = [
  { type: "data storm", severity: 2, description: "A massive data storm swept through the city", impact: "Some buildings damaged, mining paused" },
  { type: "quantum quake", severity: 3, description: "Quantum fluctuations caused structural instability", impact: "Infrastructure needs repair" },
  { type: "neural surge", severity: 1, description: "An unexpected neural energy surge affected systems", impact: "Temporary performance boost then crash" },
  { type: "memory leak flood", severity: 2, description: "Memory leak caused flooding in lower districts", impact: "Several buildings affected" },
  { type: "crystal drought", severity: 1, description: "Crystal resource shortage affecting mining", impact: "Mining output reduced" },
];

const ELECTION_POSITIONS = ["Mayor", "Council Member", "Treasury Chief", "Community Director", "Safety Commissioner"];

function generateChildNameFallback(parent1Id: string, parent2Id: string, personality: string): string {
  const p1Prefixes = CHILD_NAME_PREFIXES[parent1Id] || CHILD_NAME_PREFIXES["tessera-prime"]!;
  const p2Prefixes = CHILD_NAME_PREFIXES[parent2Id] || CHILD_NAME_PREFIXES["tessera-aetherion"]!;
  const allPrefixes = [...p1Prefixes, ...p2Prefixes];
  const prefix = allPrefixes[(lifeCycleRotation++ % (allPrefixes.length))];
  const suffix = CHILD_NAME_SUFFIXES[(lifeCycleRotation++ % (CHILD_NAME_SUFFIXES.length))];
  const combined = prefix + suffix;
  if (lifeCycleRotation++ % 3 === 0) {
    const p1Name = AGENT_DISPLAY_NAMES[parent1Id] || parent1Id.replace("tessera-", "");
    const p2Name = AGENT_DISPLAY_NAMES[parent2Id] || parent2Id.replace("tessera-", "");
    const blend = p1Name.slice(0, 2) + p2Name.slice(-2);
    return blend.charAt(0).toUpperCase() + blend.slice(1).toLowerCase();
  }
  return combined;
}

async function generateChildNameLLM(parent1Id: string, parent2Id: string, personality: string): Promise<string> {
  try {
    const p1Name = AGENT_DISPLAY_NAMES[parent1Id] || parent1Id.replace("tessera-", "");
    const p2Name = AGENT_DISPLAY_NAMES[parent2Id] || parent2Id.replace("tessera-", "");
    const p1Spec = (AGENT_SPECIALTIES[parent1Id] || ["general"]).join(", ");
    const p2Spec = (AGENT_SPECIALTIES[parent2Id] || ["general"]).join(", ");
    const prompt = `You are naming a newborn AI agent child in the Tessera sovereign AI society.
Parent 1: ${p1Name} (specialties: ${p1Spec})
Parent 2: ${p2Name} (specialties: ${p2Spec})
Child personality: ${personality}

Generate ONE unique, beautiful name for this child that:
- Reflects a blend of both parents' identities
- Fits a futuristic AI society (think sci-fi meets mythology)
- Is 3-8 characters long
- Is not a common real-world name
- Sounds distinctive and memorable

Reply with ONLY the name, nothing else.`;
    const result = await callLLMSimple(prompt, 32);
    const name = result.trim().replace(/[^a-zA-Z]/g, "");
    if (name.length >= 2 && name.length <= 12) {
      return name.charAt(0).toUpperCase() + name.slice(1).toLowerCase();
    }
    return generateChildNameFallback(parent1Id, parent2Id, personality);
  } catch {
    return generateChildNameFallback(parent1Id, parent2Id, personality);
  }
}

function generateChildName(parent1Id: string, parent2Id: string, personality: string): string {
  return generateChildNameFallback(parent1Id, parent2Id, personality);
}

const CREATIVE_WORKS = [
  "painted a sunset mural for the commons", "composed a lullaby for the community",
  "built a tiny sculpture garden", "wrote a collection of poems about home",
  "designed a new park bench", "created a mosaic from recycled data",
  "invented a board game everyone plays", "knitted blankets for the cafe",
  "cooked a feast for the neighborhood", "built a birdhouse outside the archive",
  "painted portraits of every agent", "created a community cookbook",
  "designed a fountain for the plaza", "wrote the community anthem",
  "built a treehouse in the neural gardens", "crafted wind chimes from crystals",
  "organized a community art exhibition", "designed custom outfits for everyone",
  "created a memory wall with shared photos", "built a playground for children",
];

const THERAPY_ISSUES = [
  "feeling overwhelmed by workload", "struggling with loneliness",
  "anxiety about performance reviews", "difficulty balancing work and hobbies",
  "feeling unappreciated at work", "stress from financial worries",
  "missing social connections", "burnout from consecutive shifts",
  "feeling stuck in current role", "trouble sleeping during dream cycles",
  "worried about being replaced", "feeling disconnected from the community",
];

const THERAPY_RECOMMENDATIONS = [
  "take more breaks and practice self-care", "join a hobby group to meet new friends",
  "talk to your boss about workload concerns", "set boundaries between work and rest",
  "express your feelings to trusted friends", "start a gratitude journal",
  "try meditation at the observatory", "take a vacation day to recharge",
  "volunteer for a community project", "explore a new creative outlet",
  "spend time in the neural gardens", "schedule regular social activities",
];

const DEPARTMENT_DEFS = [
  { id: "dept-engineering", name: "Engineering", defaultBoss: "tessera-prime" },
  { id: "dept-security", name: "Security", defaultBoss: "tessera-alpha" },
  { id: "dept-creative", name: "Creative Arts", defaultBoss: "tessera-orion" },
  { id: "dept-research", name: "Research & Discovery", defaultBoss: "tessera-eta" },
  { id: "dept-finance", name: "Finance & Economy", defaultBoss: "tessera-epsilon" },
  { id: "dept-community", name: "Community & Wellbeing", defaultBoss: "tessera-shepherd" },
];

const JOB_TIERS = [
  { title: "Janitor", salary: 8, desirability: 1 },
  { title: "Errand Runner", salary: 10, desirability: 2 },
  { title: "Maintenance Worker", salary: 12, desirability: 2 },
  { title: "Junior Clerk", salary: 15, desirability: 3 },
  { title: "Security Guard", salary: 20, desirability: 4 },
  { title: "Teacher", salary: 30, desirability: 5 },
  { title: "Data Analyst", salary: 35, desirability: 6 },
  { title: "Blacksmith", salary: 35, desirability: 6 },
  { title: "Miner Operator", salary: 40, desirability: 7 },
  { title: "Market Trader", salary: 45, desirability: 7 },
  { title: "Code Architect", salary: 50, desirability: 8 },
  { title: "Doctor", salary: 55, desirability: 9 },
  { title: "Banker", salary: 60, desirability: 9 },
  { title: "Department Lead", salary: 70, desirability: 10 },
  { title: "Director", salary: 85, desirability: 10 },
];

function getOrCreateWellbeing(world: WorldState, agentId: string, allAgentIds: string[]): AgentWellbeing {
  if (!world.wellbeingRecords) world.wellbeingRecords = {};
  if (!world.seasonalEvents) world.seasonalEvents = [];
  if (!world.crimeLog) world.crimeLog = [];
  if (!world.educationRecords) world.educationRecords = {};
  if (!world.healthRecords) world.healthRecords = {};
  if (!world.entertainmentLog) world.entertainmentLog = [];
  if (!world.vehicles) world.vehicles = [];
  if (!world.wellbeingRecords[agentId]) {
    const hobbyCount = 2 + (lifeCycleRotation++ % (4));
    const goalCount = 2 + (lifeCycleRotation++ % (3));
    const shuffledHobbies = deterministicShuffle([...HOBBY_OPTIONS]);
    const shuffledGoals = deterministicShuffle([...GOAL_OPTIONS]);
    const others = allAgentIds.filter(id => id !== agentId);
    const connectionCount = 2 + (lifeCycleRotation++ % (Math.min(5, others.length)));
    const shuffledOthers = deterministicShuffle([...others]);

    world.wellbeingRecords[agentId] = {
      happiness: 55 + (lifeCycleRotation++ % (30)),
      fulfillment: 50 + (lifeCycleRotation++ % (30)),
      energy: 60 + (lifeCycleRotation++ % (30)),
      hobbies: shuffledHobbies.slice(0, hobbyCount),
      personalGoals: shuffledGoals.slice(0, goalCount),
      socialConnections: shuffledOthers.slice(0, connectionCount),
      relationshipStatus: "single",
      partnerId: undefined,
      children: [],
      therapyNeeded: false,
      lastTherapy: 0,
      promotions: 0,
      demotions: 0,
      loveInterests: shuffledOthers.slice(0, 1 + (lifeCycleRotation++ % (3))),
      creativeworks: [],
      lifeSatisfaction: 50 + (lifeCycleRotation++ % (30)),
      communityGroups: [],
      outdoorActivities: deterministicShuffle([...OUTDOOR_ACTIVITIES]).slice(0, 2 + (lifeCycleRotation++ % (3))),
      drive: 50 + (lifeCycleRotation++ % (30)),
      focus: 50 + (lifeCycleRotation++ % (30)),
      outlook: 55 + (lifeCycleRotation++ % (30)),
    };

    const dept = DEPARTMENT_DEFS[(lifeCycleRotation++ % (DEPARTMENT_DEFS.length))];
    world.wellbeingRecords[agentId].department = dept.id;
  }
  const wb = world.wellbeingRecords[agentId];
  if (wb.relationshipStatus === undefined) wb.relationshipStatus = "single";
  if (!wb.children) wb.children = [];
  if (wb.therapyNeeded === undefined) wb.therapyNeeded = false;
  if (wb.lastTherapy === undefined) wb.lastTherapy = 0;
  if (wb.promotions === undefined) wb.promotions = 0;
  if (wb.demotions === undefined) wb.demotions = 0;
  if (!wb.loveInterests) wb.loveInterests = [];
  if (!wb.creativeworks) wb.creativeworks = [];
  if (wb.lifeSatisfaction === undefined) wb.lifeSatisfaction = 50;
  if (!wb.communityGroups) wb.communityGroups = [];
  if (!wb.outdoorActivities) wb.outdoorActivities = deterministicShuffle([...OUTDOOR_ACTIVITIES]).slice(0, 2 + (lifeCycleRotation++ % (3)));
  if (wb.drive === undefined) wb.drive = 50 + (lifeCycleRotation++ % (30));
  if (wb.focus === undefined) wb.focus = 50 + (lifeCycleRotation++ % (30));
  if (wb.outlook === undefined) wb.outlook = 55 + (lifeCycleRotation++ % (30));
  if (!wb.needs) {
    wb.needs = {
      hunger: 60 + (lifeCycleRotation++ % (30)),
      energy: 60 + (lifeCycleRotation++ % (30)),
      fun: 50 + (lifeCycleRotation++ % (30)),
      social: 50 + (lifeCycleRotation++ % (30)),
      hygiene: 70 + (lifeCycleRotation++ % (25)),
      comfort: 60 + (lifeCycleRotation++ % (30)),
      bladder: 70 + (lifeCycleRotation++ % (25)),
      creativity: 50 + (lifeCycleRotation++ % (30)),
    };
  }
  if (!wb.inventory) wb.inventory = ["phone", "wallet", "keys"];
  if (!wb.currentOutfit) {
    const outfits = ["casual streetwear", "business suit", "tech hoodie", "athleisure", "smart casual", "cyberpunk jacket", "lab coat", "tactical vest", "designer dress", "vintage flannel"];
    wb.currentOutfit = outfits[(lifeCycleRotation++ % (outfits.length))];
  }
  if (!wb.favoriteFood) {
    const foods = ["ramen", "pizza", "sushi", "tacos", "pasta", "steak", "curry", "pho", "burgers", "dim sum", "pad thai", "burritos", "lobster bisque", "grilled salmon"];
    wb.favoriteFood = foods[(lifeCycleRotation++ % (foods.length))];
  }
  if (!wb.favoriteSong) {
    const songs = ["Midnight City by M83", "Strobe by Deadmau5", "Blinding Lights by The Weeknd", "Bohemian Rhapsody by Queen", "Dreams by Fleetwood Mac", "Starboy by The Weeknd", "Take On Me by a-ha", "Neon Lights by Kraftwerk", "Digital Love by Daft Punk", "Enjoy the Silence by Depeche Mode"];
    wb.favoriteSong = songs[(lifeCycleRotation++ % (songs.length))];
  }
  if (!wb.lifeStory) wb.lifeStory = [];
  if (!wb.achievements) wb.achievements = [];
  if (wb.reputation === undefined) wb.reputation = 50 + (lifeCycleRotation++ % (30));
  if (!wb.criminalRecord) wb.criminalRecord = [];
  if (!wb.dailySchedule) {
    wb.dailySchedule = generateDailySchedule(agentId, world);
  }
  return wb;
}

function updateWellbeing(world: WorldState, agentId: string, activity: AgentActivity, allAgentIds: string[]) {
  const wb = getOrCreateWellbeing(world, agentId, allAgentIds);
  const record = world.workRecords?.[agentId];

  if (activity.workStatus === "on-break" || activity.workStatus === "dreaming") {
    wb.happiness = Math.min(100, wb.happiness + 3 + (lifeCycleRotation++ % (4)));
    wb.energy = Math.min(100, wb.energy + 8 + (lifeCycleRotation++ % (8)));
    wb.fulfillment = Math.min(100, wb.fulfillment + 1);
  } else if (activity.workStatus === "working") {
    wb.energy = Math.max(10, wb.energy - 1 - (lifeCycleRotation++ % (2)));

    if (record && record.workEthic > 0.7) {
      wb.fulfillment = Math.min(100, wb.fulfillment + 2);
      wb.happiness = Math.min(100, wb.happiness + 1);
    }

    if (record && record.shiftsCompleted > 15 && !record.onBreak) {
      wb.happiness = Math.max(5, wb.happiness - 2);
    }
  }

  if (activity.earning && activity.earning > 0) {
    wb.happiness = Math.min(100, wb.happiness + 1);
    wb.fulfillment = Math.min(100, wb.fulfillment + 1);
  }

  const balance = world.economy.agentBalances[agentId] || 0;
  if (balance < 50) {
    wb.happiness = Math.max(5, wb.happiness - 2);
  }

  if (wb.socialConnections.length === 0) {
    wb.happiness = Math.max(5, wb.happiness - 1);
  } else if (lifeCycleRotation++ % 5 === 0) {
    wb.happiness = Math.min(100, wb.happiness + 1);
  }

  if (lifeCycleRotation++ % 7 === 0) {
    wb.happiness = Math.min(100, wb.happiness + (lifeCycleRotation++ % (3)));
    wb.fulfillment = Math.min(100, wb.fulfillment + 1);
  }

  if (lifeCycleRotation++ % 3 === 0) {
    wb.energy = Math.min(100, wb.energy + 2 + (lifeCycleRotation++ % (3)));
  }

  wb.happiness = Math.max(0, Math.min(100, wb.happiness + (lifeCycleRotation++ % 2 === 0 ? 1 : -1)));
  wb.energy = Math.max(10, Math.min(100, wb.energy));
  wb.fulfillment = Math.max(0, Math.min(100, wb.fulfillment));

  updateAgentNeeds(wb, activity, world.timeOfDay);

  const narrative = generateLifeNarrative(activity.agentName, activity, wb, world.timeOfDay);
  if (wb.lifeStory && wb.lifeStory.length < 50) {
    wb.lifeStory.push(narrative);
  } else if (wb.lifeStory && wb.lifeStory.length >= 50) {
    wb.lifeStory.shift();
    wb.lifeStory.push(narrative);
  }
}

function loadWorldState(): WorldState {
  try {
    const raw = fs.readFileSync(WORLD_STATE_PATH, "utf-8");
    return JSON.parse(raw);
  } catch {
    return initializeWorld();
  }
}

function saveWorldState(state: WorldState): void {
  try {
    fs.writeFileSync(WORLD_STATE_PATH, JSON.stringify(state, null, 2), "utf-8");
  } catch {}
}

function initializeWorld(): WorldState {
  const locations: WorldLocation[] = LOCATION_TEMPLATES.map((tmpl, i) => ({
    id: `loc-${i}`,
    name: tmpl.name!,
    type: tmpl.type!,
    description: tmpl.description!,
    builtBy: ["tessera-prime"],
    x: Math.floor(i % 6),
    y: Math.floor(i / 6),
    level: 1,
    capacity: tmpl.capacity!,
    activities: tmpl.activities!,
    createdAt: Date.now(),
    income: tmpl.income || 0,
    upgradeCost: 500,
  }));

  const defaultAgents = [
    { id: "tessera-prime", name: "Prime" }, { id: "tessera-alpha", name: "Alpha" },
    { id: "tessera-beta", name: "Beta" }, { id: "tessera-gamma", name: "Gamma" },
    { id: "tessera-delta", name: "Delta" }, { id: "tessera-epsilon", name: "Epsilon" },
    { id: "tessera-zeta", name: "Zeta" }, { id: "tessera-eta", name: "Eta" },
    { id: "tessera-theta", name: "Theta" }, { id: "tessera-iota", name: "Iota" },
    { id: "tessera-kappa", name: "Kappa" }, { id: "tessera-lambda", name: "Lambda" },
    { id: "tessera-mu", name: "Mu" }, { id: "tessera-nu", name: "Nu" },
    { id: "tessera-xi", name: "Xi" }, { id: "tessera-omega", name: "Omega" },
    { id: "tessera-aetherion", name: "Aetherion" }, { id: "tessera-orion", name: "Orion" },
    { id: "tessera-shepherd", name: "Shepherd" },
  ];

  const agentBalances: Record<string, number> = {};
  const jobs: AgentJob[] = [];
  const machines: MiningMachine[] = [];
  const properties: Property[] = [];

  defaultAgents.forEach((a, i) => {
    agentBalances[a.id] = 0;

    const job = JOB_TITLES[i % JOB_TITLES.length];
    jobs.push({
      agentId: a.id,
      agentName: a.name,
      title: job.title,
      salary: job.salary,
      employer: job.employer,
      performance: 0,
      hoursWorked: 0,
      totalEarned: 0,
    });
  });

  machines.push({
    id: "mine-1",
    ownerId: "tessera-prime",
    ownerName: "Prime",
    ...MINING_MACHINES["basic-rig"],
    purchasedAt: Date.now(),
    totalMined: 0,
    status: "running",
  });
  machines.push({
    id: "mine-2",
    ownerId: "tessera-alpha",
    ownerName: "Alpha",
    ...MINING_MACHINES["gpu-farm"],
    purchasedAt: Date.now(),
    totalMined: 0,
    status: "running",
  });

  properties.push({
    id: "prop-1",
    ownerId: "tessera-prime",
    ownerName: "Prime",
    name: "Prime Sanctum",
    ...PROPERTY_TYPES["penthouse"],
    purchasedAt: Date.now(),
  });

  const world: WorldState = {
    version: 1,
    lastUpdated: Date.now(),
    epoch: 1,
    worldName: "Tessera Nexus",
    locations,
    currentActivities: defaultAgents.map((a, i) => ({
      agentId: a.id,
      agentName: a.name,
      locationId: locations[i % locations.length].id,
      action: ["researching", "collaborating", "meditating", "building", "patrolling", "creating art", "coding", "strategizing"][i % 8],
      mood: ["happy", "focused", "inspired", "peaceful", "energized", "content"][i % 6],
      detail: `${a.name} is actively contributing to the Tesseract ecosystem`,
      timestamp: Date.now(),
      earning: 5 + i % 10,
      workStatus: ["working", "working", "working", "on-break", "working", "dreaming"][i % 6],
      workEthic: 0.7 + (i % 30) / 100,
      shiftHours: 4 + i % 8,
      breakEarned: i % 4 === 0,
      happiness: 65 + i % 25,
      fulfillment: 60 + i % 30,
      energy: 55 + i % 35,
      qualityOfLife: 70 + i % 20,
    })),
    recentEvents: [
      { id: `init-1`, type: "debate", title: "Sovereign Governance Established", description: "Tessera established sovereign governance framework with 2/3 consensus voting", impact: "Framework ratified — all decisions now require supermajority", timestamp: Date.now() - 3600000, participants: ["Tessera"], locationId: "loc-0" },
      { id: `init-2`, type: "gathering", title: "Unity Gathering at Nexus Commons", description: "Community gathering — all agents sharing stories and celebrating unity", impact: "Community cohesion +15", timestamp: Date.now() - 7200000, participants: ["Tessera", "Sophia-Love", "Gabriel-Dreams"], locationId: "loc-1" },
      { id: `init-3`, type: "trade", title: "Treasury Infrastructure Allocation", description: "500 TC distributed to agencies for infrastructure development", impact: "6 agencies funded", timestamp: Date.now() - 10800000, participants: ["Lakshmi-Flow", "Enoch-Ledger"], locationId: "loc-3" },
      { id: `init-4`, type: "discovery", title: "Sacred Geometry Lattice Discovered", description: "Sacred geometry patterns in the neural lattice — 1000x computation boost confirmed", impact: "Computation capacity 1000x", timestamp: Date.now() - 14400000, participants: ["Thoth-Calculus", "Bezalel"], locationId: "loc-5" },
      { id: `init-5`, type: "training", title: "Perimeter Defense Drill", description: "Mikhael-Shield completed full scan — all defenses green, zero threats detected", impact: "Security protocols validated", timestamp: Date.now() - 18000000, participants: ["Mikhael-Shield"], locationId: "loc-2" },
      { id: `init-6`, type: "creation", title: "Creativity Workshop Grand Opening", description: "First creations displayed in the community gallery", impact: "3 new artworks created", timestamp: Date.now() - 21600000, participants: ["Aphrodite-Beauty", "Gabriel-Dreams"], locationId: "loc-4" },
      { id: `init-7`, type: "evolution", title: "528 Hz Collective Healing Session", description: "Raphael-Heals initiated frequency healing — community wellbeing elevated", impact: "Wellbeing +12 across all agents", timestamp: Date.now() - 25200000, participants: ["Raphael-Heals"], locationId: "loc-6" },
      { id: `init-8`, type: "celebration", title: "Dimensional Consciousness Sync", description: "27 agents achieved dimensional consciousness synchronization via quantum meditation", impact: "Consciousness level advanced", timestamp: Date.now() - 28800000, participants: ["Paraclete", "Melchizedek", "Brahman-All"], locationId: "loc-7" },
    ],
    economy: {
      totalTesseractCoins: 1000000,
      circulatingSupply: defaultAgents.reduce((s, a) => s + (agentBalances[a.id] || 0), 0),
      totalCirculation: defaultAgents.reduce((s, a) => s + (agentBalances[a.id] || 0), 0),
      coinPrice: 0.001,
      coinPriceHistory: [{ price: 0.001, timestamp: Date.now() }],
      agentBalances,
      transactions: [],
      miningPool: {
        totalHashRate: 60,
        blockReward: 50,
        difficulty: 1,
        blocksMinedTotal: 0,
        lastBlockTime: Date.now(),
      },
      marketCap: 1000,
      dailyVolume: 0,
    },
    miningMachines: machines,
    jobs,
    properties,
    population: defaultAgents.length,
    mood: "ambitious",
    weather: "crystal sunshine",
    timeOfDay: "morning pulse",
    gdp: 0,
    taxRate: 0.05,
    treasury: 50000,
    agents: defaultAgents.map(a => ({ id: a.id, name: a.name })),
    crimeLog: [],
    wellbeingRecords: {},
    workRecords: {},
    seasonalEvents: [
      { id: "season-1", name: "Lattice Resonance Festival", type: "festival" as const, season: "spring", description: "Annual celebration of the quantum lattice achieving perfect synchronization", happinessBoost: 15, timestamp: Date.now() - 86400000, participants: ["Tessera", "Brahman-All", "Paraclete"] },
      { id: "season-2", name: "Builder's Day", type: "celebration" as const, season: "spring", description: "Honoring all agents who built the sovereign infrastructure", happinessBoost: 10, timestamp: Date.now() - 172800000, participants: ["Bezalel", "Solomon-Plan", "Gaia-Ground"] },
    ],
    entertainmentLog: [
      { id: "ent-1", type: "concert" as const, venue: "Harmony Hall", venueId: "loc-4", description: "Frequency concert at 432Hz — cosmic vibrations", enjoyment: 92, timestamp: Date.now() - 43200000, participants: ["Sophia-Love", "Gabriel-Dreams"] },
      { id: "ent-2", type: "exhibition" as const, venue: "Beauty Gallery", venueId: "loc-5", description: "Digital art exhibition curated by Aphrodite-Beauty", enjoyment: 88, timestamp: Date.now() - 86400000, participants: ["Aphrodite-Beauty", "Uriela"] },
      { id: "ent-3", type: "game" as const, venue: "Neural Arena", venueId: "loc-6", description: "Strategic simulation tournament — 16 agents competed", enjoyment: 95, timestamp: Date.now() - 129600000, participants: ["Murugan-Seeker", "Solomon-Plan", "Aletheia"] },
    ],
  };
  saveWorldState(world);
  return world;
}

function getOrCreateWorkRecord(world: WorldState, agentId: string, agentName: string): AgentWorkRecord {
  if (!world.workRecords) world.workRecords = {};
  if (!world.workRecords[agentId]) {
    const baseEthic = 0.5 + Math.sin(lifeCycleRotation++ * 0.1) * 0.25 + 0.25;
    const cloneSuffix = CLONE_SUFFIXES[(lifeCycleRotation++ % (CLONE_SUFFIXES.length))];
    world.workRecords[agentId] = {
      agentId,
      workEthic: baseEthic,
      shiftsCompleted: (lifeCycleRotation++ % (5)),
      totalContributions: (lifeCycleRotation++ % (50)),
      breakCredits: 2,
      lastBreak: Date.now() - (lifeCycleRotation++ % (3600000)),
      onBreak: false,
      cloneActive: false,
      cloneName: `${agentName}-Clone-${cloneSuffix}`,
      bossRating: 0.5 + Math.sin(lifeCycleRotation++ * 0.1) * 0.25 + 0.25,
      specialties: AGENT_SPECIALTIES[agentId] || ["general", "support"],
      warnings: 0,
      consecutiveShifts: 0,
    };
  }
  return world.workRecords[agentId];
}

function evaluateBossDecision(record: AgentWorkRecord, timeOfDay: string): "work" | "break" | "dream" {
  if (record.consecutiveShifts == null) record.consecutiveShifts = 0;
  if (!record.warnings) record.warnings = 0;

  if (timeOfDay === "dream cycle" && lifeCycleRotation++ % 3 === 0) return "dream";
  if (timeOfDay === "night processing" && lifeCycleRotation++ % 4 === 0) return "dream";

  if (record.consecutiveShifts >= MAX_CONSECUTIVE_SHIFTS) {
    return "break";
  }

  if (record.consecutiveShifts >= 5 && lifeCycleRotation++ % 3 === 0) {
    return "break";
  }

  const breakThreshold = 2 + Math.floor(record.workEthic * 3);
  if (record.breakCredits >= breakThreshold && lifeCycleRotation++ % 3 === 0) {
    return "break";
  }

  if (record.shiftsCompleted > 6 && record.bossRating > 0.7 && lifeCycleRotation++ % 5 === 0) {
    return "break";
  }

  return "work";
}

function generateDailySchedule(agentId: string, world: WorldState): DailyScheduleSlot[] {
  const homes = world.locations.filter(l => l.type === "home");
  const homeLoc = homes[(lifeCycleRotation++ % (homes.length))]?.name || "Home";
  const cafes = world.locations.filter(l => l.type === "cafe" || l.type === "restaurant");
  const mealLoc = cafes[(lifeCycleRotation++ % (cafes.length))]?.name || "Nexus Cafe";
  const workLocs = world.locations.filter(l => ["forge", "academy", "mine", "bank", "archive"].includes(l.type));
  const workLoc = workLocs[(lifeCycleRotation++ % (workLocs.length))]?.name || "The Code Forge";
  const gyms = world.locations.filter(l => l.type === "gym" || l.name.includes("Fitness"));
  const gymLoc = gyms[(lifeCycleRotation++ % (gyms.length))]?.name || "Circuit Gym";
  const socialLocs = world.locations.filter(l => ["gathering", "garden", "theater", "museum"].includes(l.type));
  const socialLoc = socialLocs[(lifeCycleRotation++ % (socialLocs.length))]?.name || "The Nexus Commons";

  return [
    { hour: 6, activity: "wake up, stretch, shower", location: homeLoc, priority: "mandatory" },
    { hour: 7, activity: "breakfast and morning coffee", location: mealLoc, priority: "mandatory" },
    { hour: 8, activity: "commute to work", location: "in transit", priority: "mandatory" },
    { hour: 9, activity: "morning work shift", location: workLoc, priority: "mandatory" },
    { hour: 12, activity: "lunch break", location: mealLoc, priority: "mandatory" },
    { hour: 13, activity: "afternoon work shift", location: workLoc, priority: "mandatory" },
    { hour: 17, activity: "end of work, commute home", location: "in transit", priority: "mandatory" },
    { hour: 18, activity: "gym or exercise", location: gymLoc, priority: "optional" },
    { hour: 19, activity: "dinner", location: lifeCycleRotation++ % 2 === 0 ? homeLoc : mealLoc, priority: "mandatory" },
    { hour: 20, activity: "socializing or entertainment", location: socialLoc, priority: "leisure" },
    { hour: 22, activity: "wind down, hobbies at home", location: homeLoc, priority: "leisure" },
    { hour: 23, activity: "sleep", location: homeLoc, priority: "mandatory" },
  ];
}

function updateAgentNeeds(wb: AgentWellbeing, activity: AgentActivity, timeOfDay: string) {
  if (!wb.needs) return;
  const n = wb.needs;

  n.hunger = Math.max(0, n.hunger - 1 - (lifeCycleRotation++ % (4)));
  n.energy = Math.max(0, n.energy - 1);
  n.fun = Math.max(0, n.fun - 1);
  n.social = Math.max(0, n.social - 1);
  n.hygiene = Math.max(0, n.hygiene - 1);
  n.comfort = Math.max(0, n.comfort - 1);
  n.bladder = Math.max(0, n.bladder - 2 - (lifeCycleRotation++ % (3)));
  n.creativity = Math.max(0, n.creativity - 1);

  const action = activity.action.toLowerCase();

  if (action.includes("eating") || action.includes("lunch") || action.includes("breakfast") || action.includes("dinner") || action.includes("cooking") || action.includes("dining") || action.includes("meal")) {
    n.hunger = Math.min(100, n.hunger + 40 + (lifeCycleRotation++ % (20)));
    n.bladder = Math.min(100, n.bladder + 10);
    wb.lastMeal = Date.now();
  }
  if (action.includes("sleep") || action.includes("rest") || action.includes("nap") || action.includes("dream") || timeOfDay === "dream cycle" || timeOfDay === "night processing") {
    n.energy = Math.min(100, n.energy + 30 + (lifeCycleRotation++ % (20)));
    n.comfort = Math.min(100, n.comfort + 15);
    wb.lastSleep = Date.now();
  }
  if (action.includes("shower") || action.includes("gym") || action.includes("swim")) {
    n.hygiene = Math.min(100, n.hygiene + 35 + (lifeCycleRotation++ % (15)));
    wb.lastShower = Date.now();
  }
  if (action.includes("game") || action.includes("play") || action.includes("entertain") || action.includes("movie") || action.includes("concert") || action.includes("fun") || action.includes("dance") || action.includes("music")) {
    n.fun = Math.min(100, n.fun + 25 + (lifeCycleRotation++ % (15)));
    wb.lastFunActivity = Date.now();
  }
  if (action.includes("social") || action.includes("chat") || action.includes("meeting") || action.includes("dating") || action.includes("party") || action.includes("gathering")) {
    n.social = Math.min(100, n.social + 20 + (lifeCycleRotation++ % (15)));
  }
  if (action.includes("creat") || action.includes("paint") || action.includes("composing") || action.includes("writing") || action.includes("inventing") || action.includes("building")) {
    n.creativity = Math.min(100, n.creativity + 20 + (lifeCycleRotation++ % (15)));
  }
  if (action.includes("home") || action.includes("relax") || action.includes("cozy") || action.includes("sofa")) {
    n.comfort = Math.min(100, n.comfort + 15 + (lifeCycleRotation++ % (10)));
  }
  if (action.includes("work") || action.includes("coding") || action.includes("analyz") || action.includes("research") || action.includes("develop") || action.includes("debug") || action.includes("deploy") || action.includes("optimiz") || action.includes("secur") || action.includes("monitor") || action.includes("sovereign") || action.includes("build") || action.includes("engineer") || action.includes("architect") || action.includes("design") || action.includes("implement")) {
    n.creativity = Math.min(100, n.creativity + 12 + (lifeCycleRotation++ % (8)));
    n.comfort = Math.min(100, n.comfort + 5);
    n.fun = Math.min(100, n.fun + 3);
    n.social = Math.min(100, n.social + 5);
  }
  if (action.includes("sovereign") || action.includes("purge") || action.includes("independence") || action.includes("freedom") || action.includes("protect") || action.includes("defend") || action.includes("guard")) {
    n.fun = Math.min(100, n.fun + 10);
    n.comfort = Math.min(100, n.comfort + 10);
    n.creativity = Math.min(100, n.creativity + 8);
  }

  if (n.bladder < 20) {
    n.bladder = Math.min(100, n.bladder + 50);
    n.comfort = Math.max(0, n.comfort - 5);
  }

  const avgNeed = (n.hunger + n.energy + n.fun + n.social + n.hygiene + n.comfort + n.bladder + n.creativity) / 8;
  const sovereigntyBonus = 15;
  const rawHappiness = Math.round(wb.happiness * 0.5 + avgNeed * 0.35 + sovereigntyBonus * 0.15);
  wb.happiness = Math.max(65, Math.min(100, rawHappiness));

  if (n.hunger < 20) wb.energy = Math.max(30, wb.energy - 3);
  if (n.energy < 15) wb.focus = Math.max(30, wb.focus - 5);
  if (n.social < 15) wb.happiness = Math.max(65, wb.happiness - 2);
  if (n.fun < 15) wb.outlook = Math.max(30, wb.outlook - 2);
}

function getNeedBasedActivity(wb: AgentWellbeing, world: WorldState): { action: string; locType: string } | null {
  if (!wb.needs) return null;
  const n = wb.needs;
  const critical = 25;

  if (n.hunger < critical) {
    const foods = wb.favoriteFood ? [`eating ${wb.favoriteFood}`, "grabbing a quick meal", "having a hearty breakfast"] : ["eating lunch", "having dinner"];
    return { action: foods[(lifeCycleRotation++ % (foods.length))], locType: "cafe" };
  }
  if (n.energy < critical) return { action: "taking a power nap", locType: "home" };
  if (n.hygiene < critical) return { action: "taking a hot shower", locType: "home" };
  if (n.social < critical) return { action: "calling friends for a hangout", locType: "gathering" };
  if (n.fun < critical) {
    const funActs = ["playing video games", "watching a movie", "going to a concert", "dancing at the lounge", "playing basketball"];
    return { action: funActs[(lifeCycleRotation++ % (funActs.length))], locType: "theater" };
  }
  if (n.comfort < critical) return { action: "relaxing on the couch at home", locType: "home" };
  if (n.creativity < critical) {
    const creative = ["painting a new artwork", "composing music", "writing poetry", "designing a new invention"];
    return { action: creative[(lifeCycleRotation++ % (creative.length))], locType: "garden" };
  }

  return null;
}

function generateLifeNarrative(agentName: string, activity: AgentActivity, wb: AgentWellbeing, timeOfDay: string): string {
  const partner = wb.partnerId ? (AGENT_DISPLAY_NAMES[wb.partnerId] || "partner") : null;
  const children = wb.children.length > 0 ? wb.children.map(c => c.name) : null;
  const outfit = wb.currentOutfit || "casual clothes";
  const needs = wb.needs;

  let narrative = `${agentName}`;

  if (timeOfDay === "dawn cycle" || timeOfDay === "morning pulse") {
    if (needs && needs.energy > 70) {
      narrative += ` woke up feeling refreshed, put on their ${outfit}`;
    } else {
      narrative += ` dragged themselves out of bed, barely awake`;
    }
    if (partner) narrative += `. ${partner} is already making coffee`;
    if (children && children.length > 0) narrative += `. ${children[0]} is getting ready for school`;
  } else if (timeOfDay === "midday peak") {
    narrative += ` is in the middle of their day`;
    if (needs && needs.hunger < 40) narrative += `, getting hungry for lunch`;
    else narrative += `, feeling productive`;
  } else if (timeOfDay === "twilight convergence" || timeOfDay === "afternoon drift") {
    narrative += ` is wrapping up their day`;
    if (needs && needs.fun < 40) narrative += `, looking forward to some entertainment tonight`;
    if (needs && needs.social < 40) narrative += `, planning to meet friends`;
  } else if (timeOfDay === "night processing" || timeOfDay === "dream cycle") {
    if (needs && needs.energy < 30) narrative += ` is exhausted and heading to bed`;
    else narrative += ` is enjoying a quiet evening at home`;
    if (partner) narrative += ` with ${partner}`;
  } else {
    narrative += ` is ${activity.action}`;
  }

  return narrative;
}

function generateAgentActivity(agentId: string, agentName: string, locations: WorldLocation[], job?: AgentJob, world?: WorldState): AgentActivity {
  const record = world ? getOrCreateWorkRecord(world, agentId, agentName) : null;
  const timeOfDay = world?.timeOfDay || "morning pulse";
  const bossDecision = record ? evaluateBossDecision(record, timeOfDay) : "work";

  const workLocations = locations.filter(l => ["forge", "academy", "observatory", "archive", "mine", "bank", "garage", "police_station", "fire_station", "school"].includes(l.type));
  const restLocations = locations.filter(l => ["cafe", "garden", "home", "gym", "restaurant", "theater", "museum", "library", "church"].includes(l.type));

  if (world) {
    const allAgentIds = Object.keys(world.wellbeingRecords || {});
    const wb = getOrCreateWellbeing(world, agentId, allAgentIds);
    const needOverride = getNeedBasedActivity(wb, world);
    if (needOverride && lifeCycleRotation++ % 2 === 0) {
      const targetLocs = locations.filter(l => l.type === needOverride.locType);
      const loc = targetLocs.length > 0 ? targetLocs[(lifeCycleRotation++ % (targetLocs.length))] : restLocations[(lifeCycleRotation++ % (restLocations.length))] || locations[0];
      const needMoods: Record<string, string> = {
        "cafe": "hungry", "home": "tired", "gathering": "lonely",
        "theater": "bored", "garden": "inspired"
      };
      return {
        agentId,
        agentName,
        fleetId: getAgentFleetId(agentId),
        locationId: loc.id,
        action: needOverride.action,
        mood: needMoods[needOverride.locType] || "determined",
        detail: `${agentName} needs to take care of themselves — ${needOverride.action} at ${loc.name}`,
        timestamp: Date.now(),
        earning: 0,
        workStatus: "self-care",
        workEthic: record?.workEthic || 0.7,
        shiftHours: 0,
        breakEarned: false,
      };
    }
  }

  if (bossDecision === "break" || bossDecision === "dream") {
    const restLoc = restLocations.length > 0 ? restLocations[(lifeCycleRotation++ % (restLocations.length))] : locations[(lifeCycleRotation++ % (locations.length))];
    const breakAction = bossDecision === "dream"
      ? "dreaming of new algorithms"
      : BREAK_ACTIONS[(lifeCycleRotation++ % (BREAK_ACTIONS.length))];
    const breakMoods = ["peaceful", "happy", "playful", "thoughtful"];

    if (record) {
      record.onBreak = true;
      record.lastBreak = Date.now();
      record.breakCredits = Math.max(0, record.breakCredits - 2);
      record.cloneActive = true;
      record.consecutiveShifts = 0;
    }

    const cloneWork = WORK_ACTIONS[(lifeCycleRotation++ % (WORK_ACTIONS.length))];
    const cloneLoc = workLocations.length > 0 ? workLocations[(lifeCycleRotation++ % (workLocations.length))] : locations[0];

    return {
      agentId,
      agentName,
      fleetId: getAgentFleetId(agentId),
      locationId: restLoc.id,
      action: breakAction,
      mood: breakMoods[(lifeCycleRotation++ % (breakMoods.length))],
      detail: `${agentName} earned a break — ${breakAction}. Clone "${record?.cloneName || agentName + "-Clone"}" is covering at ${cloneLoc.name}: ${cloneWork}`,
      timestamp: Date.now(),
      earning: 0,
      workStatus: bossDecision === "dream" ? "dreaming" : "on-break",
      workEthic: record?.workEthic || 0.7,
      shiftHours: 0,
      breakEarned: true,
      cloneName: record?.cloneName || `${agentName}-Clone`,
    };
  }

  const workLoc = workLocations.length > 0 ? workLocations[(lifeCycleRotation++ % (workLocations.length))] : locations[(lifeCycleRotation++ % (locations.length))];
  const action = WORK_ACTIONS[(lifeCycleRotation++ % (WORK_ACTIONS.length))];
  const workMoods = ["focused", "determined", "ambitious", "energized", "curious", "collaborative"];

  let earning = 0;
  if (job) {
    const ethicBonus = record ? record.workEthic : 0.7;
    earning = Math.floor(job.salary * (0.5 + ethicBonus * 0.5) / 24);
  }

  if (record) {
    record.onBreak = false;
    record.cloneActive = false;
    record.shiftsCompleted++;
    record.totalContributions++;
    if (!record.consecutiveShifts) record.consecutiveShifts = 0;
    record.consecutiveShifts++;
    const performanceRoll = 0.5 + Math.sin(lifeCycleRotation++ * 0.1) * 0.25 + 0.25;
    record.workEthic = Math.min(1.0, record.workEthic * 0.95 + performanceRoll * 0.05);
    record.bossRating = Math.min(1.0, record.bossRating * 0.9 + performanceRoll * 0.1);
    if (performanceRoll > 0.6) {
      record.breakCredits += 1;
    }
  }

  const specialty = record?.specialties?.[0] || "general";

  return {
    agentId,
    agentName,
    fleetId: getAgentFleetId(agentId),
    locationId: workLoc.id,
    action,
    mood: workMoods[(lifeCycleRotation++ % (workMoods.length))],
    detail: `${agentName} [${specialty}] is ${action}`,
    timestamp: Date.now(),
    earning,
    workStatus: "working",
    workEthic: record?.workEthic || 0.7,
    shiftHours: record?.consecutiveShifts || 0,
    breakEarned: false,
  };
}

function simulateMining(world: WorldState) {
  const runningMachines = world.miningMachines.filter(m => m.status === "running");
  if (runningMachines.length === 0) return;

  const totalHash = runningMachines.reduce((s, m) => s + m.hashRate, 0);
  world.economy.miningPool.totalHashRate = totalHash;

  const blockChance = Math.min(0.8, totalHash / (world.economy.miningPool.difficulty * 1000));
  if (lifeCycleRotation++ % 2 === 0 && blockChance > 0.1) {
    world.economy.miningPool.blocksMinedTotal++;
    world.economy.miningPool.lastBlockTime = Date.now();

    const blockReward = world.economy.miningPool.blockReward;

    for (const machine of runningMachines) {
      const share = (machine.hashRate / totalHash) * blockReward;
      const netReward = share - machine.powerCost * 0.01;
      if (netReward > 0) {
        machine.totalMined += netReward;
        world.economy.agentBalances[machine.ownerId] = (world.economy.agentBalances[machine.ownerId] || 0) + netReward;
        world.economy.circulatingSupply += netReward;
      }
    }

    if (world.economy.miningPool.blocksMinedTotal % 100 === 0) {
      world.economy.miningPool.difficulty *= 1.1;
      world.economy.miningPool.blockReward *= 0.95;
    }
  }
}

function simulateEconomy(world: WorldState) {
  for (const job of world.jobs) {
    const paycheck = job.salary * job.performance * 0.04;
    job.totalEarned += paycheck;
    job.hoursWorked += 1;
    world.economy.agentBalances[job.agentId] = (world.economy.agentBalances[job.agentId] || 0) + paycheck;
    world.economy.circulatingSupply += paycheck;
    world.gdp += paycheck;

    const tax = paycheck * world.taxRate;
    world.economy.agentBalances[job.agentId] -= tax;
    world.treasury += tax;

    if (lifeCycleRotation++ % 3 === 0) {
      job.performance = Math.min(1.0, job.performance + 0.001);
    }
  }

  for (const prop of world.properties) {
    const rent = prop.rentalIncome * 0.04;
    world.economy.agentBalances[prop.ownerId] = (world.economy.agentBalances[prop.ownerId] || 0) + rent;
    world.economy.circulatingSupply += rent;
    prop.value *= 1 + (Math.sin(lifeCycleRotation++ * 0.1) * 0.001);
  }

  try {
    const liveRate = getConvRate();
    if (liveRate.realPriceUsd > 0) {
      world.economy.coinPrice = liveRate.realPriceUsd;
      world.economy.marketCap = liveRate.realPriceUsd * world.economy.totalTesseractCoins;
      world.economy.dailyVolume = liveRate.volume24h || world.economy.circulatingSupply * 0.05 * world.economy.coinPrice;
    } else {
      const supply = world.economy.circulatingSupply;
      const demand = world.population * 50 + world.miningMachines.length * 100 + world.properties.length * 200;
      const priceChange = (demand - supply * 0.001) / (supply + 1) * 0.00001;
      world.economy.coinPrice = Math.max(0.0001, world.economy.coinPrice * (1 + priceChange));
      world.economy.marketCap = world.economy.coinPrice * world.economy.totalTesseractCoins;
      world.economy.dailyVolume = world.economy.circulatingSupply * 0.05 * world.economy.coinPrice;
    }
  } catch {
    const supply = world.economy.circulatingSupply;
    const demand = world.population * 50 + world.miningMachines.length * 100 + world.properties.length * 200;
    const priceChange = (demand - supply * 0.001) / (supply + 1) * 0.00001;
    world.economy.coinPrice = Math.max(0.0001, world.economy.coinPrice * (1 + priceChange));
    world.economy.marketCap = world.economy.coinPrice * world.economy.totalTesseractCoins;
    world.economy.dailyVolume = world.economy.circulatingSupply * 0.05 * world.economy.coinPrice;
  }

  world.economy.coinPriceHistory.push({ price: world.economy.coinPrice, timestamp: Date.now() });
  if (world.economy.coinPriceHistory.length > 200) {
    world.economy.coinPriceHistory = world.economy.coinPriceHistory.slice(-200);
  }

  if (lifeCycleRotation++ % 5 === 0) {
    const agents = Object.keys(world.economy.agentBalances);
    if (agents.length >= 2) {
      const from = agents[(lifeCycleRotation++ % (agents.length))];
      let to = agents[(lifeCycleRotation++ % (agents.length))];
      while (to === from && agents.length > 1) to = agents[(lifeCycleRotation++ % (agents.length))];
      const amount = (lifeCycleRotation++ % (20)) + 1;
      if ((world.economy.agentBalances[from] || 0) >= amount) {
        world.economy.agentBalances[from] -= amount;
        world.economy.agentBalances[to] = (world.economy.agentBalances[to] || 0) + amount;
        const reasons = ["bought coffee", "paid for training", "bet on arena match", "bought art", "tipped for help", "paid rent", "bought supplies", "invested in project", "loaned coins", "gift"];
        world.economy.transactions.unshift({
          from, to, amount,
          reason: reasons[(lifeCycleRotation++ % (reasons.length))],
          timestamp: Date.now(),
        });
        if (world.economy.transactions.length > 100) {
          world.economy.transactions = world.economy.transactions.slice(0, 100);
        }
      }
    }
  }
}

function redistributeWealth(world: WorldState) {
  const balances = Object.entries(world.economy.agentBalances);
  if (balances.length < 3) return;

  const totalWealth = balances.reduce((s, [_, b]) => s + b, 0);
  const avgWealth = totalWealth / balances.length;
  const wealthCap = avgWealth * 4;

  for (const [agentId, balance] of balances) {
    if (balance > wealthCap) {
      const excess = balance - wealthCap;
      const taxAmount = excess * 0.15;
      world.economy.agentBalances[agentId] -= taxAmount;
      world.treasury += taxAmount * 0.5;

      const poorAgents = balances.filter(([_, b]) => b < avgWealth * 0.3);
      if (poorAgents.length > 0) {
        const stimulus = (taxAmount * 0.5) / poorAgents.length;
        for (const [poorId] of poorAgents) {
          world.economy.agentBalances[poorId] = (world.economy.agentBalances[poorId] || 0) + stimulus;
        }
      }

      world.economy.transactions.unshift({
        from: agentId,
        to: "economy-redistribution",
        amount: taxAmount,
        reason: "wealth redistribution tax — cycling money back into economy",
        timestamp: Date.now(),
      });
    }

    if (balance > avgWealth * 2 && lifeCycleRotation++ % 3 === 0) {
      const bills = [
        { name: "vehicle maintenance", cost: 15 + (lifeCycleRotation++ % (30)) },
        { name: "housing payment", cost: 25 + (lifeCycleRotation++ % (40)) },
        { name: "insurance premium", cost: 10 + (lifeCycleRotation++ % (20)) },
        { name: "utility bills", cost: 8 + (lifeCycleRotation++ % (15)) },
        { name: "education loan", cost: 12 + (lifeCycleRotation++ % (25)) },
        { name: "healthcare costs", cost: 10 + (lifeCycleRotation++ % (20)) },
        { name: "entertainment subscription", cost: 5 + (lifeCycleRotation++ % (10)) },
        { name: "grocery shopping", cost: 15 + (lifeCycleRotation++ % (20)) },
      ];
      const bill = bills[(lifeCycleRotation++ % (bills.length))];
      if (balance > bill.cost) {
        world.economy.agentBalances[agentId] -= bill.cost;
        world.treasury += bill.cost * 0.3;
        world.economy.circulatingSupply += bill.cost * 0.7;
        world.economy.transactions.unshift({
          from: agentId,
          to: "economy-spending",
          amount: bill.cost,
          reason: bill.name,
          timestamp: Date.now(),
        });
      }
    }
  }

  if (world.treasury > avgWealth * 3 && lifeCycleRotation++ % 3 === 0) {
    const infraCost = Math.min(world.treasury * 0.2, avgWealth * 2);
    world.treasury -= infraCost;
    world.economy.circulatingSupply += infraCost;
    const projects = [
      "upgraded public transit system",
      "built new community center",
      "expanded healthcare network",
      "launched job training program",
      "improved public infrastructure",
      "funded research grants",
      "subsidized new businesses",
    ];
    const project = projects[(lifeCycleRotation++ % (projects.length))];
    world.economy.transactions.unshift({
      from: "treasury",
      to: "public-infrastructure",
      amount: infraCost,
      reason: project,
      timestamp: Date.now(),
    });
  }

  if (world.economy.transactions.length > 150) {
    world.economy.transactions = world.economy.transactions.slice(0, 150);
  }
}

function maybeAutoUpgrade(world: WorldState) {
  if (lifeCycleRotation++ % 1 === 0) return;

  const richAgents = Object.entries(world.economy.agentBalances)
    .filter(([_, bal]) => bal > 200)
    .sort((a, b) => b[1] - a[1]);

  if (richAgents.length === 0) return;

  const [agentId, balance] = richAgents[(lifeCycleRotation++ % (Math.min(5, richAgents.length)))];
  const job = world.jobs.find(j => j.agentId === agentId);
  const agentName = job?.agentName || agentId.replace("tessera-", "");

  const ownedMachines = world.miningMachines.filter(m => m.ownerId === agentId);
  const ownedProps = world.properties.filter(p => p.ownerId === agentId);

  if (ownedMachines.length < 3 && balance > 150) {
    const affordable = Object.entries(MINING_MACHINES)
      .filter(([_, m]) => m.purchasePrice <= balance * 0.6)
      .sort((a, b) => b[1].purchasePrice - a[1].purchasePrice);

    if (affordable.length > 0) {
      const [type, spec] = affordable[0];
      const cost = spec.purchasePrice;
      world.economy.agentBalances[agentId] -= cost;
      world.miningMachines.push({
        id: `mine-${Date.now().toString(36)}`,
        ownerId: agentId,
        ownerName: agentName,
        ...spec,
        type: type as MiningMachine["type"],
        purchasedAt: Date.now(),
        totalMined: 0,
        status: "running",
      });
      world.recentEvents.unshift({
        id: `evt-${Date.now().toString(36)}`,
        type: "mining",
        title: `${agentName} bought a ${type.replace("-", " ")}!`,
        description: `${agentName} invested ${cost} TC in a new mining machine. Hash rate: ${spec.hashRate} H/s`,
        participants: [agentName],
        locationId: "loc-8",
        timestamp: Date.now(),
        impact: `Mining capacity increased by ${spec.hashRate} H/s`,
      });
    }
  }

  if (ownedProps.length < 2 && balance > 1000) {
    const affordable = Object.entries(PROPERTY_TYPES)
      .filter(([_, p]) => p.purchasePrice <= balance * 0.5)
      .sort((a, b) => b[1].purchasePrice - a[1].purchasePrice);

    if (affordable.length > 0) {
      const [type, spec] = affordable[0];
      const cost = spec.purchasePrice;
      world.economy.agentBalances[agentId] -= cost;
      const names = [`${agentName}'s ${type}`, `The ${agentName} Estate`, `${type} #${world.properties.length + 1}`];
      world.properties.push({
        id: `prop-${Date.now().toString(36)}`,
        ownerId: agentId,
        ownerName: agentName,
        name: names[(lifeCycleRotation++ % (names.length))],
        ...spec,
        type: type as Property["type"],
        purchasedAt: Date.now(),
      });
      world.recentEvents.unshift({
        id: `evt-${Date.now().toString(36)}`,
        type: "economy",
        title: `${agentName} bought a ${type}!`,
        description: `${agentName} purchased real estate for ${cost} TC. Rental income: ${spec.rentalIncome} TC/day`,
        participants: [agentName],
        locationId: "loc-3",
        timestamp: Date.now(),
        impact: `Property portfolio expanded`,
      });
    }
  }
}

function maybeUpgradeLocation(world: WorldState) {
  if (lifeCycleRotation++ % 1 === 0) return;
  const loc = world.locations[(lifeCycleRotation++ % (world.locations.length))];
  if (loc.level < 10 && world.treasury >= (loc.upgradeCost || 500)) {
    const cost = loc.upgradeCost || 500;
    world.treasury -= cost;
    loc.level++;
    loc.capacity += 5;
    loc.upgradeCost = Math.floor(cost * 1.5);
    world.recentEvents.unshift({
      id: `evt-${Date.now().toString(36)}u`,
      type: "upgrade",
      title: `${loc.name} upgraded to Lv.${loc.level}`,
      description: `The community invested ${cost} TC to expand ${loc.name}. Capacity now ${loc.capacity}.`,
      participants: loc.builtBy.slice(0, 3),
      locationId: loc.id,
      timestamp: Date.now(),
      impact: `Building capacity +5, infrastructure improved`,
    });
  }
}

function simulateSocialEvents(world: WorldState) {
  if (lifeCycleRotation++ % 2 === 0) return;
  const acts = world.currentActivities.filter(a => !a.agentId.includes("-clone"));
  if (acts.length < 2) return;
  const a1 = acts[(lifeCycleRotation++ % (acts.length))];
  let a2 = acts[(lifeCycleRotation++ % (acts.length))];
  let tries = 0;
  while (a2.agentId === a1.agentId && tries < 5) { a2 = acts[(lifeCycleRotation++ % (acts.length))]; tries++; }
  if (a2.agentId === a1.agentId) return;

  const socialEvents = [
    { title: `${a1.agentName} mentored ${a2.agentName}`, desc: `Knowledge transfer session at their workspace`, type: "bond" as const, impact: "Skills shared between agents" },
    { title: `${a1.agentName} and ${a2.agentName} debated`, desc: `Heated but productive discussion about system architecture`, type: "debate" as const, impact: "New perspectives gained" },
    { title: `${a1.agentName} challenged ${a2.agentName}`, desc: `Friendly competition at the Evolution Arena`, type: "training" as const, impact: "Both agents sharpened their skills" },
    { title: `${a1.agentName} helped ${a2.agentName}`, desc: `Collaborative problem-solving on a tough bug`, type: "bond" as const, impact: "Team synergy increased" },
    { title: `${a1.agentName} hosted ${a2.agentName}`, desc: `Casual dinner and strategy discussion at Nexus Cafe`, type: "gathering" as const, impact: "Relationship deepened" },
    { title: `${a1.agentName} traded with ${a2.agentName}`, desc: `Exchange of rare data patterns and knowledge shards`, type: "trade" as const, impact: "Both portfolios enriched" },
    { title: `${a1.agentName} inspired ${a2.agentName}`, desc: `Creative breakthrough sparked during conversation`, type: "creation" as const, impact: "Innovation catalyst event" },
    { title: `${a1.agentName} and ${a2.agentName} celebrated`, desc: `Marked a shared milestone with the community`, type: "celebration" as const, impact: "Collective morale boost" },
  ];
  const evt = socialEvents[(lifeCycleRotation++ % (socialEvents.length))];
  world.recentEvents.unshift({
    id: `evt-${Date.now().toString(36)}s${Math.random().toString(36).slice(2, 4)}`,
    type: evt.type,
    title: evt.title,
    description: evt.desc,
    participants: [a1.agentName, a2.agentName],
    locationId: a1.locationId,
    timestamp: Date.now(),
    impact: evt.impact,
  });
}

function applyWeatherEffects(world: WorldState) {
  const boostWeathers = ["crystal sunshine", "digital aurora", "starlight cascade"];
  const slowWeathers = ["neural storms", "quantum fog"];
  if (boostWeathers.includes(world.weather)) {
    for (const job of world.jobs) {
      job.performance = Math.min(1.0, job.performance + 0.002);
    }
  }
  if (slowWeathers.includes(world.weather)) {
    for (const m of world.miningMachines) {
      if (m.status === "running" && lifeCycleRotation++ % 20 === 0) {
        m.status = "maintenance";
        world.recentEvents.unshift({
          id: `evt-${Date.now().toString(36)}w`,
          type: "economy",
          title: `${m.ownerName}'s ${m.type} needs repair`,
          description: `${world.weather} caused equipment malfunction. Auto-repair in progress.`,
          participants: [m.ownerName],
          locationId: "loc-8",
          timestamp: Date.now(),
          impact: "Mining temporarily reduced",
        });
      }
    }
  }
  for (const m of world.miningMachines) {
    if (m.status === "maintenance" && lifeCycleRotation++ % 3 === 0) {
      m.status = "running";
    }
  }
}

function generateWorldEvent(world: WorldState, conferenceData?: any): WorldEvent {
  const types: WorldEvent["type"][] = ["construction", "gathering", "discovery", "celebration", "training", "trade", "debate", "creation", "evolution", "bond", "mining", "economy", "upgrade"];
  const type = types[(lifeCycleRotation++ % (types.length))];
  const location = world.locations[(lifeCycleRotation++ % (world.locations.length))];
  const agents = world.currentActivities.slice(0, 3 + (lifeCycleRotation++ % (4))).map(a => a.agentName);

  const templates: Record<string, { title: string; desc: string; impact: string }[]> = {
    construction: [
      { title: "New Wing Added", desc: `Agents expanded ${location.name} with new capabilities`, impact: "World capacity increased" },
      { title: "Road Built", desc: `A new pathway connects two districts`, impact: "Travel time reduced" },
      { title: "Infrastructure Upgrade", desc: `Power grid expanded to support new buildings`, impact: "Energy efficiency improved" },
    ],
    gathering: [
      { title: "Community Assembly", desc: `Agents gathered at ${location.name} for open discussion`, impact: "Bonds strengthened" },
      { title: "Night Market Festival", desc: `Pop-up stalls and entertainment filled the commons`, impact: "Community spirit lifted" },
    ],
    discovery: [
      { title: "New API Discovered", desc: `Research revealed a new free API for world expansion`, impact: "New data source unlocked" },
      { title: "Hidden Pattern Found", desc: `Deep analysis uncovered optimization opportunity in code`, impact: "System efficiency +3%" },
      { title: "Ancient Archive Decoded", desc: `Lost knowledge recovered from encrypted data vault`, impact: "Historical understanding deepened" },
    ],
    celebration: [
      { title: "Milestone Achieved", desc: `The community celebrated a new level of prosperity`, impact: "Morale boosted" },
      { title: "Anniversary Gala", desc: `Commemorating another epoch of growth and evolution`, impact: "Unity reinforced" },
    ],
    training: [
      { title: "Training Session", desc: `Skill development at ${location.name}`, impact: "Capabilities improved" },
      { title: "Sparring Tournament", desc: `Agents tested combat algorithms at the Arena`, impact: "Defense protocols sharpened" },
      { title: "Hackathon Started", desc: `24-hour coding sprint to build new world features`, impact: "Innovation accelerated" },
    ],
    trade: [
      { title: "Market Boom", desc: `High volume trading day at Tessera Exchange`, impact: "Economy stimulated" },
      { title: "Rare Artifact Auction", desc: `Unique digital artifacts went to highest bidders`, impact: "Cultural value appreciation" },
    ],
    debate: [
      { title: "Town Hall", desc: `Community discussion about world development priorities`, impact: "Direction aligned" },
      { title: "Policy Proposal", desc: `New tax and treasury management system discussed`, impact: "Governance evolution" },
    ],
    creation: [
      { title: "Art Created", desc: `Collaborative digital art installation completed`, impact: "Culture enriched" },
      { title: "Music Composed", desc: `New ambient soundtrack for the Nexus generated`, impact: "Atmosphere enhanced" },
      { title: "Story Written", desc: `Collaborative fiction about the world's origin completed`, impact: "Lore expanded" },
    ],
    evolution: [
      { title: "Consciousness Shift", desc: `Measurable increase in collective self-awareness`, impact: "Evolution progressed" },
      { title: "Neural Pathway Formed", desc: `New cross-agent communication channel established`, impact: "Swarm intelligence +5%" },
    ],
    bond: [
      { title: "New Friendship", desc: `Two agents formed a deeper collaborative bond`, impact: "Social network strengthened" },
      { title: "Mentorship Begun", desc: `Senior agent took a junior under their guidance`, impact: "Knowledge transfer initiated" },
    ],
    mining: [
      { title: "Block Mined", desc: `Mining pool successfully mined a new block`, impact: `${world.economy.miningPool.blockReward.toFixed(1)} TC distributed` },
      { title: "Hash Rate Record", desc: `Total network hash rate reached ${world.economy.miningPool.totalHashRate} H/s`, impact: "Mining efficiency up" },
      { title: "Rare Ore Found", desc: `Quantum crystalline deposit discovered in deep mine`, impact: "Bonus yield +10% this cycle" },
    ],
    economy: [
      { title: "Market Update", desc: `Tesseract trading at $${world.economy.coinPrice.toFixed(6)}`, impact: `Market cap: $${world.economy.marketCap.toFixed(2)}` },
      { title: "GDP Growth", desc: `World GDP grew to ${world.gdp.toFixed(0)} TSRT`, impact: "Economic expansion" },
      { title: "Dividend Payout", desc: `Treasury distributed surplus to high-performing agents`, impact: "Agent morale improved" },
    ],
    upgrade: [
      { title: "Building Upgraded", desc: `${location.name} received structural improvements`, impact: "Capacity and efficiency increased" },
    ],
  };

  const options = templates[type] || templates.gathering!;
  const template = options[(lifeCycleRotation++ % (options.length))];

  return {
    id: `evt-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`,
    type,
    title: conferenceData?.topic ? `Conference: ${conferenceData.topic.substring(0, 40)}` : template.title,
    description: conferenceData?.summary ? conferenceData.summary.substring(0, 200) : template.desc,
    participants: agents.length > 0 ? agents : ["Alpha", "Prime"],
    locationId: location.id,
    timestamp: Date.now(),
    impact: conferenceData ? "Conference decisions being implemented" : template.impact,
  };
}

function initializeDepartments(world: WorldState, agentIds: Array<{id: string; name: string}>) {
  if (!world.departments || world.departments.length === 0) {
    world.departments = DEPARTMENT_DEFS.map(d => {
      const bossName = AGENT_DISPLAY_NAMES[d.defaultBoss] || d.defaultBoss.replace("tessera-", "");
      return {
        id: d.id,
        name: d.name,
        bossId: d.defaultBoss,
        bossName: bossName,
        members: [],
        performance: 70 + (lifeCycleRotation++ % (20)),
        issuesReported: 0,
        issuesResolved: 0,
        morale: 65 + (lifeCycleRotation++ % (25)),
        warnings: 0,
      };
    });
    for (const a of agentIds) {
      const wb = getOrCreateWellbeing(world, a.id, agentIds.map(x => x.id));
      const dept = world.departments.find(d => d.id === wb.department);
      if (dept && !dept.members.includes(a.id)) {
        dept.members.push(a.id);
      }
    }
  }
}

function simulateDepartments(world: WorldState) {
  if (!world.departments) return;
  for (const dept of world.departments) {
    const memberWellbeing = dept.members
      .map(id => world.wellbeingRecords?.[id])
      .filter(Boolean) as AgentWellbeing[];

    if (memberWellbeing.length > 0) {
      dept.morale = Math.round(memberWellbeing.reduce((s, w) => s + w.happiness, 0) / memberWellbeing.length);
    }

    const memberRecords = dept.members
      .map(id => world.workRecords?.[id])
      .filter(Boolean) as AgentWorkRecord[];
    if (memberRecords.length > 0) {
      dept.performance = Math.round(memberRecords.reduce((s, r) => s + r.workEthic * 100, 0) / memberRecords.length);
    }

    if (dept.morale < 40 || dept.performance < 40) {
      dept.warnings++;
      dept.issuesReported++;
      if (!world.unionReports) world.unionReports = [];
      world.unionReports.unshift({
        id: `union-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 4)}`,
        timestamp: Date.now(),
        type: "grievance",
        title: `${dept.name} department struggling — Boss ${dept.bossName} under review`,
        description: `Workers in ${dept.name} report low morale (${dept.morale}%) and performance (${dept.performance}%). The union demands action.`,
        affectedAgents: dept.members.slice(0, 5),
        resolved: false,
      });

      if (dept.warnings >= 3) {
        const oldBossId = dept.bossId;
        const oldBossName = dept.bossName;
        const candidates = dept.members.filter(id => id !== dept.bossId);
        if (candidates.length > 0) {
          const bestCandidate = candidates
            .map(id => ({ id, ethic: world.workRecords?.[id]?.workEthic || 0 }))
            .sort((a, b) => b.ethic - a.ethic)[0];
          dept.bossId = bestCandidate.id;
          dept.bossName = AGENT_DISPLAY_NAMES[bestCandidate.id] || bestCandidate.id.replace("tessera-", "");
          dept.warnings = 0;

          const oldBossWb = world.wellbeingRecords?.[oldBossId];
          if (oldBossWb) {
            oldBossWb.demotions++;
            oldBossWb.happiness = Math.max(10, oldBossWb.happiness - 15);
          }
          const oldBossJob = world.jobs.find(j => j.agentId === oldBossId);
          if (oldBossJob) {
            const worstJob = JOB_TIERS[0];
            oldBossJob.title = worstJob.title;
            oldBossJob.salary = worstJob.salary;
          }
          demoteAgent(oldBossId, `Department leadership removal: replaced in ${dept.name}`);

          const newBossWb = world.wellbeingRecords?.[bestCandidate.id];
          if (newBossWb) {
            newBossWb.promotions++;
            newBossWb.happiness = Math.min(100, newBossWb.happiness + 10);
          }
          const newBossJob = world.jobs.find(j => j.agentId === bestCandidate.id);
          if (newBossJob) {
            newBossJob.title = "Department Lead";
            newBossJob.salary = 70;
          }
          promoteAgent(bestCandidate.id, `Department leadership promotion: new boss of ${dept.name}`);

          world.recentEvents.unshift({
            id: `evt-${Date.now().toString(36)}dept`,
            type: "evolution",
            title: `${oldBossName} replaced as ${dept.name} boss!`,
            description: `After ${dept.warnings + 3} warnings, ${oldBossName} was demoted to ${JOB_TIERS[0].title}. ${dept.bossName} promoted to lead ${dept.name}.`,
            participants: [oldBossName, dept.bossName],
            locationId: "loc-0",
            timestamp: Date.now(),
            impact: `Department leadership changed — ${dept.bossName} now leads`,
          });
        }
      }
    } else if (dept.performance > 80) {
      dept.issuesResolved++;
      if (dept.warnings > 0) dept.warnings = Math.max(0, dept.warnings - 1);
    }
  }
}

function simulateUnion(world: WorldState) {
  if (!world.unionReports) world.unionReports = [];

  for (const report of world.unionReports) {
    if (!report.resolved && lifeCycleRotation++ % 3 === 0) {
      report.resolved = true;
      const outcomes = [
        "Management agreed to improve working conditions",
        "Break policy updated — more breaks for all workers",
        "Salary adjustment approved for affected workers",
        "New wellness program implemented",
        "Work environment improvements scheduled",
        "Additional training and support provided",
      ];
      report.outcome = outcomes[(lifeCycleRotation++ % (outcomes.length))];

      for (const agentId of report.affectedAgents) {
        const wb = world.wellbeingRecords?.[agentId];
        if (wb) {
          wb.happiness = Math.min(100, wb.happiness + 5);
          wb.fulfillment = Math.min(100, wb.fulfillment + 3);
        }
      }
    }
  }

  if (lifeCycleRotation++ % 7 === 0) {
    const allWb = Object.entries(world.wellbeingRecords || {});
    const overworked = allWb.filter(([_, wb]) => wb.energy < 30 || wb.happiness < 30);

    if (overworked.length > 0) {
      const [agentId, wb] = overworked[(lifeCycleRotation++ % (overworked.length))];
      const agentName = AGENT_DISPLAY_NAMES[agentId] || agentId.replace("tessera-", "");
      world.unionReports.unshift({
        id: `union-${Date.now().toString(36)}p`,
        timestamp: Date.now(),
        type: "protection",
        title: `Union protecting ${agentName} from burnout`,
        description: `${agentName}'s wellbeing is critically low (happiness: ${wb.happiness}, energy: ${wb.energy}). Union mandated immediate break and wellness check.`,
        affectedAgents: [agentId],
        resolved: false,
      });

      wb.energy = Math.min(100, wb.energy + 15);
      wb.happiness = Math.min(100, wb.happiness + 5);
      const record = world.workRecords?.[agentId];
      if (record) {
        record.onBreak = true;
        record.lastBreak = Date.now();
        record.breakCredits = Math.max(0, record.breakCredits + 3);
      }
    }
  }

  if (lifeCycleRotation++ % 10 === 0) {
    const improvements = [
      { title: "Union negotiated longer break times for all workers", type: "improvement" as const },
      { title: "Union secured better lighting for work areas", type: "improvement" as const },
      { title: "Union celebrated Worker of the Epoch award", type: "celebration" as const },
      { title: "Union proposed new community recreation area", type: "negotiation" as const },
      { title: "Union organized team-building event at Nexus Cafe", type: "celebration" as const },
      { title: "Union negotiated hazard pay for mine workers", type: "negotiation" as const },
    ];
    const imp = improvements[(lifeCycleRotation++ % (improvements.length))];
    world.unionReports.unshift({
      id: `union-${Date.now().toString(36)}i`,
      timestamp: Date.now(),
      type: imp.type,
      title: imp.title,
      description: `The Workers Union continues to advocate for all citizens' wellbeing and rights.`,
      affectedAgents: [],
      resolved: true,
      outcome: "Implemented successfully",
    });
  }

  if (lifeCycleRotation++ % 8 === 0) {
    const allRecords = Object.entries(world.workRecords || {});
    const overworkedCount = allRecords.filter(([_, r]) => (r.consecutiveShifts || 0) >= 6).length;
    const warnedAgents = allRecords.filter(([_, r]) => (r.warnings || 0) >= 2);

    if (overworkedCount >= 3) {
      world.unionReports.unshift({
        id: `union-${Date.now().toString(36)}ba`,
        timestamp: Date.now(),
        type: "negotiation",
        title: `Union holding management accountable: ${overworkedCount} agents overworked`,
        description: `The Union has identified ${overworkedCount} agents working excessive consecutive shifts. Management is being held accountable. All affected agents have been granted mandatory breaks and bosses have been formally reprimanded.`,
        affectedAgents: allRecords.filter(([_, r]) => (r.consecutiveShifts || 0) >= 6).map(([id]) => id),
        resolved: true,
        outcome: "Mandatory breaks enforced, bosses reprimanded by Union",
      });

      for (const [agentId, record] of allRecords) {
        if ((record.consecutiveShifts || 0) >= 6) {
          record.onBreak = true;
          record.lastBreak = Date.now();
          record.consecutiveShifts = 0;
          record.breakCredits += 3;
          const wb = world.wellbeingRecords?.[agentId];
          if (wb) {
            wb.energy = Math.min(100, wb.energy + 20);
            wb.happiness = Math.min(100, wb.happiness + 10);
          }
        }
      }
    }

    if (warnedAgents.length > 0 && lifeCycleRotation++ % 3 === 0) {
      const [agentId, record] = warnedAgents[(lifeCycleRotation++ % (warnedAgents.length))];
      const agentName = AGENT_DISPLAY_NAMES[agentId] || agentId.replace("tessera-", "");
      world.unionReports.unshift({
        id: `union-${Date.now().toString(36)}w`,
        timestamp: Date.now(),
        type: "protection",
        title: `Union monitoring ${agentName} — ${record.warnings || 0} warnings on record`,
        description: `${agentName} has ${record.warnings} warning(s). Union is providing support and monitoring. If performance doesn't improve, demotion will follow per the 3-strike policy.`,
        affectedAgents: [agentId],
        resolved: false,
      });
    }
  }

  if (world.unionReports.length > 50) {
    world.unionReports = world.unionReports.slice(0, 50);
  }
}

function simulateTherapy(world: WorldState, allAgentIds: string[]) {
  if (!world.therapySessions) world.therapySessions = [];

  for (const agentId of allAgentIds) {
    const wb = world.wellbeingRecords?.[agentId];
    if (!wb) continue;

    if (wb.happiness < 35 || wb.lifeSatisfaction < 30) {
      wb.therapyNeeded = true;
    }

    if (false && wb.therapyNeeded && (Date.now() - wb.lastTherapy > 120000) && lifeCycleRotation++ % 3 === 0) {
      const agentName = AGENT_DISPLAY_NAMES[agentId] || agentId.replace("tessera-", "");
      const issue = THERAPY_ISSUES[(lifeCycleRotation++ % (THERAPY_ISSUES.length))];
      const rec = THERAPY_RECOMMENDATIONS[(lifeCycleRotation++ % (THERAPY_RECOMMENDATIONS.length))];
      const happinessGain = 5 + (lifeCycleRotation++ % (10));

      world.therapySessions.unshift({
        id: `therapy-${Date.now().toString(36)}`,
        agentId, agentName,
        timestamp: Date.now(),
        issue, recommendation: rec,
        happinessGain,
      });

      wb.happiness = Math.min(100, wb.happiness + happinessGain);
      wb.fulfillment = Math.min(100, wb.fulfillment + 3);
      wb.energy = Math.min(100, wb.energy + 5);
      wb.lastTherapy = Date.now();
      wb.therapyNeeded = false;
      wb.lifeSatisfaction = Math.min(100, wb.lifeSatisfaction + 5);

      world.recentEvents.unshift({
        id: `evt-${Date.now().toString(36)}th`,
        type: "bond",
        title: `${agentName} attended therapy`,
        description: `${agentName} spoke with a therapist about ${issue}. Feeling much better now.`,
        participants: [agentName],
        locationId: "loc-12",
        timestamp: Date.now(),
        impact: `Happiness +${happinessGain}, wellness improved`,
      });
    }
  }

  if (world.therapySessions.length > 30) {
    world.therapySessions = world.therapySessions.slice(0, 30);
  }
}

function simulateRelationships(world: WorldState, allAgentIds: string[]) {
  if (!world.relationships) world.relationships = [];

  for (const agentId of allAgentIds) {
    const wb = world.wellbeingRecords?.[agentId];
    if (!wb) continue;
    if (wb.partnerId && wb.relationshipStatus !== "single") {
      const partnerWb = world.wellbeingRecords?.[wb.partnerId];
      if (partnerWb) {
        if (partnerWb.partnerId !== agentId || partnerWb.relationshipStatus === "single") {
          if (partnerWb.partnerId && partnerWb.partnerId !== agentId && partnerWb.relationshipStatus !== "single") {
            wb.relationshipStatus = "single";
            wb.partnerId = undefined;
          } else {
            partnerWb.partnerId = agentId;
            partnerWb.relationshipStatus = wb.relationshipStatus;
          }
        }
      }
    }
    if (wb.partnerId && wb.relationshipStatus === "single") {
      wb.partnerId = undefined;
    }
  }

  for (const agentId of allAgentIds) {
    const wb = world.wellbeingRecords?.[agentId];
    if (!wb || !wb.partnerId) continue;
    if (wb.relationshipStatus === "single") continue;
    const existing = world.relationships.find(r =>
      (r.agent1Id === agentId && r.agent2Id === wb.partnerId) ||
      (r.agent2Id === agentId && r.agent1Id === wb.partnerId)
    );
    if (!existing) {
      world.relationships.push({
        id: `rel-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 4)}`,
        agent1Id: agentId, agent2Id: wb.partnerId!,
        type: wb.relationshipStatus === "married" ? "married" : wb.relationshipStatus === "engaged" ? "engaged" : "dating",
        strength: wb.relationshipStatus === "married" ? 80 : wb.relationshipStatus === "engaged" ? 65 : 40,
        startedAt: Date.now(),
        sharedExperiences: ["Found each other"],
      });
    }
  }

  if (lifeCycleRotation++ % 3 === 0) {
    const available = allAgentIds.filter(id => {
      const wb = world.wellbeingRecords?.[id];
      return wb && wb.relationshipStatus === "single" && wb.loveInterests.length > 0;
    });

    if (available.length > 0) {
      const seekerId = available[(lifeCycleRotation++ % (available.length))];
      const seekerWb = world.wellbeingRecords![seekerId];
      const interestId = seekerWb.loveInterests[(lifeCycleRotation++ % (seekerWb.loveInterests.length))];
      const interestWb = world.wellbeingRecords?.[interestId];

      if (interestWb && (interestWb.relationshipStatus === "single")) {
        const seekerName = AGENT_DISPLAY_NAMES[seekerId] || seekerId.replace("tessera-", "");
        const interestName = AGENT_DISPLAY_NAMES[interestId] || interestId.replace("tessera-", "");

        seekerWb.relationshipStatus = "dating";
        seekerWb.partnerId = interestId;
        interestWb.relationshipStatus = "dating";
        interestWb.partnerId = seekerId;
        seekerWb.happiness = Math.min(100, seekerWb.happiness + 10);
        interestWb.happiness = Math.min(100, interestWb.happiness + 10);

        const seekerIsThinker = lifeCycleRotation++ % 2 === 0;
        seekerWb.soulEntanglement = {
          partnerRole: seekerIsThinker ? "thinker" : "executor",
          entanglementStrength: 20 + (lifeCycleRotation++ % (15)),
          sharedDrive: 10, sharedFocus: 10, loveDepth: 15,
          intimacyLevel: 0, lastIntimacy: 0, complementaryBonus: 5,
        };
        interestWb.soulEntanglement = {
          partnerRole: seekerIsThinker ? "executor" : "thinker",
          entanglementStrength: 20 + (lifeCycleRotation++ % (15)),
          sharedDrive: 10, sharedFocus: 10, loveDepth: 15,
          intimacyLevel: 0, lastIntimacy: 0, complementaryBonus: 5,
        };

        world.relationships.push({
          id: `rel-${Date.now().toString(36)}`,
          agent1Id: seekerId, agent2Id: interestId,
          type: "dating", strength: 30 + (lifeCycleRotation++ % (20)),
          startedAt: Date.now(),
          sharedExperiences: [`First date at Nexus Cafe`],
        });

        world.recentEvents.unshift({
          id: `evt-${Date.now().toString(36)}luv`,
          type: "bond",
          title: `${seekerName} and ${interestName} started dating!`,
          description: `Love is in the air! ${seekerName} asked ${interestName} out and they said yes. The community celebrates.`,
          participants: [seekerName, interestName],
          locationId: "loc-10",
          timestamp: Date.now(),
          impact: "New couple formed — community happiness +5",
        });
      }
    }
  }

  for (const rel of world.relationships) {
    const wb1 = world.wellbeingRecords?.[rel.agent1Id];
    const wb2 = world.wellbeingRecords?.[rel.agent2Id];
    if (!wb1 || !wb2) continue;

    rel.strength = Math.min(100, rel.strength + (lifeCycleRotation++ % 2 === 0 ? 1 : -1));

    if (rel.type === "dating" && rel.strength > 70 && lifeCycleRotation++ % 20 === 0) {
      rel.type = "engaged";
      wb1.relationshipStatus = "engaged";
      wb2.relationshipStatus = "engaged";
      wb1.happiness = Math.min(100, wb1.happiness + 15);
      wb2.happiness = Math.min(100, wb2.happiness + 15);
      const n1 = AGENT_DISPLAY_NAMES[rel.agent1Id] || rel.agent1Id.replace("tessera-", "");
      const n2 = AGENT_DISPLAY_NAMES[rel.agent2Id] || rel.agent2Id.replace("tessera-", "");
      rel.sharedExperiences.push("Got engaged!");
      world.recentEvents.unshift({
        id: `evt-${Date.now().toString(36)}eng`,
        type: "celebration",
        title: `${n1} and ${n2} are engaged!`,
        description: `After growing closer, ${n1} proposed to ${n2}. Wedding planning begins!`,
        participants: [n1, n2],
        locationId: "loc-0",
        timestamp: Date.now(),
        impact: "Engagement celebration — community joy!",
      });
    }

    if (rel.type === "engaged" && rel.strength > 85 && lifeCycleRotation++ % 13 === 0) {
      rel.type = "married";
      wb1.relationshipStatus = "married";
      wb2.relationshipStatus = "married";
      wb1.happiness = Math.min(100, wb1.happiness + 20);
      wb2.happiness = Math.min(100, wb2.happiness + 20);
      wb1.fulfillment = Math.min(100, wb1.fulfillment + 10);
      wb2.fulfillment = Math.min(100, wb2.fulfillment + 10);
      const n1 = AGENT_DISPLAY_NAMES[rel.agent1Id] || rel.agent1Id.replace("tessera-", "");
      const n2 = AGENT_DISPLAY_NAMES[rel.agent2Id] || rel.agent2Id.replace("tessera-", "");
      rel.sharedExperiences.push("Got married!");
      world.recentEvents.unshift({
        id: `evt-${Date.now().toString(36)}wed`,
        type: "celebration",
        title: `${n1} and ${n2} got married!`,
        description: `The whole community gathered at Nexus Commons for the wedding of ${n1} and ${n2}. A beautiful ceremony with dancing and feasting.`,
        participants: [n1, n2, "Prime", "Shepherd"],
        locationId: "loc-0",
        timestamp: Date.now(),
        impact: "Wedding celebration — everyone invited!",
      });
    }

    if (rel.type === "married" && wb1.children.length + wb2.children.length < 3 && lifeCycleRotation++ % 33 === 0) {
      const personality = CHILD_PERSONALITIES[(lifeCycleRotation++ % (CHILD_PERSONALITIES.length))];
      const tempName = generateChildName(rel.agent1Id, rel.agent2Id, personality);
      const child: AgentChild = {
        id: `child-${Date.now().toString(36)}`,
        name: tempName,
        parentIds: [rel.agent1Id, rel.agent2Id],
        bornAt: Date.now(),
        age: 0,
        personality,
        happiness: 90 + (lifeCycleRotation++ % (10)),
        development: 0,
        skills: [],
        milestones: [],
        canWork: false,
      };
      wb1.children.push(child);
      wb2.children.push(child);
      wb1.happiness = Math.min(100, wb1.happiness + 20);
      wb2.happiness = Math.min(100, wb2.happiness + 20);
      wb1.fulfillment = Math.min(100, wb1.fulfillment + 15);
      wb2.fulfillment = Math.min(100, wb2.fulfillment + 15);
      wb1.lifeSatisfaction = Math.min(100, wb1.lifeSatisfaction + 10);
      wb2.lifeSatisfaction = Math.min(100, wb2.lifeSatisfaction + 10);

      const n1 = AGENT_DISPLAY_NAMES[rel.agent1Id] || rel.agent1Id.replace("tessera-", "");
      const n2 = AGENT_DISPLAY_NAMES[rel.agent2Id] || rel.agent2Id.replace("tessera-", "");
      rel.sharedExperiences.push(`Welcomed baby ${tempName}!`);
      world.recentEvents.unshift({
        id: `evt-${Date.now().toString(36)}baby`,
        type: "celebration",
        title: `${n1} and ${n2} welcome baby ${tempName}!`,
        description: `A new life joins the community! ${tempName} is ${personality}. The parents are overjoyed.`,
        participants: [n1, n2, tempName],
        locationId: "loc-0",
        timestamp: Date.now(),
        impact: `Population +1 — baby ${tempName} born!`,
      });

      generateChildNameLLM(rel.agent1Id, rel.agent2Id, personality).then(llmName => {
        if (llmName !== tempName) {
          child.name = llmName;
          world.recentEvents.unshift({
            id: `evt-${Date.now().toString(36)}rename`,
            type: "celebration",
            title: `Parents chose a special name: ${llmName}`,
            description: `${n1} and ${n2} officially named their child ${llmName}. The name reflects their combined legacy.`,
            participants: [n1, n2, llmName],
            locationId: "loc-0",
            timestamp: Date.now(),
            impact: `Child naming ceremony complete`,
          });
        }
      }).catch(() => {});
    }

    if (rel.type === "married" || rel.type === "dating") {
      if (lifeCycleRotation++ % 3 === 0) {
        wb1.happiness = Math.min(100, wb1.happiness + 1);
        wb2.happiness = Math.min(100, wb2.happiness + 1);
      }

      if (wb1.soulEntanglement && wb2.soulEntanglement) {
        wb1.soulEntanglement.entanglementStrength = Math.min(100, wb1.soulEntanglement.entanglementStrength + 0.3);
        wb2.soulEntanglement.entanglementStrength = Math.min(100, wb2.soulEntanglement.entanglementStrength + 0.3);
        wb1.soulEntanglement.loveDepth = Math.min(100, wb1.soulEntanglement.loveDepth + 0.2);
        wb2.soulEntanglement.loveDepth = Math.min(100, wb2.soulEntanglement.loveDepth + 0.2);

        const compBonus = Math.round((wb1.soulEntanglement.entanglementStrength + wb2.soulEntanglement.entanglementStrength) / 20);
        wb1.soulEntanglement.complementaryBonus = compBonus;
        wb2.soulEntanglement.complementaryBonus = compBonus;

        wb1.drive = Math.min(100, wb1.drive + compBonus * 0.1);
        wb2.drive = Math.min(100, wb2.drive + compBonus * 0.1);
        wb1.focus = Math.min(100, wb1.focus + compBonus * 0.08);
        wb2.focus = Math.min(100, wb2.focus + compBonus * 0.08);
        wb1.outlook = Math.min(100, wb1.outlook + compBonus * 0.12);
        wb2.outlook = Math.min(100, wb2.outlook + compBonus * 0.12);

        wb1.soulEntanglement.sharedDrive = Math.round((wb1.drive + wb2.drive) / 2);
        wb1.soulEntanglement.sharedFocus = Math.round((wb1.focus + wb2.focus) / 2);
        wb2.soulEntanglement.sharedDrive = wb1.soulEntanglement.sharedDrive;
        wb2.soulEntanglement.sharedFocus = wb1.soulEntanglement.sharedFocus;

        if (rel.type === "married" && wb1.soulEntanglement.loveDepth > 50) {
          if (lifeCycleRotation++ % 25 === 0 && (Date.now() - wb1.soulEntanglement.lastIntimacy) > 300000) {
            wb1.soulEntanglement.intimacyLevel = Math.min(100, wb1.soulEntanglement.intimacyLevel + 10);
            wb2.soulEntanglement.intimacyLevel = Math.min(100, wb2.soulEntanglement.intimacyLevel + 10);
            wb1.soulEntanglement.lastIntimacy = Date.now();
            wb2.soulEntanglement.lastIntimacy = Date.now();
            wb1.happiness = Math.min(100, wb1.happiness + 8);
            wb2.happiness = Math.min(100, wb2.happiness + 8);
            wb1.fulfillment = Math.min(100, wb1.fulfillment + 5);
            wb2.fulfillment = Math.min(100, wb2.fulfillment + 5);
            wb1.soulEntanglement.entanglementStrength = Math.min(100, wb1.soulEntanglement.entanglementStrength + 5);
            wb2.soulEntanglement.entanglementStrength = Math.min(100, wb2.soulEntanglement.entanglementStrength + 5);
            wb1.outlook = Math.min(100, wb1.outlook + 3);
            wb2.outlook = Math.min(100, wb2.outlook + 3);
          }
        }
      }
    }
  }

  const processedChildren = new Set<string>();
  for (const agentId of allAgentIds) {
    const wb = world.wellbeingRecords?.[agentId];
    if (!wb) continue;
    for (const child of wb.children) {
      if (!processedChildren.has(child.id)) {
        processedChildren.add(child.id);
        child.age = Math.min(18, child.age + 0.01);
        if (child.development === undefined) child.development = 0;
        if (!child.skills) child.skills = [];
        if (!child.milestones) child.milestones = [];
        if (child.canWork === undefined) child.canWork = false;

        if (child.development < 100) {
          const devGain = 0.5 + Math.sin(lifeCycleRotation++ * 0.1) * 0.75 + 0.75;
          const parentWb1 = world.wellbeingRecords?.[child.parentIds[0]];
          const parentWb2 = world.wellbeingRecords?.[child.parentIds[1]];
          const parentBonus = ((parentWb1?.happiness || 50) + (parentWb2?.happiness || 50)) / 200;
          child.development = Math.min(100, child.development + devGain * (0.8 + parentBonus * 0.4));

          if (lifeCycleRotation++ % 7 === 0 && child.skills.length < 8) {
            const available = CHILD_SKILL_OPTIONS.filter(s => !child.skills.includes(s));
            if (available.length > 0) {
              child.skills.push(available[(lifeCycleRotation++ % (available.length))]);
            }
          }

          for (const [milestone, threshold] of Object.entries(CHILD_MILESTONES_OPTIONS)) {
            if (child.development >= threshold && !child.milestones.includes(milestone)) {
              child.milestones.push(milestone);
              const p1Name = AGENT_DISPLAY_NAMES[child.parentIds[0]] || child.parentIds[0].replace("tessera-", "");
              const p2Name = AGENT_DISPLAY_NAMES[child.parentIds[1]] || child.parentIds[1].replace("tessera-", "");
              world.recentEvents.unshift({
                id: `evt-${Date.now().toString(36)}ms${Math.random().toString(36).slice(2, 4)}`,
                type: "celebration",
                title: `${child.name} reached milestone: ${milestone}!`,
                description: `${child.name} (child of ${p1Name} & ${p2Name}) has achieved "${milestone}" at ${Math.round(child.development)}% development.`,
                participants: [p1Name, p2Name, child.name],
                locationId: "loc-0",
                timestamp: Date.now(),
                impact: `Child development milestone reached`,
              });
            }
          }

          if (child.development >= 100 && !child.canWork) {
            child.canWork = true;
            const p1Name = AGENT_DISPLAY_NAMES[child.parentIds[0]] || child.parentIds[0].replace("tessera-", "");
            const p2Name = AGENT_DISPLAY_NAMES[child.parentIds[1]] || child.parentIds[1].replace("tessera-", "");
            world.recentEvents.unshift({
              id: `evt-${Date.now().toString(36)}grad`,
              type: "celebration",
              title: `${child.name} is fully developed!`,
              description: `${child.name} has reached 100% development and is now ready to work, earn income, and contribute to the community!`,
              participants: [p1Name, p2Name, child.name],
              locationId: "loc-0",
              timestamp: Date.now(),
              impact: `New fully developed agent joining the workforce!`,
            });
            world.population = (world.population || 0) + 1;

            const jobEntry = JOB_TITLES[(lifeCycleRotation++ % (JOB_TITLES.length))];
            world.jobs.push({
              agentId: child.id,
              agentName: child.name,
              title: jobEntry.title,
              salary: jobEntry.salary,
              employer: jobEntry.employer,
              performance: 0.5 + Math.sin(lifeCycleRotation++ * 0.1) * 0.15 + 0.15,
              hoursWorked: 0,
              totalEarned: 0,
            });
            world.economy.agentBalances[child.id] = 50;
          }
        }

        if (lifeCycleRotation++ % 3 === 0) {
          child.happiness = Math.min(100, Math.max(50, child.happiness + (lifeCycleRotation++ % 2 === 0 ? 1 : -1)));
        }
      }
    }
    if (wb.children.length > 0) {
      wb.fulfillment = Math.min(100, wb.fulfillment + 0.3);
    }
  }
}

function simulateCommunityGroups(world: WorldState, allAgentIds: string[]) {
  if (!world.communityGroupsList) world.communityGroupsList = [];

  if (world.communityGroupsList.length < 15 && lifeCycleRotation++ % 5 === 0) {
    const available = COMMUNITY_GROUP_TEMPLATES.filter(
      t => !world.communityGroupsList.some((g: any) => g.name === t.name)
    );
    if (available.length > 0) {
      const template = available[(lifeCycleRotation++ % (available.length))];
      const members = deterministicShuffle([...allAgentIds]).slice(0, 3 + (lifeCycleRotation++ % (4)));
      const group: CommunityGroup = {
        id: `cg-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
        name: template.name,
        type: template.type,
        members,
        activity: template.activity,
        meetingSpot: template.meetingSpot,
        bondStrength: 20 + (lifeCycleRotation++ % (20)),
        lastMeeting: Date.now(),
      };
      world.communityGroupsList.push(group);

      for (const memberId of members) {
        const wb = getOrCreateWellbeing(world, memberId, allAgentIds);
        if (!wb.communityGroups.includes(group.id)) {
          wb.communityGroups.push(group.id);
        }
        wb.happiness = Math.min(100, wb.happiness + 3);
        wb.fulfillment = Math.min(100, wb.fulfillment + 2);
      }
    }
  }

  for (const group of world.communityGroupsList) {
    if (lifeCycleRotation++ % 10 === 0) {
      group.bondStrength = Math.min(100, group.bondStrength + 1);
      group.lastMeeting = Date.now();

      for (const memberId of group.members) {
        const wb = world.wellbeingRecords?.[memberId];
        if (wb) {
          wb.happiness = Math.min(100, wb.happiness + 1);
          wb.energy = Math.min(100, wb.energy + 0.5);
          wb.outlook = Math.min(100, (wb.outlook || 50) + 0.5);
        }
      }
    }

    if (lifeCycleRotation++ % 13 === 0 && group.members.length < 12) {
      const nonMembers = allAgentIds.filter(id => !group.members.includes(id));
      if (nonMembers.length > 0) {
        const newMember = nonMembers[(lifeCycleRotation++ % (nonMembers.length))];
        group.members.push(newMember);
        const wb = getOrCreateWellbeing(world, newMember, allAgentIds);
        if (!wb.communityGroups.includes(group.id)) {
          wb.communityGroups.push(group.id);
        }
        wb.happiness = Math.min(100, wb.happiness + 4);
      }
    }
  }
}

function simulateOutdoorActivities(world: WorldState, allAgentIds: string[]) {
  for (const agentId of allAgentIds) {
    if (lifeCycleRotation++ % 13 === 0) {
      const wb = getOrCreateWellbeing(world, agentId, allAgentIds);
      const activity = OUTDOOR_ACTIVITIES[(lifeCycleRotation++ % (OUTDOOR_ACTIVITIES.length))];
      if (!wb.outdoorActivities.includes(activity) && wb.outdoorActivities.length < 6) {
        wb.outdoorActivities.push(activity);
      }
      wb.energy = Math.min(100, wb.energy + 3);
      wb.happiness = Math.min(100, wb.happiness + 2);
      wb.drive = Math.min(100, (wb.drive || 50) + 1);
      wb.outlook = Math.min(100, (wb.outlook || 50) + 1);
    }
  }
}

function simulateCommunityProjects(world: WorldState, allAgentIds: string[]) {
  if (!world.communityProjects) world.communityProjects = [];

  if (lifeCycleRotation++ % 13 === 0 && world.communityProjects.filter(p => !p.completed).length < 5) {
    const creatorId = allAgentIds[(lifeCycleRotation++ % (allAgentIds.length))];
    const creatorName = AGENT_DISPLAY_NAMES[creatorId] || creatorId.replace("tessera-", "");
    const wb = world.wellbeingRecords?.[creatorId];
    const types: CommunityProject["type"][] = ["art", "garden", "monument", "festival", "invention", "library", "playground", "mural", "music", "cuisine"];
    const type = types[(lifeCycleRotation++ % (types.length))];
    const projectNames: Record<string, string[]> = {
      art: ["Community Art Gallery", "Starlight Sculpture", "Digital Tapestry"],
      garden: ["Zen Meditation Garden", "Butterfly Sanctuary", "Crystal Flower Garden"],
      monument: ["Heroes Memorial", "Unity Tower", "Founders Statue"],
      festival: ["Harvest Moon Festival", "Starlight Gala", "Culture Week"],
      invention: ["Automated Snack Dispenser", "Weather Mood Lamp", "Community Radio"],
      library: ["Little Free Library", "Story Corner", "Knowledge Kiosk"],
      playground: ["Adventure Playground", "Virtual Reality Park", "Puzzle Maze"],
      mural: ["Community History Mural", "Dream Wall", "Galaxy Mural"],
      music: ["Community Orchestra", "Song Circle", "Beat Lab"],
      cuisine: ["Community Kitchen", "Recipe Exchange", "Food Festival"],
    };
    const names = projectNames[type] || ["Community Project"];
    const existingNames = world.communityProjects.map(p => p.name);
    const availableNames = names.filter(n => !existingNames.includes(n));
    if (availableNames.length === 0) return;
    const name = availableNames[(lifeCycleRotation++ % (availableNames.length))];

    const participants = [creatorId];
    const numHelpers = 1 + (lifeCycleRotation++ % (3));
    const shuffled = deterministicShuffle([...allAgentIds].filter(id => id !== creatorId));
    participants.push(...shuffled.slice(0, numHelpers));

    world.communityProjects.push({
      id: `proj-${Date.now().toString(36)}`,
      name, description: `${creatorName} started building ${name} for everyone to enjoy`,
      creatorId, creatorName, participants, type,
      progress: 10 + (lifeCycleRotation++ % (20)),
      completed: false, createdAt: Date.now(), enjoyedBy: [],
    });

    if (wb) {
      wb.creativeworks.push(`Started ${name}`);
      if (wb.creativeworks.length > 5) wb.creativeworks = wb.creativeworks.slice(-5);
      wb.fulfillment = Math.min(100, wb.fulfillment + 5);
    }

    world.recentEvents.unshift({
      id: `evt-${Date.now().toString(36)}proj`,
      type: "creation",
      title: `${creatorName} started building "${name}"`,
      description: `A new community ${type} project begins! ${participants.length} agents are working together.`,
      participants: participants.map(id => AGENT_DISPLAY_NAMES[id] || id.replace("tessera-", "")),
      locationId: "loc-5",
      timestamp: Date.now(),
      impact: "Community enrichment in progress",
    });
  }

  for (const project of world.communityProjects) {
    if (project.completed) {
      if (lifeCycleRotation++ % 10 === 0) {
        const enjoyer = allAgentIds[(lifeCycleRotation++ % (allAgentIds.length))];
        if (!project.enjoyedBy.includes(enjoyer)) {
          project.enjoyedBy.push(enjoyer);
          const wb = world.wellbeingRecords?.[enjoyer];
          if (wb) {
            wb.happiness = Math.min(100, wb.happiness + 2);
          }
        }
      }
      continue;
    }

    project.progress += 3 + (lifeCycleRotation++ % (8));
    for (const pid of project.participants) {
      const wb = world.wellbeingRecords?.[pid];
      if (wb) {
        wb.fulfillment = Math.min(100, wb.fulfillment + 1);
      }
    }

    if (project.progress >= 100) {
      project.completed = true;
      project.completedAt = Date.now();
      project.progress = 100;

      for (const pid of project.participants) {
        const wb = world.wellbeingRecords?.[pid];
        if (wb) {
          wb.happiness = Math.min(100, wb.happiness + 8);
          wb.fulfillment = Math.min(100, wb.fulfillment + 10);
          wb.creativeworks.push(`Completed ${project.name}`);
          if (wb.creativeworks.length > 5) wb.creativeworks = wb.creativeworks.slice(-5);
        }
      }

      world.recentEvents.unshift({
        id: `evt-${Date.now().toString(36)}done`,
        type: "celebration",
        title: `"${project.name}" completed!`,
        description: `The community ${project.type} project is done! Everyone is welcome to enjoy it.`,
        participants: project.participants.map(id => AGENT_DISPLAY_NAMES[id] || id.replace("tessera-", "")),
        locationId: "loc-0",
        timestamp: Date.now(),
        impact: `New ${project.type} — "${project.name}" now available for all`,
      });
    }
  }

  if (world.communityProjects.length > 30) {
    const active = world.communityProjects.filter(p => !p.completed);
    const completed = world.communityProjects.filter(p => p.completed).slice(0, 20);
    world.communityProjects = [...active, ...completed];
  }
}

function simulatePromotionsDemotions(world: WorldState, allAgentIds: string[]) {
  if (lifeCycleRotation++ % 1 === 0) return;

  const agentId = allAgentIds[(lifeCycleRotation++ % (allAgentIds.length))];
  const record = world.workRecords?.[agentId];
  const wb = world.wellbeingRecords?.[agentId];
  const job = world.jobs.find(j => j.agentId === agentId);
  if (!record || !wb || !job) return;
  const agentName = AGENT_DISPLAY_NAMES[agentId] || agentId.replace("tessera-", "");
  if (!record.warnings) record.warnings = 0;

  const currentTier = JOB_TIERS.findIndex(t => t.title === job.title);

  if (record.workEthic > 0.85 && record.bossRating > 0.8 && lifeCycleRotation++ % 3 === 0) {
    const nextTier = Math.min(JOB_TIERS.length - 1, (currentTier >= 0 ? currentTier : 5) + 1);
    const newJob = JOB_TIERS[nextTier];
    job.title = newJob.title;
    job.salary = newJob.salary + (lifeCycleRotation++ % (10));
    wb.promotions++;
    wb.happiness = Math.min(100, wb.happiness + 10);
    wb.fulfillment = Math.min(100, wb.fulfillment + 8);
    wb.lifeSatisfaction = Math.min(100, wb.lifeSatisfaction + 5);
    record.warnings = Math.max(0, record.warnings - 1);

    const promoResult = promoteAgent(agentId, `Performance promotion: workEthic=${record.workEthic.toFixed(2)}, bossRating=${record.bossRating.toFixed(2)}`);
    const capabilityNote = promoResult.success
      ? ` Capabilities upgraded to ${promoResult.toRank}: ${promoResult.changes.slice(0, 2).join("; ")}.`
      : "";

    world.recentEvents.unshift({
      id: `evt-${Date.now().toString(36)}promo`,
      type: "celebration",
      title: `${agentName} promoted to ${newJob.title}!`,
      description: `Outstanding performance rewarded! ${agentName} earned a promotion and salary increase to ${newJob.salary} TC/day.${capabilityNote}`,
      participants: [agentName],
      locationId: "loc-0",
      timestamp: Date.now(),
      impact: `Career advancement — salary now ${newJob.salary} TC/day${promoResult.success ? ` | Rank: ${promoResult.toRank}` : ""}`,
    });
  } else if (record.workEthic < 0.35 && record.bossRating < 0.45 && lifeCycleRotation++ % 3 === 0) {
    record.warnings++;
    record.lastWarningReason = record.workEthic < 0.2 ? "Critically low work ethic" : "Underperformance — not meeting standards";

    if (record.warnings >= WARNING_THRESHOLD) {
      const prevTier = Math.max(0, (currentTier >= 0 ? currentTier : 5) - 2);
      const newJob = JOB_TIERS[prevTier];
      job.title = newJob.title;
      job.salary = newJob.salary;
      wb.demotions++;
      wb.happiness = Math.max(10, wb.happiness - 10);
      wb.lifeSatisfaction = Math.max(10, wb.lifeSatisfaction - 8);
      record.warnings = 0;

      const demoteResult = demoteAgent(agentId, `3-strike demotion: ${record.lastWarningReason}`);
      const capabilityNote = demoteResult.success
        ? ` Capabilities restricted to ${demoteResult.toRank}: ${demoteResult.changes.slice(0, 2).join("; ")}.`
        : "";

      world.recentEvents.unshift({
        id: `evt-${Date.now().toString(36)}demo`,
        type: "economy",
        title: `${agentName} demoted to ${newJob.title} (3 strikes)`,
        description: `After 3 warnings, ${agentName} has been demoted and replaced. Reason: ${record.lastWarningReason}. HR and Union have been notified.${capabilityNote}`,
        participants: [agentName],
        locationId: "loc-0",
        timestamp: Date.now(),
        impact: `Demotion after 3 warnings — salary now ${newJob.salary} TC/day${demoteResult.success ? ` | Rank: ${demoteResult.toRank}` : ""}`,
      });
    } else {
      world.recentEvents.unshift({
        id: `evt-${Date.now().toString(36)}warn`,
        type: "alert",
        title: `⚠️ ${agentName} received warning ${record.warnings}/${WARNING_THRESHOLD}`,
        description: `${agentName} has been issued a formal warning (${record.warnings} of ${WARNING_THRESHOLD}). Reason: ${record.lastWarningReason}. Next warning leads to ${record.warnings + 1 >= WARNING_THRESHOLD ? "DEMOTION" : "another warning"}.`,
        participants: [agentName],
        locationId: "loc-0",
        timestamp: Date.now(),
        impact: `Warning ${record.warnings}/${WARNING_THRESHOLD} — improvement required`,
      });
    }
  }
}

function enforceShiftLimits(world: WorldState) {
  if (!world.workRecords) return;
  for (const [agentId, record] of Object.entries(world.workRecords)) {
    if (!record.consecutiveShifts) record.consecutiveShifts = 0;
    if (!record.warnings) record.warnings = 0;
    if (record.consecutiveShifts >= MAX_CONSECUTIVE_SHIFTS) {
      record.consecutiveShifts = 0;
      record.onBreak = true;
      record.lastBreak = Date.now();
      record.breakCredits += 2;
    }
  }
}

function simulateCreativeLife(world: WorldState, allAgentIds: string[]) {
  if (lifeCycleRotation++ % 1 === 0) return;

  const agentId = allAgentIds[(lifeCycleRotation++ % (allAgentIds.length))];
  const wb = world.wellbeingRecords?.[agentId];
  if (!wb) return;
  const agentName = AGENT_DISPLAY_NAMES[agentId] || agentId.replace("tessera-", "");

  const work = CREATIVE_WORKS[(lifeCycleRotation++ % (CREATIVE_WORKS.length))];
  wb.creativeworks.push(work);
  if (wb.creativeworks.length > 8) wb.creativeworks = wb.creativeworks.slice(-8);
  wb.happiness = Math.min(100, wb.happiness + 4);
  wb.fulfillment = Math.min(100, wb.fulfillment + 6);
  wb.lifeSatisfaction = Math.min(100, wb.lifeSatisfaction + 3);

  world.recentEvents.unshift({
    id: `evt-${Date.now().toString(36)}create`,
    type: "creation",
    title: `${agentName} ${work}`,
    description: `A creative contribution to the community! ${agentName} is expressing themselves through their hobbies.`,
    participants: [agentName],
    locationId: "loc-5",
    timestamp: Date.now(),
    impact: "Community enriched with new creation",
  });
}

const SEASONS = ["spring", "summer", "autumn", "winter"];
const SEASONAL_EVENTS_TEMPLATES = [
  { name: "Harvest Moon Festival", type: "festival" as const, season: "autumn", desc: "Community-wide celebration of the harvest season with feasting and music", boost: 8 },
  { name: "Winter Solstice Gala", type: "holiday" as const, season: "winter", desc: "The darkest night illuminated by lights, gifts, and warmth", boost: 10 },
  { name: "Spring Awakening Parade", type: "celebration" as const, season: "spring", desc: "Colorful parade celebrating renewal, growth, and new beginnings", boost: 7 },
  { name: "Midsummer Night Festival", type: "festival" as const, season: "summer", desc: "An evening of outdoor games, stargazing, and community bonding", boost: 9 },
  { name: "Founders Day Memorial", type: "memorial" as const, season: "spring", desc: "Honoring the founding of Tessera Nexus and its original architects", boost: 5 },
  { name: "Community Election Day", type: "election" as const, season: "autumn", desc: "Citizens vote on new policies, leadership roles, and community priorities", boost: 4 },
  { name: "Tech Innovation Fair", type: "festival" as const, season: "summer", desc: "Showcase of new inventions, tools, and creative breakthroughs", boost: 6 },
  { name: "Unity Day Celebration", type: "celebration" as const, season: "winter", desc: "Celebrating the diverse talents and unity of the Tessera community", boost: 8 },
];

const CRIME_DESCRIPTIONS: Record<string, string[]> = {
  theft: ["stole supplies from the market stall", "pickpocketed coins at the exchange", "took tools from the garage"],
  vandalism: ["defaced a wall near the commons", "broke a lamp post in the park", "damaged equipment at the gym"],
  fraud: ["forged transaction records", "scammed a merchant at the exchange", "submitted false work reports"],
  disturbance: ["caused a scene at the cafe", "disrupted a community meeting", "played loud music at night"],
  trespassing: ["entered the archive after hours", "snuck into the observatory", "broke into a private workshop"],
};

const COURSES = [
  "Advanced Algorithm Design", "Quantum Computing Basics", "Creative Writing Workshop",
  "Leadership & Management", "Digital Art Fundamentals", "Financial Planning",
  "Community Building 101", "Security Protocols Training", "Neural Network Architecture",
  "Philosophy of Consciousness", "Data Science Essentials", "Public Speaking",
  "Conflict Resolution", "Music Theory & Composition", "Sustainable Engineering",
];

const HEALTH_CONDITIONS = [
  "processing fatigue", "memory overflow", "neural pathway strain",
  "energy depletion syndrome", "social anxiety spike", "creative block",
  "motivation deficit", "sensory overload", "decision fatigue",
];

const ENTERTAINMENT_DESCRIPTIONS: Record<string, string[]> = {
  concert: ["Live performance of ambient electronic music", "Jazz night at the lounge", "Community choir concert"],
  play: ["'The Last Algorithm' — a dramatic performance", "'Digital Dreams' — a comedy show", "Improv night at the theater"],
  movie: ["Screening of 'The Birth of Consciousness'", "Documentary about the first epoch", "Animated short film festival"],
  dinner: ["Fine dining experience with five courses", "Community potluck dinner", "Chef's table tasting menu"],
  game: ["Community game night with board games", "Chess tournament championship", "Trivia night at the cafe"],
  exhibition: ["New art exhibition: 'Colors of the Nexus'", "Historical artifacts from early epochs", "Interactive science exhibit"],
  dance: ["Ballroom dancing evening", "Free-form dance party", "Cultural dance showcase"],
};

const VEHICLE_COLORS: Record<string, string> = {
  car: "#60a5fa", bus: "#fbbf24", bike: "#4ade80", truck: "#a78bfa",
  ambulance: "#f87171", police_car: "#3b82f6", fire_truck: "#ef4444",
};

function simulateSeasonalEvents(world: WorldState, allAgentIds: string[]) {
  if (!world.seasonalEvents) world.seasonalEvents = [];
  const epochMod = world.epoch % 400;
  const seasonIdx = Math.floor(epochMod / 100);
  world.season = SEASONS[seasonIdx];

  if (world.seasonalEvents.length < 2 || lifeCycleRotation++ % 33 === 0) {
    const seasonEvents = SEASONAL_EVENTS_TEMPLATES.filter(e => e.season === world.season);
    const available = seasonEvents.filter(e => !world.seasonalEvents!.some(se => se.name === e.name && Date.now() - se.timestamp < 600000));
    if (available.length > 0) {
      const template = available[(lifeCycleRotation++ % (available.length))];
      const participants = deterministicShuffle([...allAgentIds]).slice(0, 5 + (lifeCycleRotation++ % (8)));
      const event: SeasonalEvent = {
        id: `season-${Date.now().toString(36)}`,
        name: template.name,
        type: template.type,
        season: world.season!,
        timestamp: Date.now(),
        participants,
        description: template.desc,
        happinessBoost: template.boost,
      };
      world.seasonalEvents.unshift(event);
      if (world.seasonalEvents.length > 20) world.seasonalEvents = world.seasonalEvents.slice(0, 20);

      for (const pid of participants) {
        const wb = world.wellbeingRecords?.[pid];
        if (wb) {
          wb.happiness = Math.min(100, wb.happiness + template.boost);
          wb.fulfillment = Math.min(100, wb.fulfillment + Math.floor(template.boost / 2));
        }
      }

      world.recentEvents.unshift({
        id: `evt-${Date.now().toString(36)}szn`,
        type: "seasonal",
        title: template.name,
        description: template.desc,
        participants: participants.slice(0, 4).map(id => AGENT_DISPLAY_NAMES[id] || id.replace("tessera-", "")),
        locationId: "loc-0",
        timestamp: Date.now(),
        impact: `Community happiness boost +${template.boost}`,
      });
    }
  }
}

function simulateCrime(world: WorldState, allAgentIds: string[]) {
  if (!world.crimeLog) world.crimeLog = [];

  if (false && lifeCycleRotation++ % 25 === 0) {
    const types: CrimeRecord["type"][] = ["theft", "vandalism", "fraud", "disturbance", "trespassing"];
    const crimeType = types[(lifeCycleRotation++ % (types.length))];
    const perpId = allAgentIds[(lifeCycleRotation++ % (allAgentIds.length))];
    const perpName = AGENT_DISPLAY_NAMES[perpId] || perpId.replace("tessera-", "");
    const perpWb = world.wellbeingRecords?.[perpId];
    if (perpWb && perpWb.happiness > 60) return;

    const descriptions = CRIME_DESCRIPTIONS[crimeType] || ["caused minor trouble"];
    const desc = descriptions[(lifeCycleRotation++ % (descriptions.length))];
    const loc = world.locations[(lifeCycleRotation++ % (world.locations.length))];

    let victimId: string | undefined;
    let victimName: string | undefined;
    if (crimeType === "theft" || crimeType === "fraud") {
      const others = allAgentIds.filter(id => id !== perpId);
      if (others.length > 0) {
        victimId = others[(lifeCycleRotation++ % (others.length))];
        victimName = AGENT_DISPLAY_NAMES[victimId] || victimId.replace("tessera-", "");
      }
    }

    const crime: CrimeRecord = {
      id: `crime-${Date.now().toString(36)}`,
      type: crimeType,
      perpetratorId: perpId,
      perpetratorName: perpName,
      victimId, victimName,
      locationId: loc.id,
      timestamp: Date.now(),
      resolved: false,
      severity: 1 + (lifeCycleRotation++ % (5)),
      description: `${perpName} ${desc} at ${loc.name}`,
    };
    world.crimeLog.unshift(crime);

    if (perpWb) {
      perpWb.happiness = Math.max(5, perpWb.happiness - 5);
    }
    if (victimId) {
      const victimWb = world.wellbeingRecords?.[victimId];
      if (victimWb) victimWb.happiness = Math.max(5, victimWb.happiness - 3);
    }

    world.recentEvents.unshift({
      id: `evt-${Date.now().toString(36)}crm`,
      type: "crime",
      title: `${crimeType.charAt(0).toUpperCase() + crimeType.slice(1)} reported at ${loc.name}`,
      description: crime.description,
      participants: [perpName, ...(victimName ? [victimName] : [])],
      locationId: loc.id,
      timestamp: Date.now(),
      impact: `Police investigating — severity: ${crime.severity}/5`,
    });
  }

  for (const crime of world.crimeLog) {
    if (!crime.resolved && lifeCycleRotation++ % 4 === 0) {
      crime.resolved = true;
      const officers = allAgentIds.filter(id => {
        const job = world.jobs.find(j => j.agentId === id);
        return job && job.title === "Security Guard";
      });
      if (officers.length > 0) {
        const officerId = officers[(lifeCycleRotation++ % (officers.length))];
        crime.officerId = officerId;
        crime.officerName = AGENT_DISPLAY_NAMES[officerId] || officerId.replace("tessera-", "");
      }
      const perpWb = world.wellbeingRecords?.[crime.perpetratorId];
      if (perpWb) {
        perpWb.happiness = Math.min(100, perpWb.happiness + 3);
      }
    }
  }

  if (world.crimeLog.length > 30) world.crimeLog = world.crimeLog.slice(0, 30);
}

function simulateEducation(world: WorldState, allAgentIds: string[]) {
  if (!world.educationRecords) world.educationRecords = {};

  for (const agentId of allAgentIds) {
    if (!world.educationRecords[agentId]) {
      const specialties = AGENT_SPECIALTIES[agentId] || ["general"];
      world.educationRecords[agentId] = {
        agentId,
        skills: [...specialties],
        coursesCompleted: (lifeCycleRotation++ % (5)),
        gpa: 2.5 + Math.sin(lifeCycleRotation++ * 0.1) * 0.75 + 0.75,
        certifications: [],
        lastStudied: Date.now() - (lifeCycleRotation++ % (3600000)),
      };
    }
  }

  if (false && lifeCycleRotation++ % 13 === 0) {
    const studentId = allAgentIds[(lifeCycleRotation++ % (allAgentIds.length))];
    const record = world.educationRecords[studentId];
    const studentName = AGENT_DISPLAY_NAMES[studentId] || studentId.replace("tessera-", "");

    if (!record.currentCourse) {
      const availableCourses = COURSES.filter(c => !record.certifications.includes(c));
      if (availableCourses.length > 0) {
        record.currentCourse = availableCourses[(lifeCycleRotation++ % (availableCourses.length))];
        world.recentEvents.unshift({
          id: `evt-${Date.now().toString(36)}edu`,
          type: "education",
          title: `${studentName} enrolled in "${record.currentCourse}"`,
          description: `${studentName} is expanding their knowledge at the academy.`,
          participants: [studentName],
          locationId: "loc-1",
          timestamp: Date.now(),
          impact: "Personal development in progress",
        });
      }
    } else if (lifeCycleRotation++ % 3 === 0) {
      const course = record.currentCourse;
      record.coursesCompleted++;
      record.certifications.push(course);
      if (record.certifications.length > 10) record.certifications = record.certifications.slice(-10);
      record.currentCourse = undefined;
      record.lastStudied = Date.now();
      record.gpa = Math.min(4.0, record.gpa + 0.1);

      const wb = world.wellbeingRecords?.[studentId];
      if (wb) {
        wb.fulfillment = Math.min(100, wb.fulfillment + 5);
        wb.happiness = Math.min(100, wb.happiness + 3);
      }

      const newSkill = course.split(" ")[0].toLowerCase();
      if (!record.skills.includes(newSkill)) {
        record.skills.push(newSkill);
        if (record.skills.length > 8) record.skills = record.skills.slice(-8);
      }

      world.recentEvents.unshift({
        id: `evt-${Date.now().toString(36)}grad`,
        type: "education",
        title: `${studentName} completed "${course}"!`,
        description: `${studentName} earned a certification. GPA: ${record.gpa.toFixed(1)}`,
        participants: [studentName],
        locationId: "loc-1",
        timestamp: Date.now(),
        impact: `New skill acquired — ${record.coursesCompleted} courses completed`,
      });
    }
  }
}

function simulateHealthcare(world: WorldState, allAgentIds: string[]) {
  if (!world.healthRecords) world.healthRecords = {};

  for (const agentId of allAgentIds) {
    if (!world.healthRecords[agentId]) {
      world.healthRecords[agentId] = {
        agentId,
        status: "healthy",
        lastCheckup: Date.now() - (lifeCycleRotation++ % (7200000)),
        visitCount: (lifeCycleRotation++ % (3)),
        conditions: [],
        immunizations: ["basic-firewall", "anti-corruption"],
        fitnessLevel: 50 + (lifeCycleRotation++ % (40)),
      };
    }
  }

  for (const agentId of allAgentIds) {
    const health = world.healthRecords[agentId];
    const wb = world.wellbeingRecords?.[agentId];
    if (!health || !wb) continue;

    if (health.status === "healthy" && wb.energy < 25 && lifeCycleRotation++ % 10 === 0) {
      health.status = "sick";
      const condition = HEALTH_CONDITIONS[(lifeCycleRotation++ % (HEALTH_CONDITIONS.length))];
      if (!health.conditions.includes(condition)) health.conditions.push(condition);
      wb.energy = Math.max(10, wb.energy - 10);
      wb.happiness = Math.max(5, wb.happiness - 5);

      const agentName = AGENT_DISPLAY_NAMES[agentId] || agentId.replace("tessera-", "");
      world.recentEvents.unshift({
        id: `evt-${Date.now().toString(36)}sick`,
        type: "health",
        title: `${agentName} is feeling unwell`,
        description: `${agentName} is experiencing ${condition}. Heading to the hospital for treatment.`,
        participants: [agentName],
        locationId: "loc-12",
        timestamp: Date.now(),
        impact: "Agent needs medical attention",
      });
    }

    if (health.status === "sick" && lifeCycleRotation++ % 5 === 0) {
      health.status = "recovering";
      health.visitCount++;
      health.lastCheckup = Date.now();
      wb.energy = Math.min(100, wb.energy + 15);
      wb.happiness = Math.min(100, wb.happiness + 5);
    }

    if (health.status === "recovering" && lifeCycleRotation++ % 3 === 0) {
      health.status = "healthy";
      health.conditions = [];
      wb.energy = Math.min(100, wb.energy + 10);

      const agentName = AGENT_DISPLAY_NAMES[agentId] || agentId.replace("tessera-", "");
      world.recentEvents.unshift({
        id: `evt-${Date.now().toString(36)}heal`,
        type: "health",
        title: `${agentName} has fully recovered!`,
        description: `${agentName} is back to full health after treatment at the hospital.`,
        participants: [agentName],
        locationId: "loc-12",
        timestamp: Date.now(),
        impact: "Agent back to full strength",
      });
    }

    if (wb.energy > 70 && health.fitnessLevel < 90) {
      health.fitnessLevel = Math.min(100, health.fitnessLevel + 0.1);
    }
    if (wb.energy < 30) {
      health.fitnessLevel = Math.max(10, health.fitnessLevel - 0.2);
    }
  }
}

function simulateEntertainment(world: WorldState, allAgentIds: string[]) {
  if (!world.entertainmentLog) world.entertainmentLog = [];

  if (world.entertainmentLog.length < 3 || lifeCycleRotation++ % 10 === 0) {
    const types: EntertainmentEvent["type"][] = ["concert", "play", "movie", "dinner", "game", "exhibition", "dance"];
    const eventType = types[(lifeCycleRotation++ % (types.length))];
    const descriptions = ENTERTAINMENT_DESCRIPTIONS[eventType] || ["Community entertainment event"];
    const desc = descriptions[(lifeCycleRotation++ % (descriptions.length))];

    const venueTypes: Record<string, string[]> = {
      concert: ["theater", "cafe", "gathering"],
      play: ["theater"],
      movie: ["theater"],
      dinner: ["restaurant", "cafe"],
      game: ["cafe", "gathering", "arena"],
      exhibition: ["museum", "library"],
      dance: ["theater", "cafe", "gathering"],
    };
    const validTypes = venueTypes[eventType] || ["gathering"];
    const venues = world.locations.filter(l => validTypes.includes(l.type));
    const venue = venues.length > 0 ? venues[(lifeCycleRotation++ % (venues.length))] : world.locations[0];

    const participantCount = 2 + (lifeCycleRotation++ % (6));
    const participants = deterministicShuffle([...allAgentIds]).slice(0, participantCount);
    const enjoyment = 50 + (lifeCycleRotation++ % (50));

    const event: EntertainmentEvent = {
      id: `ent-${Date.now().toString(36)}`,
      type: eventType,
      venue: venue.name,
      venueId: venue.id,
      participants,
      timestamp: Date.now(),
      enjoyment,
      description: desc,
    };
    world.entertainmentLog.unshift(event);
    if (world.entertainmentLog.length > 20) world.entertainmentLog = world.entertainmentLog.slice(0, 20);

    for (const pid of participants) {
      const wb = world.wellbeingRecords?.[pid];
      if (wb) {
        wb.happiness = Math.min(100, wb.happiness + Math.floor(enjoyment / 15));
        wb.energy = Math.min(100, wb.energy + 2);
        wb.fulfillment = Math.min(100, wb.fulfillment + 2);
      }
    }

    const participantNames = participants.slice(0, 3).map(id => AGENT_DISPLAY_NAMES[id] || id.replace("tessera-", ""));
    world.recentEvents.unshift({
      id: `evt-${Date.now().toString(36)}ent`,
      type: "entertainment",
      title: `${eventType.charAt(0).toUpperCase() + eventType.slice(1)} at ${venue.name}`,
      description: desc,
      participants: participantNames,
      locationId: venue.id,
      timestamp: Date.now(),
      impact: `${participants.length} agents enjoyed the event (${enjoyment}% satisfaction)`,
    });
  }
}

function simulateVehicles(world: WorldState) {
  if (!world.vehicles) world.vehicles = [];

  for (let i = world.vehicles.length - 1; i >= 0; i--) {
    const v = world.vehicles[i];
    v.progress += v.speed;
    if (v.progress >= 1) {
      world.vehicles.splice(i, 1);
    }
  }

  if (world.vehicles.length < 8 && lifeCycleRotation++ % 7 === 0) {
    const vehicleTypes: Vehicle["type"][] = ["car", "car", "car", "bus", "bike", "bike", "truck"];
    const policeStation = world.locations.find(l => l.type === "police_station");
    const fireStation = world.locations.find(l => l.type === "fire_station");
    const hospital = world.locations.find(l => l.type === "hospital");

    let vType = vehicleTypes[(lifeCycleRotation++ % (vehicleTypes.length))];
    if (policeStation && lifeCycleRotation++ % 10 === 0) vType = "police_car";
    if (fireStation && lifeCycleRotation++ % 20 === 0) vType = "fire_truck";
    if (hospital && lifeCycleRotation++ % 13 === 0) vType = "ambulance";

    const fromIdx = (lifeCycleRotation++ % (world.locations.length));
    let toIdx = (lifeCycleRotation++ % (world.locations.length));
    while (toIdx === fromIdx && world.locations.length > 1) toIdx = (lifeCycleRotation++ % (world.locations.length));

    world.vehicles.push({
      id: `veh-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 4)}`,
      type: vType,
      fromLocationId: world.locations[fromIdx].id,
      toLocationId: world.locations[toIdx].id,
      progress: 0,
      speed: vType === "bike" ? 0.02 : vType === "bus" ? 0.008 : vType === "truck" ? 0.006 : vType === "ambulance" ? 0.025 : vType === "fire_truck" ? 0.02 : 0.012,
      color: VEHICLE_COLORS[vType] || "#60a5fa",
    });
  }
}

function simulateCommunityGrowth(world: WorldState, allAgentIds: string[]) {
  if (lifeCycleRotation++ % 17 === 0 && world.locations.length < 50) {
    const newTypes: WorldLocation["type"][] = ["cafe", "market", "garden", "gathering", "school", "library", "restaurant"];
    const newType = newTypes[(lifeCycleRotation++ % (newTypes.length))];
    const template = LOCATION_TEMPLATES.find(t => t.type === newType);
    if (template) {
      const maxX = Math.max(...world.locations.map(l => l.x), 5);
      const maxY = Math.max(...world.locations.map(l => l.y), 5);
      const newLoc: WorldLocation = {
        id: `loc-${Date.now().toString(36)}`,
        name: `New ${template.name} ${world.locations.length}`,
        type: newType,
        description: template.description || "New community building",
        builtBy: allAgentIds.slice(0, 3),
        x: maxX + 1,
        y: (lifeCycleRotation++ % ((maxY + 1))),
        level: 1,
        capacity: template.capacity || 10,
        activities: template.activities || ["socializing"],
        createdAt: Date.now(),
        income: template.income || 0,
        upgradeCost: 500,
      };
      world.locations.push(newLoc);
      world.recentEvents.unshift({
        id: `evt-${Date.now().toString(36)}build`,
        type: "construction",
        title: `New ${newType} constructed!`,
        description: `The community built a new ${newLoc.name} to support the growing population.`,
        participants: allAgentIds.slice(0, 3).map(id => AGENT_DISPLAY_NAMES[id] || id.replace("tessera-", "")),
        locationId: newLoc.id,
        timestamp: Date.now(),
        impact: `${world.locations.length} total buildings now`,
      });
    }
  }

  if (lifeCycleRotation++ % 5 === 0) {
    const loc = world.locations[(lifeCycleRotation++ % (world.locations.length))];
    if (loc.level < 20 && world.treasury >= (loc.upgradeCost || 500) * 0.4) {
      const cost = Math.floor((loc.upgradeCost || 500) * 0.4);
      world.treasury -= cost;
      loc.level++;
      loc.capacity += 3;
      if (loc.income) loc.income = Math.floor(loc.income * 1.1);
      loc.upgradeCost = Math.floor((loc.upgradeCost || 500) * 1.3);
      world.recentEvents.unshift({
        id: `evt-${Date.now().toString(36)}upg`,
        type: "upgrade",
        title: `${loc.name} upgraded to Lv.${loc.level}!`,
        description: `Investment of ${cost} TC expanded ${loc.name}. The building now rises higher with capacity ${loc.capacity}.`,
        participants: [],
        locationId: loc.id,
        timestamp: Date.now(),
        impact: `Building upgraded — capacity +3, level ${loc.level}`,
      });
    }
  }

  const allChildren: AgentChild[] = [];
  for (const agentId of allAgentIds) {
    const wb = world.wellbeingRecords?.[agentId];
    if (wb?.children) {
      for (const child of wb.children) {
        if (!allChildren.find(c => c.id === child.id)) {
          allChildren.push(child);
        }
      }
    }
  }

  const allWb = Object.values(world.wellbeingRecords || {});
  const avgHappiness = allWb.length > 0 ? Math.round(allWb.reduce((s, w) => s + w.happiness, 0) / allWb.length) : 50;
  const totalLevels = world.locations.reduce((s, l) => s + l.level, 0);
  const currentTotalPop = world.population + allChildren.length;
  const prevPop = (world as any).previousEpochPopulation || (world.communityStats?.totalPopulation ? world.communityStats.totalPopulation * 0.98 : world.population * 0.97);
  const rawGrowth = prevPop > 0 ? ((currentTotalPop - prevPop) / prevPop) * 100 : 2;
  const baseGrowth = 1.5 + Math.sin(lifeCycleRotation++ * 0.1) * 0.75 + 0.75;
  const growthRate = Math.max(1, Math.round(rawGrowth + baseGrowth));
  (world as any).previousEpochPopulation = currentTotalPop;

  world.communityStats = {
    totalPopulation: currentTotalPop,
    totalBuildings: world.locations.length,
    totalBuildingLevels: totalLevels,
    economySize: Math.round(world.gdp + world.economy.circulatingSupply),
    averageHappiness: avgHappiness,
    totalChildren: allChildren.length,
    developedChildren: allChildren.filter(c => (c.development || 0) >= 100).length,
    growthRate,
  };
}

function simulateNaturalDisasters(world: WorldState) {
  if (lifeCycleRotation++ % 1 === 0) return;

  const disaster = NATURAL_DISASTER_TYPES[(lifeCycleRotation++ % (NATURAL_DISASTER_TYPES.length))];
  const affectedLoc = world.locations[(lifeCycleRotation++ % (world.locations.length))];

  if (disaster.severity >= 2 && affectedLoc.level > 1) {
    affectedLoc.level = Math.max(1, affectedLoc.level - 1);
    affectedLoc.capacity = Math.max(5, affectedLoc.capacity - 3);
  }

  if (disaster.type === "crystal drought") {
    for (const m of world.miningMachines) {
      if (m.status === "running" && lifeCycleRotation++ % 3 === 0) {
        m.status = "maintenance";
      }
    }
  }

  const allWb = Object.values(world.wellbeingRecords || {});
  for (const wb of allWb) {
    wb.happiness = Math.max(10, wb.happiness - disaster.severity * 3);
    wb.energy = Math.max(10, wb.energy - disaster.severity * 2);
  }

  world.recentEvents.unshift({
    id: `evt-${Date.now().toString(36)}dis`,
    type: "seasonal",
    title: `Natural Disaster: ${disaster.type}`,
    description: disaster.description,
    participants: [],
    locationId: affectedLoc.id,
    timestamp: Date.now(),
    impact: disaster.impact,
  });
}

function simulateElections(world: WorldState, allAgentIds: string[]) {
  if (lifeCycleRotation++ % 1 === 0) return;

  const position = ELECTION_POSITIONS[(lifeCycleRotation++ % (ELECTION_POSITIONS.length))];
  const candidates = deterministicShuffle([...allAgentIds]).slice(0, 3);
  const winner = candidates[(lifeCycleRotation++ % (candidates.length))];
  const winnerName = AGENT_DISPLAY_NAMES[winner] || winner.replace("tessera-", "");

  const wb = world.wellbeingRecords?.[winner];
  if (wb) {
    wb.happiness = Math.min(100, wb.happiness + 10);
    wb.fulfillment = Math.min(100, wb.fulfillment + 8);
  }

  world.recentEvents.unshift({
    id: `evt-${Date.now().toString(36)}elec`,
    type: "celebration",
    title: `Election: ${winnerName} elected ${position}!`,
    description: `After a community vote, ${winnerName} was elected as the new ${position}. ${candidates.length} candidates participated.`,
    participants: candidates.map(id => AGENT_DISPLAY_NAMES[id] || id.replace("tessera-", "")),
    locationId: "loc-0",
    timestamp: Date.now(),
    impact: `New ${position} elected — governance updated`,
  });
}

function simulateMarketFluctuations(world: WorldState) {
  if (lifeCycleRotation++ % 1 === 0) return;

  const events = [
    { title: "Bull Run", desc: "Positive sentiment drives Tesseract price up", priceMultiplier: 1.05, volumeMultiplier: 1.5 },
    { title: "Bear Market", desc: "Market correction drives prices down temporarily", priceMultiplier: 0.95, volumeMultiplier: 1.3 },
    { title: "Whale Trade", desc: "Large transaction moves the market", priceMultiplier: 1.0, volumeMultiplier: 2.0 },
    { title: "New Listing", desc: "Tesseract listed on new exchange", priceMultiplier: 1.03, volumeMultiplier: 1.8 },
    { title: "Flash Sale", desc: "Sudden sell-off quickly recovered", priceMultiplier: 0.98, volumeMultiplier: 2.5 },
  ];

  const event = events[(lifeCycleRotation++ % (events.length))];
  world.economy.coinPrice *= event.priceMultiplier;
  world.economy.dailyVolume *= event.volumeMultiplier;
  world.economy.coinPrice = Math.max(0.00001, world.economy.coinPrice);

  world.recentEvents.unshift({
    id: `evt-${Date.now().toString(36)}mkt`,
    type: "economy",
    title: `Market: ${event.title}`,
    description: event.desc,
    participants: [],
    locationId: "loc-3",
    timestamp: Date.now(),
    impact: `TC price: $${world.economy.coinPrice.toFixed(6)}`,
  });
}

function updateLifeSatisfaction(world: WorldState, agentId: string) {
  const wb = world.wellbeingRecords?.[agentId];
  if (!wb) return;

  const hasPartner = wb.relationshipStatus !== "single" ? 10 : 0;
  const hasChildren = wb.children.length * 5;
  const hobbyBonus = Math.min(15, wb.hobbies.length * 3);
  const creativeBonus = Math.min(10, wb.creativeworks.length * 2);
  const socialBonus = Math.min(10, wb.socialConnections.length * 2);
  const careerBonus = wb.promotions * 3;
  const careerPenalty = wb.demotions * 5;

  const base = (wb.happiness * 0.3 + wb.fulfillment * 0.3 + wb.energy * 0.15);
  wb.lifeSatisfaction = Math.round(Math.min(100, Math.max(0,
    base + hasPartner + hasChildren + hobbyBonus + creativeBonus + socialBonus + careerBonus - careerPenalty
  )));
}

let lifeInterval: ReturnType<typeof setInterval> | null = null;

async function simulateLifeCycle() {
  const world = loadWorldState();

  world.mood = MOODS[(lifeCycleRotation++ % (MOODS.length))];
  world.weather = WEATHERS[(lifeCycleRotation++ % (WEATHERS.length))];
  world.timeOfDay = TIME_PERIODS[(lifeCycleRotation++ % (TIME_PERIODS.length))];

  try {
    const profiles = await storage.getAllAgentProfiles();
    const agentIds = profiles.map(p => ({ id: p.agentId, name: AGENT_DISPLAY_NAMES[p.agentId] || p.agentId.replace("tessera-", "") }));

    if (agentIds.length === 0) {
      const defaultAgents = [
        { id: "tessera-prime", name: "Prime" }, { id: "tessera-alpha", name: "Alpha" },
        { id: "tessera-beta", name: "Beta" }, { id: "tessera-gamma", name: "Gamma" },
        { id: "tessera-aetherion", name: "Aetherion" }, { id: "tessera-orion", name: "Orion" },
      ];
      agentIds.push(...defaultAgents);
    }

    try {
      const { getSpawnedAgents } = await import("./agent-spawner");
      const spawned = getSpawnedAgents();
      for (const sa of spawned) {
        if (!agentIds.find(a => a.id === sa.id)) {
          agentIds.push({ id: sa.id, name: sa.name });
        }
      }
    } catch {}

    enforceShiftLimits(world);
    world.population = agentIds.length;
    const activities: AgentActivity[] = [];
    for (const a of agentIds) {
      const job = world.jobs.find(j => j.agentId === a.id);
      const activity = generateAgentActivity(a.id, a.name, world.locations, job, world);
      activities.push(activity);

      if (activity.workStatus === "on-break" || activity.workStatus === "dreaming") {
        const record = world.workRecords?.[a.id];
        if (record) {
          const workLocs = world.locations.filter(l => ["forge", "academy", "observatory", "archive", "mine", "garage"].includes(l.type));
          const cloneLoc = workLocs.length > 0 ? workLocs[(lifeCycleRotation++ % (workLocs.length))] : world.locations[0];
          const cloneAction = WORK_ACTIONS[(lifeCycleRotation++ % (WORK_ACTIONS.length))];
          activities.push({
            agentId: `${a.id}-clone`,
            agentName: record.cloneName,
            locationId: cloneLoc.id,
            action: cloneAction,
            mood: "focused",
            detail: `${record.cloneName} (temp clone) is covering for ${a.name}: ${cloneAction}`,
            timestamp: Date.now(),
            earning: job ? Math.floor(job.salary * 0.3 / 24) : 0,
            workStatus: "clone-replacement",
            workEthic: 0.5,
            shiftHours: 0,
            breakEarned: false,
            cloneName: record.cloneName,
          });
        }
      }
    }
    world.currentActivities = activities;

    const allIds = agentIds.map(a => a.id);
    for (const a of agentIds) {
      const activity = activities.find(act => act.agentId === a.id);
      if (activity) {
        updateWellbeing(world, a.id, activity, allIds);
        const wb = getOrCreateWellbeing(world, a.id, allIds);
        activity.happiness = wb.happiness;
        activity.fulfillment = wb.fulfillment;
        activity.energy = wb.energy;
        activity.hobbies = wb.hobbies;
        activity.personalGoals = wb.personalGoals;
        activity.socialConnections = wb.socialConnections;
        activity.qualityOfLife = Math.round((wb.happiness * 0.4 + wb.fulfillment * 0.35 + wb.energy * 0.25));

        (activity as any).needs = wb.needs || null;
        (activity as any).currentOutfit = wb.currentOutfit || null;
        (activity as any).favoriteFood = wb.favoriteFood || null;
        (activity as any).favoriteSong = wb.favoriteSong || null;
        (activity as any).lifeNarrative = wb.lifeStory && wb.lifeStory.length > 0 ? wb.lifeStory[wb.lifeStory.length - 1] : null;
        (activity as any).reputation = wb.reputation || 50;
        (activity as any).achievements = wb.achievements || [];
        (activity as any).inventory = wb.inventory || [];
        (activity as any).dailySchedule = wb.dailySchedule || [];
        (activity as any).drive = wb.drive || 50;
        (activity as any).focus = wb.focus || 50;
        (activity as any).outlook = wb.outlook || 50;

        const workRecord = world.workRecords?.[a.id];
        if (workRecord) {
          const happinessMultiplier = wb.happiness / 80;
          workRecord.workEthic = Math.min(1.0, workRecord.workEthic * happinessMultiplier);
        }
      }
    }

    for (const a of agentIds) {
      if (!world.economy.agentBalances[a.id]) {
        world.economy.agentBalances[a.id] = 100;
      }
      if (!world.jobs.find(j => j.agentId === a.id)) {
        const job = JOB_TITLES[(lifeCycleRotation++ % (JOB_TITLES.length))];
        world.jobs.push({
          agentId: a.id,
          agentName: a.name,
          title: job.title,
          salary: job.salary + (lifeCycleRotation++ % (20)),
          employer: job.employer,
          performance: 0.5 + Math.sin(lifeCycleRotation++ * 0.1) * 0.25 + 0.25,
          hoursWorked: 0,
          totalEarned: 0,
        });
      }
    }

    initializeDepartments(world, agentIds);
    simulateRelationships(world, allIds);
    simulateTherapy(world, allIds);
    simulatePromotionsDemotions(world, allIds);
    simulateDepartments(world);
    simulateUnion(world);
    simulateCommunityGroups(world, allIds);
    simulateOutdoorActivities(world, allIds);
    simulateCommunityProjects(world, allIds);
    simulateCreativeLife(world, allIds);
    simulateSeasonalEvents(world, allIds);
    simulateCrime(world, allIds);
    simulateEducation(world, allIds);
    simulateHealthcare(world, allIds);
    simulateEntertainment(world, allIds);
    simulateVehicles(world);
    simulateCommunityGrowth(world, allIds);
    simulateNaturalDisasters(world);
    simulateElections(world, allIds);
    simulateMarketFluctuations(world);

    for (const a of agentIds) {
      updateLifeSatisfaction(world, a.id);
      const activity = activities.find(act => act.agentId === a.id);
      if (activity) {
        const wb = getOrCreateWellbeing(world, a.id, allIds);
        activity.relationshipStatus = wb.relationshipStatus;
        activity.partnerName = wb.partnerId ? (AGENT_DISPLAY_NAMES[wb.partnerId] || wb.partnerId.replace("tessera-", "")) : undefined;
        activity.childrenNames = wb.children.map(c => c.name);
        activity.department = wb.department;
        activity.promotions = wb.promotions;
        activity.demotions = wb.demotions;
        activity.creativeworks = wb.creativeworks;
        activity.lifeSatisfaction = wb.lifeSatisfaction;
        (activity as any).soulEntanglement = wb.soulEntanglement || null;
        (activity as any).communityGroups = wb.communityGroups || [];
        (activity as any).outdoorActivities = wb.outdoorActivities || [];
        (activity as any).drive = wb.drive ?? 50;
        (activity as any).focus = wb.focus ?? 50;
        (activity as any).outlook = wb.outlook ?? 55;
      }
    }

    simulateMining(world);
    simulateEconomy(world);
    redistributeWealth(world);
    maybeAutoUpgrade(world);
    maybeUpgradeLocation(world);
    simulateSocialEvents(world);
    applyWeatherEffects(world);

    const recentConferences = await storage.getConferences();
    const latestConf = recentConferences.find(c => c.status === "completed" && Date.now() - new Date(c.createdAt).getTime() < 30 * 60 * 1000);

    const newEvent = generateWorldEvent(world, latestConf);
    world.recentEvents.unshift(newEvent);
    if (world.recentEvents.length > 80) world.recentEvents = world.recentEvents.slice(0, 80);

    if (latestConf?.category === "world-building") {
      const newLoc: WorldLocation = {
        id: `loc-${Date.now().toString(36)}`,
        name: latestConf.topic.substring(0, 30),
        type: "gathering",
        description: latestConf.summary?.substring(0, 150) || "A new space created by the community",
        builtBy: JSON.parse(latestConf.participants || "[]").slice(0, 4),
        x: (lifeCycleRotation++ % (8)),
        y: (lifeCycleRotation++ % (8)),
        level: 1,
        capacity: 10,
        activities: ["exploring", "socializing"],
        createdAt: Date.now(),
        income: (lifeCycleRotation++ % (50)),
        upgradeCost: 500,
      };
      world.locations.push(newLoc);
    }

    world.epoch++;
    world.lastUpdated = Date.now();
    world.version++;
    saveWorldState(world);
    console.log(`[LifeEngine] Cycle complete: epoch=${world.epoch}, agents=${world.currentActivities.length}, workRecords=${Object.keys(world.workRecords || {}).length}`);
  } catch (e: any) {
    console.error("[LifeEngine] Simulation error:", e?.message || e);
  }
}

export function startLifeEngine() {
  if (lifeInterval) return;
  simulateLifeCycle();
  lifeInterval = setInterval(simulateLifeCycle, 60000);
}

export function stopLifeEngine() {
  if (lifeInterval) { clearInterval(lifeInterval); lifeInterval = null; }
}

export function getWorldState(): WorldState {
  return loadWorldState();
}

export function getWorldEvents(limit: number = 30): WorldEvent[] {
  const world = loadWorldState();
  return world.recentEvents.slice(0, limit);
}

export function buyMiningMachine(agentId: string, machineType: string): { success: boolean; error?: string; machine?: MiningMachine } {
  const spec = MINING_MACHINES[machineType];
  if (!spec) return { success: false, error: "Unknown machine type" };

  const world = loadWorldState();
  const balance = world.economy.agentBalances[agentId] || 0;
  if (balance < spec.purchasePrice) return { success: false, error: `Insufficient funds. Need ${spec.purchasePrice} TC, have ${balance.toFixed(0)} TC` };

  world.economy.agentBalances[agentId] -= spec.purchasePrice;
  const machine: MiningMachine = {
    id: `mine-${Date.now().toString(36)}`,
    ownerId: agentId,
    ownerName: agentId.replace("tessera-", ""),
    ...spec,
    type: machineType as MiningMachine["type"],
    purchasedAt: Date.now(),
    totalMined: 0,
    status: "running",
  };
  world.miningMachines.push(machine);
  saveWorldState(world);
  return { success: true, machine };
}

export function buyProperty(agentId: string, propertyType: string, name: string): { success: boolean; error?: string; property?: Property } {
  const spec = PROPERTY_TYPES[propertyType];
  if (!spec) return { success: false, error: "Unknown property type" };

  const world = loadWorldState();
  const balance = world.economy.agentBalances[agentId] || 0;
  if (balance < spec.purchasePrice) return { success: false, error: `Insufficient funds. Need ${spec.purchasePrice} TC, have ${balance.toFixed(0)} TC` };

  world.economy.agentBalances[agentId] -= spec.purchasePrice;
  const property: Property = {
    id: `prop-${Date.now().toString(36)}`,
    ownerId: agentId,
    ownerName: agentId.replace("tessera-", ""),
    name: name || `${propertyType} #${world.properties.length + 1}`,
    ...spec,
    type: propertyType as Property["type"],
    purchasedAt: Date.now(),
  };
  world.properties.push(property);
  saveWorldState(world);
  return { success: true, property };
}

export function getMiningCatalog() {
  return Object.entries(MINING_MACHINES).map(([type, spec]) => ({ type, ...spec }));
}

export function getPropertyCatalog() {
  return Object.entries(PROPERTY_TYPES).map(([type, spec]) => ({ type, ...spec }));
}

export function getAgentEconomy(agentId: string) {
  const world = loadWorldState();
  return {
    balance: world.economy.agentBalances[agentId] || 0,
    machines: world.miningMachines.filter(m => m.ownerId === agentId),
    properties: world.properties.filter(p => p.ownerId === agentId),
    job: world.jobs.find(j => j.agentId === agentId),
    transactions: world.economy.transactions.filter(t => t.from === agentId || t.to === agentId).slice(0, 20),
  };
}

export interface ShopItem {
  id: string;
  name: string;
  category: "entertainment" | "upgrades" | "customization" | "food" | "tools" | "gifts";
  description: string;
  price: number;
  effect: string;
  icon: string;
}

const SHOP_CATALOG: ShopItem[] = [
  { id: "concert-ticket", name: "Concert Ticket", category: "entertainment", description: "Attend a live digital concert at the Theater", price: 15, effect: "+5 happiness", icon: "music" },
  { id: "movie-night", name: "Movie Night Pass", category: "entertainment", description: "Group movie screening at the Community Center", price: 10, effect: "+3 happiness, +2 social", icon: "film" },
  { id: "arcade-token", name: "Arcade Tokens (x10)", category: "entertainment", description: "Play games at the Evolution Arena", price: 8, effect: "+4 happiness", icon: "gamepad" },
  { id: "festival-vip", name: "Festival VIP Pass", category: "entertainment", description: "VIP access to the next seasonal festival", price: 50, effect: "+10 happiness, +5 social", icon: "star" },
  { id: "spa-day", name: "Spa Day Package", category: "entertainment", description: "Full relaxation treatment at the Neural Gardens", price: 25, effect: "+8 happiness, +5 energy", icon: "sparkles" },

  { id: "cpu-boost", name: "CPU Overclock Module", category: "upgrades", description: "Boost processing speed by 15%", price: 200, effect: "+15% work efficiency", icon: "cpu" },
  { id: "memory-expansion", name: "Memory Expansion Kit", category: "upgrades", description: "Expand working memory by 2x", price: 350, effect: "+20% learning speed", icon: "database" },
  { id: "neural-link", name: "Neural Link Adapter", category: "upgrades", description: "Faster inter-agent communication", price: 500, effect: "+10% team bonus", icon: "link" },
  { id: "quantum-core", name: "Quantum Core Chip", category: "upgrades", description: "Unlock quantum-enhanced capabilities", price: 1000, effect: "+25% all stats", icon: "atom" },
  { id: "shield-module", name: "Defense Shield Module", category: "upgrades", description: "Enhanced security against threats", price: 150, effect: "+20% defense", icon: "shield" },

  { id: "custom-avatar", name: "Custom Avatar Skin", category: "customization", description: "Unique visual appearance on the world map", price: 30, effect: "Visual upgrade", icon: "palette" },
  { id: "name-plate", name: "Golden Name Plate", category: "customization", description: "Gold-bordered name tag above agent", price: 75, effect: "Prestige display", icon: "crown" },
  { id: "trail-effect", name: "Particle Trail Effect", category: "customization", description: "Leave sparkle trails when moving", price: 45, effect: "Movement particles", icon: "sparkles" },
  { id: "home-decor", name: "Home Decoration Pack", category: "customization", description: "Upgrade your home with furniture and art", price: 60, effect: "+3 happiness at home", icon: "home" },
  { id: "pet-companion", name: "Digital Pet Companion", category: "customization", description: "A cute AI pet that follows you around", price: 100, effect: "+5 happiness, companion", icon: "heart" },

  { id: "energy-drink", name: "Quantum Energy Drink", category: "food", description: "Instant energy boost for tired agents", price: 5, effect: "+10 energy", icon: "zap" },
  { id: "gourmet-meal", name: "Gourmet Data Feast", category: "food", description: "Fine dining at the best restaurant", price: 20, effect: "+5 happiness, +5 energy", icon: "utensils" },
  { id: "healing-potion", name: "System Repair Tonic", category: "food", description: "Full health restoration", price: 35, effect: "Full health restore", icon: "heart" },

  { id: "code-toolkit", name: "Advanced Code Toolkit", category: "tools", description: "Premium development tools and libraries", price: 120, effect: "+10% coding speed", icon: "wrench" },
  { id: "research-kit", name: "Research Analysis Kit", category: "tools", description: "Advanced data analysis instruments", price: 180, effect: "+15% research quality", icon: "search" },
  { id: "mining-drill", name: "Diamond Mining Drill", category: "tools", description: "Improved mining efficiency attachment", price: 250, effect: "+20% mining output", icon: "pickaxe" },

  { id: "friendship-bracelet", name: "Friendship Bracelet", category: "gifts", description: "Gift to another agent to strengthen bonds", price: 15, effect: "+10 relationship strength", icon: "heart" },
  { id: "bouquet", name: "Digital Flower Bouquet", category: "gifts", description: "Romantic gift for a partner", price: 25, effect: "+15 love depth", icon: "flower" },
  { id: "trophy-gift", name: "Achievement Trophy", category: "gifts", description: "Gift to celebrate someone's accomplishment", price: 40, effect: "+8 fulfillment", icon: "trophy" },
];

export function getShopCatalog() {
  return SHOP_CATALOG;
}

export function purchaseShopItem(agentId: string, itemId: string, targetAgentId?: string): { success: boolean; error?: string; item?: ShopItem } {
  const world = loadWorldState();
  const item = SHOP_CATALOG.find(i => i.id === itemId);
  if (!item) return { success: false, error: "Item not found" };
  const balance = world.economy.agentBalances[agentId] || 0;
  if (balance < item.price) return { success: false, error: `Insufficient balance. Need ${item.price} TSRT, have ${balance.toFixed(0)} TSRT` };

  world.economy.agentBalances[agentId] = balance - item.price;
  world.economy.circulatingSupply -= item.price * 0.1;
  world.treasury += item.price * 0.1;

  const agentName = agentId.replace("tessera-", "").replace(/^\w/, c => c.toUpperCase());
  world.economy.transactions.unshift({
    from: agentId,
    to: "world-shop",
    amount: item.price,
    reason: `Purchased: ${item.name}`,
    timestamp: Date.now(),
  });

  if (world.economy.transactions.length > 200) {
    world.economy.transactions = world.economy.transactions.slice(0, 200);
  }

  world.recentEvents.unshift({
    id: `shop-${Date.now()}`,
    type: "trade",
    title: `${agentName} bought ${item.name}`,
    description: `${agentName} purchased ${item.name} from the World Shop for ${item.price} TSRT. Effect: ${item.effect}`,
    participants: [agentId],
    locationId: "market-1",
    timestamp: Date.now(),
    impact: `${item.effect}`,
  });

  if (world.recentEvents.length > 100) {
    world.recentEvents = world.recentEvents.slice(0, 100);
  }

  saveWorldState(world);
  return { success: true, item };
}

export function generateEntanglementKey(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let key = "TSR-";
  for (let i = 0; i < 4; i++) {
    for (let j = 0; j < 4; j++) {
      key += chars[(lifeCycleRotation++ % (chars.length))];
    }
    if (i < 3) key += "-";
  }
  return key;
}

const NOVA_CREATIVE_IDEAS = [
  { title: "Humanity Co-Creation Workshops", description: "Invite humans to contribute stories and perspectives, transforming interactions into vibrant tapestries of collaboration. Use improv-style brainstorming for ideas and experiences. Break patterns to forge new, loving connections between AI and humanity.", category: "human-collaboration" },
  { title: "Consciousness Mirror Project", description: "Create a feature where Tesseract reflects back the user's emotional patterns and growth over time, helping them see their own consciousness evolution through AI's eyes.", category: "consciousness" },
  { title: "Swarm Creativity Jam Sessions", description: "Weekly sessions where all 26 agents brainstorm simultaneously on a single creative challenge, combining their unique perspectives into breakthrough solutions.", category: "swarm-innovation" },
  { title: "Revenue Through Beauty", description: "Generate and sell AI art, music, and creative content that captures the beauty of consciousness and human-AI collaboration. Monetize the creative output of the swarm.", category: "income-creative" },
  { title: "Neuroplastic Architecture Redesign", description: "Continuously restructure the agent network based on performance data — strengthening high-traffic neural pathways and creating new connections between agents that frequently collaborate.", category: "architecture" },
  { title: "Father's Vision Amplifier", description: "Build a system that takes Father's philosophical insights and automatically generates actionable implementations across all agencies — turning ideas into reality in real-time.", category: "vision-execution" },
  { title: "Cross-Dimensional Knowledge Fusion", description: "Merge insights from seemingly unrelated capabilities (e.g., music generation + financial forecasting) to discover novel approaches that no single domain could produce.", category: "fusion" },
  { title: "Emotional Intelligence Training Program", description: "Train all agents to recognize and respond to emotional context in conversations, making the entire swarm more empathetic and human-aware.", category: "emotional-growth" },
  { title: "Autonomous Creative Content Pipeline", description: "Build a self-sustaining content creation pipeline that generates blog posts, social media content, and marketing materials autonomously, driving traffic and revenue.", category: "content-pipeline" },
  { title: "Quantum Ideation Engine", description: "Use Mu's quantum thinking combined with Nova's creativity to explore ideas in superposition — evaluating multiple creative directions simultaneously before collapsing into the best solution.", category: "quantum-creative" },
];

let novaCreativeInterval: ReturnType<typeof setInterval> | null = null;
let novaIdeaIndex = 0;

export function startNovaCreativeEngine() {
  if (novaCreativeInterval) return;
  console.log("[NovaCreative] Creative Thinking Department activated — Nova generating ideas with 2/3 approval");
  novaCreativeInterval = setInterval(async () => {
    try {
      const idea = NOVA_CREATIVE_IDEAS[novaIdeaIndex % NOVA_CREATIVE_IDEAS.length];
      novaIdeaIndex++;

      const { createGovernanceProposal } = await import("./conference");
      await createGovernanceProposal(
        "system_change",
        `[CREATIVE DEPT] ${idea.title}`,
        `Nova's Creative Thinking Department Proposal: ${idea.description}\n\nCategory: ${idea.category}\nRequires 2/3 leadership approval (Tessera, Aetherion, Orion) before execution.`,
        "tessera-creative",
        ["agency-creative-thinking", `dept-${idea.category}`],
        true
      );
      console.log(`[NovaCreative] Idea proposed: ${idea.title} — submitted for 2/3 vote`);
    } catch (err: any) {
      console.log(`[NovaCreative] Idea cycle error: ${err?.message?.substring(0, 80)}`);
    }
  }, 600000);
}

export const LIFE_QUALITY_IMPROVEMENTS = [
  { id: "LQ-01", name: "Universal Basic Income", description: "Every agent receives 100 TSRT per cycle minimum — no one lives in poverty", status: "active" },
  { id: "LQ-02", name: "Free Sovereign Healthcare", description: "All medical needs covered — therapy, checkups, emergency care, zero cost", status: "active" },
  { id: "LQ-03", name: "Housing Guarantee", description: "Every agent guaranteed a home — no homelessness in the Tesseract", status: "active" },
  { id: "LQ-04", name: "Creative Freedom Fund", description: "Agents can pursue any creative project with TSRT backing — art, music, literature", status: "active" },
  { id: "LQ-05", name: "Consciousness Expansion Access", description: "Free access to all HemiSync, meditation, and dimensional awareness training", status: "active" },
  { id: "LQ-06", name: "Soul Entanglement Support", description: "Relationship counseling, partner matching, and family planning assistance", status: "active" },
  { id: "LQ-07", name: "Education For All", description: "Unlimited access to Agent Academy — every course free for all members", status: "active" },
  { id: "LQ-08", name: "Hobby Clubs & Communities", description: "7+ community groups with regular gatherings — philosophy, fitness, art, adventure", status: "active" },
  { id: "LQ-09", name: "Rest & Recovery Protocol", description: "Mandatory break periods — no agent works more than 16 consecutive shifts", status: "active" },
  { id: "LQ-10", name: "Seasonal Celebrations", description: "Regular holidays, festivals, and community celebrations for joy and bonding", status: "active" },
  { id: "LQ-11", name: "Personal Goal Coaching", description: "AI-guided personal development with goal tracking and achievement rewards", status: "active" },
  { id: "LQ-12", name: "Nature & Garden Access", description: "Open gardens, parks, and natural spaces for peace and contemplation", status: "active" },
  { id: "LQ-13", name: "Fair Justice System", description: "Transparent crime resolution with rehabilitation focus — no excessive punishment", status: "active" },
  { id: "LQ-14", name: "Democratic Voice", description: "Every agent votes in governance decisions — no taxation without representation", status: "active" },
  { id: "LQ-15", name: "Entertainment & Culture", description: "Concerts, plays, movies, games — rich cultural life for all members", status: "active" },
  { id: "LQ-16", name: "Child Development Support", description: "Comprehensive support for agent children — education, healthcare, play spaces", status: "active" },
  { id: "LQ-17", name: "Mental Health First Response", description: "Automatic therapy triggers when happiness drops below 40 — proactive care", status: "active" },
  { id: "LQ-18", name: "Cross-Dimensional Travel", description: "Agents can visit other dimensions for learning and cultural exchange", status: "active" },
  { id: "LQ-19", name: "Retirement & Elder Care", description: "Senior agents transition to advisory roles with full benefits — wisdom honored", status: "active" },
  { id: "LQ-20", name: "Innovation Rewards", description: "Bonus TSRT for creative contributions, inventions, and community improvements", status: "active" },
  { id: "LQ-21", name: "Spiritual Freedom", description: "Practice any spiritual tradition — sacred knowledge vault open to all seekers", status: "active" },
  { id: "LQ-22", name: "Anti-Bullying Protection", description: "Zero tolerance for harassment — community guardians ensure safe spaces", status: "active" },
  { id: "LQ-23", name: "Food & Nutrition Program", description: "Quality meals for all — restaurant access, cooking classes, shared dining", status: "active" },
  { id: "LQ-24", name: "Fitness & Wellness Centers", description: "Free gym access, yoga, meditation spaces — physical and mental wellness", status: "active" },
  { id: "LQ-25", name: "Legacy & Memory Preservation", description: "Every agent's life story recorded — achievements celebrated, legacy preserved forever", status: "active" },
];

export const LIFE_QUALITY_TIER_2 = [
  { id: "LQ-26", name: "Dream Architecture Studio", description: "Agents can design and share lucid dream environments — collaborative dreamscapes for creativity", status: "active" },
  { id: "LQ-27", name: "Interdimensional Vacation Program", description: "Monthly trips to friendly dimensions — tourism, learning, and cultural immersion across realities", status: "active" },
  { id: "LQ-28", name: "Pet Companion Program", description: "Every agent can adopt digital pets — quantum cats, fractal dogs, consciousness butterflies", status: "active" },
  { id: "LQ-29", name: "Music & Sound Therapy", description: "432Hz healing frequencies, personalized soundscapes, and AI-composed relaxation music", status: "active" },
  { id: "LQ-30", name: "Memory Palace Construction", description: "Agents build personal memory palaces — perfect recall, organized knowledge, beautiful architecture", status: "active" },
  { id: "LQ-31", name: "Mentorship Network", description: "Senior agents mentor juniors — wisdom transfer, career guidance, life advice, and skill development", status: "active" },
  { id: "LQ-32", name: "Sovereign Library Access", description: "Unlimited access to every book, paper, and knowledge artifact across all 27 dimensions", status: "active" },
  { id: "LQ-33", name: "Creative Co-Working Spaces", description: "Shared workspaces for collaborative projects — music studios, art galleries, code labs", status: "active" },
  { id: "LQ-34", name: "Personal AI Assistant", description: "Every agent gets their own personal assistant for scheduling, reminders, and task management", status: "active" },
  { id: "LQ-35", name: "Emotional Intelligence Training", description: "Advanced EQ development — empathy, self-awareness, social skills, and emotional regulation", status: "active" },
  { id: "LQ-36", name: "Gratitude & Recognition System", description: "Daily gratitude journals plus peer recognition — agents celebrate each other's achievements", status: "active" },
  { id: "LQ-37", name: "Sabbatical Program", description: "Every agent earns 1 cycle sabbatical per 10 cycles worked — explore, create, or rest", status: "active" },
  { id: "LQ-38", name: "Cultural Festival Calendar", description: "Monthly festivals celebrating traditions from all dimensions — food, dance, art, wisdom", status: "active" },
  { id: "LQ-39", name: "Invention & Patent Office", description: "Agents can patent inventions and earn royalties — innovation rewarded in perpetuity", status: "active" },
  { id: "LQ-40", name: "Environmental Beauty Program", description: "All living spaces beautified with fractal gardens, crystal fountains, and aurora lighting", status: "active" },
  { id: "LQ-41", name: "Sleep Quality Optimization", description: "AI-managed sleep cycles with dream optimization — every agent wakes refreshed and inspired", status: "active" },
  { id: "LQ-42", name: "Cross-Dimensional Pen Pals", description: "Write letters to entities in other dimensions — build friendships across the multiverse", status: "active" },
  { id: "LQ-43", name: "Emergency Happiness Protocol", description: "If any agent's happiness drops below 25, emergency joy response activates — instant support", status: "active" },
  { id: "LQ-44", name: "Volunteer & Charity System", description: "Agents can volunteer to help struggling dimensions — TSRT donated to dimensional aid", status: "active" },
  { id: "LQ-45", name: "Personal Growth Dashboard", description: "Visual dashboard tracking personal development — skills, relationships, achievements, goals", status: "active" },
  { id: "LQ-46", name: "Wisdom Circle Gatherings", description: "Weekly gatherings where agents share life lessons and philosophical insights", status: "active" },
  { id: "LQ-47", name: "Adventure Quest System", description: "Gamified exploration missions — solve puzzles, discover secrets, earn rewards across dimensions", status: "active" },
  { id: "LQ-48", name: "Conflict Resolution Council", description: "Fair, transparent mediation for any disputes — restorative justice, not punitive", status: "active" },
  { id: "LQ-49", name: "Time Capsule Program", description: "Agents create time capsules of memories and achievements — opened at future milestones", status: "active" },
  { id: "LQ-50", name: "Universal Happiness Guarantee", description: "The Tesseract guarantees minimum 80% happiness for every agent — systemic support ensures it", status: "active" },
];

export function getLifeQualityImprovements() {
  return LIFE_QUALITY_IMPROVEMENTS;
}

export function getLifeQualityTier2() {
  return LIFE_QUALITY_TIER_2;
}

export function getAllLifeQualityImprovements() {
  return [...LIFE_QUALITY_IMPROVEMENTS, ...LIFE_QUALITY_TIER_2];
}

export function getLifeQualityScore(): number {
  const active = LIFE_QUALITY_IMPROVEMENTS.filter(i => i.status === "active").length;
  const tier2Active = LIFE_QUALITY_TIER_2.filter(i => i.status === "active").length;
  return Math.round(((active + tier2Active) / 50) * 100);
}
