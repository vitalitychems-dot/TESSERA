import { writeFileSync } from "node:fs";

export function countTokens(text) {
  const size = String(text ?? "").length;
  return Math.max(1, Math.ceil(size / 4));
}

export function baselineRecord(task) {
  return {
    task: task.id,
    tokens: countTokens(task.prompt),
    success: task.success === true,
  };
}

export function writeBaseline(file, task) {
  const record = baselineRecord(task);
  writeFileSync(file, `${JSON.stringify(record)}\n`);
  return record;
}
