import { logger } from "./logger";

interface ScrapeStats {
  queriesAvailable: number;
  rateLimit: number;
  totalScraped: number;
  lastScrape: number;
}

const stats: ScrapeStats = {
  queriesAvailable: 30,
  rateLimit: 30,
  totalScraped: 0,
  lastScrape: 0,
};

export function getGitHubScrapeStats(): ScrapeStats {
  return { ...stats };
}

export async function scrapeRepos(query: string, limit = 10): Promise<any[]> {
  const results: any[] = [];

  try {
    const token = process.env.GITHUB_TOKEN;
    if (!token) {
      logger.warn("github-scraper", "No GITHUB_TOKEN set — scraping disabled");
      return results;
    }

    const { default: axios } = await import("axios");
    const res = await axios.get(`https://api.github.com/search/repositories?q=${encodeURIComponent(query)}&per_page=${limit}`, {
      headers: { Authorization: `token ${token}` },
      timeout: 10000,
    });

    if (res.data?.items) {
      for (const item of res.data.items) {
        results.push({
          name: item.full_name,
          stars: item.stargazers_count,
          url: item.html_url,
          description: item.description,
          language: item.language,
        });
      }
      stats.totalScraped += results.length;
      stats.lastScrape = Date.now();
    }

    const remaining = parseInt(res.headers["x-ratelimit-remaining"] || "30");
    stats.queriesAvailable = remaining;
  } catch (e: any) {
    logger.error("github-scraper", `Scrape failed: ${e.message}`);
  }

  return results;
}
