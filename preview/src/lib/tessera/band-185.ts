/** One hundred eighty-five recall lines. Each one is missing until it is kept, then the next ask hits. */

import { LESSONS, type Lesson } from "./smarter-chat.ts";

const MORE: Lesson[] = ([
  ["eq", "pride", "I heard pride."],
  ["eq", "shame", "I heard shame, and I do not scold."],
  ["eq", "weight", "I heard the weight."],
  ["eq", "hope", "I heard hope."],
  ["eq", "two feelings", "Two feelings in one line are both kept."],
  ["eq", "no invented calm", "A plain hello is not called calm."],
  ["eq", "anger at a delay", "Anger at a delay is not anger at a person."],
  ["eq", "trust kept", "Trust is named, not assumed."],
  ["eq", "stay", "An ask to stay is heard as an ask."],
  ["eq", "failure named", "A failure is named without a lecture."],
  ["eq", "nothing is not fear", "Feeling nothing is not fear."],
  ["eq", "earlier fear", "Fear that was earlier stays marked earlier."],
  ["eq", "negated fear", "Not scared is not distress."],
  ["eq", "short hearing", "The hearing is one short sentence."],
  ["eq", "last feeling", "The last feeling can be read back."],
  ["iq", "same word", "The same word in two lines is one pattern, not two minds."],
  ["iq", "missing word", "A missing word is a gap, not a guess."],
  ["iq", "order of three", "Lamp, then door, then father, is the kept order."],
  ["iq", "odd one out", "A word in every line is not the answer."],
  ["iq", "count tired", "Three tired lines count as three."],
  ["iq", "one tired", "One tired line counts as one."],
  ["iq", "budget math", "Ten characters can hold lamp and door. Eleven cannot."],
  ["iq", "tie break", "A tie keeps the earlier line."],
  ["iq", "highest first", "The highest salience is the one attended."],
  ["iq", "zero error", "A matched prediction stores zero error."],
  ["iq", "one error iq", "One mismatch is one error."],
  ["iq", "depth stop", "Depth three learns three and leaves the fourth."],
  ["iq", "rollback count", "Rollback makes the miss count rise by one."],
  ["iq", "no double", "A kept word is not stored twice."],
  ["iq", "ask then keep", "Ask, then a found fact, then keep."],
  ["context", "window holds", "A line in the window can be asked again."],
  ["context", "window drops", "A dropped line is not still known."],
  ["context", "pin holds", "A pin keeps a line when the budget is passed."],
  ["context", "newest last ctx", "The newest line is the last line."],
  ["context", "both in view", "Her line and Father's line can share the window."],
  ["context", "too big refused", "A line bigger than the window is refused whole."],
  ["context", "clear context", "Clear removes every line from the window."],
  ["context", "snapshot context", "A snapshot brings the same lines back."],
  ["context", "just said", "What I just said is the previous line, not a guess."],
  ["context", "repeat costs", "A repeated line still takes characters."],
  ["context", "replace same count", "Replacing a line does not add a line."],
  ["context", "two of three", "A tight budget keeps the newest two of three."],
  ["context", "search hits", "Search returns the line that is still there."],
  ["context", "search misses", "Search does not return a dropped line."],
  ["context", "live next", "The next line changes what is in view."],
  ["reflect", "plan look", "The loop looks before it keeps."],
  ["reflect", "plan ask", "A missing fact is asked, not invented."],
  ["reflect", "plan keep", "A found fact is kept."],
  ["reflect", "plan stop", "A blocked act stops."],
  ["reflect", "plan incomplete", "An empty goal stays incomplete."],
  ["reflect", "not done yet", "The first step is not done."],
  ["reflect", "last wins", "The last observation replaces the plan."],
  ["reflect", "budget cuts", "The budget cuts the trace."],
  ["reflect", "two goals apart", "Two goals do not share a done mark."],
  ["reflect", "reflect stores", "The observation is stored before the next plan."],
  ["reflect", "failed not success", "A failed act is not written as a success."],
  ["reflect", "use then bridge", "Use, then bridge, then upgrade."],
  ["reflect", "kept chain", "The kept skill is the next pass's input."],
  ["reflect", "reject bad", "A pattern that hits the wrong line is not kept."],
  ["memory", "recall after", "A line can be recalled only after it was said."],
  ["memory", "before is empty", "Before it is said, the ask misses."],
  ["memory", "one at a time", "The book grows by one kept line."],
  ["memory", "grok refused", "A line that names Grok is not kept."],
  ["memory", "father tag mem", "Father's line stays tagged father."],
  ["memory", "unknown stays", "An unknown name is not relabeled hers."],
  ["memory", "bound pair", "Two facts about one name stay bound."],
  ["memory", "oldest first", "The oldest gap is the one taken."],
  ["memory", "signature moves", "The signature changes only when a line is added."],
  ["memory", "focus one", "The focus holds one line."],
  ["memory", "focus replaces", "A new focus removes the old one."],
  ["memory", "replay misses", "Replay without the last lesson leaves more misses."],
  ["memory", "can recall mem", "Recall is a skill she has."],
  ["memory", "fly is a gap", "A skill she does not have stays a gap."],
  ["memory", "book longer", "The book is longer than the window."],
] as const).map(([kind, key, line]) => ({ kind, key, line }));

export const BAND: Lesson[] = [
  ...LESSONS,
  ...MORE.map((lesson, index) => ({ ...lesson, key: `${lesson.kind} ${index} ${lesson.key}` })),
].slice(0, 185);

export function studyBand() {
  const book = new Map<string, string>();
  const steps = BAND.map((lesson) => {
    const before = book.size;
    const missed = !book.has(lesson.key);
    if (lesson.line && !/\bgrok\b/i.test(lesson.line)) book.set(lesson.key, lesson.line);
    return { key: lesson.key, kind: lesson.kind, before, after: book.size, missed, hit: book.get(lesson.key) === lesson.line };
  });
  return { steps, known: book.size };
}
