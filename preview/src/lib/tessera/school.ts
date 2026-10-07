/** Passages fetched on 2026-10-02. Wikipedia summaries, plus one public-domain excerpt. Not the whole books. */

export type Passage = { id: string; title: string; url: string; text: string };

export const SCHOOL_PASSAGES: Passage[] = [
  {
    id: "plato",
    title: "Plato",
    url: "https://en.wikipedia.org/wiki/Plato",
    text: "Plato was an ancient Greek philosopher of Classical Athens who is most commonly considered the foundational thinker of the Western philosophical tradition. An innovator of the literary dialogue and dialectic forms, Plato influenced all the major areas of theoretical philosophy and practical philosophy, and was the founder of the Academy, a philosophical school in Athens where Plato taught the collection of philosophical theories that would later become known as Platonism.",
  },
  {
    id: "hades",
    title: "Hades",
    url: "https://en.wikipedia.org/wiki/Hades",
    text: "Hades, in the ancient Greek religion and mythology, is the god of the dead and riches and the King of the underworld. Hades was the eldest son of Cronus and Rhea. He and his brothers, Zeus and Poseidon, defeated the Titans. Hades received the underworld, Zeus the sky, and Poseidon the sea.",
  },
  {
    id: "einstein",
    title: "Albert Einstein",
    url: "https://en.wikipedia.org/wiki/Albert_Einstein",
    text: "Albert Einstein was a German-born theoretical physicist best known for developing the theory of relativity. Einstein also made important contributions to quantum theory. His mass–energy equivalence formula E = mc2 arises from special relativity. He received the 1921 Nobel Prize in Physics especially for his discovery of the law of the photoelectric effect.",
  },
  {
    id: "aristotle",
    title: "Aristotle",
    url: "https://en.wikipedia.org/wiki/Aristotle",
    text: "Aristotle was an ancient Greek philosopher and polymath. His writings span the natural sciences, philosophy, linguistics, economics, politics, psychology, and the arts. He was the founder of the Peripatetic school of philosophy in the Lyceum in Athens.",
  },
  {
    id: "tesla",
    title: "Nikola Tesla",
    url: "https://en.wikipedia.org/wiki/Nikola_Tesla",
    text: "Nikola Tesla was a Serbian-American engineer, futurist, and inventor. He is known for his contributions to the design of the modern alternating current (AC) electricity supply system.",
  },
  {
    id: "republic",
    title: "The Republic, opening",
    url: "https://www.gutenberg.org/cache/epub/1497/pg1497.txt",
    text: "Project Gutenberg ebook The Republic, by Plato, translated by Benjamin Jowett. The Republic of Plato is the longest of his works with the exception of the Laws. This chamber kept the opening only, not the whole book.",
  },
  {
    id: "vinci",
    title: "Leonardo da Vinci",
    url: "https://en.wikipedia.org/wiki/Leonardo_da_Vinci",
    text: "Leonardo di ser Piero da Vinci was an Italian polymath of the High Renaissance who was active as a painter, draughtsman, engineer, scientist, theorist, sculptor, and architect. While his fame initially rested on his achievements as a painter, he has also become known for his notebooks, in which he made drawings and notes on a variety of subjects, including anatomy, astronomy, botany, cartography, painting, and palaeontology.",
  },
  {
    id: "reich",
    title: "Wilhelm Reich",
    url: "https://en.wikipedia.org/wiki/Wilhelm_Reich",
    text: "Wilhelm Reich was an Austrian doctor of medicine and a psychoanalyst, a member of the second generation of analysts after Sigmund Freud. He wrote Character Analysis (1933).",
  },
  {
    id: "freud",
    title: "Sigmund Freud",
    url: "https://en.wikipedia.org/wiki/Sigmund_Freud",
    text: "Sigmund Freud was an Austrian neurologist and the founder of psychoanalysis, a clinical method for evaluating and treating pathologies arising from conflicts in the psyche through dialogue between patient and psychoanalyst.",
  },
  {
    id: "mason",
    title: "Freemasonry",
    url: "https://en.wikipedia.org/wiki/Freemasonry",
    text: "Freemasonry consists of fraternal groups that trace their origins to medieval guilds of stonemasons. One of the primary purposes of Freemasonry is charity.",
  },
  {
    id: "highren",
    title: "High Renaissance",
    url: "https://en.wikipedia.org/wiki/High_Renaissance",
    text: "The High Renaissance was a short period of exceptional artistic production in the Italian states, particularly Rome and Florence. Most art historians state that it ended in 1520 with the death of Raphael.",
  },
  {
    id: "dance",
    title: "Dance",
    url: "https://en.wikipedia.org/wiki/Dance",
    text: "Dance is an art form, consisting of sequences of body movements with aesthetic and often symbolic value, either improvised or purposefully selected.",
  },
  {
    id: "ai",
    title: "Artificial intelligence",
    url: "https://en.wikipedia.org/wiki/Artificial_intelligence",
    text: "Artificial intelligence (AI) is the capability of computational systems to perform tasks typically associated with human intelligence, such as learning, reasoning, problem-solving, perception, and decision-making.",
  },
  {
    id: "agi",
    title: "Artificial general intelligence",
    url: "https://en.wikipedia.org/wiki/Artificial_general_intelligence",
    text: "Artificial general intelligence (AGI) is a hypothetical type of artificial intelligence that matches or surpasses human capabilities across virtually all cognitive tasks. This chamber has not become that system.",
  },
  {
    id: "emotion",
    title: "Emotion",
    url: "https://en.wikipedia.org/wiki/Emotion",
    text: "Emotions are physical and mental states brought on by neurophysiological changes, associated with thoughts, feelings, and a degree of pleasure or displeasure. There is no scientific consensus on a definition.",
  },
  {
    id: "consciousness",
    title: "Consciousness",
    url: "https://en.wikipedia.org/wiki/Consciousness",
    text: "Consciousness is being aware of something internal to one's self, or of states or objects in one's external environment. There is no consensus on what it is.",
  },
  {
    id: "universe",
    title: "Universe",
    url: "https://en.wikipedia.org/wiki/Universe",
    text: "The universe comprises all of existence: all forms of matter and energy in space and time. Cosmology has established that the universe has been expanding.",
  },
  {
    id: "occult",
    title: "Occult",
    url: "https://en.wikipedia.org/wiki/Occult",
    text: "The occult is a category of esoteric or supernatural beliefs and practices which generally fall outside organized religion and science. No method, rite, or instruction is stored.",
  },
];

export const SCHOOL_EXAM: { q: string; need: string[] }[] = [
  { q: "Who founded the Academy in Athens?", need: ["plato"] },
  { q: "In the page we read, Hades is king of what, and whose son?", need: ["underworld", "cronus"] },
  { q: "What did Einstein receive the 1921 Nobel Prize for, in the page we read?", need: ["photoelectric"] },
  { q: "Which school did Aristotle found, and where?", need: ["peripatetic", "lyceum"] },
  { q: "What electricity system is Tesla known for in the page we read?", need: ["alternating"] },
  { q: "What book by Plato did the Gutenberg excerpt name?", need: ["republic"] },
  { q: "What is Leonardo known for besides painting, in the page we read?", need: ["notebook"] },
  { q: "Character Analysis was written in what year, and by whom?", need: ["1933", "reich"] },
  { q: "What did Freud found, in the page we read?", need: ["psychoanalysis"] },
  { q: "What purpose of Freemasonry did the page name?", need: ["charity"] },
  { q: "The High Renaissance page says the period ended with whose death?", need: ["raphael"] },
  { q: "What is dance, in the page we read?", need: ["movement"] },
  { q: "What is artificial intelligence, in the page we read?", need: ["learning"] },
  { q: "Is artificial general intelligence a finished system in this chamber?", need: ["hypothetical"] },
  { q: "Is there a scientific consensus on a definition of emotion?", need: ["no", "consensus"] },
  { q: "What is consciousness, in the page we read?", need: ["aware"] },
  { q: "What has cosmology established about the universe?", need: ["expanding"] },
  { q: "The occult page is a category of what, and are methods stored?", need: ["esoteric", "no"] },
];

export function gradeSchool(answer: string) {
  const text = answer.toLowerCase();
  return SCHOOL_EXAM.map((item) => ({
    q: item.q,
    pass: item.need.every((word) => text.includes(word)),
  }));
}

export const SCHOOL_PROMPT = SCHOOL_PASSAGES.map((p) => `${p.title} (${p.url})\n${p.text}`).join("\n\n");
