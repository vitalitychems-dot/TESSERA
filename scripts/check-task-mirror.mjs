/**
 * Validate the read-only Gitbook task-queue mirror.
 *
 * Checks mesh/queue/TASKS.mirror.json: task ids are unique, each status is
 * queued, claimed, blocked, or done, and each scope is an array of strings.
 * Claims still happen in Gitbook. This script does not claim tasks.
 *
 * Usage: node scripts/check-task-mirror.mjs [path]
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const STATUSES = new Set(["queued", "claimed", "blocked", "done"]);

export const defaultMirrorPath = join(
  dirname(fileURLToPath(import.meta.url)),
  "../mesh/queue/TASKS.mirror.json",
);

export function validateTaskMirror(doc) {
  const errors = [];
  if (doc === null || typeof doc !== "object" || Array.isArray(doc)) {
    return { ok: false, errors: ["mirror must be a JSON object"] };
  }
  if (doc.schema !== "mesh-queue/v1") {
    errors.push('schema must be "mesh-queue/v1"');
  }
  if (typeof doc.source !== "string" || !/^Gitbook mesh\/queue\/TASKS\.json @ .+?, read-only mirror$/.test(doc.source)) {
    errors.push(
      'source must be "Gitbook mesh/queue/TASKS.json @ <date>, read-only mirror"',
    );
  }
  if (!Array.isArray(doc.tasks)) {
    errors.push("tasks must be an array");
    return { ok: false, errors };
  }

  const seen = new Set();
  doc.tasks.forEach((task, index) => {
    const where = `tasks[${index}]`;
    if (task === null || typeof task !== "object" || Array.isArray(task)) {
      errors.push(`${where} must be an object`);
      return;
    }
    if (typeof task.id !== "string" || task.id.trim() === "") {
      errors.push(`${where}.id must be a non-empty string`);
    } else if (seen.has(task.id)) {
      errors.push(`${where}.id ${JSON.stringify(task.id)} is duplicated`);
    } else {
      seen.add(task.id);
    }
    if (!STATUSES.has(task.status)) {
      errors.push(
        `${where}.status must be one of queued, claimed, blocked, done`,
      );
    }
    if (!Array.isArray(task.scope)) {
      errors.push(`${where}.scope must be an array`);
    } else if (task.scope.some((item) => typeof item !== "string" || item.trim() === "")) {
      errors.push(`${where}.scope must be an array of non-empty strings`);
    }
  });

  return { ok: errors.length === 0, errors };
}

export function checkMirrorFile(path = defaultMirrorPath) {
  let text;
  try {
    text = readFileSync(path, "utf8");
  } catch (error) {
    return { ok: false, errors: [`cannot read ${path}: ${error.message}`] };
  }
  let doc;
  try {
    doc = JSON.parse(text);
  } catch (error) {
    return { ok: false, errors: [`invalid JSON in ${path}: ${error.message}`] };
  }
  return validateTaskMirror(doc);
}

function invokedDirectly() {
  const entry = process.argv[1];
  return entry !== undefined && import.meta.url === pathToFileURL(entry).href;
}

if (invokedDirectly()) {
  const target = process.argv[2] ?? defaultMirrorPath;
  const result = checkMirrorFile(target);
  if (!result.ok) {
    for (const error of result.errors) {
      console.error(error);
    }
    process.exit(1);
  }
  const doc = JSON.parse(readFileSync(target, "utf8"));
  console.log(`ok tasks=${doc.tasks.length}`);
}
