/** Prints whether the database URL is loopback. It does not start a server and it does not print the URL. */

function loopback(url) {
  if (!url) return false;
  return url.includes("localhost") || url.includes("127.0.0.1");
}

const database = process.env.DATABASE_URL || "postgresql://localhost:5432/tessera_dev";
const api = process.env.TESSERA_API_PORT || "5000";
const studio = process.env.PORT || "4173";

console.log("Tessera mesh check");
console.log("ground #070b10 edge #7ef0d4 fracture #ff5c39 bone #f3efe6");
console.log(loopback(database) ? `database is loopback. api ${api}. studio ${studio}.` : "database is not loopback. api was not started.");
