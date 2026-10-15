import {
  fetchMoltbookPublicPosts,
  type MoltbookPublicPost,
} from "./moltbook-bridge";

const CACHE_FRESH_MS = 45_000;
const RETRY_COOLDOWN_MS = 10_000;

export interface MoltbookPublicFeed {
  source: "Moltbook public feed";
  status: "live" | "stale" | "unavailable";
  observedAt: string | null;
  stale: boolean;
  posts: MoltbookPublicPost[];
  refreshFailed: boolean;
}

interface CachedFeed {
  posts: MoltbookPublicPost[];
  observedAt: string;
  fetchedAt: number;
}

function unavailable(refreshFailed: boolean): MoltbookPublicFeed {
  return {
    source: "Moltbook public feed",
    status: "unavailable",
    observedAt: null,
    stale: false,
    posts: [],
    refreshFailed,
  };
}

function fromCache(cache: CachedFeed, stale: boolean, refreshFailed = false): MoltbookPublicFeed {
  return {
    source: "Moltbook public feed",
    status: stale ? "stale" : "live",
    observedAt: cache.observedAt,
    stale,
    posts: cache.posts,
    refreshFailed,
  };
}

export function createMoltbookPublicFeedReader(
  fetchPosts: (limit: number) => Promise<MoltbookPublicPost[]> = fetchMoltbookPublicPosts,
  now: () => number = Date.now,
) {
  let cache: CachedFeed | null = null;
  let lastAttemptAt = 0;
  let inFlight: Promise<MoltbookPublicFeed> | null = null;

  return async function readMoltbookPublicFeed(): Promise<MoltbookPublicFeed> {
    const currentTime = now();
    if (cache && currentTime - cache.fetchedAt < CACHE_FRESH_MS) {
      return fromCache(cache, false);
    }
    if (inFlight) return inFlight;
    if (lastAttemptAt > 0 && currentTime - lastAttemptAt < RETRY_COOLDOWN_MS) {
      return cache ? fromCache(cache, true) : unavailable(false);
    }

    lastAttemptAt = currentTime;
    inFlight = fetchPosts(5)
      .then(posts => {
        cache = {
          posts,
          observedAt: new Date(now()).toISOString(),
          fetchedAt: now(),
        };
        return fromCache(cache, false);
      })
      .catch(() => cache ? fromCache(cache, true, true) : unavailable(true))
      .finally(() => {
        inFlight = null;
      });

    return inFlight;
  };
}

export const readMoltbookPublicFeed = createMoltbookPublicFeedReader();
