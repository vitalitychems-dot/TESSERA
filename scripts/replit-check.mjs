/** Checks the public launch page. It cannot reopen a dead Replit shell. */

const url = "https://tessera-launch.replit.app/";
const response = await fetch(url, { redirect: "follow" });
const health = await fetch(url + "api/health", { redirect: "manual" });
console.log(`page ${response.status}`);
console.log(`health ${health.status}`);
if (response.status !== 200) {
  console.log("The public page did not answer 200.");
  process.exit(1);
}
console.log("The public page is up.");
console.log("A Session terminated screen is the shell. This script does not reopen it.");
console.log("Open the Repl and start a new shell. A code loop will not keep that shell alive.");
