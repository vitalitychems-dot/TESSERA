const SECRET = /SESSION_SECRET|BEGIN [A-Z ]*PRIVATE KEY|AKIA[0-9A-Z]{16}|ghp_[A-Za-z0-9]|github_pat_|xox[baprs]-|sk-[A-Za-z0-9]{10,}/;

export function gitbookNote(body: string) {
  return body.replace(SECRET, "[withheld]").replace(/\s+/g, " ").trim().slice(0, 280);
}
