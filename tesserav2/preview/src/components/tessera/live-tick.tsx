import { useEffect, useState } from "react";
import { tickReward } from "@/lib/tessera/reward-tick";

/** A timer. The value changes. She does not gain a skill from it. */

export function LiveTick() {
  const [value, setValue] = useState(0);
  const [gain, setGain] = useState(0);
  const [steps, setSteps] = useState(0);

  useEffect(() => {
    const id = window.setInterval(() => {
      setValue((current) => {
        const next = tickReward(current);
        setGain(next.gain);
        setSteps((count) => count + 1);
        return next.value;
      });
    }, 1000);
    return () => window.clearInterval(id);
  }, []);

  return (
    <section className="border border-accent/40 bg-bg px-4 py-3">
      <p className="text-xs tracking-[0.16em] text-muted uppercase">Timer</p>
      <p className="mt-1 font-display text-3xl tracking-tight">{value.toFixed(3)}</p>
      <p className="mt-1 text-sm text-fg">
        This step added {gain.toFixed(3)}. Steps {steps}. This is a clock on a formula. It is not learning.
      </p>
    </section>
  );
}
