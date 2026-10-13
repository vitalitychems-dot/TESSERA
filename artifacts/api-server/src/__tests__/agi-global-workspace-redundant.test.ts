import { describe, it, expect } from "vitest";
import { publish } from "../lib/agi/agent-bus";
import { broadcastWinnerWithReport, lastBroadcastReport, subscribeWorkspace } from "../lib/agi/global-workspace";

const N = 5;
let seq = 0;

describe("W-state redundant broadcast with delivery count (#10)", () => {
  it("baseline: all N recipients receive the winner, delivered === N", () => {
    const got: number[] = [];
    const offs = Array.from({ length: N }, (_, i) => subscribeWorkspace(() => { got.push(i); }));
    publish("t", `w-base-${seq++}`, { v: `baseline ${seq}` }, 100);
    const r = broadcastWinnerWithReport();
    offs.forEach((o) => o());
    expect(r.winner).not.toBeNull();
    expect(r).toMatchObject({ attempted: N, delivered: N, failed: 0 });
    expect(got.sort()).toEqual([0, 1, 2, 3, 4]);
    expect(lastBroadcastReport().delivered).toBe(N);
  });

  for (let drop = 0; drop < N; drop++) {
    it(`recipient ${drop} throws: the other ${N - 1} still get the winner`, () => {
      const got: number[] = [];
      const offs = Array.from({ length: N }, (_, i) =>
        subscribeWorkspace(() => { if (i === drop) throw new Error("lost photon"); got.push(i); }));
      publish("t", `w-throw-${drop}-${seq++}`, { v: `throw case ${drop} ${seq}` }, 100);
      const r = broadcastWinnerWithReport();
      offs.forEach((o) => o());
      expect(r).toMatchObject({ attempted: N, delivered: N - 1, failed: 1 });
      expect(got.sort()).toEqual([0, 1, 2, 3, 4].filter((i) => i !== drop));
    });

    it(`recipient ${drop} unsubscribes a peer mid-broadcast: snapshot still delivers to all`, () => {
      const got: number[] = [];
      const offs: Array<() => void> = [];
      for (let i = 0; i < N; i++) {
        offs.push(subscribeWorkspace(() => {
          got.push(i);
          if (i === drop) offs[(drop + 1) % N]();
        }));
      }
      publish("t", `w-unsub-${drop}-${seq++}`, { v: `unsub case ${drop} ${seq}` }, 100);
      const r = broadcastWinnerWithReport();
      offs.forEach((o) => o());
      expect(r.delivered).toBe(N);
      expect(got.length).toBe(N);
    });
  }
});
