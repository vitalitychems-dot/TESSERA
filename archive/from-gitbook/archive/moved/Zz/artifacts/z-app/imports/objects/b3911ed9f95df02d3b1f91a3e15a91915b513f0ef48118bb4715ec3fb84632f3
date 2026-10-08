import { fetchText } from "./scrapers";
import { htmlToText } from "./pipeline";
import type { NormalizedItem } from "./pipeline";

interface RssItem {
  title?: string;
  link?: string;
  description?: string;
  pubDate?: string;
  content?: string;
}

function extractTag(xml: string, tag: string): string {
  const cdataMatch = xml.match(new RegExp(`<${tag}[^>]*><!\\[CDATA\\[([\\s\\S]*?)\\]\\]><\\/${tag}>`, "i"));
  if (cdataMatch) return cdataMatch[1].trim();
  const match = xml.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, "i"));
  return match ? htmlToText(match[1].trim()) : "";
}

function parseRss(xml: string, feedName: string, feedUrl: string): NormalizedItem[] {
  const items: NormalizedItem[] = [];
  const itemRegex = /<item[^>]*>([\s\S]*?)<\/item>/gi;
  let match: RegExpExecArray | null;

  while ((match = itemRegex.exec(xml)) !== null) {
    const itemXml = match[1];
    const title = extractTag(itemXml, "title");
    const link = extractTag(itemXml, "link") || extractTag(itemXml, "guid");
    const description = extractTag(itemXml, "description");
    const content = extractTag(itemXml, "content:encoded") || description;
    const pubDate = extractTag(itemXml, "pubDate");

    if (!content && !title) continue;

    let publishedAt: Date | undefined;
    if (pubDate) {
      try { publishedAt = new Date(pubDate); } catch { }
    }

    items.push({
      source: feedName,
      sourceType: "rss",
      title: title || undefined,
      content: content || title,
      url: link || feedUrl,
      tags: ["rss", feedName.toLowerCase().replace(/\s+/g, "-")],
      metadata: { feedUrl },
      publishedAt,
    });
  }

  const entryRegex = /<entry[^>]*>([\s\S]*?)<\/entry>/gi;
  while ((match = entryRegex.exec(xml)) !== null) {
    const entryXml = match[1];
    const title = extractTag(entryXml, "title");
    const linkMatch = entryXml.match(/<link[^>]+href="([^"]+)"/i);
    const link = linkMatch ? linkMatch[1] : "";
    const summary = extractTag(entryXml, "summary");
    const content = extractTag(entryXml, "content") || summary;
    const updated = extractTag(entryXml, "updated") || extractTag(entryXml, "published");

    if (!content && !title) continue;

    let publishedAt: Date | undefined;
    if (updated) {
      try { publishedAt = new Date(updated); } catch { }
    }

    items.push({
      source: feedName,
      sourceType: "rss",
      title: title || undefined,
      content: content || title,
      url: link || feedUrl,
      tags: ["atom", feedName.toLowerCase().replace(/\s+/g, "-")],
      metadata: { feedUrl },
      publishedAt,
    });
  }

  return items.slice(0, 20);
}

export const DEFAULT_FEEDS: Array<{ name: string; url: string }> = [
  { name: "Hacker News RSS", url: "https://hnrss.org/frontpage" },
  { name: "arXiv CS", url: "https://rss.arxiv.org/rss/cs" },
  { name: "arXiv AI", url: "https://rss.arxiv.org/rss/cs.AI" },
  { name: "NASA News", url: "https://www.nasa.gov/news-release/feed/" },
  { name: "USGS Earthquakes", url: "https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/significant_week.atom" },
  { name: "Wikipedia Featured", url: "https://en.wikipedia.org/w/api.php?action=featuredfeed&feed=featured&feedformat=atom" },
];

export async function fetchRssFeed(name: string, url: string): Promise<NormalizedItem[]> {
  const xml = await fetchText(url);
  return parseRss(xml, name, url);
}
