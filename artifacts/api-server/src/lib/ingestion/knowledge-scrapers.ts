import { fetchJson, fetchText, fetchAndParse, deepCrawl } from "./scrapers";
import type { NormalizedItem } from "./pipeline";

export async function fetchCIAReadingRoom(query: string = "declassified", count = 10): Promise<NormalizedItem[]> {
  const items: NormalizedItem[] = [];
  const searchTerms = [
    "stargate+program", "remote+viewing", "gateway+process", "mkultra",
    "project+monarch", "cointelpro", "operation+mockingbird", "operation+paperclip",
    "area+51", "ufo+sightings", "psychic+warfare", "consciousness+research",
    "tesla+death+ray", "free+energy+suppression", "antigravity",
  ];
  const term = searchTerms[Math.floor(Math.random() * searchTerms.length)];
  try {
    const pages = await deepCrawl(
      `https://www.cia.gov/readingroom/search/site/${encodeURIComponent(term)}`,
      { maxDepth: 1, maxPages: Math.min(count, 5), minContentLength: 200 }
    );
    for (const page of pages) {
      items.push({
        source: "CIA Reading Room",
        sourceType: "declassified",
        title: page.title || `CIA Declassified: ${term}`,
        content: page.content,
        url: page.url,
        tags: ["cia", "declassified", "intelligence", "foia", term.replace(/\+/g, "-")],
        metadata: { searchTerm: term, depth: page.depth },
      });
    }
  } catch {}
  return items;
}

export async function fetchFBIVault(): Promise<NormalizedItem[]> {
  const items: NormalizedItem[] = [];
  const topics = [
    "Nikola Tesla", "UFO", "Albert Einstein", "Unexplained Phenomenon",
    "Secret Societies", "ESP Research", "Martin Luther King", "JFK Assassination",
  ];
  const topic = topics[Math.floor(Math.random() * topics.length)];
  try {
    const pages = await deepCrawl(
      `https://vault.fbi.gov/search?SearchableText=${encodeURIComponent(topic)}`,
      { maxDepth: 1, maxPages: 3, minContentLength: 200 }
    );
    for (const page of pages) {
      items.push({
        source: "FBI Vault",
        sourceType: "declassified",
        title: page.title || `FBI Vault: ${topic}`,
        content: page.content,
        url: page.url,
        tags: ["fbi", "declassified", "vault", topic.toLowerCase().replace(/\s+/g, "-")],
        metadata: { topic },
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
