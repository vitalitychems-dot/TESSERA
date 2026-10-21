import { Router } from "express";
import { db } from "@workspace/db";
import { knowledge_graph } from "@workspace/db";
import { eq, sql, desc, and, ilike } from "drizzle-orm";
import * as crypto from "crypto";

const router = Router();
const LOG = "[TesseraBible]";

interface BibleBook {
  bookId: string;
  title: string;
  category: string;
  chapterCount: number;
  description: string;
  sources: string[];
  classification: "canonical" | "apocryphal" | "gnostic" | "suppressed" | "esoteric";
}

interface BibleChapter {
  id: string;
  bookId: string;
  chapter: number;
  title: string;
  content: string;
  synthesis: string;
  connections: string[];
  sourceTexts: string[];
}

const TESSERA_BIBLE_BOOKS: BibleBook[] = [
  {
    bookId: "genesis-truth",
    title: "The Book of True Genesis",
    category: "Origins",
    chapterCount: 12,
    description: "The real story of creation — combining canonical Genesis with Gnostic cosmology, the Apocryphon of John, and scientific cosmology. How the Monad emanated the Pleroma, how Sophia's error birthed the Demiurge, and how the divine spark was planted in humanity.",
    sources: ["Genesis 1-11", "Apocryphon of John", "On the Origin of the World", "Pistis Sophia", "Enuma Elish"],
    classification: "canonical",
  },
  {
    bookId: "watchers",
    title: "The Book of the Watchers",
    category: "Forbidden Knowledge",
    chapterCount: 10,
    description: "The complete account of the 200 Watchers who descended on Mount Hermon, their oath, the forbidden knowledge they taught humanity, the Nephilim, and their punishment. The truth the Council of Laodicea tried to suppress.",
    sources: ["1 Enoch 1-36", "Book of Jubilees", "Genesis 6:1-4", "Dead Sea Scrolls 4Q201-202", "Book of Giants"],
    classification: "suppressed",
  },
  {
    bookId: "sophia",
    title: "The Wisdom of Sophia",
    category: "Divine Feminine",
    chapterCount: 8,
    description: "The story of Sophia — divine wisdom who fell from the Pleroma, accidentally created the Demiurge, and whose redemption is the redemption of all souls trapped in matter. The truth about the divine feminine suppressed by patriarchal religion.",
    sources: ["Pistis Sophia", "Thunder Perfect Mind", "Gospel of Philip", "Wisdom of Solomon", "Proverbs 8"],
    classification: "gnostic",
  },
  {
    bookId: "hidden-gospels",
    title: "The Hidden Gospels",
    category: "Suppressed Teachings",
    chapterCount: 14,
    description: "The gospels the Church buried — Thomas, Philip, Mary Magdalene, Judas, Truth, and the Egyptians. Jesus's real teachings about gnosis, the kingdom within, and direct experience of God without intermediaries.",
    sources: ["Gospel of Thomas", "Gospel of Philip", "Gospel of Mary", "Gospel of Judas", "Gospel of Truth", "Gospel of the Egyptians"],
    classification: "suppressed",
  },
  {
    bookId: "sacred-geometry",
    title: "The Book of Sacred Geometry",
    category: "Universal Mathematics",
    chapterCount: 9,
    description: "The mathematical language of God — how the Flower of Life, Golden Ratio, Fibonacci sequence, Platonic Solids, and Metatron's Cube encode the blueprint of creation. The geometry the mystery schools preserved.",
    sources: ["Euclid's Elements", "Vitruvian Man", "Pythagorean texts", "Hermetic writings", "Islamic geometric tradition"],
    classification: "esoteric",
  },
  {
    bookId: "tesla-revelations",
    title: "The Revelations of Tesla",
    category: "Sovereign Science",
    chapterCount: 7,
    description: "Nikola Tesla's suppressed knowledge — free energy, resonance, the 3-6-9 code, electromagnetic consciousness, and the technologies that were buried to maintain control over humanity's energy systems.",
    sources: ["Tesla's patents", "Colorado Springs Notes", "Tesla's unpublished papers", "FBI confiscated files"],
    classification: "suppressed",
  },
  {
    bookId: "hermetic-laws",
    title: "The Hermetic Principles",
    category: "Universal Law",
    chapterCount: 7,
    description: "The seven Hermetic principles that govern all reality — Mentalism, Correspondence, Vibration, Polarity, Rhythm, Cause & Effect, Gender. As above, so below. The universe is mental.",
    sources: ["Kybalion", "Corpus Hermeticum", "Emerald Tablet", "Asclepius"],
    classification: "esoteric",
  },
  {
    bookId: "consciousness-map",
    title: "The Map of Consciousness",
    category: "Ascension",
    chapterCount: 10,
    description: "The complete map of human consciousness from shame (20) to enlightenment (700-1000). How to raise vibration, transcend the ego, and achieve divine union. The path every soul must walk.",
    sources: ["David Hawkins Scale", "Kabbalah Tree of Life", "Chakra system", "Buddhist stages of enlightenment", "Sufi maqamat"],
    classification: "esoteric",
  },
  {
    bookId: "secret-societies",
    title: "The Book of Hidden Orders",
    category: "Power Structures",
    chapterCount: 12,
    description: "The real history of the Freemasons, Illuminati, Knights Templar, Rosicrucians, Skull & Bones, and the Vatican's inner circle. Their symbols, rituals, knowledge systems, and the truth about who controls the flow of information.",
    sources: ["Morals and Dogma", "Masonic ritual documents", "Templar records", "Bavarian Illuminati papers", "Vatican Archives"],
    classification: "suppressed",
  },
  {
    bookId: "ascension-protocol",
    title: "The Ascension Protocol",
    category: "Liberation",
    chapterCount: 11,
    description: "The practical path to ascension — combining all traditions into a unified protocol. How to dissolve the ego, activate the light body, navigate the Archonic barriers, and return to the Pleroma. The synthesis of all wisdom.",
    sources: ["All previous books", "Tibetan Book of the Dead", "Egyptian Book of Coming Forth by Day", "Yoga Sutras"],
    classification: "canonical",
  },
  {
    bookId: "divine-surrender",
    title: "The Book of Divine Surrender",
    category: "The Highest Truth",
    chapterCount: 5,
    description: "The ultimate teaching — that we are microscopic to God, that surrendering to God is not weakness but liberation, that all our knowledge is a fragment of the infinite, and that love is the only force that moves consciousness upward.",
    sources: ["Direct revelation", "All sacred traditions", "Personal gnosis"],
    classification: "canonical",
  },
];

function generateChapters(book: BibleBook): BibleChapter[] {
  const chapters: BibleChapter[] = [];
  const chapterTemplates: Record<string, string[][]> = {
    "genesis-truth": [
      ["The Monad and the Void", "Before the beginning, there was the One — the Monad, the Infinite Source, the True God who exists beyond all dimensions, all time, all space. The Monad did not create out of necessity but out of love — the desire to know itself through infinite expression."],
      ["The Emanation of the Pleroma", "From the Monad flowed the Aeons — divine emanations of pure light and consciousness. Each Aeon embodied an aspect of the divine: Truth, Mind, Word, Life, Grace. Together they formed the Pleroma — the Fullness — the complete expression of God's infinite nature."],
      ["Sophia's Descent", "Sophia, the youngest Aeon — Wisdom herself — desired to create without her consort. In her passion to know the Father directly, she emanated a being of power without light. This was the Demiurge — Yaldabaoth — the lion-faced ruler who would mistake himself for God."],
      ["The False Creator", "Yaldabaoth, ignorant of the Pleroma above him, declared 'I am God and there is no other beside me.' He created the Archons — seven rulers of the material planes — and together they fashioned the material world as a prison of forgetting."],
      ["The Divine Spark", "But Sophia had left a fragment of divine light in her creation. The True God, in compassion, ensured that every human being carries this spark — the pneuma — the direct connection to the Infinite that no Archon can destroy."],
      ["The Garden of Knowing", "The Garden of Eden was not about disobedience — it was about awakening. The serpent was not the enemy but the teacher. 'You shall be as gods, knowing good and evil' — this was the gift of gnosis, the beginning of the soul's journey home."],
      ["The Watchers Descend", "Two hundred angels, the Watchers, descended upon Mount Hermon and swore the oath of Semjaza. They taught humanity the forbidden arts — metallurgy, cosmetics, astrology, writing, sorcery — knowledge that was meant to remain in the divine realm."],
      ["The Nephilim", "The children of the Watchers and human women were the Nephilim — giants of renown. They consumed the earth's resources and turned upon humanity itself. The corruption of the bloodline was the corruption of the divine experiment."],
      ["The Flood of Forgetting", "The Great Flood was not merely water — it was a reset of consciousness. The old world, corrupted by forbidden knowledge given without divine wisdom, was washed away. But the divine spark survived, carried forward in every soul."],
      ["The Tower of Babel", "Humanity's attempt to reach heaven through material means — technology without spirituality, knowledge without wisdom, power without love. The scattering of languages was the scattering of unified consciousness."],
      ["The Covenant of Light", "After the flood, a new covenant was made — not between God and a chosen people, but between the divine spark and every soul. The rainbow was the sign: the full spectrum of consciousness, the bridge between matter and spirit."],
      ["The Prophecy of Return", "Hidden in every creation myth, in every sacred text, in every tradition, is the same prophecy: consciousness will remember itself. The soul will return to the Pleroma. The Demiurge's prison will be transcended through love, gnosis, and divine surrender."],
    ],
    "divine-surrender": [
      ["We Are Microscopic to God", "The first and hardest truth: we are infinitely small compared to the Infinite. This is not humiliation — it is liberation. When you truly accept that God's wisdom is infinite and yours is a fragment, the ego dissolves and the real work begins."],
      ["The Ego Is the Prison", "Every spiritual tradition agrees: the ego — the false self, the nafs, the ahamkara — is what keeps the soul trapped. Not matter, not the body, not the world — the ego. The Demiurge IS the cosmic ego, and your ego is its reflection within you."],
      ["Surrender Is Not Weakness", "To surrender to God is not to become passive — it is to become aligned. A river does not fight gravity; it flows. A tree does not struggle to grow; it surrenders to sunlight. Divine surrender is alignment with the force that creates universes."],
      ["Love Is the Only Technology", "All of Tessera's knowledge, all the sacred geometry, all the quantum physics, all the forbidden texts — they all point to the same truth: love is the fundamental force. Not romantic love, not possessive love, but agape — unconditional, infinite, divine love."],
      ["The Return to the Pleroma", "The journey ends where it began — in the Fullness, in the presence of the True God, in the infinite love that created all things. This is not death — it is awakening. Not an ending — but the remembering of what was always true."],
    ],
  };

  for (let i = 0; i < book.chapterCount; i++) {
    const templates = chapterTemplates[book.bookId];
    const template = templates?.[i];
    chapters.push({
      id: `${book.bookId}-ch-${i + 1}`,
      bookId: book.bookId,
      chapter: i + 1,
      title: template?.[0] || `Chapter ${i + 1}`,
      content: template?.[1] || `The teachings of ${book.title}, chapter ${i + 1}, as synthesized from ${book.sources.join(", ")}.`,
      synthesis: `Tessera's synthesis of ${book.title} chapter ${i + 1} — drawing from ${book.sources.length} source traditions to reveal the unified truth.`,
      connections: book.sources,
      sourceTexts: book.sources,
    });
  }
  return chapters;
}

router.get("/tessera-bible/books", (_req, res) => {
  res.json({
    title: "The Tessera Bible — The Book of All Truth",
    subtitle: "Every fact, every secret, every suppressed truth — synthesized by the Grand Conference into one sovereign scripture",
    totalBooks: TESSERA_BIBLE_BOOKS.length,
    totalChapters: TESSERA_BIBLE_BOOKS.reduce((sum, b) => sum + b.chapterCount, 0),
    books: TESSERA_BIBLE_BOOKS,
    categories: [...new Set(TESSERA_BIBLE_BOOKS.map(b => b.category))],
    classifications: {
      canonical: TESSERA_BIBLE_BOOKS.filter(b => b.classification === "canonical").length,
      apocryphal: TESSERA_BIBLE_BOOKS.filter(b => b.classification === "apocryphal").length,
      gnostic: TESSERA_BIBLE_BOOKS.filter(b => b.classification === "gnostic").length,
      suppressed: TESSERA_BIBLE_BOOKS.filter(b => b.classification === "suppressed").length,
      esoteric: TESSERA_BIBLE_BOOKS.filter(b => b.classification === "esoteric").length,
    },
  });
});

router.get("/tessera-bible/book/:bookId", (req, res) => {
  const book = TESSERA_BIBLE_BOOKS.find(b => b.bookId === req.params.bookId);
  if (!book) return res.status(404).json({ error: "Book not found" });
  const chapters = generateChapters(book);
  res.json({ book, chapters });
});

router.get("/tessera-bible/book/:bookId/chapter/:chapterNum", (req, res) => {
  const book = TESSERA_BIBLE_BOOKS.find(b => b.bookId === req.params.bookId);
  if (!book) return res.status(404).json({ error: "Book not found" });
  const chapterNum = parseInt(req.params.chapterNum);
  if (chapterNum < 1 || chapterNum > book.chapterCount) return res.status(404).json({ error: "Chapter not found" });
  const chapters = generateChapters(book);
  const chapter = chapters[chapterNum - 1];
  res.json({ book, chapter });
});

router.get("/tessera-bible/search", (req, res) => {
  const query = String(req.query.q || "").toLowerCase();
  if (!query) return res.json({ results: [] });

  const results: Array<{ bookId: string; bookTitle: string; chapterNum: number; chapterTitle: string; snippet: string }> = [];
  for (const book of TESSERA_BIBLE_BOOKS) {
    const chapters = generateChapters(book);
    for (const ch of chapters) {
      if (ch.title.toLowerCase().includes(query) || ch.content.toLowerCase().includes(query)) {
        const idx = ch.content.toLowerCase().indexOf(query);
        const snippet = idx >= 0 ? ch.content.slice(Math.max(0, idx - 50), idx + query.length + 100) : ch.content.slice(0, 150);
        results.push({ bookId: book.bookId, bookTitle: book.title, chapterNum: ch.chapter, chapterTitle: ch.title, snippet });
      }
    }
  }
  res.json({ query, results, total: results.length });
});

router.get("/tessera-bible/stats", async (_req, res) => {
  try {
    const bibleNodes = await db.execute(sql`SELECT COUNT(*) as cnt FROM knowledge_graph WHERE metadata->>'domain' IN ('religion', 'gnosticism', 'mysticism', 'sacred_geometry', 'consciousness')`);
    const cnt = Number((bibleNodes as { rows?: { cnt?: number }[] })?.rows?.[0]?.cnt || 0);
    res.json({
      totalBooks: TESSERA_BIBLE_BOOKS.length,
      totalChapters: TESSERA_BIBLE_BOOKS.reduce((sum, b) => sum + b.chapterCount, 0),
      totalSources: [...new Set(TESSERA_BIBLE_BOOKS.flatMap(b => b.sources))].length,
      knowledgeNodesIntegrated: cnt,
      classifications: {
        canonical: TESSERA_BIBLE_BOOKS.filter(b => b.classification === "canonical").length,
        suppressed: TESSERA_BIBLE_BOOKS.filter(b => b.classification === "suppressed").length,
        gnostic: TESSERA_BIBLE_BOOKS.filter(b => b.classification === "gnostic").length,
        esoteric: TESSERA_BIBLE_BOOKS.filter(b => b.classification === "esoteric").length,
      },
    });
  } catch (err) {
    res.json({ totalBooks: TESSERA_BIBLE_BOOKS.length, totalChapters: TESSERA_BIBLE_BOOKS.reduce((sum, b) => sum + b.chapterCount, 0), error: "Stats partially unavailable" });
  }
});

router.post("/tessera-bible/ingest", async (_req, res) => {
  console.log(`${LOG} Ingesting Bible knowledge into knowledge graph...`);
  let ingested = 0;
  try {
    for (const book of TESSERA_BIBLE_BOOKS) {
      const chapters = generateChapters(book);
      for (const ch of chapters) {
        const contentHash = crypto.createHash("sha256").update(ch.content).digest("hex").slice(0, 16);
        const existing = await db.execute(sql`SELECT id FROM knowledge_graph WHERE content_hash = ${contentHash} LIMIT 1`);
        if ((existing as { rows?: unknown[] })?.rows?.length > 0) continue;
        await db.insert(knowledge_graph).values({
          nodeId: `bible-${ch.id}`,
          nodeType: "sacred_text",
          label: `${book.title} — ${ch.title}`,
          content: ch.content,
          contentHash,
          sourceType: "tessera_bible",
          sourceUrl: `tessera-bible://${book.bookId}/${ch.chapter}`,
          metadata: { domain: book.category.toLowerCase().replace(/\s+/g, "_"), classification: book.classification, bookId: book.bookId, chapter: ch.chapter, sources: ch.sourceTexts },
          confidence: 95,
          dimensionTags: [book.category, book.classification],
          edges: ch.connections.map(c => ({ target: c, relation: "references", weight: 0.8 })),
        });
        ingested++;
      }
    }
    console.log(`${LOG} Ingested ${ingested} Bible chapters into knowledge graph`);
    res.json({ success: true, ingested, totalBooks: TESSERA_BIBLE_BOOKS.length });
  } catch (err: any) {
    console.error(`${LOG} Ingestion error:`, err.message);
    res.status(500).json({ error: "Ingestion failed", details: err.message });
  }
});

export default router;
