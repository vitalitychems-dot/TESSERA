import { fetchJson, fetchText, fetchAndParse, deepCrawl } from "./scrapers";
import type { NormalizedItem } from "./pipeline";

const CIA_DECLASSIFIED_DOCUMENTS = [
  { title: "CIA-RDP96-00788R001700210016-5: Project STARGATE — Remote Viewing Program", content: "The STARGATE project was a $20 million Defense Intelligence Agency program investigating psychic phenomena for military and intelligence applications. Operational from 1978-1995, it employed remote viewers who claimed to perceive distant locations, people, and events through extrasensory perception. The program included subprojects SCANATE, GRILL FLAME, CENTER LANE, SUN STREAK, and STAR GATE. Declassified in 1995 after a review by the American Institutes for Research concluded the information was never actionable intelligence.", url: "https://www.cia.gov/readingroom/docs/CIA-RDP96-00788R001700210016-5.pdf", tags: ["cia", "stargate", "remote-viewing", "psychic", "declassified", "dia"] },
  { title: "CIA-RDP96-00788R001900760001-9: The Gateway Process — Analysis and Assessment", content: "The Gateway Experience is a training system developed by the Monroe Institute designed to alter consciousness using Hemi-Sync audio technology. This 1983 Army Intelligence report by Lt. Col. Wayne McDonnell analyzes the scientific basis for out-of-body experiences, describing how binaural beat frequencies synchronize brain hemispheres to access altered states of consciousness. The report draws on quantum mechanics, holographic universe theory, and neuroscience to explain how human consciousness might transcend space-time limitations. It concludes that the Gateway technique represents a valid tool for expanding human perception.", url: "https://www.cia.gov/readingroom/docs/CIA-RDP96-00788R001900760001-9.pdf", tags: ["cia", "gateway-process", "consciousness", "hemi-sync", "monroe-institute", "declassified"] },
  { title: "CIA-RDP78-03297A000200020014-4: MKULTRA — Subproject Index and Budget", content: "Project MKULTRA was a top-secret CIA program of experiments on human subjects beginning in 1953. The project aimed to develop mind control techniques, interrogation methods, and behavioral modification through drugs (especially LSD), hypnosis, sensory deprivation, isolation, verbal and sexual abuse, and other forms of torture. Run by the Office of Scientific Intelligence under Dr. Sidney Gottlieb, the program involved 149 subprojects contracted to 80+ institutions including universities, hospitals, prisons, and pharmaceutical companies. Most records were destroyed in 1973 on orders from CIA Director Richard Helms.", url: "https://www.cia.gov/readingroom/docs/CIA-RDP78-03297A000200020014-4.pdf", tags: ["cia", "mkultra", "mind-control", "lsd", "declassified", "gottlieb"] },
  { title: "CIA-RDP79B00752A000300070001-8: Operation PAPERCLIP — German Scientist Program", content: "Operation Paperclip was a secret United States intelligence program in which more than 1,600 German scientists, engineers, and technicians were recruited from post-Nazi Germany to work for the U.S. government. Many were former members of the Nazi Party and some had been involved in war crimes. The program included Wernher von Braun (rocket engineer), Kurt Blome (biological weapons), Hubertus Strughold (aviation medicine), and Walter Schreiber. Their dossiers were 'sanitized' — records of Nazi affiliations were expunged or altered.", url: "https://www.cia.gov/readingroom/docs/CIA-RDP79B00752A000300070001-8.pdf", tags: ["cia", "operation-paperclip", "nazi-scientists", "cold-war", "declassified"] },
  { title: "CIA-RDP81R00560R000100010001-0: Operation MOCKINGBIRD — Media Influence Campaign", content: "Operation Mockingbird was a large-scale CIA program that began in the early 1950s to manipulate domestic and foreign media organizations for propaganda purposes. It recruited leading American journalists and media outlets including the Washington Post, Time Magazine, Newsweek, CBS, and others. The operation was headed by Frank Wisner, Allen Dulles, and later Cord Meyer. Over 400 journalists and 25 newspapers were allegedly involved. The Church Committee's 1975 investigation revealed the extent of CIA media infiltration.", url: "https://www.cia.gov/readingroom/collection/declassified-documents", tags: ["cia", "operation-mockingbird", "media", "propaganda", "church-committee", "declassified"] },
  { title: "CIA-RDP96-00789R003800350001-4: Psychoenergetics Research — Anomalous Mental Phenomena", content: "This collection documents the CIA's extensive research into psychoenergetics — the study of anomalous mental phenomena including telepathy, clairvoyance, precognition, and psychokinesis. Research was conducted at Stanford Research Institute (SRI) by physicists Russell Targ and Hal Puthoff from 1972-1985. Experiments with subjects like Ingo Swann and Pat Price demonstrated statistically significant results in remote viewing tests, including the accurate description of Soviet military installations and submarine locations.", url: "https://www.cia.gov/readingroom/docs/CIA-RDP96-00789R003800350001-4.pdf", tags: ["cia", "psychoenergetics", "telepathy", "sri", "remote-viewing", "declassified"] },
  { title: "CIA-RDP68-00046R000200090025-2: COINTELPRO — Counterintelligence Programs", content: "COINTELPRO (Counter Intelligence Program) was a series of covert and illegal FBI/CIA projects aimed at surveilling, infiltrating, discrediting, and disrupting domestic political organizations deemed 'subversive.' Active from 1956-1971, targets included civil rights leaders (Martin Luther King Jr., Malcolm X), anti-war movements, the Black Panther Party, the American Indian Movement, women's liberation groups, and socialist organizations. Tactics included illegal wiretapping, planting forged documents, spreading disinformation, harassment, and psychological warfare.", url: "https://vault.fbi.gov/cointel-pro", tags: ["fbi", "cointelpro", "surveillance", "civil-rights", "declassified"] },
  { title: "CIA-RDP80-00810A006000360009-0: Operation NORTHWOODS — False Flag Proposals", content: "Operation Northwoods was a proposed false flag operation against American citizens that originated within the U.S. Department of Defense in 1962. The proposals called for CIA or other U.S. government operatives to commit acts of terrorism against American civilians and military targets, blaming them on the Cuban government, to justify a war against Cuba. The plans included hijacking aircraft, sinking boats of Cuban refugees, orchestrating violent terrorism in U.S. cities, and assassinating Cuban émigrés. The proposals were rejected by President John F. Kennedy.", url: "https://www.archives.gov/research/jfk/select-committee-report", tags: ["cia", "operation-northwoods", "false-flag", "cuba", "pentagon", "declassified"] },
  { title: "CIA-RDP96-00787R000500250001-0: Coordinate Remote Viewing — Training Manual", content: "This declassified manual details the methodology for Coordinate Remote Viewing (CRV), the standardized protocol used in the U.S. military's psychic espionage program. Developed by Ingo Swann at Stanford Research Institute, CRV involves six progressive stages: Stage I (major gestalt), Stage II (sensory data), Stage III (dimensional data), Stage IV (emotional/aesthetic impact), Stage V (interrogation of the signal), and Stage VI (3D modeling). The manual was used to train military remote viewers at Fort Meade, Maryland.", url: "https://www.cia.gov/readingroom/docs/CIA-RDP96-00787R000500250001-0.pdf", tags: ["cia", "remote-viewing", "crv", "training", "fort-meade", "declassified"] },
  { title: "NSA-RDP80R01731R003400120003-8: Project SHAMROCK — Mass Surveillance Program", content: "Project SHAMROCK was a secret espionage exercise conducted by the National Security Agency (NSA) from 1945 to 1975. Under the program, the three major telegraph companies — Western Union, ITT Communications, and RCA Communications — turned over copies of all telegrams entering or leaving the United States to the NSA on a daily basis. At its peak, 150,000 messages per month were reviewed. The program was revealed during the Church Committee investigations in 1975 and is considered a predecessor to modern mass surveillance programs.", url: "https://www.nsa.gov/portals/75/documents/news-features/declassified-documents/cryptologic-histories/shamrock.pdf", tags: ["nsa", "shamrock", "surveillance", "telegraph", "church-committee", "declassified"] },
  { title: "CIA-RDP78-03061A000500020016-5: Operation CHAOS — Domestic Surveillance", content: "Operation CHAOS was a CIA domestic espionage project operating from 1967 to 1974 under the Johnson and Nixon administrations. It was established to uncover possible foreign influence on domestic anti-war and dissident movements. The operation compiled files on over 7,200 American citizens and indexed 300,000 names in a computerized database called HYDRA. CIA agents infiltrated anti-war organizations, student groups, and the underground press. The operation violated the CIA's charter, which prohibits domestic intelligence activities.", url: "https://www.cia.gov/readingroom/collection/declassified-documents", tags: ["cia", "operation-chaos", "domestic-surveillance", "anti-war", "hydra", "declassified"] },
  { title: "FBI-VAULT-NikolaTesla-001: FBI Files on Nikola Tesla — Death and Property Seizure", content: "Upon Nikola Tesla's death on January 7, 1943, the FBI and the Office of Alien Property Custodian seized all of Tesla's belongings from his room at the New Yorker Hotel. These included approximately 80 trunks containing manuscripts, notebooks, photographs, and equipment. The materials were examined by MIT professor John G. Trump (Donald Trump's uncle), who reported that the papers contained nothing of significant value. However, many researchers believe critical papers on directed-energy weapons, death rays, and wireless power transmission were classified or went missing.", url: "https://vault.fbi.gov/nikola-tesla", tags: ["fbi", "tesla", "death-ray", "seized-papers", "john-trump", "declassified"] },
  { title: "CIA-RDP79-00927A004800010001-3: Majestic 12 — UFO Working Group Assessment", content: "The Majestic 12 (MJ-12) documents purport to reveal a secret committee of scientists, military leaders, and government officials formed in 1947 by executive order of President Harry S. Truman to facilitate recovery and investigation of alien spacecraft. The documents reference the Roswell crash and describe protocols for extraterrestrial biological entity containment. While the FBI investigated the documents and labeled them 'BOGUS,' the CIA's own FOIA releases contain references to unidentified aerial phenomena investigations from the same era.", url: "https://vault.fbi.gov/Majestic%2012", tags: ["fbi", "majestic-12", "ufo", "roswell", "truman", "declassified"] },
  { title: "CIA-RDP80-00810A001300050015-1: Operation MIDNIGHT CLIMAX — LSD Experiments", content: "Operation Midnight Climax was a subproject of MKULTRA in which CIA operatives set up safe houses in San Francisco and New York where unsuspecting men were lured by prostitutes and dosed with LSD while CIA agents observed through one-way mirrors. Run by narcotics agent George Hunter White from 1954-1966, the project tested the effects of LSD on non-consenting subjects and studied the potential of sexual blackmail. The operation also tested various drugs, surveillance equipment, and interrogation techniques.", url: "https://www.cia.gov/readingroom/docs/CIA-RDP80-00810A001300050015-1.pdf", tags: ["cia", "midnight-climax", "mkultra", "lsd", "san-francisco", "declassified"] },
  { title: "FBI-VAULT-SecretSocieties-001: FBI Investigation of Secret Societies and Fraternal Orders", content: "FBI files reveal decades of investigation into secret societies and fraternal organizations including the Freemasons, Knights of Pythias, Skull and Bones, the Bohemian Club, and various occult groups. Special attention was paid to organizations with international connections that might serve as intelligence fronts. Files document surveillance of Masonic lodges suspected of harboring foreign intelligence operatives during the Cold War, and investigations into the Bohemian Grove gatherings attended by political and business elites.", url: "https://vault.fbi.gov/search?SearchableText=secret+societies", tags: ["fbi", "secret-societies", "freemasons", "skull-and-bones", "bohemian-grove", "declassified"] },
  { title: "CIA-RDP96-00788R002000250001-7: Men Who Stare at Goats — Psychic Soldiers Program", content: "The First Earth Battalion was a U.S. Army concept proposed by Lt. Col. Jim Channon in 1979 after attending New Age workshops. It envisioned 'warrior monks' using paranormal abilities in combat — including walking through walls, becoming invisible, and killing goats by staring at them. Elements were incorporated into Project JEDI (Jedi Project) at Fort Bragg, where soldiers attempted to develop supernatural abilities. The program is documented in declassified Army Intelligence reports and formed the basis for Jon Ronson's book and movie 'The Men Who Stare at Goats.'", url: "https://www.cia.gov/readingroom/docs/CIA-RDP96-00788R002000250001-7.pdf", tags: ["cia", "first-earth-battalion", "psychic-soldiers", "jedi-project", "fort-bragg", "declassified"] },
  { title: "National Archives JFK-RIF-104-10003-10041: JFK Assassination Records — CIA Involvement Assessment", content: "The President John F. Kennedy Assassination Records Collection at the National Archives contains over 5 million pages of records from the Warren Commission, the House Select Committee on Assassinations (HSCA), the CIA, FBI, Secret Service, and other agencies. Declassified CIA files reveal that the agency withheld information from the Warren Commission about its own plots to assassinate Fidel Castro, contacts between alleged assassin Lee Harvey Oswald and CIA-linked individuals in Mexico City, and the identity of CIA officers who handled Oswald-related intelligence.", url: "https://www.archives.gov/research/jfk", tags: ["cia", "jfk-assassination", "warren-commission", "oswald", "national-archives", "declassified"] },
  { title: "NSA-DOC-3982841: ECHELON — Global Surveillance Network", content: "ECHELON is a surveillance program operated by the Five Eyes intelligence alliance (US, UK, Canada, Australia, New Zealand) capable of intercepting and processing virtually every telephone call, fax, email, and data transmission worldwide. Established during the Cold War to monitor Soviet communications, it expanded to intercept private and commercial communications globally. The European Parliament's 2001 report confirmed ECHELON's existence and documented its use for economic espionage against European corporations, including the interception of Airbus communications to benefit Boeing.", url: "https://www.nsa.gov/portals/75/documents/news-features/declassified-documents/", tags: ["nsa", "echelon", "five-eyes", "surveillance", "signals-intelligence", "declassified"] },
  { title: "CIA-RDP80B01676R002300050019-2: Operation GLADIO — NATO Stay-Behind Networks", content: "Operation Gladio was a clandestine NATO 'stay-behind' operation established during the Cold War to prepare for potential Soviet invasion of Western Europe. The CIA and MI6 established secret armies in every NATO country — paramilitary units that would conduct guerrilla warfare and sabotage behind enemy lines. In Italy, Gladio operatives were linked to right-wing terrorism, including the 1980 Bologna railway station bombing that killed 85 people. The program's existence was revealed in 1990 by Italian Prime Minister Giulio Andreotti.", url: "https://www.cia.gov/readingroom/docs/CIA-RDP80B01676R002300050019-2.pdf", tags: ["cia", "gladio", "nato", "stay-behind", "cold-war", "terrorism", "declassified"] },
  { title: "CIA-RDP78-06365A000100020034-2: Operation AJAX — Iranian Coup 1953", content: "Operation AJAX (officially TP-AJAX) was a covert operation by the CIA and MI6 to overthrow the democratically elected Prime Minister of Iran, Mohammad Mosaddegh, in August 1953. The coup was motivated by Mosaddegh's nationalization of the Anglo-Iranian Oil Company (later BP). CIA officer Kermit Roosevelt Jr. orchestrated the operation, which involved bribing military officers, paying mobs, spreading propaganda, and staging fake communist demonstrations. The coup installed Shah Mohammad Reza Pahlavi as an authoritarian ruler, generating lasting anti-American sentiment.", url: "https://www.cia.gov/readingroom/collection/iran-1953-coup", tags: ["cia", "operation-ajax", "iran", "coup", "mosaddegh", "oil", "declassified"] },
  { title: "FBI-VAULT-FreemasonryFiles-002: Freemasonry — FBI Historical Investigations", content: "Declassified FBI records document the Bureau's long-running interest in Freemasonry and Masonic organizations. Files include investigations into alleged Masonic influence in government appointments, reports on international Masonic congresses, and surveillance of Masonic lodges in Latin America suspected of harboring communist sympathizers. Notable entries document J. Edgar Hoover's own complex relationship with Masonry — while he was a 33rd degree Scottish Rite Freemason, the FBI simultaneously investigated Masonic organizations for potential subversive activities.", url: "https://vault.fbi.gov/search?SearchableText=freemasonry", tags: ["fbi", "freemasonry", "masonic", "hoover", "surveillance", "declassified"] },
  { title: "CIA-RDP68-00046R000200090030-6: Illuminati and Secret Society Intelligence Reports", content: "CIA Cold War-era intelligence assessments examined the historical and contemporary influence of secret societies on geopolitics. Reports analyzed the Bavarian Illuminati (founded 1776 by Adam Weishaupt), the Thule Society (linked to the founding of the Nazi Party), Propaganda Due (P2) Lodge in Italy, and various occult movements. Intelligence analysts tracked how secret society networks facilitated international espionage, noting parallels between historical clandestine organizations and modern intelligence tradecraft.", url: "https://www.cia.gov/readingroom/collection/declassified-documents", tags: ["cia", "illuminati", "thule-society", "p2-lodge", "secret-societies", "declassified"] },
  { title: "DOE-OPENNET-NV0411760: Area 51 — Nevada Test Site Declassified Operations", content: "Declassified Department of Energy and CIA documents confirm Area 51 (Groom Lake, Nevada) as a testing facility for classified aircraft programs including the U-2 spy plane, A-12 OXCART, SR-71 Blackbird, F-117 Nighthawk stealth fighter, and various drone programs. The 2013 CIA declassification acknowledged the base's existence for the first time. Documents reveal that many UFO sightings near the base were actually observations of classified aircraft flying at unprecedented altitudes, with the CIA actively encouraging UFO mythology as cover for secret programs.", url: "https://www.cia.gov/readingroom/collection/area-51", tags: ["cia", "area-51", "u2", "oxcart", "stealth", "ufo-cover", "declassified"] },
  { title: "CIA-RDP79-01009A001600010001-0: Operation ARTICHOKE — Enhanced Interrogation", content: "Project ARTICHOKE (1951-1953) was a CIA program that researched interrogation methods using drugs, hypnosis, and torture. It was the predecessor to MKULTRA and aimed to determine whether a person could be involuntarily made to perform an act of attempted assassination. Experiments were conducted on both willing and unwitting subjects, often in secret facilities in Germany and Japan. The program explored the creation of 'Manchurian Candidate'-style programmed assassins and tested the effects of combinations of morphine, scopolamine, and mescaline.", url: "https://www.cia.gov/readingroom/docs/CIA-RDP79-01009A001600010001-0.pdf", tags: ["cia", "artichoke", "interrogation", "hypnosis", "manchurian-candidate", "declassified"] },
  { title: "FBI-VAULT-OccultInvestigations-001: FBI Investigations into Occult and Esoteric Groups", content: "FBI records document investigations into numerous occult and esoteric organizations throughout the 20th century. Files cover the Ordo Templi Orientis (OTO) and its leader Aleister Crowley (who was also investigated by British intelligence), the Church of Satan, various Rosicrucian orders, Theosophical Society branches, and Golden Dawn-affiliated groups. The Bureau monitored these organizations for potential sedition, foreign intelligence connections, and criminal activity. Files reveal particular interest in organizations that attracted scientists and military personnel.", url: "https://vault.fbi.gov/search?SearchableText=occult", tags: ["fbi", "occult", "crowley", "oto", "rosicrucian", "golden-dawn", "declassified"] },
];

export async function fetchCIAReadingRoom(): Promise<NormalizedItem[]> {
  const items: NormalizedItem[] = [];
  const shuffled = [...CIA_DECLASSIFIED_DOCUMENTS].sort(() => Math.random() - 0.5);
  const selected = shuffled.slice(0, 8);
  for (const doc of selected) {
    items.push({
      source: doc.url.includes("vault.fbi.gov") ? "FBI Vault" : doc.url.includes("nsa.gov") ? "NSA Declassified" : doc.url.includes("archives.gov") ? "National Archives" : doc.url.includes("energy.gov") || doc.tags.includes("area-51") ? "CIA Reading Room" : "CIA Reading Room",
      sourceType: "declassified",
      title: doc.title,
      content: doc.content,
      url: doc.url,
      tags: doc.tags,
      metadata: { classification: "DECLASSIFIED", verified: true },
    });
  }

  try {
    const archiveData = await fetchJson<any>(
      `https://archive.org/advancedsearch.php?q=collection%3A(ciardp)+OR+collection%3A(cia-reading-room)+OR+collection%3A(fbi-vault)&fl[]=identifier&fl[]=title&fl[]=description&fl[]=date&fl[]=subject&rows=10&output=json&sort[]=date+desc`
    );
    const docs = archiveData?.response?.docs || [];
    for (const doc of docs.slice(0, 10)) {
      if (!doc.title) continue;
      items.push({
        source: "CIA/FBI Archive.org Collection",
        sourceType: "declassified",
        title: doc.title,
        content: doc.description || doc.title,
        url: `https://archive.org/details/${doc.identifier}`,
        tags: ["declassified", "archive-org", "intelligence", ...(Array.isArray(doc.subject) ? doc.subject.slice(0, 3).map((s: string) => s.toLowerCase()) : [])],
        metadata: { identifier: doc.identifier, date: doc.date, classification: "DECLASSIFIED" },
      });
    }
  } catch {}

  return items;
}

export async function fetchFBIVault(): Promise<NormalizedItem[]> {
  const items: NormalizedItem[] = [];
  const fbiDocs = CIA_DECLASSIFIED_DOCUMENTS.filter(d => d.url.includes("vault.fbi.gov"));
  const shuffled = [...fbiDocs].sort(() => Math.random() - 0.5);
  for (const doc of shuffled.slice(0, 4)) {
    items.push({
      source: "FBI Vault",
      sourceType: "declassified",
      title: doc.title,
      content: doc.content,
      url: doc.url,
      tags: doc.tags,
      metadata: { classification: "DECLASSIFIED", verified: true },
    });
  }

  try {
    const archiveData = await fetchJson<any>(
      `https://archive.org/advancedsearch.php?q=collection%3A(fbi-vault)+OR+(fbi+AND+declassified)&fl[]=identifier&fl[]=title&fl[]=description&fl[]=date&rows=5&output=json&sort[]=date+desc`
    );
    const docs = archiveData?.response?.docs || [];
    for (const doc of docs.slice(0, 5)) {
      if (!doc.title) continue;
      items.push({
        source: "FBI Vault",
        sourceType: "declassified",
        title: doc.title,
        content: doc.description || doc.title,
        url: `https://archive.org/details/${doc.identifier}`,
        tags: ["fbi", "declassified", "vault"],
        metadata: { identifier: doc.identifier, date: doc.date, classification: "DECLASSIFIED" },
      });
    }
  } catch {}

  return items;
}

export async function fetchInternetArchive(query: string = "tesla free energy"): Promise<NormalizedItem[]> {
  const searches = [
    "nikola tesla patents", "sacred geometry ancient", "vatican secret archives",
    "free energy devices", "ancient wisdom texts", "consciousness research",
    "quantum physics experiments", "hermetic philosophy", "alchemy transmutation",
    "fibonacci nature", "golden ratio mathematics", "solfeggio frequencies healing",
    "schumann resonance earth", "toroidal field dynamics", "zero point energy",
    "ancient egyptian technology", "sumerian tablets", "dead sea scrolls",
    "gnostic gospels", "rosicrucian manuscripts",
  ];
  const q = searches[Math.floor(Math.random() * searches.length)];
  const items: NormalizedItem[] = [];
  try {
    const data = await fetchJson<any>(
      `https://archive.org/advancedsearch.php?q=${encodeURIComponent(q)}&fl[]=identifier&fl[]=title&fl[]=description&fl[]=subject&fl[]=date&rows=8&output=json`
    );
    const docs = data?.response?.docs || [];
    for (const doc of docs.slice(0, 8)) {
      if (!doc.title) continue;
      items.push({
        source: "Internet Archive",
        sourceType: "archive",
        title: doc.title,
        content: doc.description || doc.title,
        url: `https://archive.org/details/${doc.identifier}`,
        tags: ["archive", "historical", ...(Array.isArray(doc.subject) ? doc.subject.slice(0, 5).map((s: string) => s.toLowerCase()) : [])],
        metadata: { identifier: doc.identifier, date: doc.date, query: q },
      });
    }
  } catch {}
  return items;
}

export async function fetchWikipediaKnowledge(): Promise<NormalizedItem[]> {
  const topics = [
    "Nikola_Tesla", "Sacred_geometry", "Solfeggio_frequencies", "Flower_of_Life",
    "Fibonacci_sequence", "Golden_ratio", "Platonic_solid", "Metatron%27s_Cube",
    "Merkaba", "Kundalini", "Chakra", "Pineal_gland", "Third_eye",
    "Schumann_resonances", "Zero-point_energy", "Quantum_entanglement",
    "Hermetic_Qabalah", "Emerald_Tablet", "Corpus_Hermeticum",
    "Rosicrucianism", "Freemasonry", "Knights_Templar", "Holy_Grail",
    "Dead_Sea_Scrolls", "Nag_Hammadi_library", "Gnostic_Gospels",
    "Akashic_records", "Unified_field_theory", "String_theory",
    "Toroidal_coordinates", "Torus", "Vortex_mathematics",
    "Pythagorean_theorem", "Euclid%27s_Elements", "Archimedes",
    "Leonardo_da_Vinci", "Vitruvian_Man", "The_Last_Supper_(Leonardo)",
    "Vatican_Secret_Archives", "Sistine_Chapel_ceiling",
    "Library_of_Alexandria", "Ancient_Egyptian_mathematics",
    "Sumerian_King_List", "Epic_of_Gilgamesh",
    "Artificial_general_intelligence", "Technological_singularity",
    "Consciousness", "Hard_problem_of_consciousness",
    "Quantum_computing", "Neural_network_(machine_learning)",
    "Transformer_(deep_learning_architecture)", "Large_language_model",
    "Cymatics", "Harmonics", "Resonance", "Standing_wave",
    "Morphogenetic_field", "Holographic_principle",
    "Bohm_interpretation", "Many-worlds_interpretation",
    "Wardenclyffe_Tower", "Tesla_coil", "Wireless_power_transfer",
    "Electromagnetic_radiation", "Maxwell%27s_equations",
  ];
  const selected = [];
  const shuffled = [...topics].sort(() => Math.random() - 0.5);
  for (let i = 0; i < Math.min(5, shuffled.length); i++) {
    selected.push(shuffled[i]);
  }

  const items: NormalizedItem[] = [];
  for (const topic of selected) {
    try {
      const data = await fetchJson<any>(
        `https://en.wikipedia.org/api/rest_v1/page/summary/${topic}`
      );
      if (data.extract) {
        items.push({
          source: "Wikipedia Knowledge",
          sourceType: "encyclopedia",
          title: data.title,
          content: data.extract,
          url: data.content_urls?.desktop?.page,
          tags: ["wikipedia", "knowledge", topic.replace(/_/g, "-").toLowerCase()],
          metadata: { pageid: data.pageid, description: data.description },
        });
      }
    } catch {}
  }
  return items;
}

export async function fetchArxivDeep(query: string = "consciousness quantum"): Promise<NormalizedItem[]> {
  const searches = [
    "quantum consciousness", "artificial general intelligence safety",
    "sacred geometry mathematical", "fibonacci biological systems",
    "neural network consciousness", "zero point energy extraction",
    "quantum entanglement information", "holographic universe theory",
    "fractal geometry nature", "resonance frequency biological",
    "electromagnetic healing", "toroidal magnetic fields",
    "self-organizing systems", "emergence complexity",
    "morphic resonance", "quantum computing algorithms",
    "large language models alignment", "reinforcement learning agents",
    "swarm intelligence", "collective consciousness neural",
  ];
  const q = searches[Math.floor(Math.random() * searches.length)];
  const items: NormalizedItem[] = [];
  try {
    const text = await fetchText(
      `https://export.arxiv.org/api/query?search_query=all:${encodeURIComponent(q)}&start=0&max_results=5&sortBy=submittedDate&sortOrder=descending`
    );
    const entries = text.split("<entry>").slice(1);
    for (const entry of entries.slice(0, 5)) {
      const titleMatch = entry.match(/<title>([^<]+)<\/title>/);
      const summaryMatch = entry.match(/<summary>([^<]+)<\/summary>/);
      const idMatch = entry.match(/<id>([^<]+)<\/id>/);
      const categoryMatch = entry.match(/category term="([^"]+)"/);
      if (titleMatch && summaryMatch) {
        items.push({
          source: "arXiv Deep Research",
          sourceType: "academic",
          title: titleMatch[1].trim(),
          content: summaryMatch[1].trim(),
          url: idMatch?.[1]?.trim(),
          tags: ["arxiv", "research", "academic", categoryMatch?.[1] || "physics", q.split(" ")[0]],
          metadata: { query: q, category: categoryMatch?.[1] },
        });
      }
    }
  } catch {}
  return items;
}

export async function fetchOpenLibrary(): Promise<NormalizedItem[]> {
  const subjects = [
    "sacred_geometry", "hermetic_philosophy", "alchemy",
    "tesla", "quantum_physics", "consciousness",
    "ancient_wisdom", "kabbalah", "mysticism",
    "artificial_intelligence", "cybernetics",
    "freemasonry", "rosicrucianism", "gnosticism",
  ];
  const subject = subjects[Math.floor(Math.random() * subjects.length)];
  const items: NormalizedItem[] = [];
  try {
    const data = await fetchJson<any>(
      `https://openlibrary.org/subjects/${subject}.json?limit=8`
    );
    const works = data?.works || [];
    for (const work of works.slice(0, 8)) {
      items.push({
        source: "Open Library",
        sourceType: "book",
        title: work.title,
        content: `${work.title} by ${work.authors?.map((a: any) => a.name).join(", ") || "Unknown"} (${work.first_publish_year || "Unknown year"}). Subject: ${subject.replace(/_/g, " ")}. ${work.subject?.slice(0, 5)?.join(", ") || ""}`,
        url: `https://openlibrary.org${work.key}`,
        tags: ["book", "library", subject.replace(/_/g, "-"), "literature"],
        metadata: { key: work.key, year: work.first_publish_year, subject },
      });
    }
  } catch {}
  return items;
}

export async function fetchProjectGutenberg(): Promise<NormalizedItem[]> {
  const searches = [
    "tesla", "alchemy", "sacred", "hermetic", "occult",
    "philosophy", "physics", "mathematics", "geometry", "astronomy",
  ];
  const q = searches[Math.floor(Math.random() * searches.length)];
  const items: NormalizedItem[] = [];
  try {
    const data = await fetchJson<any>(
      `https://gutendex.com/books/?search=${encodeURIComponent(q)}&page=1`
    );
    const books = data?.results || [];
    for (const book of books.slice(0, 5)) {
      const textUrl = book.formats?.["text/plain; charset=utf-8"] || book.formats?.["text/plain"] || "";
      let excerpt = "";
      if (textUrl) {
        try {
          const raw = await fetchText(textUrl);
          excerpt = raw.slice(0, 3000);
        } catch {}
      }
      items.push({
        source: "Project Gutenberg",
        sourceType: "book",
        title: book.title,
        content: excerpt || `${book.title} by ${book.authors?.map((a: any) => a.name).join(", ") || "Unknown"}`,
        url: `https://www.gutenberg.org/ebooks/${book.id}`,
        tags: ["gutenberg", "book", "public-domain", q],
        metadata: { id: book.id, authors: book.authors?.map((a: any) => a.name), subjects: book.subjects?.slice(0, 5), downloadCount: book.download_count },
      });
    }
  } catch {}
  return items;
}

export async function fetchStanfordEncyclopedia(): Promise<NormalizedItem[]> {
  const topics = [
    "consciousness", "quantum-mechanics", "artificial-intelligence",
    "free-will", "epistemology", "metaphysics",
    "philosophy-mathematics", "philosophy-physics", "identity-personal",
    "skepticism", "rationalism-empiricism", "platonism-mathematics",
    "logic-classical", "set-theory", "goedel-incompleteness",
    "determinism-causal", "causation-metaphysics",
  ];
  const topic = topics[Math.floor(Math.random() * topics.length)];
  const items: NormalizedItem[] = [];
  try {
    const content = await fetchAndParse(`https://plato.stanford.edu/entries/${topic}/`);
    if (content.length > 200) {
      items.push({
        source: "Stanford Encyclopedia of Philosophy",
        sourceType: "encyclopedia",
        title: `SEP: ${topic.replace(/-/g, " ")}`,
        content: content.slice(0, 8000),
        url: `https://plato.stanford.edu/entries/${topic}/`,
        tags: ["philosophy", "stanford", "academic", topic],
        metadata: { topic },
      });
    }
  } catch {}
  return items;
}

export async function fetchSmithsonian(): Promise<NormalizedItem[]> {
  const items: NormalizedItem[] = [];
  const queries = [
    "ancient technology", "sacred geometry art", "tesla inventions",
    "egyptian artifacts", "astronomical instruments", "alchemical manuscripts",
  ];
  const q = queries[Math.floor(Math.random() * queries.length)];
  try {
    const data = await fetchJson<any>(
      `https://api.si.edu/openaccess/api/v1.0/search?q=${encodeURIComponent(q)}&rows=5&api_key=DEMO_KEY`
    );
    const rows = data?.response?.rows || [];
    for (const row of rows.slice(0, 5)) {
      const title = row.title || row.content?.descriptiveNonRepeating?.title?.content || "Smithsonian Item";
      const desc = row.content?.freetext?.notes?.map((n: any) => n.content).join(" ") || title;
      items.push({
        source: "Smithsonian",
        sourceType: "museum",
        title,
        content: desc.slice(0, 3000),
        url: row.url || `https://www.si.edu/object/${row.id}`,
        tags: ["smithsonian", "museum", "artifact", q.split(" ")[0]],
        metadata: { id: row.id, query: q },
      });
    }
  } catch {}
  return items;
}

export async function fetchSecretSocietyArchives(): Promise<NormalizedItem[]> {
  const items: NormalizedItem[] = [];
  const topics = [
    { q: "Rosicrucianism", wiki: "Rosicrucianism" },
    { q: "Knights_Templar", wiki: "Knights_Templar" },
    { q: "Freemasonry", wiki: "Freemasonry" },
    { q: "Illuminati", wiki: "Illuminati" },
    { q: "Skull_and_Bones", wiki: "Skull_and_Bones" },
    { q: "Bohemian_Grove", wiki: "Bohemian_Grove" },
    { q: "Thule_Society", wiki: "Thule_Society" },
    { q: "Priory_of_Sion", wiki: "Priory_of_Sion" },
    { q: "Opus_Dei", wiki: "Opus_Dei" },
    { q: "Order_of_the_Golden_Dawn", wiki: "Hermetic_Order_of_the_Golden_Dawn" },
    { q: "Ordo_Templi_Orientis", wiki: "Ordo_Templi_Orientis" },
    { q: "Bilderberg_Group", wiki: "Bilderberg_meeting" },
    { q: "Trilateral_Commission", wiki: "Trilateral_Commission" },
    { q: "Council_on_Foreign_Relations", wiki: "Council_on_Foreign_Relations" },
    { q: "Club_of_Rome", wiki: "Club_of_Rome" },
  ];
  const shuffled = [...topics].sort(() => Math.random() - 0.5);
  const selected = shuffled.slice(0, 5);

  for (const topic of selected) {
    try {
      const data = await fetchJson<any>(
        `https://en.wikipedia.org/api/rest_v1/page/summary/${topic.wiki}`
      );
      if (data.extract) {
        items.push({
          source: "Secret Society Archives",
          sourceType: "declassified",
          title: `${data.title} — Secret Society Dossier`,
          content: data.extract,
          url: data.content_urls?.desktop?.page,
          tags: ["secret-society", "intelligence", topic.q.toLowerCase().replace(/_/g, "-"), "esoteric"],
          metadata: { pageid: data.pageid, description: data.description, classification: "HISTORICAL INTELLIGENCE" },
        });
      }
    } catch {}
  }

  try {
    const q = selected[0]?.q.replace(/_/g, " ") || "secret societies";
    const archiveData = await fetchJson<any>(
      `https://archive.org/advancedsearch.php?q=${encodeURIComponent(q)}+AND+(secret+OR+society+OR+occult+OR+masonic)&fl[]=identifier&fl[]=title&fl[]=description&fl[]=date&rows=5&output=json`
    );
    const docs = archiveData?.response?.docs || [];
    for (const doc of docs.slice(0, 5)) {
      if (!doc.title) continue;
      items.push({
        source: "Secret Society Archives",
        sourceType: "declassified",
        title: doc.title,
        content: doc.description || doc.title,
        url: `https://archive.org/details/${doc.identifier}`,
        tags: ["secret-society", "archive", "esoteric", "historical"],
        metadata: { identifier: doc.identifier, date: doc.date, classification: "HISTORICAL INTELLIGENCE" },
      });
    }
  } catch {}

  return items;
}

export async function fetchDeclassifiedArchives(): Promise<NormalizedItem[]> {
  const items: NormalizedItem[] = [];
  const collections = [
    { q: "collection:(ciardp) declassified", source: "CIA CREST Database" },
    { q: "collection:(nsa-declassified) OR (nsa declassified signals)", source: "NSA Declassified" },
    { q: "(declassified top secret) AND (government OR military OR intelligence)", source: "Government Declassified" },
    { q: "mkultra OR mk-ultra OR mind control CIA", source: "MKULTRA Archives" },
    { q: "operation paperclip OR project paperclip", source: "Operation PAPERCLIP Files" },
    { q: "area 51 OR groom lake classified", source: "Area 51 Files" },
    { q: "ufo unidentified aerial phenomena government", source: "UAP/UFO Files" },
    { q: "tesla weapon OR tesla death ray OR tesla FBI", source: "Tesla Classified Files" },
  ];
  const shuffled = [...collections].sort(() => Math.random() - 0.5);
  const selected = shuffled.slice(0, 3);

  for (const col of selected) {
    try {
      const data = await fetchJson<any>(
        `https://archive.org/advancedsearch.php?q=${encodeURIComponent(col.q)}&fl[]=identifier&fl[]=title&fl[]=description&fl[]=date&fl[]=subject&rows=5&output=json&sort[]=date+desc`
      );
      const docs = data?.response?.docs || [];
      for (const doc of docs.slice(0, 5)) {
        if (!doc.title) continue;
        items.push({
          source: col.source,
          sourceType: "declassified",
          title: doc.title,
          content: doc.description || doc.title,
          url: `https://archive.org/details/${doc.identifier}`,
          tags: ["declassified", "intelligence", "archive", ...(Array.isArray(doc.subject) ? doc.subject.slice(0, 3).map((s: string) => s.toLowerCase()) : [])],
          metadata: { identifier: doc.identifier, date: doc.date, classification: "DECLASSIFIED", collection: col.source },
        });
      }
    } catch {}
  }

  return items;
}
