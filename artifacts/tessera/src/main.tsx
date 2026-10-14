import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import { applyTheme, DEFAULT_ACCENT } from "./lib/theme-constants";

let savedAccent = DEFAULT_ACCENT;
try {
  savedAccent = localStorage.getItem("tessera-accent") || DEFAULT_ACCENT;
} catch {
  // Storage can be blocked in privacy-constrained browser contexts.
}
applyTheme(savedAccent);

createRoot(document.getElementById("root")!).render(<App />);
