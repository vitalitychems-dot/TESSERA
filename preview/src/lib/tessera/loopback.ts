/** A database address is allowed only on this machine. Anything else stays closed. */

export function loopbackOnly(url: string) {
  try {
    const host = new URL(url).hostname;
    return host === "localhost" || host === "127.0.0.1";
  } catch {
    return false;
  }
}
