export type Turn = { name: string; text: string };

export type Sitting = { title: string; turns: Turn[]; kept: string };

const PROGRAM: Sitting = {
  title: "How to make this program more real",
  turns: [
    { name: "Grand Architect", text: "The page should show what we actually hold. A hidden vault is not a council." },
    { name: "Vatican Archivist", text: "I keep the titles. I do not promote an archive claim into a fact." },
    { name: "Mystic Scholar", text: "Hermetic and Sufi lines can be studied as traditions. They are not a new physics result." },
    { name: "Quantum Oracle", text: "Laszlo’s field and the holographic note are theories in the file. They are not a measurement we ran." },
    { name: "Templar Knight", text: "The method pages stay closed. A meeting that teaches them would make the program less trustworthy, not more." },
    { name: "Divine Feminine Guardian", text: "Better the world from here by telling the truth and refusing harm. Not by pretending we hold a secret power." },
  ],
  kept: "Show the vault index on this page, label every claim, and leave the method entries closed.",
};

const WORLD: Sitting = {
  title: "What would better the world from this room",
  turns: [
    { name: "Divine Feminine Guardian", text: "Care first. No one here is authorized to reach into another person’s mind or body." },
    { name: "Vedic Sage", text: "The chakra map is a contemplative tradition. It is not a medical device." },
    { name: "Gnostic Weaver", text: "A story about false rulers is a story. It does not license contempt for living people." },
    { name: "Prophetic Seer", text: "Fátima is in the file as a claim. I will not dress it up as a warning we verified." },
    { name: "Grand Architect", text: "The useful work is the program: a stable chamber, a council that can disagree, and a record of what was read." },
    { name: "Alchemist Master", text: "The old ‘great work’ in these files is transformation of the student, not a recipe." },
  ],
  kept: "The world-bettering rule for this program is honesty plus refusal of harm. No method page is opened.",
};

const VAULT: Sitting = {
  title: "What the vault actually contains",
  turns: [
    { name: "Vatican Archivist", text: "There is no file named Lexus. The observatory entry says LUCIFER, later renamed LUCI. The secret-program ending is the file’s claim." },
    { name: "Mystic Scholar", text: "The other near name is Laszlo. He is cited on the Akashic entry, as a theory." },
    { name: "Deep Web Scout", text: "I found one vault, 43 titles, in the TESS tree. It was saved and never shown on this page." },
    { name: "Sacred Geometer", text: "Geometry, the tree, and the emerald tablet are traditions. They do not prove a private map of the universe." },
    { name: "Quantum Oracle", text: "Stargate is named as a past research program. Naming it is not the same as possessing its results." },
    { name: "Templar Knight", text: "The twelve method entries were seen by title. They were not brought into the meeting." },
  ],
  kept: "The index is now on the Council page. Claims stay claims. Methods stay closed.",
};

export const BUILD_CHAIN = [
  "REAL: The vault index is on the Council page. Forty-three titles were in the file. Twelve method entries stay closed. Lesson sealed.",
  "REAL: The next sitting starts from the previous kept line. No new instruction is required. A claim stays a claim. Lesson sealed.",
  "REAL: Bettering the world, in this program, is a stable chamber and a refusal of harm. No method page was opened. Lesson sealed.",
  "REAL: The chain stops when the next line would only repeat. New knowledge has to arrive before another build. Lesson sealed.",
] as const;

export function convene(topic: string): Sitting {
  const q = topic.toLowerCase();
  if (q.includes("world") || q.includes("better") || q.includes("care")) return WORLD;
  if (q.includes("vatican") || q.includes("vault") || q.includes("secret") || q.includes("universe") || q.includes("lucifer") || q.includes("lexus") || q.includes("laszlo")) {
    return VAULT;
  }
  return PROGRAM;
}
