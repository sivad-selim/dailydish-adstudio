import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "../app/globals.css";
import { AuthGate } from "./AuthGate";
import "../app/components/studio.css";

const root = document.getElementById("root");

if (!root) {
  throw new Error("Le point de montage de DailyDish Ad Studio est introuvable.");
}

createRoot(root).render(
  <StrictMode>
    <AuthGate />
  </StrictMode>,
);
