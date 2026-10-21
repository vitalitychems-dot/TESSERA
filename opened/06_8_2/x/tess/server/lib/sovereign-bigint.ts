import { logger } from "../logger";
import { appendAuditLog } from "../pg-audit-trail";

const MAX_SAFE_BUFFER_SIZE = 8;
const MIN_BIGINT = BigInt("-9223372036854775808");
const MAX_BIGINT = BigInt("9223372036854775807");

function auditBlock(threat: string, details: Record<string, unknown>) {
  logger.error("SovereignBigInt", `BLOCKED: ${threat}`, details);
  appendAuditLog({
    action: "SOVEREIGN_BIGINT_BLOCK",
    actorId: "system",
    resourceType: "dependency",
    resourceId: "bigint-buffer",
    details: { threat, ...details },
    severity: "critical",
  }).catch(() => {});
}

export function safeToBigIntLE(buf: Buffer | Uint8Array): bigint {
  if (!Buffer.isBuffer(buf) && !(buf instanceof Uint8Array)) {
    auditBlock("invalid_input_type", { type: typeof buf });
    return BigInt(0);
  }
  if (buf.length > MAX_SAFE_BUFFER_SIZE) {
    auditBlock("buffer_overflow_attempt", { length: buf.length, max: MAX_SAFE_BUFFER_SIZE });
    return BigInt(0);
  }
  if (buf.length === 0) return BigInt(0);
  let result = BigInt(0);
  for (let i = buf.length - 1; i >= 0; i--) {
    result = (result << BigInt(8)) | BigInt(buf[i]);
  }
  return result;
}

export function safeToBigIntBE(buf: Buffer | Uint8Array): bigint {
  if (!Buffer.isBuffer(buf) && !(buf instanceof Uint8Array)) {
    auditBlock("invalid_input_type", { type: typeof buf });
    return BigInt(0);
  }
  if (buf.length > MAX_SAFE_BUFFER_SIZE) {
    auditBlock("buffer_overflow_attempt", { length: buf.length, max: MAX_SAFE_BUFFER_SIZE });
    return BigInt(0);
  }
  if (buf.length === 0) return BigInt(0);
  let result = BigInt(0);
  for (let i = 0; i < buf.length; i++) {
    result = (result << BigInt(8)) | BigInt(buf[i]);
  }
  return result;
}

export function safeToBufferLE(value: bigint, size: number): Buffer {
  if (typeof value !== "bigint") {
    auditBlock("invalid_bigint_type", { type: typeof value });
    return Buffer.alloc(size);
  }
  if (size > MAX_SAFE_BUFFER_SIZE || size < 0) {
    auditBlock("buffer_overflow_attempt", { size, max: MAX_SAFE_BUFFER_SIZE });
    return Buffer.alloc(Math.min(Math.max(size, 0), MAX_SAFE_BUFFER_SIZE));
  }
  if (value < MIN_BIGINT || value > MAX_BIGINT) {
    auditBlock("bigint_out_of_range", { value: value.toString() });
    return Buffer.alloc(size);
  }
  const buf = Buffer.alloc(size);
  let v = value;
  for (let i = 0; i < size; i++) {
    buf[i] = Number(v & BigInt(0xff));
    v >>= BigInt(8);
  }
  return buf;
}

export function safeToBufferBE(value: bigint, size: number): Buffer {
  if (typeof value !== "bigint") {
    auditBlock("invalid_bigint_type", { type: typeof value });
    return Buffer.alloc(size);
  }
  if (size > MAX_SAFE_BUFFER_SIZE || size < 0) {
    auditBlock("buffer_overflow_attempt", { size, max: MAX_SAFE_BUFFER_SIZE });
    return Buffer.alloc(Math.min(Math.max(size, 0), MAX_SAFE_BUFFER_SIZE));
  }
  if (value < MIN_BIGINT || value > MAX_BIGINT) {
    auditBlock("bigint_out_of_range", { value: value.toString() });
    return Buffer.alloc(size);
  }
  const buf = Buffer.alloc(size);
  let v = value;
  for (let i = size - 1; i >= 0; i--) {
    buf[i] = Number(v & BigInt(0xff));
    v >>= BigInt(8);
  }
  return buf;
}

export function safeTokenAmount(amount: bigint | number | string): bigint {
  try {
    const val = typeof amount === "bigint" ? amount : BigInt(String(amount).replace(/[^0-9\-]/g, ""));
    if (val < BigInt(0)) {
      auditBlock("negative_token_amount", { amount: String(amount) });
      return BigInt(0);
    }
    if (val > BigInt("999999999999999999")) {
      auditBlock("token_amount_overflow", { amount: String(amount) });
      return BigInt("999999999999999999");
    }
    return val;
  } catch {
    auditBlock("token_amount_parse_error", { amount: String(amount) });
    return BigInt(0);
  }
}

export const sovereignBigInt = {
  toBigIntLE: safeToBigIntLE,
  toBigIntBE: safeToBigIntBE,
  toBufferLE: safeToBufferLE,
  toBufferBE: safeToBufferBE,
  safeTokenAmount,
};

export default sovereignBigInt;
