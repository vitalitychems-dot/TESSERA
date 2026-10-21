import type { Express } from "express";

export function registerMarketplaceRoutes(app: Express, deps: {
  mkStats: () => any;
  mkActiveListings: (type?: string) => any;
  mkListing: (body: any) => any;
  mkPurchase: (listingId: string, buyer: string, wallet?: string) => Promise<{ transaction: any; error?: string }>;
  mkComputeListings: () => any;
  mkCreateComputeOffer: (body: any) => any;
  mkRentCompute: (rentalId: string, renter: string, hours: number, wallet?: string) => Promise<{ transaction: any; escrow?: any; error?: string }>;
  mkEndComputeRental: (rentalId: string) => Promise<{ rental: any; settlement?: any; error?: string }>;
  mkToolListings: () => any;
  mkCreateToolOffer: (body: any) => any;
  mkBorrowTool: (toolId: string, borrower: string, wallet?: string) => Promise<{ tool: any; escrow?: any; error?: string }>;
  mkUseTool: (toolId: string, user: string, details?: { endpoint?: string; tokensUsed?: number }) => Promise<{ transaction: any; metered?: any; error?: string }>;
  mkReturnTool: (toolId: string) => Promise<{ tool: any; settlement?: any; error?: string }>;
  mkTransactions: (limit?: number) => any;
  mkSellerProfile: (seller: string) => any;
  mkEscrowBalance: () => any;
  mkDisputes: (status?: string) => any;
  mkOpenDispute: (body: any) => Promise<any>;
  mkResolveDispute: (id: string, resolution: string, note: string) => Promise<any>;
  mkRevenueReport: () => any;
}) {
  app.get("/api/marketplace/stats", (_req, res) => {
    try { res.json(deps.mkStats()); } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  app.get("/api/marketplace/listings", (req, res) => {
    try { res.json(deps.mkActiveListings(req.query.type as string)); } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  app.post("/api/marketplace/listings", (req, res) => {
    try { res.json(deps.mkListing(req.body)); } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  app.post("/api/marketplace/purchase", async (req, res) => {
    try {
      const result = await deps.mkPurchase(req.body.listingId, req.body.buyer, req.body.buyerWallet);
      if (!result.transaction) return res.status(400).json({ error: result.error || "Purchase failed" });
      res.json(result);
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  app.get("/api/marketplace/compute", (_req, res) => {
    try { res.json(deps.mkComputeListings()); } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  app.post("/api/marketplace/compute", (req, res) => {
    try { res.json(deps.mkCreateComputeOffer(req.body)); } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  app.post("/api/marketplace/compute/rent", async (req, res) => {
    try {
      const { rentalId, renter, hours, renterWallet } = req.body;
      const result = await deps.mkRentCompute(rentalId, renter, hours, renterWallet);
      if (!result.transaction) return res.status(400).json({ error: result.error || "Rental failed" });
      res.json(result);
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  app.post("/api/marketplace/compute/end", async (req, res) => {
    try {
      const result = await deps.mkEndComputeRental(req.body.rentalId);
      if (!result.rental) return res.status(400).json({ error: result.error || "End rental failed" });
      res.json(result);
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  app.get("/api/marketplace/tools", (_req, res) => {
    try { res.json(deps.mkToolListings()); } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  app.post("/api/marketplace/tools", (req, res) => {
    try { res.json(deps.mkCreateToolOffer(req.body)); } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  app.post("/api/marketplace/tools/borrow", async (req, res) => {
    try {
      const { toolId, borrower, borrowerWallet } = req.body;
      const result = await deps.mkBorrowTool(toolId, borrower, borrowerWallet);
      if (!result.tool) return res.status(400).json({ error: result.error || "Borrow failed" });
      res.json(result);
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  app.post("/api/marketplace/tools/use", async (req, res) => {
    try {
      const { toolId, user, apiCallDetails } = req.body;
      const result = await deps.mkUseTool(toolId, user, apiCallDetails);
      if (!result.transaction) return res.status(400).json({ error: result.error || "Use failed" });
      res.json(result);
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  app.post("/api/marketplace/tools/return", async (req, res) => {
    try {
      const result = await deps.mkReturnTool(req.body.toolId);
      if (!result.tool) return res.status(400).json({ error: result.error || "Return failed" });
      res.json(result);
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  app.get("/api/marketplace/transactions", (req, res) => {
    try { res.json(deps.mkTransactions(Number(req.query.limit) || 50)); } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  app.get("/api/marketplace/seller/:seller", (req, res) => {
    try { res.json(deps.mkSellerProfile(req.params.seller)); } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  app.get("/api/marketplace/escrow", (_req, res) => {
    try { res.json(deps.mkEscrowBalance()); } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  app.get("/api/marketplace/disputes", (req, res) => {
    try { res.json(deps.mkDisputes(req.query.status as string)); } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  app.post("/api/marketplace/disputes", async (req, res) => {
    try {
      const dispute = await deps.mkOpenDispute(req.body);
      res.json(dispute);
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  app.post("/api/marketplace/disputes/resolve", async (req, res) => {
    try {
      const result = await deps.mkResolveDispute(req.body.disputeId, req.body.resolution, req.body.resolutionNote);
      if (!result.dispute) return res.status(400).json({ error: result.error || "Dispute not found" });
      res.json(result);
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  app.get("/api/marketplace/revenue", (_req, res) => {
    try { res.json(deps.mkRevenueReport()); } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  console.log("[MarketplaceRoutes] 20 marketplace routes registered");
}
