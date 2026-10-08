import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { saveSubscriber } from "@/lib/store-api";
import { useCart } from "@/lib/cart-store";
import { knownPromo } from "@/lib/promo";

const KEY = "vs-welcome10";

export function WelcomePopup() {
  const setPromo = useCart((s) => s.setPromo);
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [done, setDone] = useState(false);

  useEffect(() => {
    const gated = () => document.documentElement.getAttribute("data-gate") === "ok";
    const openNow = () => {
      if (gated()) setOpen(true);
    };
    window.addEventListener("vs:open-welcome", openNow);
    let t = 0;
    try {
      if (!localStorage.getItem(KEY)) {
        t = window.setTimeout(() => {
          if (gated()) setOpen(true);
        }, 8000);
      }
    } catch {
      /* ignore */
    }
    return () => {
      window.removeEventListener("vs:open-welcome", openNow);
      if (t) window.clearTimeout(t);
    };
  }, []);

  const close = (persist = false) => {
    setOpen(false);
    if (persist) {
      try {
        localStorage.setItem(KEY, "1");
      } catch {
        /* ignore */
      }
    }
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.includes("@")) return;
    try {
      await saveSubscriber({ data: { email, name: "Welcome10", cadence: "list" } });
    } catch {
      /* still grant the code locally */
    }
    const promo = knownPromo("WELCOME10");
    if (promo) setPromo(promo);
    try {
      localStorage.setItem("vs-promo", "WELCOME10");
      localStorage.setItem(KEY, "1");
    } catch {
      /* ignore */
    }
    setDone(true);
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[75] flex items-end justify-center bg-bg/80 p-4 backdrop-blur-sm sm:items-center"
      onClick={() => close(true)}
      role="presentation"
    >
      <div
        className="relative grid w-full max-w-lg overflow-hidden rounded-lg border border-border bg-bg-elevated shadow-lift sm:max-w-2xl sm:grid-cols-[minmax(0,0.9fr)_1.1fr]"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-labelledby="welcome-title"
      >
        <button
          type="button"
          className="absolute top-2 right-2 z-20 flex h-11 w-11 items-center justify-center rounded-full bg-bg/80 text-fg hover:text-primary"
          onClick={() => close(true)}
          aria-label="Dismiss"
        >
          <X className="h-5 w-5" />
        </button>
        <div className="vial-stage hidden sm:block">
          <img
            src="/brand/popup-vial.jpg?v=9"
            alt="Vitality Supply research vial"
            className="h-full w-full object-contain object-center"
          />
        </div>
        <div className="p-6 sm:p-7">
          <img
            src="/brand/popup-vial.jpg?v=9"
            alt=""
            className="mx-auto mb-4 h-40 w-auto object-contain sm:hidden"
          />
          {done ? (
            <>
              <p className="font-mono text-xs tracking-widest text-primary uppercase">Applied</p>
              <h2
                id="welcome-title"
                className="font-display mt-2 text-2xl font-semibold tracking-wide uppercase"
              >
                10% off first order
              </h2>
              <p className="mt-3 text-sm leading-relaxed text-muted">
                <span className="text-primary">WELCOME10</span> is saved to your cart. 10% off your
                first laboratory order at checkout. Research use only — not for human consumption.
              </p>
              <button type="button" className="btn-primary mt-6 w-full" onClick={() => close(true)}>
                Continue to catalog
              </button>
            </>
          ) : (
            <>
              <p className="font-mono text-xs tracking-widest text-primary uppercase">
                First order · Subscribe
              </p>
              <h2
                id="welcome-title"
                className="font-display mt-2 text-2xl font-semibold tracking-wide uppercase"
              >
                10% off your first order
              </h2>
              <p className="mt-3 text-sm leading-relaxed text-muted">
                Join the laboratory list. We apply <span className="text-primary">WELCOME10</span>{" "}
                automatically at checkout.
              </p>
              <form onSubmit={submit} className="mt-5 flex flex-col gap-2">
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Lab email"
                  className="input-field"
                />
                <button type="submit" className="btn-primary w-full">
                  Get 10% off
                </button>
              </form>
              <button
                type="button"
                className="mt-3 min-h-10 text-xs text-faint hover:text-muted"
                onClick={() => close(true)}
              >
                No thanks
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
