export interface TaskContract {
  id: string;
  goal: string;
  constraints: string[];
  evidenceNeeds: string[];
  acceptanceChecks: string[];
  allowedCapabilities: string[];
  forbiddenCapabilities: string[];
  budgets: {
    maxTokens?: number;
    maxDurationMs?: number;
  };
}

export interface ContractValidation {
  valid: boolean;
  errors: string[];
  value?: TaskContract;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function nonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function stringList(value: unknown): value is string[] {
  return Array.isArray(value) && value.every(nonEmptyString);
}

function positiveInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value > 0;
}

export function validateTaskContract(input: unknown): ContractValidation {
  if (!isRecord(input)) return { valid: false, errors: ["Contract must be an object."] };

  const errors: string[] = [];
  const allowedFields = new Set([
    "id", "goal", "constraints", "evidenceNeeds", "acceptanceChecks",
    "allowedCapabilities", "forbiddenCapabilities", "budgets",
  ]);
  for (const key of Object.keys(input)) {
    if (!allowedFields.has(key)) errors.push(`Unknown contract field: ${key}.`);
  }
  if (!nonEmptyString(input.id)) errors.push("id must be a non-empty string.");
  if (!nonEmptyString(input.goal)) errors.push("goal must be a non-empty string.");

  const listFields = [
    "constraints",
    "evidenceNeeds",
    "acceptanceChecks",
    "allowedCapabilities",
    "forbiddenCapabilities",
  ] as const;
  for (const field of listFields) {
    if (!stringList(input[field])) errors.push(`${field} must be an array of non-empty strings.`);
  }
  if (Array.isArray(input.acceptanceChecks) && input.acceptanceChecks.length === 0) {
    errors.push("acceptanceChecks must contain at least one check.");
  }

  const budgets = isRecord(input.budgets) ? input.budgets : {};
  if (input.budgets !== undefined && !isRecord(input.budgets)) {
    errors.push("budgets must be an object.");
  }
  if (budgets.maxTokens !== undefined && !positiveInteger(budgets.maxTokens)) {
    errors.push("budgets.maxTokens must be a positive integer.");
  }
  if (budgets.maxDurationMs !== undefined && !positiveInteger(budgets.maxDurationMs)) {
    errors.push("budgets.maxDurationMs must be a positive integer.");
  }

  if (stringList(input.allowedCapabilities) && stringList(input.forbiddenCapabilities)) {
    const forbidden = new Set(input.forbiddenCapabilities.map(capability => capability.trim()));
    const conflicts = input.allowedCapabilities
      .map(capability => capability.trim())
      .filter(capability => forbidden.has(capability));
    if (conflicts.length > 0) {
      errors.push(`Capabilities cannot be both allowed and forbidden: ${[...new Set(conflicts)].join(", ")}.`);
    }
  }

  if (errors.length > 0) return { valid: false, errors };

  return {
    valid: true,
    errors: [],
    value: {
      id: input.id as string,
      goal: input.goal as string,
      constraints: input.constraints as string[],
      evidenceNeeds: input.evidenceNeeds as string[],
      acceptanceChecks: input.acceptanceChecks as string[],
      allowedCapabilities: input.allowedCapabilities as string[],
      forbiddenCapabilities: input.forbiddenCapabilities as string[],
      budgets: {
        ...(budgets.maxTokens !== undefined ? { maxTokens: budgets.maxTokens as number } : {}),
        ...(budgets.maxDurationMs !== undefined ? { maxDurationMs: budgets.maxDurationMs as number } : {}),
      },
    },
  };
}
