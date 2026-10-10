import { MESH } from "@/lib/tessera/mesh-net";
import { type ViewId } from "@/lib/tessera/store";

export const ROOMS: { id: ViewId; group: string; label: string; line: string }[] = [
  { id: "chamber", group: "With her", label: "Talk", line: "Speak with her." },
  { id: "council", group: "With her", label: "Council", line: "The seats, in one room." },
  { id: "talk", group: "With her", label: "Agents", line: "Every named seat and the job it holds." },
  { id: "world", group: "With her", label: "World", line: "The neighborhood as it moves." },
  { id: "rick", group: "With her", label: "Rick", line: "The west chamber, the house, and a welcome." },
  { id: "brain", group: "Mind", label: "Brain", line: "What she is growing." },
  { id: "memory", group: "Mind", label: "Memory", line: "What she already holds." },
  { id: "library", group: "Mind", label: "Library", line: "The shelf she can open." },
  { id: "theme", group: "Mind", label: "Theme", line: "Water, fire, lightning, diamond, spiral." },
  { id: "language", group: "Mind", label: "Language", line: "How a line is kept." },
  { id: "bible", group: "Mind", label: "Bible", line: "The verses she keeps." },
  { id: "narrative", group: "Mind", label: "Narrative", line: "The story in her voice." },
  { id: "gitbook", group: "Books", label: "Gitbook", line: "The private notes." },
  { id: "gitbookai", group: "Books", label: "GitbookAI", line: `${MESH.projects.length} programs on the public mesh.` },
  { id: "board", group: "Books", label: "Board", line: "What is open, read again when you enter." },
  { id: "web", group: "Books", label: "Map", line: "Where a name lives." },
  { id: "code", group: "Work", label: "Code", line: "What she can run from here." },
  { id: "learn", group: "Work", label: "Practice", line: "A lesson she can seal." },
  { id: "secrets", group: "Work", label: "Closed", line: "What stays shut." },
];

export function RoomsSheet({ current, open, close }: { current: ViewId; open: (id: ViewId) => void; close: () => void }) {
  const groups = [...new Set(ROOMS.map((room) => room.group))];
  return (
    <div className="absolute inset-0 z-40 overflow-y-auto bg-bg px-4 pt-4 pb-28">
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-5">
        <div className="flex items-end justify-between gap-3">
          <div>
            <p className="text-xs tracking-[0.2em] text-muted uppercase">Rooms</p>
            <h2 className="font-display text-4xl tracking-tight">All of them</h2>
          </div>
          <button type="button" onClick={close} className="h-11 rounded-full border border-border px-4 text-sm text-fg">
            Close
          </button>
        </div>
        {groups.map((group) => (
          <section key={group}>
            <h3 className="text-xs tracking-[0.16em] text-subtle uppercase">{group}</h3>
            <ul className="mt-2 flex flex-col gap-2">
              {ROOMS.filter((room) => room.group === group).map((room) => {
                const on = room.id === current;
                return (
                  <li key={room.id}>
                    <button
                      type="button"
                      onClick={() => {
                        open(room.id);
                        close();
                      }}
                      className={
                        on
                          ? "flex min-h-14 w-full flex-col items-start justify-center border border-accent bg-surface px-4 py-3 text-left"
                          : "flex min-h-14 w-full flex-col items-start justify-center border border-border px-4 py-3 text-left"
                      }
                    >
                      <span className="font-display text-2xl text-fg">{room.label}</span>
                      <span className="text-sm text-muted">{room.line}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}
