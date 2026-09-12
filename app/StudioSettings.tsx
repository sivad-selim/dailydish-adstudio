"use client";
import { PageHeader } from "./components";

import { InstagramConnection } from "./InstagramConnection";
import "./studioSettings.css";

export function StudioSettings() {
  return <section className="studio-settings publication-calendar" aria-label="Réglages">
    <PageHeader title="Réglages" description="Gère les connexions de l’Ad Studio." />
    <InstagramConnection />
  </section>;
}
