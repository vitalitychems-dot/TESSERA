import { existsSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const stubs = new Map([
  ["@tanstack/react-start", new URL("./stubs/tanstack-start.mjs", import.meta.url).href],
  ["pino", new URL("./stubs/pino.mjs", import.meta.url).href],
]);

function fileIfExists(candidate) {
  if (!existsSync(candidate)) return null;
  const stat = statSync(candidate);
  return stat.isFile() ? pathToFileURL(candidate).href : null;
}

export async function resolve(specifier, context, nextResolve) {
  const stub = stubs.get(specifier);
  if (stub) return { url: stub, shortCircuit: true };
  if (!specifier.startsWith(".") || !context.parentURL) return nextResolve(specifier, context);

  const parent = fileURLToPath(context.parentURL);
  const abs = path.resolve(path.dirname(parent), specifier);
  const tries = [];
  if (specifier.endsWith(".js")) tries.push(`${abs.slice(0, -3)}.ts`);
  tries.push(abs);
  if (!path.extname(abs)) tries.push(`${abs}.ts`, `${abs}.mjs`, `${abs}.js`, path.join(abs, "index.ts"));
  for (const candidate of tries) {
    const url = fileIfExists(candidate);
    if (url) return { url, shortCircuit: true };
  }
  return nextResolve(specifier, context);
}
