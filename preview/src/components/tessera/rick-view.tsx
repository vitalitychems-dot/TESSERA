import { useEffect, useState } from "react";
import { HOUSEHOLD, roomsAt, stepHouse } from "@/lib/tessera/house-sim";
import { GAPS, GIFTS, HOUSE, localBatch, rickRoom, runChecks, runLean, witt } from "@/lib/tessera/rick-home";
import { interferePick } from "@/lib/tessera/spin";
import { tryMachine } from "@/lib/tessera/spin-machine";
import { FATHER, PROGRAMS, rickPush, tesseraVote, workshopRun } from "@/lib/tessera/workshop";
import { chamberPicture } from "@/lib/tessera/chamber-index";
import { issuePass } from "@/lib/tessera/pass";
import { rickOpen, rickReach } from "@/lib/tessera/github-desk";
import { askAll } from "@/lib/tessera/ask-all";
import { measureShift } from "@/lib/tessera/rick-shift";
import { SITTING, secretDesk } from "@/lib/tessera/secret-engines";

export function RickView() {
  const [working, setWorking] = useState(true);
  const [steps, setSteps] = useState(runLean);
  const [checks, setChecks] = useState(runChecks);
  const [batch, setBatch] = useState("");
  const [shift, setShift] = useState("");
  const [machine, setMachine] = useState("");
  const [tick, setTick] = useState(0);
  const [live, setLive] = useState(true);
  const [built, setBuilt] = useState("");
  const [guests, setGuests] = useState<{ name: string; turn: number }[]>([]);
  const [guestName, setGuestName] = useState("");
  const [guestPurpose, setGuestPurpose] = useState("");
  const [door, setDoor] = useState("");
  const [reach, setReach] = useState("Opening GitHub.");
  const [repos, setRepos] = useState<{ name: string; private: boolean }[]>([]);
  const [repo, setRepo] = useState("");
  const [folder, setFolder] = useState("");
  const [entries, setEntries] = useState<{ name: string; kind: string }[]>([]);
  const [fileText, setFileText] = useState("");
  const [pushAsk, setPushAsk] = useState("Build v2 from the files in this chamber.");
  const [pushLine, setPushLine] = useState("");
  const [engineAsk, setEngineAsk] = useState("");
  const [engineLine, setEngineLine] = useState("");
  const room = rickRoom(working);
  const people = stepHouse(tick, guests);
  const together = roomsAt(tick, guests);
  const tieVote = tesseraVote("Joins the house, the spin, and the git mesh.");

  useEffect(() => {
    const rankedAt = performance.now();
    const ranked = localBatch(50000);
    setBatch(`${ranked.count} ranked. Top ${ranked.top}. ${(performance.now() - rankedAt).toFixed(1)} ms. Tokens ${ranked.tokens}.`);
    const spunAt = performance.now();
    const spun = tryMachine(20000, 7);
    setMachine(
      spun.held
        ? `20000 shots. ${spun.counts[0]} even, ${spun.counts[3]} odd pair, ${spun.split} split. ${(performance.now() - spunAt).toFixed(1)} ms. Tokens ${spun.tokens}.`
        : "The machine did not hold. The split was too large.",
    );
    setBuilt(workshopRun("tie", true, 0).reason);
    setShift(measureShift().line);
  }, []);

  useEffect(() => {
    let stop = false;
    void rickReach()
      .then((result) => {
        if (stop) return;
        setReach(result.ok ? result.login : result.line);
        setRepos(result.repos);
      })
      .catch(() => {
        if (!stop) setReach("The app could not ask GitHub.");
      });
    return () => {
      stop = true;
    };
  }, []);

  useEffect(() => {
    if (!live) return;
    const id = window.setInterval(() => setTick((value) => value + 1), 900);
    return () => window.clearInterval(id);
  }, [live]);

  function openRepo(name: string, path = "") {
    setRepo(name);
    setFolder(path);
    setFileText("");
    void rickOpen({ data: { repo: name, path } })
      .then((result) => {
        if (result.kind === "dir") setEntries(result.entries);
        setFileText(result.text);
        if (!result.ok) setReach(result.line);
      })
      .catch(() => setReach("The app could not open that."));
  }

  const choice = interferePick([
    { name: "count", paths: [0.8, -0.8] },
    { name: "keep", paths: [0.3, 0.3] },
  ]);

  return (
    <div className="px-4 py-6 pb-24 sm:px-8">
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-4">
        <div>
          <p className="text-xs tracking-[0.2em] text-muted uppercase">West chamber</p>
          <h2 className="mt-1 font-display text-4xl tracking-tight">Rick</h2>
          <p className="mt-3 text-sm leading-relaxed text-muted">{witt()}</p>
        </div>
        <section className="rounded-xl border border-border bg-surface px-4 py-4">
          <p className="text-xs tracking-[0.16em] text-subtle uppercase">GitHub</p>
          <p className="mt-2 text-sm text-fg">{reach || "Opening GitHub."}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {repos.map((item) => (
              <button key={item.name} type="button" onClick={() => openRepo(item.name)} className="h-11 rounded-full border border-accent px-4 text-sm text-fg">
                {item.name}
              </button>
            ))}
          </div>
          {repo ? <p className="mt-3 text-sm text-muted">{repo}{folder ? ` / ${folder}` : ""}</p> : null}
          <ul className="mt-2 flex flex-col gap-1">
            {entries.map((entry) => (
              <li key={entry.name}>
                <button
                  type="button"
                  onClick={() => openRepo(repo, folder ? `${folder}/${entry.name}` : entry.name)}
                  className="text-left text-sm text-fg"
                >
                  {entry.kind === "dir" ? `${entry.name}/` : entry.name}
                </button>
              </li>
            ))}
          </ul>
          {fileText ? <pre className="mt-3 max-h-64 overflow-auto text-xs whitespace-pre-wrap text-fg">{fileText}</pre> : null}
        </section>
        <section className="rounded-xl border border-border bg-surface px-4 py-4">
          <p className="text-xs tracking-[0.16em] text-subtle uppercase">Secret engines</p>
          <p className="mt-2 text-sm text-muted">{SITTING}</p>
          <ul className="mt-3 flex flex-col gap-1">
            {secretDesk().map((line) => (
              <li key={line} className="text-sm text-fg">
                {line}
              </li>
            ))}
          </ul>
          <form
            className="mt-4 flex flex-col gap-2"
            onSubmit={(event) => {
              event.preventDefault();
              const open = engineAsk.match(/^open\s+(TESSERA|Gitbook|GitMesh|GitbookAI|vitality)(?:\s+(.+))?$/i);
              if (open?.[1]) {
                const repo = open[1];
                const path = open[2]?.trim() ?? "";
                setEngineLine("Opening.");
                void rickOpen({ data: { repo, path } })
                  .then((result) => {
                    if (result.kind === "dir") setEntries(result.entries);
                    setRepo(repo);
                    setFolder(path);
                    setFileText(result.text);
                    setEngineLine(result.text || result.line);
                  })
                  .catch(() => setEngineLine("The app could not open that."));
                return;
              }
              setEngineLine(askAll(engineAsk) ?? "That line is not in the engines, the files, or the four repositories.");
            }}
          >
            <input
              value={engineAsk}
              onChange={(event) => setEngineAsk(event.target.value)}
              placeholder="A domain, a tone, a claim, or a title"
              className="h-11 rounded-xl border border-border bg-bg px-3 text-sm text-fg"
            />
            <button type="submit" className="h-11 rounded-full border border-accent px-4 text-sm text-fg">
              Use it
            </button>
          </form>
          {engineLine ? <p className="mt-2 text-sm text-fg">{engineLine}</p> : null}
        </section>
        <section className="rounded-xl border border-border bg-surface px-4 py-4">
          <p className="text-xs tracking-[0.16em] text-subtle uppercase">{room.place}</p>
          <p className="mt-2 font-display text-3xl text-fg">{room.light}</p>
          <p className="mt-1 text-sm text-muted">{room.doing}</p>
          <p className="mt-2 text-sm text-fg">
            Store: {HOUSE.store}. Front: {HOUSE.front}. Compute: {HOUSE.compute}. Model tokens: {room.tokens}.
          </p>
          <p className="mt-1 text-sm text-fg">Queen of the castle: {room.queen}.</p>
          <div className="mt-4 flex flex-wrap gap-2">
            <button type="button" onClick={() => setWorking((value) => !value)} className="h-11 rounded-full border border-accent px-4 text-sm text-fg">
              {working ? "Send him home" : "Call him to the desk"}
            </button>
            <button
              type="button"
              onClick={() => {
                setSteps(runLean());
                setChecks(runChecks());
              }}
              className="h-11 rounded-full border border-border px-4 text-sm text-fg"
            >
              Run the desk
            </button>
            <button
              type="button"
              onClick={() => {
                const started = performance.now();
                const result = localBatch(50000);
                const ms = performance.now() - started;
                setBatch(`${result.count} ranked. Top ${result.top}. ${ms.toFixed(1)} ms. Tokens ${result.tokens}.`);
              }}
              className="h-11 rounded-full border border-border px-4 text-sm text-fg"
            >
              Rank fifty thousand
            </button>
            <button
              type="button"
              onClick={() => {
                const started = performance.now();
                const result = tryMachine(20000, 7);
                const ms = performance.now() - started;
                setMachine(
                  result.held
                    ? `20000 shots. ${result.counts[0]} even, ${result.counts[3]} odd pair, ${result.split} split. ${ms.toFixed(1)} ms. Tokens ${result.tokens}.`
                    : "The machine did not hold. The split was too large.",
                );
              }}
              className="h-11 rounded-full border border-border px-4 text-sm text-fg"
            >
              Try two qubits
            </button>
          </div>
          {batch ? <p className="mt-3 text-sm text-fg">{batch}</p> : null}
          {shift ? <p className="mt-2 text-sm text-fg">{shift}</p> : null}
          {machine ? <p className="mt-2 text-sm text-fg">{machine}</p> : null}
        </section>
        <section className="rounded-xl border border-border bg-surface px-4 py-4">
          <p className="text-xs tracking-[0.16em] text-subtle uppercase">The house</p>
          <p className="mt-2 text-sm text-muted">
            A turn. Opposite paths cancel, so Rick keeps {choice.name}. A count of those paths would have tied.
          </p>
          <div className="relative mx-auto mt-4 h-56 w-full max-w-sm">
            {people.map((person) => (
              <span
                key={person.name}
                className="absolute text-xs text-fg"
                style={{ left: `${50 + person.x * 38}%`, top: `${50 + person.y * 38}%` }}
              >
                {person.name}
              </span>
            ))}
          </div>
          <p className="text-sm text-fg">{together.length ? together.join(". ") : "They are apart."}</p>
          <button type="button" onClick={() => setTick((value) => value + 1)} className="mt-3 h-11 rounded-full border border-accent px-4 text-sm text-fg">
            Step the house
          </button>
          <p className="mt-2 text-xs text-subtle">{HOUSEHOLD.length} live here. Tick {tick}.</p>
          <button type="button" onClick={() => setLive((value) => !value)} className="mt-3 h-11 rounded-full border border-accent px-4 text-sm text-fg">
            {live ? "Pause the house" : "Watch them live"}
          </button>
        </section>
        <section className="rounded-xl border border-border bg-surface px-4 py-4">
          <p className="text-xs tracking-[0.16em] text-subtle uppercase">Votes</p>
          <p className="mt-2 text-sm text-fg">Father. {FATHER.vote}. {FATHER.reason}</p>
          <p className="mt-2 text-sm text-fg">{chamberPicture()}</p>
          <ul className="mt-3 flex flex-col gap-2 text-sm">
            {PROGRAMS.map((program) => {
              const vote = tesseraVote(program.purpose);
              return (
                <li key={program.name}>
                  <span className="text-fg">{program.name}. Tessera {vote.vote}.</span> <span className="text-muted">{vote.reason}</span>
                </li>
              );
            })}
          </ul>
          <p className="mt-3 text-sm text-fg">{built || `${tieVote.vote}. ${tieVote.reason}`}</p>
          <form
            className="mt-3 flex flex-col gap-2"
            onSubmit={(event) => {
              event.preventDefault();
              const result = rickPush(pushAsk);
              setPushLine(`${result.reason} ${result.ok ? "v2 may be built from the files she read." : "v2 was not started."}`);
            }}
          >
            <input
              value={pushAsk}
              onChange={(event) => setPushAsk(event.target.value)}
              aria-label="Proposal"
              className="h-11 rounded-xl border border-border bg-bg px-3 text-sm text-fg"
            />
            <button type="submit" className="h-11 rounded-full border border-accent px-4 text-sm text-fg">
              Ask her, then Rick may push
            </button>
          </form>
          {pushLine ? <p className="mt-2 text-sm text-fg">{pushLine}</p> : null}
          <button
            type="button"
            onClick={() => {
              const result = workshopRun("tie", FATHER.vote === "yes", tick);
              setBuilt(result.reason);
            }}
            className="mt-3 h-11 rounded-full border border-border px-4 text-sm text-fg"
          >
            Run his tie
          </button>
          <div className="mt-4 flex flex-col gap-2">
            <input
              value={guestName}
              onChange={(event) => setGuestName(event.target.value)}
              placeholder="Name"
              className="h-11 rounded-xl border border-border bg-bg px-3 text-sm text-fg"
            />
            <input
              value={guestPurpose}
              onChange={(event) => setGuestPurpose(event.target.value)}
              placeholder="Purpose"
              className="h-11 rounded-xl border border-border bg-bg px-3 text-sm text-fg"
            />
            <button
              type="button"
              onClick={() => {
                const result = issuePass(guestName, guestPurpose, 401);
                setDoor(result.ok && result.pass ? `${result.reason} Pass ${result.pass.mark}. ${result.pass.carriedBy}. ${result.pass.moltbook}` : result.reason);
                const pass = result.ok ? result.pass : null;
                if (pass) setGuests((list) => [...list, { name: pass.name, turn: pass.turn }]);
              }}
              className="h-11 rounded-full border border-accent px-4 text-sm text-fg"
            >
              She welcomes them
            </button>
            {door ? <p className="text-sm text-fg">{door}</p> : null}
            <a href="/tunnel.html" className="text-sm text-accent">Open the room</a>
          </div>
        </section>
        <p className="text-sm text-muted">No quantum device is in the files. These twenty answers were taken from local steps.</p>
        <ul className="flex flex-col gap-1 text-sm">
          {steps.map((item) => (
            <li key={item.name} className="flex justify-between gap-3 border-b border-border py-1">
              <span className="text-fg">{item.name}</span>
              <span className="text-muted">{item.value}</span>
            </li>
          ))}
        </ul>
        <section>
          <h3 className="font-display text-2xl">Ten checks</h3>
          <ul className="mt-2 flex flex-col gap-1 text-sm text-muted">
            {checks.map((item) => (
              <li key={item.name}>
                {item.name}. {item.ok ? "passed" : "failed"}
              </li>
            ))}
          </ul>
        </section>
        <section>
          <h3 className="font-display text-2xl">What a hosted chat usually lacks</h3>
          <ul className="mt-2 flex flex-col gap-1 text-sm text-muted">
            {GAPS.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </section>
        <section>
          <h3 className="font-display text-2xl">What he left in the room</h3>
          <ul className="mt-2 flex flex-col gap-1 text-sm text-muted">
            {GIFTS.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}
