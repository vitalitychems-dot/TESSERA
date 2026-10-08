export const getSovereignDomain = () => process.env.REPLIT_DOMAINS?.split(",")[0] || "localhost:5000";
export const getLatticeUrl = (path = "") => `https://${getSovereignDomain()}${path}`;
export const getExternalUrl = (path = "") => getLatticeUrl(path);
export const getSovereignProtocol = () => "https";
