import type { CSSProperties } from "react";
import type { GalleryAsset } from "../firebase/gallery";
import type { StoreButtonSettings } from "../firebase/postPageModel";

export function StoreButtonsPreview({ settings, assets }: { settings: StoreButtonSettings; assets: GalleryAsset[] }) {
  if (!settings.enabled) return null;
  const buttons = [
    { id: settings.iosAssetId, label: "App Store" },
    { id: settings.androidAssetId, label: "Google Play" },
  ].map((button) => ({ ...button, asset: assets.find((asset) => asset.id === button.id) }));
  const missing = buttons.some((button) => !button.asset);
  return <div className="canvas-store-buttons" data-missing-store-buttons={missing || undefined}
    style={{ flexDirection: settings.direction, bottom: `${settings.bottomMargin}%`,
      "--store-button-width": `${38.4 * settings.scale / 100}cqw` } as CSSProperties}>
    {buttons.map(({ label, asset }) => asset
      ? <img key={label} className="canvas-image store-button-image" src={asset.url} data-gallery-asset-id={asset.id} alt={label} draggable={false} />
      : <span key={label} className="store-button-placeholder">{label} indisponible</span>)}
  </div>;
}
