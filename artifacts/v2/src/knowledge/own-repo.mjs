const OWNER = "vitalitychems-dot";

export function ownRepoUrl(fullName) {
  if (typeof fullName !== "string") return null;
  const parts = fullName.split("/");
  if (parts.length !== 2 || parts[0] !== OWNER || !parts[1] || parts[1] === "." || parts[1] === "..") return null;
  return `https://api.github.com/repos/${parts[0]}/${parts[1]}`;
}

/** GitHub metadata for vitalitychems-dot repositories only. Other owners never hit the network. */
export async function fetchOwnRepo(fullName, fetchFn) {
  const url = ownRepoUrl(fullName);
  if (!url) return { ok: false, reason: "owner refused" };
  const response = await fetchFn(url);
  if (!response.ok) return { ok: false, reason: `github ${response.status}` };
  const body = await response.json();
  return {
    ok: true,
    url,
    fullName: body.full_name,
    description: body.description ?? "",
  };
}
