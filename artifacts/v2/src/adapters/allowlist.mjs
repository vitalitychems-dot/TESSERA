/** Public no-login hosts. Cookie import stays off. See NOTICE for the MIT adapter idea. */
export const ALLOWED_HOSTS = ["hn.algolia.com"];

export function importCookies() {
  throw new Error("cookie import is disabled");
}

function refused(url) {
  if (/login|signin|sign-in|oauth|cookie/i.test(`${url.pathname}${url.search}`)) return "login refused";
  if (!ALLOWED_HOSTS.includes(url.host)) return "host refused";
  return "";
}

export async function searchAllowlist(urlString, fetchFn) {
  const url = new URL(urlString);
  const reason = refused(url);
  if (reason) return { ok: false, reason };
  const response = await fetchFn(url.toString(), { headers: { accept: "application/json" } });
  const body = await response.json();
  const hits = Array.isArray(body.hits)
    ? body.hits.map((hit) => ({ title: String(hit.title ?? ""), url: String(hit.url ?? "") }))
    : [];
  return { ok: true, hits };
}
