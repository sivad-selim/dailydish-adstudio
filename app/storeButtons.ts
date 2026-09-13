import type { GalleryAsset } from "../firebase/gallery";
import type { GalleryFolder } from "../firebase/galleryFolders";
import type { StoreButtonSettings } from "../firebase/postPageModel";

// Resolve the supplied gallery components once, then keep their stable IDs on the page.
export function resolveStoreButtonAssets(settings: StoreButtonSettings, assets: GalleryAsset[], folders: GalleryFolder[]) {
  const componentFolders = new Set(folders.filter((folder) => folder.name.trim().toLowerCase() === "components").map((folder) => folder.id));
  const find = (id: string, name: string) => assets.find((asset) => asset.id === id)
    ?? assets.find((asset) => componentFolders.has(asset.folderId ?? "") && asset.name.toLowerCase() === name);
  return {
    ios: find(settings.iosAssetId, "store_apple.png"),
    android: find(settings.androidAssetId, "store_google.png"),
  };
}
