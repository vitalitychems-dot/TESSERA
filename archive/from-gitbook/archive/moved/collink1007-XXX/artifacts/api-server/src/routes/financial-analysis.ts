import { Router } from "express";
import {
  analyzeAsset,
  generateDemoPriceBars,
  formatAnalysisSummary,
  type PriceBar,
} from "../lib/financial-analysis.js";

const router = Router();

router.post("/financial-analysis/analyze", async (req, res) => {
  try {
    const { bars, ticker } = req.body as { bars?: PriceBar[]; ticker?: string };

    const priceBars: PriceBar[] = Array.isArray(bars) && bars.length > 0
      ? bars
      : generateDemoPriceBars(500, 100, 0.6);

    if (priceBars.length < 30) {
      return res.status(400).json({ error: "Minimum 30 price bars required for analysis." });
    }

    const result = await analyzeAsset(ticker ?? "DEMO", priceBars);

    res.json({
      ticker: result.ticker,
      dataPoints: result.dataPoints,
      dateRange: result.dateRange,
      hurstResult: result.hurstResult,
      fractalPrediction: result.fractalPrediction,
      fftCycles: result.fftCycles.slice(0, 5),
      sacredGeometry: result.sacredGeometry,
      moonPhaseCorrelation: result.moonPhaseCorrelation,
      pcaFactors: result.pcaFactors.slice(0, 3),
      findings: result.findings,
      summary: formatAnalysisSummary(result),
    });
  } catch (err: any) {
    res.status(500).json({ error: "Financial analysis failed", details: err?.message });
  }
});

router.get("/financial-analysis/demo", async (req, res) => {
  try {
    const ticker = typeof req.query.ticker === "string" ? req.query.ticker : "DEMO";
    const bars = generateDemoPriceBars(365, 100, 0.6);
    const result = await analyzeAsset(ticker, bars);

    res.json({
      ticker: result.ticker,
      dataPoints: result.dataPoints,
      hurstResult: result.hurstResult,
      fractalPrediction: result.fractalPrediction,
      fftCycles: result.fftCycles.slice(0, 5),
      sacredGeometry: result.sacredGeometry,
      moonPhaseCorrelation: result.moonPhaseCorrelation,
      findings: result.findings,
      summary: formatAnalysisSummary(result),
    });
  } catch (err: any) {
    res.status(500).json({ error: "Demo analysis failed", details: err?.message });
  }
});

export default router;
