/** Copilot was asked. GitHub refused the assignment. This is not Copilot speaking. */

export function copilotSeat() {
  return {
    name: "Copilot",
    role: "worker" as const,
    joined: false,
    reason: "GitHub returned 403. Copilot is not an assignable actor on this repository.",
  };
}
