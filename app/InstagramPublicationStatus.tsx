"use client";
import { useEffect, useState } from "react";
import { subscribeAllInstagramPublications, type InstagramPublication } from "../firebase/instagramPublishing";
import { subscribeAllFacebookPublications } from "../firebase/facebookPublishing";
import { SOCIAL_PLATFORMS, platformLabel } from "./socialPublicationModel";
import "./instagramPublicationStatus.css";
export const publicationFlags = {en: "🇺🇸", br: "🇧🇷", fr: "🇫🇷"};
export const publicationDate = (value: string) => new Date(value).toLocaleString("fr-FR", {day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit"});
export function useSocialHistory() {
  const [items, setItems] = useState<InstagramPublication[]>([]);
  const [status, setStatus] = useState("loading");
  useEffect(() => {
    const snapshots: Partial<Record<"instagram" | "facebook", InstagramPublication[]>> = {};
    const errors = new Set<string>();
    const receive = (platform: "instagram" | "facebook") => (next: InstagramPublication[]) => {
      snapshots[platform] = next.map((item) => ({...item, platform}));
      errors.delete(platform);
      if (snapshots.instagram && snapshots.facebook && !errors.size) {
        setItems([...snapshots.instagram, ...snapshots.facebook]); setStatus("ready");
      }
    };
    const fail = (platform: string) => () => { errors.add(platform); setStatus("error"); };
    const stops = [subscribeAllInstagramPublications(receive("instagram"), fail("instagram")), subscribeAllFacebookPublications(receive("facebook"), fail("facebook"))];
    return () => stops.forEach((stop) => stop());
  }, []);
  return {items, status};
}
export function InstagramPublicationStatus({items, status}: {items: InstagramPublication[]; status: string}) {
  if (status !== "ready") return <span className="instagram-status-list">{status === "error" ? "Statut indisponible" : "Chargement…"}</span>;
  const published = SOCIAL_PLATFORMS.map((platform) => ({platform, accounts: (["en", "fr", "br"] as const).filter((account) => items.some((item) => (item.platform ?? "instagram") === platform && item.account === account && item.status === "published"))})).filter(({accounts}) => accounts.length);
  if (!published.length) return <span className="instagram-status-list instagram-status-unpublished">Non publié</span>;
  return <span className="instagram-status-list"><span>Publié</span>{published.map(({platform, accounts}) => <span key={platform} className="instagram-status-list"><span>{platformLabel(platform)}</span>{accounts.map((account) => <span className="instagram-status-flag" key={account} role="img" aria-label={`${platformLabel(platform)} · ${account === "en" ? "International" : account === "br" ? "Brésil" : "France"}`}>{publicationFlags[account]}</span>)}</span>)}</span>;
}
