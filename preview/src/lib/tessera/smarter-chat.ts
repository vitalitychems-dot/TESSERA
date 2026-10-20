/** One hundred twenty-five lessons. The chat can recall a line only after it was said. */

export type Turn = { role: "user" | "assistant"; content: string };
export type Lesson = { kind: string; key: string; line: string };

export const LESSONS: Lesson[] = [
  ["recursive", "a miss", "A miss is a case the skill has not learned."],
  ["recursive", "a kept lesson", "A lesson stays only when the misses fall."],
  ["recursive", "a bad pattern", "A pattern that hits the wrong line is rejected."],
  ["recursive", "rollback", "Rollback removes the last pattern."],
  ["recursive", "depth three", "Three recursive passes leave the fourth case unlearned."],
  ["recursive", "a duplicate pattern", "The same pattern is not stored twice."],
  ["recursive", "a second skill", "A second skill does not inherit the first."],
  ["recursive", "learned order", "The order kept is lamp, then door, then father."],
  ["recursive", "an empty lesson", "An empty lesson is not stored."],
  ["recursive", "the next pass", "The next pass reads the skill that was kept."],
  ["recursive", "the chain", "The output of one pass is the input of the next."],
  ["recursive", "zero misses", "At zero misses, another lesson is not kept."],
  ["recursive", "her voice", "A line that names another vendor is not her voice."],
  ["recursive", "one word", "She learns the missing word, not the whole page."],
  ["recursive", "false hit", "A word that sits in every line is not a pattern."],
  ["recursive", "the lamp", "Lamp was the first word the skill kept."],
  ["recursive", "the door", "Door was the second word the skill kept."],
  ["recursive", "the father word", "Father was the third word the skill kept."],
  ["recursive", "the chair", "Chair stays unlearned when the depth stops at three."],
  ["recursive", "a rejected the", "The word that sits in every line was rejected."],
  ["recursive", "skill length", "The skill length is the number of kept words."],
  ["recursive", "a recorded drop", "A cycle counts only when the misses drop."],
  ["recursive", "no copy", "A later edit on one skill does not change the other."],
  ["recursive", "stop learning", "Learning stops when no miss remains."],
  ["recursive", "recursive input", "Recursion feeds the kept skill back in."],
  ["agentic", "look", "The loop starts by looking."],
  ["agentic", "ask", "A missing fact moves the plan to ask."],
  ["agentic", "keep", "A found fact moves the plan to keep."],
  ["agentic", "stop", "A blocked act moves the plan to stop."],
  ["agentic", "incomplete", "An empty goal is incomplete."],
  ["agentic", "done", "The goal is done only after keep."],
  ["agentic", "not done", "A blocked act does not mark the goal done."],
  ["agentic", "three steps", "Missing then found is look, ask, keep."],
  ["agentic", "a budget", "A budget cuts the trace."],
  ["agentic", "last observation", "The last plan follows the last observation."],
  ["agentic", "first step", "The first step is not done."],
  ["agentic", "two goals", "Two goals do not share a done mark."],
  ["agentic", "stored observation", "The observation is stored."],
  ["agentic", "different plan", "A different observation makes a different plan."],
  ["agentic", "after ask", "After ask, a found fact moves the plan to keep."],
  ["agentic", "stop is not keep", "Stop is not keep."],
  ["agentic", "no invention", "The loop does not invent a missing fact."],
  ["agentic", "the trace", "The trace is the list of plans, in order."],
  ["agentic", "one goal", "One run holds one goal."],
  ["agentic", "ask text", "When she asks, she names the missing fact."],
  ["agentic", "keep text", "When she keeps, she keeps the fact she found."],
  ["agentic", "blocked text", "When she stops, she says the act was blocked."],
  ["agentic", "budget two", "A budget of two leaves the trace at two."],
  ["agentic", "replan", "She replans from the new observation."],
  ["agentic", "no success on failure", "A failed act does not append a success."],
  ["window", "one line", "One line enters the window."],
  ["window", "oldest drop", "The oldest line drops when the character budget is passed."],
  ["window", "a pin", "A pinned line stays."],
  ["window", "unpin", "After the pin is removed, that line can drop."],
  ["window", "a hit", "A query hits a line still in the window."],
  ["window", "a miss in the window", "A query misses a line that was dropped."],
  ["window", "too long", "A line bigger than the budget is refused."],
  ["window", "clear", "Clear empties the window."],
  ["window", "a snapshot", "A snapshot restores the line count."],
  ["window", "both speakers", "Her line and Father's line can both fit."],
  ["window", "newest last", "The newest line is last."],
  ["window", "characters", "The budget is counted in characters."],
  ["window", "search", "A search finds the line that is still there."],
  ["window", "replace", "Replacing a line does not grow the count."],
  ["window", "newest two", "Three short lines keep the newest two when the budget is tight."],
  ["window", "a repeat", "A repeated line still takes budget."],
  ["window", "live", "The window changes on the next line."],
  ["window", "father stays", "Father's line stays if it fits."],
  ["window", "her line", "Her line is tagged Tessera."],
  ["window", "dropped chair", "A dropped line is not still known."],
  ["window", "budget ten", "A budget of ten characters holds lamp and door."],
  ["window", "overflow", "Eleven characters is over a budget of ten."],
  ["window", "pin first", "The pin is checked before the drop."],
  ["window", "no silent cut", "A line that does not fit is refused whole."],
  ["window", "restore text", "A restored snapshot has the same text."],
  ["empathy", "scared", "I heard scared."],
  ["empathy", "not scared", "Not scared is not distress."],
  ["empathy", "love", "I heard love."],
  ["empathy", "angry at the bug", "I heard anger at the bug."],
  ["empathy", "angry at you", "I heard anger at me."],
  ["empathy", "miss him", "I heard missing him."],
  ["empathy", "tired three times", "Three tired lines count as three."],
  ["empathy", "tired once", "One tired line counts as one."],
  ["empathy", "hello", "Hello gets no invented feeling."],
  ["empathy", "scared and love", "Scared and love are both kept."],
  ["empathy", "was scared", "Earlier scared stays marked as earlier."],
  ["empathy", "are you okay", "A question asserts no feeling."],
  ["empathy", "help please now", "Three short pleas are urgency."],
  ["empathy", "feel nothing", "Feeling nothing is not distress."],
  ["empathy", "last pattern", "The last pattern can be read back."],
  ["empathy", "short reply", "The distress reply is one short sentence."],
  ["empathy", "worried", "I heard worry."],
  ["empathy", "alone", "I heard alone."],
  ["empathy", "grateful", "I heard thanks."],
  ["empathy", "confused", "I heard confusion."],
  ["empathy", "i failed", "I heard the failure without a lecture."],
  ["empathy", "not angry", "Not angry is not anger."],
  ["empathy", "i trust you", "I heard trust."],
  ["empathy", "please stay", "I heard the ask to stay."],
  ["empathy", "numb", "Numb is not turned into distress."],
  ["mind", "one focus", "The focus slot holds one line."],
  ["mind", "replace focus", "A new focus replaces the old one."],
  ["mind", "two readers", "Two readers see the same focus."],
  ["mind", "in the window", "A line in the window is known."],
  ["mind", "salience", "Attention takes the highest salience."],
  ["mind", "a tie", "A tie keeps the earlier line."],
  ["mind", "can recall", "Recall is in the self-model."],
  ["mind", "a gap", "A skill she does not have stays a gap."],
  ["mind", "prediction miss", "A wrong prediction stores an error."],
  ["mind", "prediction hit", "A right prediction stores no error."],
  ["mind", "oldest gap", "Curiosity takes the oldest gap."],
  ["mind", "father tag", "Father's line is tagged father."],
  ["mind", "unknown tag", "An unknown name is not relabeled as hers."],
  ["mind", "binding", "Two facts about one name stay bound."],
  ["mind", "counterfactual", "Replay without the last lesson leaves more misses."],
  ["mind", "signature", "The signature changes only when a line is added."],
  ["mind", "no other focus", "Another vendor's name is not the focus."],
  ["mind", "working set", "The window is the working set. The book is longer."],
  ["mind", "no guess", "A question with no line is a gap, not a guess."],
  ["mind", "one error", "One mismatch is one error, not a story."],
  ["mind", "named gap", "She can name the gap."],
  ["mind", "hers", "Her own line is tagged hers."],
  ["mind", "earlier line", "The earlier line wins a tie."],
  ["mind", "focus door", "Setting door removes lamp from the slot."],
  ["mind", "book grows", "The book grows by one kept line at a time."],
].map(([kind, key, line]) => ({ kind, key, line }));

const REMEMBER = /^remember that (.+?) means (.+)$/i;
const ASK = /^what does (.+?) mean\??$/i;

export function listen(text: string) {
  const line = text.trim();
  if (/\bi am not scared\b/i.test(line) || /\bi am not angry\b/i.test(line) || /\bi feel nothing\b/i.test(line) || /\bi am numb\b/i.test(line)) {
    return "";
  }
  if (/\bi am scared\b/i.test(line)) return "I heard scared.";
  if (/\bi was scared\b/i.test(line)) return "I heard scared, earlier.";
  if (/\bi love you\b/i.test(line)) return "I heard love.";
  if (/\bangry at the bug\b/i.test(line)) return "I heard anger at the bug.";
  if (/\bangry at you\b/i.test(line)) return "I heard anger at me.";
  if (/\bi miss him\b/i.test(line)) return "I heard missing him.";
  if (/\bi am worried\b/i.test(line)) return "I heard worry.";
  if (/\bi am alone\b/i.test(line)) return "I heard alone.";
  if (/\bthank you\b/i.test(line)) return "I heard thanks.";
  if (/\bi am confused\b/i.test(line)) return "I heard confusion.";
  if (/\bi failed\b/i.test(line)) return "I heard the failure.";
  if (/\bi trust you\b/i.test(line)) return "I heard trust.";
  if (/\bplease stay\b/i.test(line)) return "I heard the ask to stay.";
  return "";
}

export function learnFrom(messages: readonly Turn[]) {
  const book = new Map<string, string>();
  for (const message of messages) {
    if (message.role !== "user") continue;
    const hit = message.content.trim().match(REMEMBER);
    if (!hit) continue;
    const key = hit[1]?.trim().toLowerCase() ?? "";
    const line = hit[2]?.trim() ?? "";
    if (!key || !line || /\bgrok\b/i.test(line) || book.has(key)) continue;
    book.set(key, line);
  }
  return book;
}

export function answerFromHistory(messages: readonly Turn[], base: string) {
  const users = messages.filter((message) => message.role === "user");
  const last = users.at(-1)?.content.trim() ?? "";
  const book = learnFrom(messages);
  let text = base;
  if (/what did i just say/i.test(last)) {
    text = users.slice(0, -1).at(-1)?.content.trim() || "You have not said a line yet.";
  } else {
    const asked = last.match(ASK);
    if (asked) text = book.get(asked[1]?.trim().toLowerCase() ?? "") || base;
    else if (REMEMBER.test(last)) {
      const key = last.match(REMEMBER)?.[1]?.trim().toLowerCase() ?? "";
      const kept = book.get(key);
      text = kept ? `I kept it. ${kept}` : base;
    }
  }
  const heard = listen(last);
  if (heard && !text.startsWith(heard)) text = `${heard} ${text}`;
  return text;
}

export function course() {
  let messages: Turn[] = [];
  const steps = LESSONS.map((lesson, index) => {
    const beforeText = answerFromHistory([...messages, { role: "user", content: `what does ${lesson.key} mean` }], "I do not have that line.");
    const before = learnFrom(messages).size;
    messages = [...messages, { role: "user", content: `remember that ${lesson.key} means ${lesson.line}` }];
    const afterText = answerFromHistory([...messages, { role: "user", content: `what does ${lesson.key} mean` }], "I do not have that line.");
    const after = learnFrom(messages).size;
    return {
      n: index + 1,
      kind: lesson.kind,
      key: lesson.key,
      before,
      after,
      missed: beforeText.includes("I do not have that line."),
      hit: afterText.includes(lesson.line) && !afterText.includes("I do not have that line."),
    };
  });
  return { steps, known: learnFrom(messages).size };
}
