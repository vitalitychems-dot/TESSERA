/** Local world rules taken from the archived simulation gateway. No provider and no network. */

export type World = { id: string; title: string; version: number; mode: "home" | "chat"; events: string[] };

export function createWorlds() {
  const worlds: World[] = [];
  let next = 1;
  return {
    create(title: string) {
      const name = title.trim().slice(0, 80);
      if (!name) throw new Error("empty prompt");
      if (worlds.length >= 10) throw new Error("world limit");
      const world: World = { id: `w${next++}`, title: name, version: 1, mode: "home", events: [name] };
      worlds.push(world);
      return world;
    },
    advance(id: string, expectedVersion: number, note: string) {
      const world = worlds.find((item) => item.id === id);
      if (!world) throw new Error("missing");
      if (world.version !== expectedVersion) throw new Error("stale");
      if (world.mode !== "home") throw new Error("not home");
      world.version += 1;
      world.events.push(note.trim().slice(0, 80));
      return world;
    },
    enterChat(id: string, expectedVersion: number) {
      const world = worlds.find((item) => item.id === id);
      if (!world) throw new Error("missing");
      if (world.version !== expectedVersion) throw new Error("stale");
      world.mode = "chat";
      world.version += 1;
      return world;
    },
    list() {
      return worlds.map((world) => ({ ...world, events: [...world.events] }));
    },
  };
}
