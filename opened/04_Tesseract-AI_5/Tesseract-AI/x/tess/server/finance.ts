import axios from "axios";

export async function performSecAnalysis(ticker: string): Promise<any> {
  const symbol = ticker.toUpperCase().trim();

  const cikRes = await axios.get(
    `https://efts.sec.gov/LATEST/search-index?q=%22${symbol}%22&dateRange=custom&startdt=2020-01-01&forms=10-K`,
    { headers: { "User-Agent": "research-agent contact@example.com" }, timeout: 10000 }
  ).catch(() => null);

  const cikLookup = await axios.get(
    `https://www.sec.gov/cgi-bin/browse-edgar?company=${symbol}&CIK=&type=10-K&dateb=&owner=include&count=5&search_text=&action=getcompany&output=atom`,
    { headers: { "User-Agent": "research-agent contact@example.com" }, timeout: 10000 }
  ).catch(() => null);

  const fullTextSearch = await axios.get(
    `https://efts.sec.gov/LATEST/search-index?q=%22${symbol}%22&forms=10-K,10-Q,8-K&dateRange=custom&startdt=2023-01-01`,
    { headers: { "User-Agent": "research-agent contact@example.com" }, timeout: 10000 }
  ).catch(() => null);

  const hits = fullTextSearch?.data?.hits?.hits ?? [];
  const filings = hits.slice(0, 10).map((h: any) => ({
    form: h._source?.form_type,
    date: h._source?.file_date,
    company: h._source?.entity_name,
    description: h._source?.period_of_report,
    url: h._source?.file_num ? `https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&filenum=${h._source.file_num}` : null,
  }));

  return {
    ticker: symbol,
    secFilings: filings,
    summary: filings.length > 0
      ? `Found ${filings.length} recent SEC filings for ${symbol}.`
      : `No recent SEC filings found for ${symbol} via public EDGAR search.`,
    source: "SEC EDGAR",
  };
}
