import pino from "pino";

export const LOGGER_REDACT_PATHS = [
  "req.headers.authorization",
  "req.headers.cookie",
  "req.headers['x-mesh-lane-token']",
  "headers['x-mesh-lane-token']",
  "res.headers['set-cookie']",
];

const isProduction = process.env.NODE_ENV === "production";

const SAFE_LOG_CODE = /^[A-Za-z0-9_]{1,32}$/;
const SAFE_LOG_NAME = /^[A-Za-z][A-Za-z0-9_]{0,63}$/;

function readSafeLogCode(err: unknown): string {
  const seen = new Set<unknown>();
  let current = err;
  for (let depth = 0; depth < 4; depth += 1) {
    if (!current || typeof current !== "object" || seen.has(current)) break;
    seen.add(current);
    const record = current as { code?: unknown; cause?: unknown };
    if (typeof record.code === "string" && SAFE_LOG_CODE.test(record.code)) return record.code;
    current = record.cause;
  }
  return "none";
}

function readSafeLogName(value: object): string {
  const record = value as { name?: unknown };
  const rawName = value instanceof Error ? value.name : record.name;
  if (typeof rawName === "string" && rawName !== "Error" && SAFE_LOG_NAME.test(rawName)) return rawName;
  if (value instanceof Error) {
    const ctor = value.constructor?.name;
    if (typeof ctor === "string" && ctor !== "Error" && SAFE_LOG_NAME.test(ctor)) return ctor;
  }
  if (typeof rawName === "string" && SAFE_LOG_NAME.test(rawName)) return rawName;
  return "Error";
}

/** Name and a short code only. Drops message, stack, and string echoes on `err`. */
export function serializeLogErr(value: unknown): { name: string; code: string } {
  if (!value || typeof value !== "object") return { name: "Error", code: "none" };
  return { name: readSafeLogName(value), code: readSafeLogCode(value) };
}

export const logger = pino({
  level: process.env.LOG_LEVEL ?? "info",
  redact: LOGGER_REDACT_PATHS,
  serializers: {
    err: serializeLogErr,
  },
  ...(isProduction
    ? {}
    : {
        transport: {
          target: "pino-pretty",
          options: { colorize: true },
        },
      }),
});
