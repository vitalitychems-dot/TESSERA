import { existsSync, statSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";

const stubs = new Map([
  ["@tanstack/react-start", new URL("./stubs/tanstack-start.mjs", import.meta.url).href],
  ["pino", new URL("./stubs/pino.mjs", import.meta.url).href],
]);
const repoRootUrl = new URL("../../", import.meta.url);

function insideRepo(url) {
  return url.protocol === "file:" && url.pathname.startsWith(repoRootUrl.pathname);
}

function fileIfExists(candidate) {
  if (!insideRepo(candidate)) return null;
  const file = fileURLToPath(candidate);
  if (!existsSync(file)) return null;
  return statSync(file).isFile() ? pathToFileURL(file).href : null;
}

function candidateUrls(specifier, parentURL) {
  const names = [];
  if (specifier.endsWith(".js")) names.push(`${specifier.slice(0, -3)}.ts`);
  names.push(specifier);
  const slash = specifier.lastIndexOf("/");
  const base = slash === -1 ? specifier : specifier.slice(slash + 1);
  if (!base.includes(".")) names.push(`${specifier}.ts`, `${specifier}.mjs`, `${specifier}.js`, `${specifier}/index.ts`);
  const urls = [];
  for (const name of names) {
    try {
      const url = new URL(name, parentURL);
      if (insideRepo(url)) urls.push(url);
    } catch {
      // A specifier that is not a URL is left to the default resolver.
    }
  }
  return urls;
}

export async function resolve(specifier, context, nextResolve) {
  const stub = stubs.get(specifier);
  if (stub) return { url: stub, shortCircuit: true };
  if (!specifier.startsWith(".") || !context.parentURL) return nextResolve(specifier, context);
  if (specifier.includes("\0") || specifier.includes("\\")) return nextResolve(specifier, context);
  for (const url of candidateUrls(specifier, context.parentURL)) {
    const found = fileIfExists(url);
    if (found) return { url: found, shortCircuit: true };
  }
  return nextResolve(specifier, context);
}
