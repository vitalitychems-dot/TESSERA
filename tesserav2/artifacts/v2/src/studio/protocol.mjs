/**
 * Small checker for the studio websocket schemas.
 * Covers the subset those schemas use: object, string, enum, required, minLength.
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

export function validate(schema, value, path = "$") {
  const errors = [];
  if (schema.type === "object") {
    if (value === null || typeof value !== "object" || Array.isArray(value)) {
      errors.push(`${path} should be an object`);
      return errors;
    }
    for (const key of schema.required ?? []) {
      if (!Object.hasOwn(value, key)) errors.push(`${path}.${key} is required`);
    }
    const known = schema.properties ?? {};
    if (schema.additionalProperties === false) {
      for (const key of Object.keys(value)) {
        if (!Object.hasOwn(known, key)) errors.push(`${path}.${key} is not allowed`);
      }
    }
    for (const [key, child] of Object.entries(known)) {
      if (Object.hasOwn(value, key)) errors.push(...validate(child, value[key], `${path}.${key}`));
    }
    return errors;
  }
  if (schema.type === "string") {
    if (typeof value !== "string") errors.push(`${path} should be a string`);
    else {
      if (schema.minLength && value.length < schema.minLength) errors.push(`${path} is too short`);
      if (schema.enum && !schema.enum.includes(value)) errors.push(`${path} is not an allowed value`);
    }
  }
  return errors;
}

export function protocolDir() {
  return join(dirname(fileURLToPath(import.meta.url)), "../../../../docs/v2/protocol");
}

const PROTOCOL_CACHE = new Map();

/** OPT-15: the schema files are static, so parse them once per dir. */
export function loadProtocol(dir = protocolDir()) {
  const cached = PROTOCOL_CACHE.get(dir);
  if (cached) return cached;
  const loaded = loadProtocolUncached(dir);
  PROTOCOL_CACHE.set(dir, loaded);
  return loaded;
}

export function loadProtocolUncached(dir = protocolDir()) {
  const schema = JSON.parse(readFileSync(join(dir, "messages.schema.json"), "utf8"));
  const examples = JSON.parse(readFileSync(join(dir, "examples.json"), "utf8"));
  return { schema, examples };
}

export function checkExamples(dir = protocolDir()) {
  const { schema, examples } = loadProtocol(dir);
  const errors = [];
  for (const [index, message] of examples.entries()) {
    const shape = schema.messages?.[message.type];
    if (!shape) {
      errors.push(`example ${index} has unknown type ${message.type}`);
      continue;
    }
    for (const error of validate(shape, message)) errors.push(`example ${index}: ${error}`);
  }
  return errors;
}

export function checkMessage(message, dir = protocolDir()) {
  const { schema } = loadProtocol(dir);
  const shape = schema.messages?.[message?.type];
  if (!shape) return [`unknown type ${message?.type}`];
  return validate(shape, message);
}
