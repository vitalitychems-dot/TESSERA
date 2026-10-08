import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import { applyTheme } from "./lib/theme-constants";

applyTheme(localStorage.getItem("tessera-accent") || "cyan");

function removePlatformBadge() {
  const selectors = [
    '[data-sovereign-feedback]',
    'div[class*="platform-badge"]',
    'div[class*="platform-lite-badge"]',
    '#platform-badge',
    '.platform-badge',
    'a[href*="tessera.ai/refer"]',
  ];
  selectors.forEach(sel => {
    document.querySelectorAll(sel).forEach(el => el.remove());
  });
}

setTimeout(() => removePlatformBadge(), 2000);

if ("serviceWorker" in navigator) {
  navigator.serviceWorker.getRegistrations().then(registrations => {
    registrations.forEach(reg => {
      if (reg.active) {
        reg.active.postMessage("FORCE_UPDATE");
      }
      reg.update();
    });
  });
  navigator.serviceWorker.register("/sw.js").then(reg => {
    if (reg.active) {
      reg.active.postMessage("PREFETCH_CRITICAL");
      reg.active.postMessage("SOVEREIGN_SCRUB");
    }
    reg.addEventListener("updatefound", () => {
      const newWorker = reg.installing;
      if (newWorker) {
        newWorker.addEventListener("statechange", () => {
          if (newWorker.state === "activated") {
            newWorker.postMessage("PREFETCH_CRITICAL");
          }
        });
      }
    });
  }).catch(() => {});

  navigator.serviceWorker.addEventListener("message", (event) => {
    if (event.data?.type === "LATTICE_OFFLINE_QUEUE") {
      const entry = event.data.entry;
      try {
        const existing = JSON.parse(localStorage.getItem("tessera-offline-queue") || "[]");
        existing.push(entry);
        localStorage.setItem("tessera-offline-queue", JSON.stringify(existing));
      } catch {}
    }
  });

  window.addEventListener("online", () => {
    try {
      const queue = JSON.parse(localStorage.getItem("tessera-offline-queue") || "[]");
      if (queue.length > 0) {
        queue.forEach((entry: any) => {
          fetch(entry.url, {
            method: entry.method,
            body: entry.body,
            headers: { "Content-Type": "application/json" },
          }).catch(() => {});
        });
        localStorage.removeItem("tessera-offline-queue");
      }
    } catch {}
    navigator.serviceWorker.ready.then(reg => {
      reg.active?.postMessage("LATTICE_SYNC");
    });
  });
}

declare global {
  interface Window {
    tesseraPWAPrompt: any;
    tesseraPWAInstalled: boolean;
  }
}

window.tesseraPWAInstalled = window.matchMedia("(display-mode: standalone)").matches
  || (navigator as any).standalone === true;

window.addEventListener("beforeinstallprompt", (e: Event) => {
  e.preventDefault();
  window.tesseraPWAPrompt = e;
  window.dispatchEvent(new CustomEvent("tessera-install-ready"));
});

window.addEventListener("appinstalled", () => {
  window.tesseraPWAInstalled = true;
  window.tesseraPWAPrompt = null;
  window.dispatchEvent(new CustomEvent("tessera-installed"));
});

createRoot(document.getElementById("root")!).render(<App />);
