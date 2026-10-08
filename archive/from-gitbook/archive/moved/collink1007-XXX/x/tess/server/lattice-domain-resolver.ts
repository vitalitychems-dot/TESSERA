const TESSERA_SOVEREIGN_DOMAIN = "tessera.sov";
const TESSERA_FALLBACK_HOST = process.env.PUBLISHED_APP_URL
  ? new URL(process.env.PUBLISHED_APP_URL).host
  : (process.env.REPLIT_DOMAINS?.split(",")[0] || "localhost:5000");

export const getSovereignDomain = () => TESSERA_FALLBACK_HOST;

export const getTesseraSovDomain = () => TESSERA_SOVEREIGN_DOMAIN;
export const getLatticeUrl = (path = "") => `https://${getSovereignDomain()}${path}`;
export const getExternalUrl = (path = "") => getLatticeUrl(path);
export const getSovereignProtocol = () => "tess";
export const getTessUri = (domain: string, path = "") => `tess://${domain}${path}`;
