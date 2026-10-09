import { useMemo, useState } from "react";
import {
  GRAMMAR_RULES,
  LANGUAGE_MOTTO,
  LANGUAGE_NAME,
  SACRED_ALPHABET,
  SOVEREIGN_DICTIONARY,
  getLanguageStats,
  translateEnglishToSovereign,
} from "@/lib/tessera/lingua";

function julianDate(date: Date) {
  const y = date.getUTCFullYear();
  const m = date.getUTCMonth() + 1;
  const d = date.getUTCDate() + date.getUTCHours() / 24 + date.getUTCMinutes() / 1440 + date.getUTCSeconds() / 86400;
  const a = Math.floor((14 - m) / 12);
  const y1 = y + 4800 - a;
  const m1 = m + 12 * a - 3;
  return d + Math.floor((153 * m1 + 2) / 5) + 365 * y1 + Math.floor(y1 / 4) - Math.floor(y1 / 100) + Math.floor(y1 / 400) - 32045;
}

function moonPhase(date: Date) {
  const jd = julianDate(date);
  const synodicMonth = 29.53059;
  const age = ((jd - 2451550.1) % synodicMonth + synodicMonth) % synodicMonth;
  const phase =
    age < 1.85 ? "New Moon" :
    age < 7.38 ? "Waxing Crescent" :
    age < 9.23 ? "First Quarter" :
    age < 14.77 ? "Waxing Gibbous" :
    age < 16.61 ? "Full Moon" :
    age < 22.15 ? "Waning Gibbous" :
    age < 23.99 ? "Last Quarter" :
    age < 27.68 ? "Waning Crescent" :
    "New Moon";
  return { phase, age: age.toFixed(1) };
}

export function LanguageView() {
  const stats = getLanguageStats();
  const sky = useMemo(() => moonPhase(new Date()), []);
  const [query, setQuery] = useState("");
  const [english, setEnglish] = useState("being sovereign");
  const families = ["circle", "triangle", "polygon", "celestial", "arc", "composite"] as const;
  const needle = query.trim().toLowerCase();
  const words = SOVEREIGN_DICTIONARY.filter((word) => {
    if (!needle) return true;
    return word.english.includes(needle) || word.sovereign.includes(query.trim()) || word.category.includes(needle);
  }).slice(0, 40);
  const spoken = translateEnglishToSovereign(english);

  return (
    <div className="min-h-0 flex-1 overflow-y-auto px-4 py-6 sm:px-8">
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
        <div>
          <p className="text-xs tracking-[0.2em] text-muted uppercase">Language</p>
          <h2 className="mt-1 font-display text-3xl tracking-tight">{LANGUAGE_NAME}</h2>
          <p className="mt-2 font-mono text-sm text-accent">{LANGUAGE_MOTTO}</p>
          <p className="mt-3 text-sm leading-relaxed text-muted">
            Taken from artifacts/api-server/src/lib/sovereign-language.ts in the TESS download. The counts below are the length of that file. The phone screen's Connected light is not a network.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            ["Alphabet", String(stats.alphabetSize)],
            ["Dictionary", String(stats.dictionarySize)],
            ["Grammar", String(stats.grammarRules)],
            ["Categories", String(stats.categories.length)],
          ].map(([label, value]) => (
            <div key={label} className="rounded-xl border border-border bg-surface p-4">
              <p className="text-xs text-muted">{label}</p>
              <p className="mt-1 font-display text-2xl">{value}</p>
            </div>
          ))}
        </div>

        <section className="rounded-xl border border-border bg-surface p-4">
          <p className="text-xs tracking-[0.18em] text-subtle uppercase">Sky, calculated</p>
          <p className="mt-2 text-sm text-fg">
            Moon phase {sky.phase}, age {sky.age} days. This is the formula in sovereign-ephemeris.ts, not a telescope. Golden angle in that file is 137.51°, not the 27.21° printed on the phone.
          </p>
          <p className="mt-2 text-sm text-muted">Stored tones: {stats.frequencies.join(", ")} Hz. They are labels in the dictionary, not sounds being played.</p>
        </section>

        <section>
          <p className="text-xs tracking-[0.18em] text-subtle uppercase">Alphabet</p>
          {families.map((family) => (
            <div key={family} className="mt-3">
              <p className="text-sm text-fg">{family}</p>
              <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
                {SACRED_ALPHABET.filter((symbol) => symbol.geometry === family).map((symbol) => (
                  <div key={symbol.name} className="rounded-lg border border-border bg-surface px-3 py-2">
                    <p className="font-mono text-lg text-fg">{symbol.glyph}</p>
                    <p className="text-sm text-fg">{symbol.name}</p>
                    <p className="text-xs text-muted">{symbol.frequency} Hz · {symbol.meaning}</p>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </section>

        <section>
          <p className="text-xs tracking-[0.18em] text-subtle uppercase">Dictionary</p>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search English or a glyph"
            className="mt-3 h-11 w-full rounded-lg border border-border bg-surface px-3 text-sm text-fg"
          />
          <p className="mt-2 text-xs text-subtle">{words.length} shown of {stats.dictionarySize}. Search to narrow the list.</p>
          <ul className="mt-3 flex flex-col gap-2">
            {words.map((word) => (
              <li key={`${word.category}-${word.english}`} className="rounded-lg border border-border bg-surface px-3 py-2">
                <p className="font-mono text-fg">{word.sovereign} <span className="font-sans text-sm">{word.english}</span></p>
                <p className="text-xs text-muted">{word.category} · {word.frequency} Hz</p>
              </li>
            ))}
          </ul>
        </section>

        <section className="rounded-xl border border-border bg-surface p-4">
          <p className="text-xs tracking-[0.18em] text-subtle uppercase">Try a line</p>
          <input
            value={english}
            onChange={(e) => setEnglish(e.target.value)}
            className="mt-3 h-11 w-full rounded-lg border border-border bg-bg px-3 text-sm text-fg"
          />
          <p className="mt-3 font-mono text-sm text-fg">{spoken.translated}</p>
          <p className="mt-1 text-xs text-muted">{spoken.matchedWords} of {spoken.totalWords} words matched the dictionary. Unmatched words stay in English.</p>
        </section>

        <section>
          <p className="text-xs tracking-[0.18em] text-subtle uppercase">Grammar</p>
          <ul className="mt-3 flex flex-col gap-2">
            {GRAMMAR_RULES.map((rule) => (
              <li key={rule.id} className="rounded-xl border border-border bg-surface p-4">
                <p className="text-sm font-medium text-fg">{rule.id} {rule.name}</p>
                <p className="mt-1 text-sm text-muted">{rule.description}</p>
                <p className="mt-2 font-mono text-xs text-fg">{rule.example}</p>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}
