import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import { applyTheme } from "./lib/theme-constants";

let savedAccent = "glass";
try { savedAccent = localStorage.getItem("tessera-accent") || "glass"; } catch { /* Paint without browser storage. */ }
applyTheme(savedAccent);

createRoot(document.getElementById("root")!).render(<App />);
