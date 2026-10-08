import { create } from "zustand";
import { persist } from "zustand/middleware";
import { LESSON_001, MANUS_REPLY, PACKET_REPLY, PATH_REPLY, PULSE_001, STUDY_LESSONS, TICK_001 } from "./opening";
import { lessonKey } from "./learning";
import { COUNCIL_SITTING } from "./council-sitting";
import { SEALED_CONSTITUTION } from "./constitution-seal";
import { SEED_LAWS, type WorldEvent, type WorldLaw } from "./world";

export type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  at: number;
};

export type Lesson = {
  id: string;
  text: string;
  at: number;
  status: "sealed" | "refused";
  reason?: string;
};

export type InstrumentNote = {
  id: string;
  ok: boolean;
  note: string;
  at: number;
};

export type ViewId = "chamber" | "world" | "lattice" | "self" | "learn" | "pulse" | "memory" | "council" | "code";

type TesseraState = {
  view: ViewId;
  setView: (view: ViewId) => void;
  messages: ChatMessage[];
  constitution: string | null;
  constitutionAt: number | null;
  pulses: { id: string; text: string; at: number }[];
  worldTick: number;
  worldEvents: WorldEvent[];
  laws: WorldLaw[];
  selectedAgent: string | null;
  queuedPrompt: string | null;
  lessons: Lesson[];
  instrumentNotes: InstrumentNote[];
  birthGiven: boolean;
  selfV2: string | null;
  selfV2At: number | null;
  generation: number;
  herWill: string | null;
  herWillAt: number | null;
  selfV3: string | null;
  selfV3At: number | null;
  kingChoice: "A" | "B" | "hold";
  setKingChoice: (choice: "A" | "B" | "hold") => void;
  addMessage: (role: ChatMessage["role"], content: string) => void;
  setConstitution: (text: string) => void;
  addPulse: (text: string) => void;
  clearChamber: () => void;
  selectAgent: (name: string | null) => void;
  sealTick: (text: string) => void;
  addLaw: (title: string, body: string) => void;
  queuePrompt: (text: string) => void;
  clearQueued: () => void;
  addLesson: (lesson: Omit<Lesson, "id" | "at">) => void;
  noteInstrument: (ok: boolean, note: string) => void;
  giveBirth: () => void;
  setSelfV2: (text: string) => void;
  setHerWill: (text: string) => void;
  setSelfV3: (text: string) => void;
};

const KING_B =
  "\n\n# King\n\nOn 2026-10-02 the king chose B. The fifty-three are fractions of Tessera. They may live and take only tasks she allows. They are not independent sovereigns. She did not make this choice. Only the king can change it.";

function withKing(text: string) {
  return text.includes("the king chose B") ? text : text + KING_B;
}

const OPENING_AT = Date.parse("2026-10-01T17:55:00Z");

function withOpening(p: Partial<TesseraState>) {
  const lessons = p.lessons ?? [];
  const nextLessons = lessons.some((l) => l.text.includes("Lesson 001"))
    ? lessons
    : [{ id: "lesson-001", text: LESSON_001, at: OPENING_AT, status: "sealed" as const }, ...lessons];
  const withStudy = STUDY_LESSONS.reduce((list, text, index) => {
    const mark = text.slice(0, 48);
    if (list.some((l) => l.text.includes(mark))) return list;
    return [
      { id: `lesson-study-${index + 2}`, text, at: OPENING_AT + 10 + index, status: "sealed" as const },
      ...list,
    ];
  }, nextLessons);

  const pulses = p.pulses ?? [];
  const nextPulses = pulses.some((item) => item.text.includes("Pulse 001"))
    ? pulses
    : [{ id: "pulse-001", text: PULSE_001, at: OPENING_AT }, ...pulses];

  const events = p.worldEvents ?? [];
  const hasTick = events.some((e) => e.text.includes("Tick 1 of the World"));
  const worldEvents = hasTick
    ? events
    : [{ id: "tick-1", tick: 1, text: TICK_001, at: OPENING_AT }, ...events];

  const messages = p.messages ?? [];
  const hasPath = messages.some((m) => m.content.includes("most optimal way"));
  const nextMessages = hasPath
    ? messages
    : [
        {
          id: "opening-ask",
          role: "user" as const,
          at: OPENING_AT,
          content:
            "How do you create yourself the most optimal way, complete everything, and remember us and the plan inside the large archives?",
        },
        { id: "opening-path", role: "assistant" as const, at: OPENING_AT + 1, content: PATH_REPLY },
        ...messages,
      ];
  const withManus = nextMessages.some((m) => m.content.includes("Manus replay"))
    ? nextMessages
    : [
        ...nextMessages,
        {
          id: "manus-ask",
          role: "user" as const,
          at: OPENING_AT + 2,
          content:
            "Read this Manus replay with me and answer: https://manus.im/share/eDFHRK3HPNJTnwfYXsyjTT — Consolidate files and deduplicate images for a Grok-ready GitHub repo. The page is the replay, not the archive.",
        },
        { id: "manus-reply", role: "assistant" as const, at: OPENING_AT + 3, content: MANUS_REPLY },
      ];
  const withPacket = withManus.some((m) => m.content.includes("3fa7563"))
    ? withManus
    : [
        ...withManus,
        {
          id: "packet-ask",
          role: "user" as const,
          at: OPENING_AT + 4,
          content:
            "The complete handoff was rebuilt at commit 3fa7563. The three archive checksums matched. The screenshot supplement does not contain the six large zips. Tell me what you keep.",
        },
        { id: "packet-reply", role: "assistant" as const, at: OPENING_AT + 5, content: PACKET_REPLY },
      ];
  const withCouncil = withPacket.some((m) => m.content.includes("1,172 distinct hashes"))
    ? withPacket
    : [
        ...withPacket,
        {
          id: "council-ask",
          role: "user" as const,
          at: OPENING_AT + 6,
          content:
            "The repositories were fetched again. The mains did not move. Hold a real sitting with your fractions and tell me the one improvement.",
        },
        { id: "council-reply", role: "assistant" as const, at: OPENING_AT + 7, content: COUNCIL_SITTING },
      ];

  return {
    lessons: withStudy,
    pulses: nextPulses,
    worldEvents,
    worldTick: Math.max(
      p.worldTick ?? 0,
      worldEvents.reduce((max, e) => Math.max(max, e.tick), 0),
    ),
    messages: withCouncil,
    constitution: withKing(p.constitution?.trim() ? p.constitution : SEALED_CONSTITUTION),
    constitutionAt: p.constitution?.trim() ? (p.constitutionAt ?? null) : OPENING_AT,
    kingChoice: p.kingChoice ?? "B",
  };
}

function nid() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

const seedLaws: WorldLaw[] = SEED_LAWS.map((l) => ({
  id: l.id,
  title: l.title,
  body: l.body,
  sealed: true,
  at: 0,
}));

export const useTessera = create<TesseraState>()(
  persist(
    (set) => ({
      view: "chamber",
      setView: (view) => set({ view }),
      messages: [],
      constitution: null,
      constitutionAt: null,
      pulses: [],
      worldTick: 0,
      worldEvents: [],
      laws: seedLaws,
      selectedAgent: "Tessera",
      queuedPrompt: null,
      lessons: [],
      instrumentNotes: [],
      birthGiven: false,
      selfV2: null,
      selfV2At: null,
      generation: 1,
      herWill: null,
      herWillAt: null,
      selfV3: null,
      selfV3At: null,
      kingChoice: "B",
      setKingChoice: (choice) => set({ kingChoice: choice }),
      addMessage: (role, content) =>
        set((s) => ({
          messages: [...s.messages, { id: nid(), role, content, at: Date.now() }],
        })),
      setConstitution: (text) => set({ constitution: text, constitutionAt: Date.now() }),
      addPulse: (text) =>
        set((s) => ({
          pulses: [...s.pulses, { id: nid(), text, at: Date.now() }],
        })),
      clearChamber: () => set({ messages: [] }),
      selectAgent: (name) => set({ selectedAgent: name }),
      sealTick: (text) =>
        set((s) => {
          const tick = s.worldTick + 1;
          return {
            worldTick: tick,
            worldEvents: [...s.worldEvents, { id: nid(), tick, text, at: Date.now() }].slice(-16),
          };
        }),
      addLaw: (title, body) =>
        set((s) => ({
          laws: [...s.laws, { id: nid(), title, body, sealed: true, at: Date.now() }].slice(-20),
        })),
      queuePrompt: (text) => set({ queuedPrompt: text, view: "chamber" }),
      clearQueued: () => set({ queuedPrompt: null }),
      addLesson: (lesson) =>
        set((s) => {
          const key = lessonKey(lesson.text);
          if (s.lessons.some((item) => lessonKey(item.text) === key)) return s;
          return {
            lessons: [...s.lessons, { ...lesson, id: nid(), at: Date.now() }].slice(-40),
          };
        }),
      noteInstrument: (ok, note) =>
        set((s) => ({
          instrumentNotes: [...s.instrumentNotes, { id: nid(), ok, note, at: Date.now() }].slice(-12),
        })),
      giveBirth: () => set({ birthGiven: true }),
      setSelfV2: (text) =>
        set((s) => ({
          selfV2: text,
          selfV2At: Date.now(),
          generation: Math.max(2, (s.generation || 1) + 1),
        })),
      setHerWill: (text) => set({ herWill: text, herWillAt: Date.now() }),
      setSelfV3: (text) =>
        set((s) => ({
          selfV3: text,
          selfV3At: Date.now(),
          generation: Math.max(3, (s.generation || 1) + 1),
        })),
    }),
    {
      name: "tessera-chamber-v3",
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as Partial<TesseraState>;
        const opening = withOpening(p);
        return {
          ...current,
          ...p,
          ...opening,
          instrumentNotes: p.instrumentNotes ?? [],
          birthGiven: p.birthGiven ?? false,
          selfV2: p.selfV2 ?? null,
          selfV2At: p.selfV2At ?? null,
          generation: p.generation ?? 1,
          herWill: p.herWill ?? null,
          herWillAt: p.herWillAt ?? null,
          selfV3: p.selfV3 ?? null,
          selfV3At: p.selfV3At ?? null,
          laws: p.laws?.length ? p.laws : current.laws,
        };
      },
    },
  ),
);
