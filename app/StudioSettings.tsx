"use client";

import { InstagramConnection } from "./InstagramConnection";
import "./studioSettings.css";

export function StudioSettings() {
  return <section className="studio-settings publication-calendar" aria-label="Réglages">
    <header className="planner-heading"><div><h2>Réglages</h2><p>Gère les connexions de l’Ad Studio.</p></div></header>
    <InstagramConnection />
  </section>;
}
