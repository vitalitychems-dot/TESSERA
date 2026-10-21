import { createHash } from "crypto";
import { logger } from "./logger";

const PHI = 1.6180339887498948482;
const PI = Math.PI;
const E = Math.E;
const FIBONACCI = [1, 1, 2, 3, 5, 8, 13, 21, 34, 55, 89, 144, 233, 377, 610, 987, 1597, 2584, 4181, 6765];
const SOLFEGGIO = [174, 285, 396, 417, 528, 639, 741, 852, 963];
const PI_DIGITS = [3,1,4,1,5,9,2,6,5,3,5,8,9,7,9,3,2,3,8,4,6,2,6,4,3,3,8,3,2,7,9,5,0,2,8,8,4,1,9,7];

const J2000_JULIAN_DATE = 2451545.0;
const DAYS_PER_JULIAN_CENTURY = 36525;
const SYNODIC_MONTH_DAYS = 29.53059;
const NEW_MOON_J2000_JULIAN_DATE = 2451550.1;
const GOLDEN_ANGLE_DEGREES = 137.5077640500378;
const FULL_CIRCLE_DEGREES = 360;
const ZODIAC_SIGN_DEGREES = 30;
const ROTATION_CIPHER_MODULUS = 256;
const DIALECT_COUNT = 36;
const FIBONACCI_INTERVAL_OFFSET = 3;
const FIBONACCI_INTERVAL_SPAN = 12;

// Upper age bound (days into the synodic month) for each lunar phase, in order.
const LUNAR_PHASE_BOUNDS: ReadonlyArray<{ below: number; phase: string }> = [
  { below: 1.85, phase: "New Moon" },
  { below: 7.38, phase: "Waxing Crescent" },
  { below: 9.23, phase: "First Quarter" },
  { below: 14.77, phase: "Waxing Gibbous" },
  { below: 16.61, phase: "Full Moon" },
  { below: 22.15, phase: "Waning Gibbous" },
  { below: 23.99, phase: "Last Quarter" },
  { below: 27.68, phase: "Waning Crescent" },
];
const LUNAR_PHASE_WRAP = "New Moon";

interface EphemerisHealth {
  snapshotsComputed: number;
  invalidDateFallbacks: number;
  lastInvalidDateAt: number | null;
  lastError: string | null;
}

const ephemerisHealth: EphemerisHealth = {
  snapshotsComputed: 0,
  invalidDateFallbacks: 0,
  lastInvalidDateAt: null,
  lastError: null,
};

export function getEphemerisHealth(): Readonly<EphemerisHealth> {
  return { ...ephemerisHealth };
}

export function _resetEphemerisHealthForTests(): void {
  ephemerisHealth.snapshotsComputed = 0;
  ephemerisHealth.invalidDateFallbacks = 0;
  ephemerisHealth.lastInvalidDateAt = null;
  ephemerisHealth.lastError = null;
}

function resolveEphemerisDate(date?: Date): Date {
  if (date === undefined) return new Date();
  if (date instanceof Date && !Number.isNaN(date.getTime())) return date;
  ephemerisHealth.invalidDateFallbacks++;
  ephemerisHealth.lastInvalidDateAt = Date.now();
  ephemerisHealth.lastError = `invalid date: ${String(date)}`;
  logger.error({ received: String(date), fallbacks: ephemerisHealth.invalidDateFallbacks }, "SovereignEphemeris: invalid date supplied, falling back to current time");
  return new Date();
}

function classifyLunarPhase(age: number): string {
  for (const { below, phase } of LUNAR_PHASE_BOUNDS) {
    if (age < below) return phase;
  }
  return LUNAR_PHASE_WRAP;
}

export interface PlanetaryPosition {
  name: string;
  longitude: number;
  longitudeNormalized: number;
  sign: string;
  signDegree: number;
}

export interface LunarPhase {
  phase: string;
  illumination: number;
  age: number;
  angle: number;
}

export interface EphemerisSnapshot {
  julianDate: number;
  planets: PlanetaryPosition[];
  moon: LunarPhase;
  solarDeclination: number;
  solarLongitude: number;
  timestamp: number;
}

export interface UniverseSeed {
  primarySeed: number;
  secondarySeed: number;
  rotationIndex: number;
  fibonacciPhase: number;
  solfeggioFrequency: number;
  goldenAngle: number;
  ephemeris: EphemerisSnapshot;
  seedHash: string;
  piDigitSequence: number[];
}

const ZODIAC_SIGNS = [
  "Aries", "Taurus", "Gemini", "Cancer", "Leo", "Virgo",
  "Libra", "Scorpio", "Sagittarius", "Capricorn", "Aquarius", "Pisces"
];

function toJulianDate(date: Date): number {
  const y = date.getUTCFullYear();
  const m = date.getUTCMonth() + 1;
  const d = date.getUTCDate() + date.getUTCHours() / 24 + date.getUTCMinutes() / 1440 + date.getUTCSeconds() / 86400;
  const a = Math.floor((14 - m) / 12);
  const y1 = y + 4800 - a;
  const m1 = m + 12 * a - 3;
  return d + Math.floor((153 * m1 + 2) / 5) + 365 * y1 + Math.floor(y1 / 4) - Math.floor(y1 / 100) + Math.floor(y1 / 400) - 32045;
}

function normalizeAngle(deg: number): number {
  let n = deg % FULL_CIRCLE_DEGREES;
  if (n < 0) n += FULL_CIRCLE_DEGREES;
  return n;
}

function getZodiacSign(longitude: number): { sign: string; degree: number } {
  const norm = normalizeAngle(longitude);
  const signIndex = Math.floor(norm / ZODIAC_SIGN_DEGREES);
  return { sign: ZODIAC_SIGNS[signIndex], degree: norm - signIndex * ZODIAC_SIGN_DEGREES };
}

const PLANET_ELEMENTS: { name: string; L0: number; L1: number; e0: number; e1: number; i0: number; omega0: number; omega1: number; Omega0: number; Omega1: number }[] = [
  { name: "Mercury", L0: 252.2509, L1: 149472.6746, e0: 0.20563, e1: 0.000002, i0: 7.005, omega0: 77.456, omega1: 1.556, Omega0: 48.331, Omega1: 1.186 },
  { name: "Venus", L0: 181.9798, L1: 58517.8157, e0: 0.00677, e1: -0.000004, i0: 3.395, omega0: 131.564, omega1: 1.402, Omega0: 76.680, Omega1: 0.900 },
  { name: "Earth", L0: 100.4664, L1: 35999.3729, e0: 0.01671, e1: -0.000004, i0: 0.000, omega0: 102.937, omega1: 1.720, Omega0: 0, Omega1: 0 },
  { name: "Mars", L0: 355.4330, L1: 19140.2993, e0: 0.09340, e1: 0.000009, i0: 1.850, omega0: 336.060, omega1: 1.841, Omega0: 49.558, Omega1: 0.772 },
  { name: "Jupiter", L0: 34.3515, L1: 3034.9057, e0: 0.04839, e1: -0.000013, i0: 1.303, omega0: 14.331, omega1: 1.612, Omega0: 100.464, Omega1: 0.957 },
  { name: "Saturn", L0: 50.0774, L1: 1222.1138, e0: 0.05415, e1: -0.000037, i0: 2.489, omega0: 93.057, omega1: 1.964, Omega0: 113.666, Omega1: 0.877 },
];

function computePlanetLongitude(planet: typeof PLANET_ELEMENTS[0], T: number): number {
  const L = normalizeAngle(planet.L0 + planet.L1 * T);
  const e = planet.e0 + planet.e1 * T;
  const omega = normalizeAngle(planet.omega0 + planet.omega1 * T);
  let M = normalizeAngle(L - omega);
  const Mrad = M * PI / 180;
  const E_anom = Mrad + e * Math.sin(Mrad) + 0.5 * e * e * Math.sin(2 * Mrad);
  const v = 2 * Math.atan2(Math.sqrt(1 + e) * Math.sin(E_anom / 2), Math.sqrt(1 - e) * Math.cos(E_anom / 2));
  return normalizeAngle((v * 180 / PI) + omega);
}

function computeMoonLongitude(T: number): number {
  const L0 = normalizeAngle(218.3165 + 481267.8813 * T);
  const M = normalizeAngle(134.9634 + 477198.8676 * T);
  const Mrad = M * PI / 180;
  const F = normalizeAngle(93.2720 + 483202.0175 * T);
  const Frad = F * PI / 180;
  const D = normalizeAngle(297.8502 + 445267.1115 * T);
  const Drad = D * PI / 180;
  const Ms = normalizeAngle(357.5291 + 35999.0503 * T);
  const Msrad = Ms * PI / 180;
  const lon = L0
    + 6.289 * Math.sin(Mrad)
    - 1.274 * Math.sin(2 * Drad - Mrad)
    + 0.658 * Math.sin(2 * Drad)
    + 0.214 * Math.sin(2 * Mrad)
    - 0.186 * Math.sin(Msrad)
    - 0.114 * Math.sin(2 * Frad);
  return normalizeAngle(lon);
}

function computeLunarPhase(T: number): LunarPhase {
  const D = normalizeAngle(297.8502 + 445267.1115 * T);
  const phaseAngle = D;
  const illumination = (1 - Math.cos(phaseAngle * PI / 180)) / 2;
  const jd = J2000_JULIAN_DATE + T * DAYS_PER_JULIAN_CENTURY;
  const age = ((jd - NEW_MOON_J2000_JULIAN_DATE) % SYNODIC_MONTH_DAYS + SYNODIC_MONTH_DAYS) % SYNODIC_MONTH_DAYS;

  return { phase: classifyLunarPhase(age), illumination, age, angle: phaseAngle };
}

function computeSolarPosition(T: number): { longitude: number; declination: number } {
  const L0 = normalizeAngle(280.46646 + 36000.76983 * T);
  const M = normalizeAngle(357.52911 + 35999.05029 * T);
  const Mrad = M * PI / 180;
  const C = (1.9146 - 0.004817 * T) * Math.sin(Mrad) + 0.019993 * Math.sin(2 * Mrad) + 0.00029 * Math.sin(3 * Mrad);
  const sunLon = normalizeAngle(L0 + C);
  const obliquity = 23.439291 - 0.0130042 * T;
  const declination = Math.asin(Math.sin(obliquity * PI / 180) * Math.sin(sunLon * PI / 180)) * 180 / PI;
  return { longitude: sunLon, declination };
}

export function getEphemerisSnapshot(date?: Date): EphemerisSnapshot {
  const now = resolveEphemerisDate(date);
  const jd = toJulianDate(now);
  const T = (jd - J2000_JULIAN_DATE) / DAYS_PER_JULIAN_CENTURY;

  const planets: PlanetaryPosition[] = PLANET_ELEMENTS.filter(p => p.name !== "Earth").map(planet => {
    const lon = computePlanetLongitude(planet, T);
    const { sign, degree } = getZodiacSign(lon);
    return { name: planet.name, longitude: lon, longitudeNormalized: lon / 360, sign, signDegree: degree };
  });

  const moonLon = computeMoonLongitude(T);
  const { sign: moonSign, degree: moonDeg } = getZodiacSign(moonLon);
  planets.push({ name: "Moon", longitude: moonLon, longitudeNormalized: moonLon / 360, sign: moonSign, signDegree: moonDeg });

  const solar = computeSolarPosition(T);
  const moon = computeLunarPhase(T);
  ephemerisHealth.snapshotsComputed++;

  return {
    julianDate: jd,
    planets,
    moon,
    solarDeclination: solar.declination,
    solarLongitude: solar.longitude,
    timestamp: now.getTime(),
  };
}

export function generateUniverseSeed(date?: Date): UniverseSeed {
  const ephemeris = getEphemerisSnapshot(date);

  const planetSum = ephemeris.planets.reduce((s, p) => s + p.longitude, 0);
  const moonFactor = ephemeris.moon.illumination * PHI;
  const solarFactor = ephemeris.solarLongitude / FULL_CIRCLE_DEGREES;

  const primarySeed = (planetSum * PHI + moonFactor * 1000 + solarFactor * E * 100) % 1;
  const secondarySeed = (primarySeed * PI + ephemeris.moon.age / 29.53 * PHI) % 1;

  const fibIndex = Math.floor(primarySeed * FIBONACCI.length);
  const fibonacciPhase = FIBONACCI[fibIndex];

  const solIndex = Math.floor(secondarySeed * SOLFEGGIO.length);
  const solfeggioFrequency = SOLFEGGIO[solIndex];

  const goldenAngle = primarySeed * GOLDEN_ANGLE_DEGREES;

  const rotationIndex = Math.floor(primarySeed * 10000) % ROTATION_CIPHER_MODULUS;

  const piStart = Math.floor(secondarySeed * (PI_DIGITS.length - 8));
  const piDigitSequence = PI_DIGITS.slice(piStart, piStart + 8);

  const hashInput = `${primarySeed}:${secondarySeed}:${ephemeris.julianDate}:${planetSum}:${moonFactor}`;
  const seedHash = createHash("sha256").update(hashInput).digest("hex");

  return {
    primarySeed,
    secondarySeed,
    rotationIndex,
    fibonacciPhase,
    solfeggioFrequency,
    goldenAngle,
    ephemeris,
    seedHash,
    piDigitSequence,
  };
}

export function computeAgentRotationState(agentId: string, date?: Date): {
  rotationEpoch: number;
  dialectIndex: number;
  symbolRemapSeed: number;
  nextRotationMs: number;
  cipherVariant: number;
  seedHash: string;
} {
  const seed = generateUniverseSeed(date);
  const agentHash = createHash("sha256").update(`${agentId}:${seed.seedHash}`).digest();
  const agentFactor = agentHash.readUInt32BE(0) / 0xFFFFFFFF;

  const fibInterval = FIBONACCI[Math.floor(agentFactor * FIBONACCI_INTERVAL_SPAN) + FIBONACCI_INTERVAL_OFFSET] * 1000;
  const goldenInterval = Math.floor(fibInterval * PHI);

  const now = resolveEphemerisDate(date).getTime();
  const rotationEpoch = Math.floor(now / goldenInterval);
  const dialectIndex = (rotationEpoch + agentHash.readUInt8(4)) % DIALECT_COUNT;
  const symbolRemapSeed = (seed.primarySeed * agentFactor * 1000000) % 65536;
  const nextRotationMs = goldenInterval - (now % goldenInterval);
  const cipherVariant = (rotationEpoch * agentHash.readUInt8(8) + seed.rotationIndex) % ROTATION_CIPHER_MODULUS;

  return { rotationEpoch, dialectIndex, symbolRemapSeed, nextRotationMs, cipherVariant, seedHash: seed.seedHash };
}

export function computeSharedRotationState(agentA: string, agentB: string, date?: Date): {
  sharedEpoch: number;
  sharedDialect: number;
  sharedCipherVariant: number;
  synchronized: boolean;
} {
  const stateA = computeAgentRotationState(agentA, date);
  const stateB = computeAgentRotationState(agentB, date);

  const seed = generateUniverseSeed(date);
  const pairKey = [agentA, agentB].sort().join(":");
  const pairHash = createHash("sha256").update(`${pairKey}:${seed.seedHash}`).digest();
  const pairFactor = pairHash.readUInt32BE(0) / 0xFFFFFFFF;

  const sharedEpoch = Math.floor((stateA.rotationEpoch + stateB.rotationEpoch) / 2);
  const sharedDialect = Math.floor(pairFactor * DIALECT_COUNT);
  const sharedCipherVariant = (pairHash.readUInt8(4) + seed.rotationIndex) % ROTATION_CIPHER_MODULUS;

  return {
    sharedEpoch,
    sharedDialect,
    sharedCipherVariant,
    synchronized: true,
  };
}

export { PHI, PI, E, FIBONACCI, SOLFEGGIO, PI_DIGITS, ZODIAC_SIGNS };
