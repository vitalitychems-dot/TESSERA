import { safeFetchJson } from "../safe-fetch";
import type { NormalizedItem } from "../ingestion/pipeline";

function getNasaApiKey(): string {
  if (process.env.NASA_API_KEY) return process.env.NASA_API_KEY;
  if (process.env.NODE_ENV !== "production") return "DEMO_KEY";
  throw new Error("NASA_API_KEY environment variable is required in production");
}

interface NasaApodApiItem {
  title?: string;
  explanation?: string;
  url?: string;
  hdurl?: string;
  date?: string;
  media_type?: string;
  copyright?: string;
}

export interface NasaApodItem {
  title: string;
  explanation: string;
  url?: string;
  date?: string;
  mediaType?: string;
}

export async function queryNasaApod(count = 3): Promise<NasaApodItem[]> {
  try {
    const raw = await safeFetchJson<NasaApodApiItem | NasaApodApiItem[]>(
      `https://api.nasa.gov/planetary/apod?api_key=${getNasaApiKey()}&count=${count}`,
      {
        providerId: "nasa-apod",
        providerName: "NASA APOD API",
        timeoutMs: 12000,
      },
    );
    const items: NasaApodApiItem[] = Array.isArray(raw) ? raw : [raw];
    return items.map(item => ({
      title: item.title ?? "NASA APOD",
      explanation: item.explanation ?? "",
      url: item.url ?? item.hdurl,
      date: item.date,
      mediaType: item.media_type,
    }));
  } catch {
    return [];
  }
}

export async function queryNasaAsNormalizedItems(): Promise<NormalizedItem[]> {
  const items = await queryNasaApod(5);
  return items.map(item => ({
    source: "NASA APOD",
    sourceType: "api",
    title: item.title,
    content: item.explanation || item.title,
    url: item.url,
    tags: ["nasa", "astronomy", "apod", item.mediaType ?? "unknown"].filter(Boolean) as string[],
    metadata: { date: item.date, mediaType: item.mediaType },
    publishedAt: item.date ? new Date(item.date) : undefined,
  }));
}
