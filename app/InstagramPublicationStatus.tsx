"use client";
import { useEffect, useState } from "react";
import { subscribeAllInstagramPublications, type InstagramPublication } from "../firebase/instagramPublishing";
import "./instagramPublicationStatus.css";
export const publicationFlags = {en: "🇺🇸", br: "🇧🇷", fr: "🇫🇷"};
export const publicationDate = (value: string) => new Date(value).toLocaleString("fr-FR", {day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit"});
export function useInstagramHistory() {
  const [items, setItems] = useState<InstagramPublication[]>([]);
  const [status, setStatus] = useState("loading");
  useEffect(() => subscribeAllInstagramPublications((next) => {setItems(next); setStatus("ready");}, () => setStatus("error")), []);
  return {items, status};
}
export function InstagramPublicationStatus({items, status}: {items: InstagramPublication[]; status: string}) {
  if (status !== "ready") return <span className="instagram-status-list">{status === "error" ? "Statut indisponible" : "Chargement…"}</span>;
  const published = (["en", "fr", "br"] as const).filter((account) => items.some((item) => item.account === account && item.status === "published"));
  if (!published.length) return <span className="instagram-status-list instagram-status-unpublished">Non publié</span>;
  return <span className="instagram-status-list"><span>Publié</span>{published.map((account) => <span className="instagram-status-flag" key={account} role="img" aria-label={account === "en" ? "International" : account === "br" ? "Brésil" : "France"}>{publicationFlags[account]}</span>)}</span>;
}
