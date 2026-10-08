import { useEffect, type ReactNode } from "react";
import { RUO_SHORT } from "@/lib/legal";

export const GATE_KEY = "vitality-research-gate";

/** Runs in <head> before paint. Returning visitors skip the overlay; first tap never waits on React. */
export const GATE_BOOT = `(function(){
  var k=${JSON.stringify(GATE_KEY)};
  function pass(){
    document.documentElement.setAttribute("data-gate","ok");
    var g=document.getElementById("ruo-gate");
    if(g){ g.setAttribute("hidden",""); g.setAttribute("inert",""); }
  }
  try {
    var p=location.pathname||"";
    if(p.indexOf("/login")===0||p.indexOf("/admin")===0||p.indexOf("/account")===0){
      pass();
      return;
    }
    if(localStorage.getItem(k)==="ok") pass();
  } catch(e) {}
  function node(ev){
    var t=ev.target;
    if(t && t.nodeType===3) t=t.parentNode;
    return t && t.closest ? t : null;
  }
  function go(ev){
    var t=node(ev);
    if(!t) return;
    if(!t.closest("#ruo-enter") && !t.closest("#ruo-gate .ruo-enter")) return;
    ev.preventDefault();
    ev.stopPropagation();
    try { localStorage.setItem(k,"ok"); } catch(e) {}
    pass();
  }
  document.addEventListener("pointerdown", go, true);
  document.addEventListener("click", go, true);
  document.addEventListener("touchend", go, true);
})();`;

function enterCatalog() {
  try {
    localStorage.setItem(GATE_KEY, "ok");
  } catch {
    /* ignore */
  }
  document.documentElement.setAttribute("data-gate", "ok");
  const g = document.getElementById("ruo-gate");
  if (g) {
    g.setAttribute("hidden", "");
    g.setAttribute("inert", "");
  }
}

export function AgeGate({ children }: { children: ReactNode }) {
  useEffect(() => {
    try {
      const path = location.pathname || "";
      if (
        localStorage.getItem(GATE_KEY) === "ok" ||
        path.startsWith("/login") ||
        path.startsWith("/admin") ||
        path.startsWith("/account")
      ) {
        enterCatalog();
      }
    } catch {
      /* ignore */
    }
  }, []);

  return (
    <>
      {children}
      <div
        id="ruo-gate"
        role="dialog"
        aria-modal="true"
        aria-labelledby="ruo-title"
        className="ruo-gate"
      >
        <div className="ruo-gate-inner">
          <img
            src="/brand/logo.png"
            alt=""
            className="h-14 w-14 object-contain"
            width={56}
            height={56}
          />
          <p className="mt-5 font-mono text-xs tracking-widest text-primary uppercase">
            Restricted catalog
          </p>
          <h1
            id="ruo-title"
            className="font-display mt-2 text-center text-3xl font-semibold tracking-wide uppercase sm:text-4xl"
          >
            Research use only
          </h1>
          <button type="button" id="ruo-enter" className="ruo-enter" onClick={enterCatalog}>
            I am 21+ · Enter catalog
          </button>
          <p className="mt-5 max-w-md text-center text-sm leading-relaxed text-muted">{RUO_SHORT}</p>
          <p className="mt-3 max-w-md text-center text-xs leading-relaxed text-faint">
            You must be 21 or older. Entering confirms you are a qualified researcher buying solely
            for laboratory work — not for human or animal use.
          </p>
        </div>
      </div>
    </>
  );
}
