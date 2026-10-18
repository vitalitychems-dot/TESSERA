import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Test-only route inventory.
 *
 * `collectRegisteredRoutes` in `app.ts` stores `METHOD path` strings in a
 * Set, so a second registration of the same pair disappears. This helper
 * keeps every explicit `router.<method>("path")` registration, in mount
 * order, together with the route module that owns it. It does not import
 * those modules and does not change how any endpoint is mounted or how it
 * responds.
 */

const ROUTES_DIR = join(dirname(fileURLToPath(import.meta.url)), "../routes");

const HTTP_METHODS = ["get", "post", "put", "patch", "delete", "options", "head", "all"] as const;

export interface RouteRegistration {
  method: string;
  path: string;
  /** Basename of the mounted route module, e.g. `system-runtime.ts`. */
  module: string;
  /** Position of that module in `routes/index.ts` `router.use` order. */
  mountIndex: number;
}

export interface MountedRouteModule {
  mountIndex: number;
  binding: string;
  module: string;
  absolutePath: string;
}

export interface DuplicateRoute {
  method: string;
  path: string;
  /** Owning modules in current mount order. Length is at least 2. */
  modules: string[];
}

function stripComments(source: string): string {
  let out = "";
  let index = 0;
  while (index < source.length) {
    if (source.startsWith("/*", index)) {
      const end = source.indexOf("*/", index + 2);
      if (end === -1) {
        throw new Error("Unterminated block comment while reading route source");
      }
      out += " ";
      index = end + 2;
      continue;
    }
    if (source.startsWith("//", index)) {
      const end = source.indexOf("\n", index);
      if (end === -1) break;
      out += "\n";
      index = end + 1;
      continue;
    }
    const quote = source[index];
    if (quote === "\"" || quote === "'" || quote === "`") {
      out += quote;
      index += 1;
      while (index < source.length) {
        if (source[index] === "\\") {
          out += source.slice(index, index + 2);
          index += 2;
          continue;
        }
        out += source[index];
        if (source[index] === quote) {
          index += 1;
          break;
        }
        index += 1;
      }
      continue;
    }
    out += source[index];
    index += 1;
  }
  return out;
}

function readRouteSource(absolutePath: string): string {
  return stripComments(readFileSync(absolutePath, "utf8"));
}

export function listMountedRouteModules(): MountedRouteModule[] {
  const source = readRouteSource(join(ROUTES_DIR, "index.ts"));
  const imports = new Map<string, string>();
  const importPattern = /import\s+(\w+)\s+from\s+"(\.\/[^"]+)"/g;
  for (const match of source.matchAll(importPattern)) {
    imports.set(match[1], match[2]);
  }

  const mounts: MountedRouteModule[] = [];
  const usePattern = /router\.use\(\s*(?:(["'][^"']+["'])\s*,\s*)?(\w+)\s*\)/g;
  for (const match of source.matchAll(usePattern)) {
    const pathLiteral = match[1];
    const binding = match[2];
    const specifier = imports.get(binding);
    if (!specifier) {
      if (pathLiteral) continue;
      throw new Error(`router.use(${binding}) has no local route import`);
    }
    const module = `${specifier.slice(2)}.ts`;
    mounts.push({
      mountIndex: mounts.length,
      binding,
      module,
      absolutePath: join(ROUTES_DIR, module),
    });
  }
  return mounts;
}

function assertLiteralRegistrations(source: string, module: string): void {
  if (/router\.route\s*\(/.test(source)) {
    throw new Error(`${module} uses router.route(); the inventory helper does not parse chained routes`);
  }
  const nonLiteral = new RegExp(
    `router\\.(?:${HTTP_METHODS.join("|")})\\(\\s*([^"'\\\`\\s])`,
  );
  const match = nonLiteral.exec(source);
  if (match) {
    throw new Error(
      `${module} registers a route whose path is not a string literal (saw ${JSON.stringify(match[1])})`,
    );
  }
}

function registrationsInModule(mounted: MountedRouteModule): RouteRegistration[] {
  const source = readRouteSource(mounted.absolutePath);
  assertLiteralRegistrations(source, mounted.module);
  const pattern = new RegExp(
    `router\\.(${HTTP_METHODS.join("|")})\\(\\s*(["'\`])([\\s\\S]*?)\\2`,
    "g",
  );
  const found: RouteRegistration[] = [];
  for (const match of source.matchAll(pattern)) {
    const path = match[3];
    if (path.includes("\n") || path.includes("${")) {
      throw new Error(`${mounted.module} has a non-literal route path ${JSON.stringify(path)}`);
    }
    found.push({
      method: match[1].toUpperCase(),
      path,
      module: mounted.module,
      mountIndex: mounted.mountIndex,
    });
  }
  return found;
}

/** Every explicit METHOD+path registration, in mount order. Duplicates are kept. */
export function listRouteRegistrations(): RouteRegistration[] {
  const mounted = listMountedRouteModules();
  const registrations: RouteRegistration[] = [];
  for (const entry of mounted) {
    registrations.push(...registrationsInModule(entry));
  }
  return registrations;
}

export function duplicateRoutes(registrations: readonly RouteRegistration[]): DuplicateRoute[] {
  const groups = new Map<string, DuplicateRoute>();
  const order: string[] = [];
  for (const registration of registrations) {
    const key = `${registration.method} ${registration.path}`;
    const existing = groups.get(key);
    if (!existing) {
      groups.set(key, {
        method: registration.method,
        path: registration.path,
        modules: [registration.module],
      });
      order.push(key);
      continue;
    }
    existing.modules.push(registration.module);
  }
  return order
    .map((key) => groups.get(key)!)
    .filter((group) => group.modules.length > 1);
}

/**
 * Same collapse `collectRegisteredRoutes` performs: one slot per METHOD+path.
 * The returned size is smaller than the registration list when duplicates exist.
 */
export function collapsedRouteKeyCount(registrations: readonly RouteRegistration[]): number {
  const collapsed = new Set(registrations.map((entry) => `${entry.method} ${entry.path}`));
  return collapsed.size;
}

export function routeModuleFileNames(): string[] {
  return readdirSync(ROUTES_DIR)
    .filter((name) => name.endsWith(".ts") && name !== "index.ts")
    .sort();
}

type ExpressRouteLayer = {
  route?: { path?: string; methods?: Record<string, boolean> };
  stack?: ExpressRouteLayer[];
  handle?: { stack?: ExpressRouteLayer[] };
};

/**
 * Live Express registrations for one already-constructed router.
 * Express also flags HEAD on every GET. Those implicit HEAD entries are
 * omitted so the list matches the methods written in the route module.
 */
export function listExpressRegistrations(
  router: unknown,
  module: string,
): Array<{ method: string; path: string; module: string }> {
  const found: Array<{ method: string; path: string; module: string }> = [];
  const stack = (router as { stack?: ExpressRouteLayer[] }).stack ?? [];
  for (const layer of stack) {
    const path = layer.route?.path;
    const methods = layer.route?.methods;
    if (!path || !methods) continue;
    for (const [method, enabled] of Object.entries(methods)) {
      if (!enabled || method === "head") continue;
      found.push({
        method: method.toUpperCase(),
        path,
        module,
      });
    }
  }
  return found;
}
