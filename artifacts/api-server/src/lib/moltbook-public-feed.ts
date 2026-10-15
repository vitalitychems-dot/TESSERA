import {
  classifyMoltbookFailure,
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
  failureCode: string | null;
}

interface CachedFeed {
  posts: MoltbookPublicPost[];
  observedAt: string;
  fetchedAt: number;
}

function unavailable(refreshFailed: boolean, failureCode: string | null = null): MoltbookPublicFeed {
  return {
    source: "Moltbook public feed",
    status: "unavailable",
    observedAt: null,
    stale: false,
    posts: [],
    refreshFailed,
    failureCode,
  };
}

function fromCache(
  cache: CachedFeed,
  stale: boolean,
  refreshFailed = false,
  failureCode: string | null = null,
): MoltbookPublicFeed {
  return {
    source: "Moltbook public feed",
    status: stale ? "stale" : "live",
    observedAt: cache.observedAt,
    stale,
    posts: cache.posts,
    refreshFailed,
    failureCode,
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
      .catch(error => {
        const failureCode = classifyMoltbookFailure(error);
        return cache
          ? fromCache(cache, true, true, failureCode)
          : unavailable(true, failureCode);
      })
      .finally(() => {
        inFlight = null;
      });

    return inFlight;
  };
}

export const readMoltbookPublicFeed = createMoltbookPublicFeedReader();
