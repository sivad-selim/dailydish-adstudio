import type { GalleryAsset } from "../firebase/gallery";

type GalleryAssetVisualProps = {
  asset: GalleryAsset;
  alt?: string;
};

export function GalleryAssetVisual({
  asset,
  alt = "",
}: GalleryAssetVisualProps) {
  return <img src={asset.url} alt={alt} />;
}
