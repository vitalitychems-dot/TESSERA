const MIN_TOKEN_LENGTH = 8;

function hashSimple(s: string): string {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (h << 5) - h + s.charCodeAt(i);
    h = h & h;
  }
  return Math.abs(h).toString(16).padStart(8, "0");
}

export function validateMeshToken(token: string | undefined | null): string | null {
  if (!token || token.trim().length < MIN_TOKEN_LENGTH) return null;
  return hashSimple(token.trim());
}
