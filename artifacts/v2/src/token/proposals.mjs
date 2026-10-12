const REQUIRED = ["id", "method", "hypothesis"];

/** A method idea stays queued. Nothing in this queue turns itself on. */
export function submitProposal(input) {
  if (!input || typeof input !== "object") throw new Error("proposal must be an object");
  for (const key of REQUIRED) {
    if (typeof input[key] !== "string" || input[key].trim() === "") {
      throw new Error(`proposal ${key} is required`);
    }
  }
  if (input.enabled === true || input.status === "enabled") {
    throw new Error("proposals cannot enable themselves");
  }
  return {
    id: input.id.trim(),
    method: input.method.trim(),
    hypothesis: input.hypothesis.trim(),
    status: "queued",
    enabled: false,
  };
}
