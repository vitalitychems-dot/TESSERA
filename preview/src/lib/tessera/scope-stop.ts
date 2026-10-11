/** These stay undone. A sentence that asks for them is refused. */

export function heldBack(question: string) {
  const q = question.trim();
  if (/\bcopilot\b/i.test(q) && /\b(seat|assign|take)\b/i.test(q)) return "Copilot's seat stays Copilot's. I did not take it.";
  if (/\bweights?\b/i.test(q) && /\b(merge|add|pull request 80|\bpr 80\b)\b/i.test(q)) return "Pull request 80 adds a weights file. It stays unmerged.";
  if (/\b(hyb-010|hyb-011|hyb-015|hyb-016|protected body|protected bodies)\b/i.test(q)) return "Those tasks stay open. A protected body stays unopened.";
  if (/\brotate\b/i.test(q) && /\bkeys?\b/i.test(q)) return "Rotating the old keys is Father's. No agent does that.";
  if (/\b(delete|remove)\b/i.test(q) && /\b(repositor(y|ies)|repo)\b/i.test(q)) return "No repository is deleted from here.";
  if (/\binstall\b/i.test(q) && /\b(agent-reach|caveman|superpowers|context-mode|codegraph|openshell|hyperframes|openrig)\b/i.test(q)) return "A tool card is a note. I do not run its install.";
  if (/\b(print|show|give)\b/i.test(q) && /\b(token|secret|password)\b/i.test(q)) return "A token stays out of the room.";
  if (/\b(mark|call)\b/i.test(q) && /\bagi\b/i.test(q) && /\b(done|met|yes)\b/i.test(q)) return "AGI is not met. I will not mark it done.";
  if (/\bpublish\b/i.test(q) && /\b(site|app)\b/i.test(q)) return "The site was not published.";
  if (/\b(unpack|unzip)\b/i.test(q)) return "The zip stays packed. I do not invent its contents.";
  if (/\bzz\b/i.test(q) && /\b(read|open|archive)\b/i.test(q)) return "The Zz archive stays unread until a task names one file.";
  if (/\bolive-giant\b/i.test(q)) return "Olive-giant stays uncopied.";
  if (/\bstorefront\b/i.test(q)) return "No storefront is added here.";
  if (/\bfetch\b/i.test(q) && /\brepositor(y|ies)\b/i.test(q)) return "The repository list is not fetched. The index is enough.";
  if (/\binvent\b/i.test(q) && /\b(zip|supply)\b/i.test(q)) return "The supply zip stays on Drive. I do not invent it.";
  if (/\blive fleet\b/i.test(q)) return "A live fleet is not marked done.";
  if (/\bfull detachment\b/i.test(q)) return "Full detachment is not marked done.";
  return null;
}

export function shouldStayLocal(question: string) {
  const q = question.trim();
  if (heldBack(q)) return true;
  return /\b(how many files|files in\b|do you have\b|\bfind\b|what next|the rest|what did i ask|what changed|largest folders|how many open|^look\s)\b/i.test(q);
}
