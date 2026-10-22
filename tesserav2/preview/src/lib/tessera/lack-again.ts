/** The same lack, seen twice, returns a rule that was already written. It does not create the missing thing. */

const RULES: Record<string, string> = {
  "no carried page": "Say Not carried. Do not fetch.",
  "missing mark": "Do not join the seat.",
  "unstamped page": "Do not serve it.",
  "empty note": "Do not store it.",
};

export function lackAgain(seen: { name: string; times: number }[]) {
  const rules = seen
    .filter((gap) => gap.times >= 2 && RULES[gap.name])
    .map((gap) => ({ name: gap.name, rule: RULES[gap.name] as string }));
  return { rules, waited: 0, assembled: false as const };
}
