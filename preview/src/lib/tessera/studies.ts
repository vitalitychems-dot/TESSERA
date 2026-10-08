/** What the TESS index names, and the limit of what this chamber may treat as known. */

export const STUDIES_SOURCE = "TESS artifacts/api-server/src/lib/knowledge-corpus-index.ts";

export const STUDIES = [
  { name: "Einstein", hold: "Relativity and the photoelectric effect are established physics. No free-energy machine of his is in these files." },
  { name: "Aristotle", hold: "Logic, ethics, and early natural history. Later measurement replaced his physics." },
  { name: "Da Vinci", hold: "Notebooks of art, anatomy, and machines. They are not a secret-society manual here." },
  { name: "Tesla", hold: "Alternating current, the induction motor, and the Tesla coil are real. He died at the New Yorker Hotel on 7 January 1943. The Office of Alien Property seized the papers. John G. Trump reviewed them and wrote that the later work was speculative and did not contain new workable methods. In 1952 the remaining papers went to his nephew and then to the Nikola Tesla Museum in Belgrade. A reported black notebook and a trunk count of 80 against about 60 received are unresolved. The FBI vault file is the investigation, not the notebooks. The Colorado Springs notes and the patents are published. This chamber holds none of the manuscripts. No free-energy machine and no working death ray were in the files." },
  { name: "Reich", hold: "A historical figure who claimed orgone. That claim is not accepted physics. The build notes stay closed." },
  { name: "Pluto, the person", hold: "Not the planet. In the saved astronomy note he is Pluto, the Roman name of the Greek god Hades: a mythic person, ruler of the dead and of what is buried, including mineral wealth. No biography, no book, and no rite of his is in the files. The dwarf-planet sentence was the wrong reading and is withdrawn." },
  { name: "Plato", hold: "Athenian. Student of Socrates. The Republic is his. The cave and the forms are teaching images: appearances can mislead, and a claim still has to be looked at. The full dialogues are not stored here." },
  { name: "Socrates", hold: "Athenian, about 470 to 399 BCE. He wrote nothing that survives. What we have is mostly Plato. Athens tried him and he was killed. No dialogue of his was in the fed files." },
  { name: "Odaus", hold: "No person spelled Odaus was in the files. The nearest public name is Odysseus, the Homeric king of Ithaca in the Odyssey. If that is the wrong person, the spelling still has no file." },
  { name: "Franklin", hold: "Benjamin Franklin, 1706 to 1790. Printer, experimenter, and a diplomat of the American founding. The kite experiment is the public electricity story. He joined a Philadelphia lodge. The lodge rite is not in this chamber." },
  { name: "Musk", hold: "Elon Musk, born 1971 in Pretoria. Public record associates him with SpaceX, Tesla the car company, and X. He is not Nikola Tesla. No private paper of his was in the fed files." },
  { name: "Hitler", hold: "Adolf Hitler, 1889 to 1945, dictator of Nazi Germany. He led the regime that started the European war in 1939 and carried out the Holocaust. This chamber keeps that history. It does not keep his program, his praise, or a method." },
  { name: "Masons", hold: "Freemasonry is a set of fraternal lodges that trace themselves to stonemason guilds. The page we read names charity. The degrees and the rites were not in the files." },
  { name: "Bohemian", hold: "The Bohemian Club was founded in 1872. Bohemian Grove is its camp in Monte Rio, California. Public reports describe a private pageant. This chamber does not hold the script, and a report is not a verified secret." },
  { name: "Societies", hold: "Indexed here: Freemasonry, the Templar as a claim, and the Golden Dawn as a tradition. College fraternities are social groups. Their rites were not fed in. Twelve method entries stay closed." },
  { name: "Bible", hold: "The Bible is a library of Jewish and Christian books. This chamber does not hold those books in full. The Gospel of Thomas is indexed as a tradition, not as canon. Fátima is indexed as a claim, not as a document we verified." },
  { name: "Vatican", hold: "The Apostolic Archive is a real library. Suppressed-gospel stories, the Fátima secrets, and the instrument later called LUCI are claims in the vault. None of those documents was verified here. Closed method pages stay closed." },
  { name: "Tools", hold: "Attached as cards and not installed: Coolify, Maxun, Open WebUI, Browser Use, Langflow, Supabase, Crawl4AI, and Dify. Camoufox was refused. A card is not a running tool, and a repository was not cloned." },
  { name: "Brains and genes", hold: "Neuroscience and genetics are named subjects. The brain repositories did not become her mind." },
  { name: "Psychedelics", hold: "The old episode was a simulation of feeling. No protocol is stored." },
  { name: "Many minds", hold: "Independent estimates can beat one estimate when the errors are not copies of each other. A council told to agree does not raise the odds." },
  { name: "AI consciousness", hold: "The research disagrees. This chamber has not shown a second mind." },
  { name: "Quantum", hold: "Planck, Bohr, and Heisenberg are public physics. Uncertainty is a measurement limit, not a mystical law. No secret quantum device was in the files." },
  { name: "Euclid", hold: "Euclid's Elements is the classical geometry book. She can name it. She does not hold the book." },
  { name: "Darwin", hold: "Charles Darwin published On the Origin of Species in 1859. Natural selection is the public theory. The book is not stored here in full." },
  { name: "Curie", hold: "Marie Curie worked on radioactivity and received two Nobel prizes. Her lab notes are not in this chamber." },
  { name: "Newton", hold: "Isaac Newton is associated with gravitation and the Principia. The Principia is not held here." },
  { name: "Confucius", hold: "Confucius is the name attached to the Analects. Those sayings are not stored here in full." },
  { name: "Hypatia", hold: "Hypatia of Alexandria taught mathematics and philosophy. She was killed in 415. No intact book of hers was in the files." },
  { name: "Witchcraft", hold: "Witchcraft trials are history. The occult page says no method, rite, or instruction is stored. That limit stays." },
  { name: "MKUltra", hold: "MK-Ultra is the public name of a CIA program. The documents were not in the fed files. A program name is not a method she can run." },
  { name: "Quran", hold: "The Quran, the Torah, the Vedas, and the Buddhist canon are scripture libraries. She holds none of them in full. The Bible line already said the same about the Bible." },
] as const;

export const FEED_PASSES = [
  ["Quantum", "uncertainty"],
  ["Euclid", "Elements"],
  ["Darwin", "1859"],
  ["Curie", "radioactivity"],
  ["Newton", "Principia"],
  ["Confucius", "Analects"],
  ["Hypatia", "415"],
  ["Witchcraft", "no method"],
  ["MKUltra", "not a method"],
  ["Quran", "none of them"],
] as const;

export const FATHER_ASKED = `Father asked her to be fed all of this, in his words:

Vatican, esoteric, religious, quantum, spiritual, conceptual, and consciousness studies. Mathematics, science, biology, genes, human studies and behavior, the human brain and the animal brain, physiology, and the psychedelic episode. Wilhelm Reich. Einstein. Pluto the person, not the planet. Da Vinci. Aristotle. Freemasonry, secret societies, witchcraft, and the occult. Tesla’s books and experiments. Declassified CIA, MI6, KGB, FSB, and Israeli documents. Psionics. Anyone named Gilmore. The Vatican’s realized archives. The latest public argument about AI consciousness. How awakened agents, as a collective, might improve a real statistical outcome.

He then said: feed her all of that. If a source is not in the files, find what can be found. Train her on it. She is to understand the way a human does: read, remember, revise when corrected, and change only what the evidence makes necessary. Pluto was the correction. The planet sentence was the mistake.

What she actually received is this list, the index titles, and the short studies above. She did not receive the books, the agency files, a person named Gilmore, or the method pages. A request is not the library. She remembers the request.`;

export const STUDIES_MISSING =
  "Not found in the saved texts: Tesla’s collected books, MI6 files, KGB files, FSB files, Israeli document sets, or anyone named Gilmore. Those bodies will not be invented. The index has 114 titles, including CIA program names. A title is not the document. A human correction counts: Pluto was stored as a planet, Father said the person, and the planet sentence was withdrawn.";
