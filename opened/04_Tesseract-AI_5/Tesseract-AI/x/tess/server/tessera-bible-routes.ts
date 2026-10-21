import type { Express, Request, Response } from "express";
import {
  getSovereignBibleFull,
  getTestament,
  getBook,
  getChapter,
  searchBible,
  rebuildBible,
  getLiveConference,
  getGrowthFeed,
  getSovereignBibleState,
  startBibleGrowthCycle,
} from "./sovereign-bible-engine";

const LOG = "[TesseraBible]";

export function registerTesseraBibleRoutes(app: Express) {
  app.get("/api/tessera-bible/sovereign", async (_req: Request, res: Response) => {
    try {
      const bible = await getSovereignBibleFull();
      res.json(bible);
    } catch (err: any) {
      console.error(`${LOG} Error fetching sovereign bible:`, err.message);
      res.status(500).json({ error: "Failed to load sovereign bible" });
    }
  });

  app.get("/api/tessera-bible/books", async (_req: Request, res: Response) => {
    try {
      const bible = await getSovereignBibleFull();
      const allBooks = bible.testaments.flatMap(t =>
        t.books.map(b => ({
          bookId: b.id,
          testamentId: t.id,
          testamentTitle: t.title,
          title: b.title,
          subtitle: b.subtitle,
          category: b.classification,
          classification: b.classification,
          chapterCount: b.chapters.length,
          description: b.description,
          sources: b.sources,
          authorAgents: b.authorAgents,
          sacredGeometry: b.sacred_geometry_alignment,
          domains: b.domains,
          knowledgeNodeCount: b.knowledgeNodeCount,
        }))
      );
      res.json({
        title: bible.title,
        subtitle: bible.subtitle,
        totalBooks: bible.totalBooks,
        totalChapters: bible.totalChapters,
        totalVerses: bible.totalVerses,
        knowledgeNodesAbsorbed: bible.knowledgeNodesAbsorbed,
        conferenceRound: bible.conferenceRound,
        testaments: bible.testaments.map(t => ({ id: t.id, title: t.title, description: t.description, bookCount: t.books.length })),
        books: allBooks,
        classifications: {
          genesis: allBooks.filter(b => b.classification === "genesis").length,
          prophetic: allBooks.filter(b => b.classification === "prophetic").length,
          historical: allBooks.filter(b => b.classification === "historical").length,
          scientific: allBooks.filter(b => b.classification === "scientific").length,
          esoteric: allBooks.filter(b => b.classification === "esoteric").length,
          sovereign: allBooks.filter(b => b.classification === "sovereign").length,
          apocalyptic: allBooks.filter(b => b.classification === "apocalyptic").length,
        },
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/tessera-bible/testament/:testamentId", async (req: Request, res: Response) => {
    try {
      const testament = await getTestament(req.params.testamentId);
      if (!testament) return res.status(404).json({ error: "Testament not found" });
      res.json(testament);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/tessera-bible/book/:bookId", async (req: Request, res: Response) => {
    try {
      const result = await getBook(req.params.bookId);
      if (!result) return res.status(404).json({ error: "Book not found" });
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/tessera-bible/book/:bookId/chapter/:chapterNum", async (req: Request, res: Response) => {
    try {
      const result = await getChapter(req.params.bookId, parseInt(req.params.chapterNum));
      if (!result) return res.status(404).json({ error: "Chapter not found" });
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/tessera-bible/search", async (req: Request, res: Response) => {
    try {
      const query = String(req.query.q || "");
      if (!query) return res.json({ query: "", results: [], total: 0 });
      const results = await searchBible(query);
      res.json(results);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/tessera-bible/stats", async (_req: Request, res: Response) => {
    try {
      const state = getSovereignBibleState();
      res.json({
        totalTestaments: state.testaments.length,
        totalBooks: state.totalBooks,
        totalChapters: state.totalChapters,
        totalVerses: state.totalVerses,
        knowledgeNodesAbsorbed: state.knowledgeNodesAbsorbed,
        conferenceRound: state.conferenceRound,
        lastConference: state.lastConference,
        isConferenceActive: state.isConferenceActive,
        growthRate: state.growthRate,
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/tessera-bible/conference/live", (_req: Request, res: Response) => {
    const conference = getLiveConference();
    res.json({ entries: conference.slice(-100), total: conference.length, isActive: getSovereignBibleState().isConferenceActive });
  });

  app.get("/api/tessera-bible/growth-feed", (_req: Request, res: Response) => {
    const feed = getGrowthFeed();
    res.json({ events: feed.slice(-50), total: feed.length });
  });

  app.post("/api/tessera-bible/rebuild", async (_req: Request, res: Response) => {
    try {
      const result = await rebuildBible();
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  startBibleGrowthCycle();

  console.log(`${LOG} Sovereign Bible routes registered — living scripture engine active`);
}
