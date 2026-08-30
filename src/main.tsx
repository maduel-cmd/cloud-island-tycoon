import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import { simulation } from "./managers/Simulation";
import "./index.css";

/** חשיפה ל־QA / Playwright בלבד */
declare global {
  interface Window {
    __CIT_SIM__?: typeof simulation;
  }
}
if (typeof window !== "undefined") {
  window.__CIT_SIM__ = simulation;
}

const root = document.getElementById("root");
if (!root) throw new Error("root missing");

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

/** רישום SW להתקנה כ־PWA (אייקון במסך הבית / אפליקציית שולחן) */
if (typeof window !== "undefined" && "serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(() => {
      /* התקנה אופציונלית — לא חוסם משחק */
    });
  });
}
