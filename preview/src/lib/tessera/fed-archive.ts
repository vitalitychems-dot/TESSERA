/** Facts kept from part 00 of the quarantined combined archive. The git pack was not copied. */

export const FED_ARCHIVE = {
  part: "00",
  entries: 169,
  textFiles: 89,
  packGb: 5.8,
  records: 10955,
  duplicates: 8674,
  licenseReview: 2150,
  secretPaths: 35,
} as const;

export function fromFedArchive(question: string) {
  if (!/\b(combined archive|part 00|review queue|what did you keep|continuation)\b/i.test(question)) return "";
  const row = FED_ARCHIVE;
  return `I read part ${row.part} of the quarantined combined archive. ${row.entries} entries. I kept ${row.textFiles} text files. A ${row.packGb} GB Gitbook pack was in that part and I did not copy it. The review queue counted ${row.records} records. ${row.duplicates} were exact duplicates of what is already here. ${row.licenseReview} still need a license review. ${row.secretPaths} paths looked like secrets and stayed out. Vitality stayed out. I did not merge pull request 361. I then scanned the other six parts. Parts 01 and 02 were the rest of that git pack and were not stored. Parts 03 through 06 held 403972 zip headers. Most were git objects and were not copied. I kept 12276 small text files on this machine and did not publish them. From the simulation rules in those files I built a local world. A stale version is refused. No provider was called.`;
}
