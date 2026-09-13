"use client";
import { useEffect, useState } from "react";
import type { GalleryAsset } from "../firebase/gallery";
import { subscribeToGalleryFolders, type GalleryFolder } from "../firebase/galleryFolders";
import type { StoreButtonSettings } from "../firebase/postPageModel";
import { SegmentedControl } from "./components";
import { SectionHeading } from "./SectionHeading";
import { resolveStoreButtonAssets } from "./storeButtons";

export function StoreButtonsControls({ value, assets, loading, onChange }: {
  value: StoreButtonSettings;
  assets: GalleryAsset[];
  loading: boolean;
  onChange: (settings: StoreButtonSettings) => void;
}) {
  const [folders, setFolders] = useState<GalleryFolder[] | null>(null);
  const [error, setError] = useState("");
  useEffect(() => subscribeToGalleryFolders((items) => { setFolders(items); setError(""); },
    () => setError("Impossible de lire le dossier Components.")), []);
  const { ios, android } = resolveStoreButtonAssets(value, assets, folders ?? []);
  const available = Boolean(ios && android);
  const pending = loading || (!folders && !error);
  return <section className="property-section store-buttons-section">
    <SectionHeading className="compact"><h2>Boutons</h2></SectionHeading>
    <label className="toggle-row property-section-first-control">
      <strong>Afficher les boutons</strong>
      <input type="checkbox" checked={value.enabled} disabled={!value.enabled && !available}
        onChange={(event) => onChange({ ...value, enabled: event.target.checked,
          iosAssetId: ios?.id ?? value.iosAssetId, androidAssetId: android?.id ?? value.androidAssetId })} />
    </label>
    {!available && <p className="image-language-note" role={pending ? "status" : "alert"}>
      {pending ? "Chargement des boutons…" : error || "Ajoute store_apple.png et store_google.png dans Galerie → Components."}
    </p>}
    {value.enabled && <>
      <SegmentedControl label="Disposition des boutons" value={value.direction} stretch
        options={[{ id: "row", label: "Côte à côte" }, { id: "column", label: "Empilés" }]}
        onChange={(direction) => onChange({ ...value, direction })} />
      <label className="property-control" htmlFor="store-buttons-size">
        <strong>Taille</strong><output htmlFor="store-buttons-size">{value.scale}%</output>
        <input id="store-buttons-size" type="range" min="25" max="150" step="1" value={value.scale}
          onChange={(event) => onChange({ ...value, scale: Number(event.target.value) })} />
      </label>
      <label className="property-control" htmlFor="store-buttons-margin">
        <strong>Marge depuis le bas</strong><output htmlFor="store-buttons-margin">{value.bottomMargin}%</output>
        <input id="store-buttons-margin" type="range" min="0" max="80" step="1" value={value.bottomMargin}
          onChange={(event) => onChange({ ...value, bottomMargin: Number(event.target.value) })} />
      </label>
    </>}
  </section>;
}
