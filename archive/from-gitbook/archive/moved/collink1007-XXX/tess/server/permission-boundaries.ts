import path from "path";

const pbLog = (msg: string) => console.log(`[PermissionBoundaries] ${msg}`);

export const SECURITY_PROTECTED_FILES = new Set([
  "server/real-threat-monitor.ts",
  "server/security-fortress.ts",
  "server/security.ts",
  "server/security.ts",
  "server/permission-boundaries.ts",
  "server/file-integrity-monitor.ts",
  "server/anomaly-detection.ts",
  "server/vuln-scanner.ts",
  "server/system-diagnostics.ts",
]);

const SECURITY_PROTECTED_PREFIXES = [
  "server/real-threat-monitor",
  "server/security-fortress",
  "server/permission-boundaries",
];

export const MODULE_PERMISSIONS: Record<string, { canRead: string[]; canWrite: string[]; blocked: string[] }> = {
  "self-code-evolution": {
    canRead: ["server", "client/src", "shared"],
    canWrite: ["server", "client/src", "shared"],
    blocked: [
      "server/real-threat-monitor.ts",
      "server/security-fortress.ts",
      "server/security.ts",
      "server/permission-boundaries.ts",
      "server/file-integrity-monitor.ts",
      "server/anomaly-detection.ts",
      "server/vuln-scanner.ts",
      "server/system-diagnostics.ts",
      "server/self-code.ts",
      "server/index.ts",
      "server/db.ts",
      "server/storage.ts",
    ],
  },
  "self-code": {
    canRead: ["server", "client/src", "shared"],
    canWrite: ["server", "client/src", "shared"],
    blocked: [
      "server/real-threat-monitor.ts",
      "server/security-fortress.ts",
      "server/security.ts",
      "server/permission-boundaries.ts",
      "server/self-code.ts",
      "server/index.ts",
      "server/db.ts",
    ],
  },
  "autonomous-builder": {
    canRead: ["server", "client/src", "shared"],
    canWrite: ["server", "client/src", "shared"],
    blocked: [
      "server/real-threat-monitor.ts",
      "server/security-fortress.ts",
      "server/security.ts",
      "server/permission-boundaries.ts",
    ],
  },
};

interface PermissionViolation {
  module: string;
  file: string;
  operation: "read" | "write" | "delete";
  timestamp: number;
  blocked: boolean;
}

const violations: PermissionViolation[] = [];

export function checkModulePermission(
  module: string,
  filePath: string,
  operation: "read" | "write" | "delete"
): { allowed: boolean; reason?: string } {
  const normalized = path.normalize(filePath).replace(/\\/g, "/");

  if (SECURITY_PROTECTED_FILES.has(normalized)) {
    if (operation === "write" || operation === "delete") {
      const violation: PermissionViolation = { module, file: normalized, operation, timestamp: Date.now(), blocked: true };
      violations.unshift(violation);
      if (violations.length > 200) violations.length = 200;
      pbLog(`BLOCKED: Module "${module}" attempted to ${operation} protected security file: ${normalized}`);
      return { allowed: false, reason: `Security file "${normalized}" is immutable — module "${module}" cannot ${operation} it` };
    }
  }

  for (const prefix of SECURITY_PROTECTED_PREFIXES) {
    if (normalized.startsWith(prefix) && (operation === "write" || operation === "delete")) {
      violations.unshift({ module, file: normalized, operation, timestamp: Date.now(), blocked: true });
      if (violations.length > 200) violations.length = 200;
      pbLog(`BLOCKED: Module "${module}" attempted to ${operation} security prefix file: ${normalized}`);
      return { allowed: false, reason: `Files matching "${prefix}" are protected` };
    }
  }

  const perms = MODULE_PERMISSIONS[module];
  if (perms && operation !== "read") {
    if (perms.blocked.includes(normalized)) {
      violations.unshift({ module, file: normalized, operation, timestamp: Date.now(), blocked: true });
      if (violations.length > 200) violations.length = 200;
      pbLog(`BLOCKED: Module "${module}" cannot ${operation} ${normalized} — module-level restriction`);
      return { allowed: false, reason: `Module "${module}" does not have ${operation} permission for "${normalized}"` };
    }
  }

  return { allowed: true };
}

export function isSecurityFile(filePath: string): boolean {
  const normalized = path.normalize(filePath).replace(/\\/g, "/");
  return SECURITY_PROTECTED_FILES.has(normalized) ||
    SECURITY_PROTECTED_PREFIXES.some(p => normalized.startsWith(p));
}

export function getPermissionBoundariesStatus(): {
  protectedFiles: string[];
  modules: string[];
  violations: PermissionViolation[];
  totalViolationsBlocked: number;
} {
  return {
    protectedFiles: [...SECURITY_PROTECTED_FILES],
    modules: Object.keys(MODULE_PERMISSIONS),
    violations: violations.slice(0, 50),
    totalViolationsBlocked: violations.filter(v => v.blocked).length,
  };
}

pbLog(`Permission boundaries initialized — ${SECURITY_PROTECTED_FILES.size} protected security files, ${Object.keys(MODULE_PERMISSIONS).length} module policies`);
