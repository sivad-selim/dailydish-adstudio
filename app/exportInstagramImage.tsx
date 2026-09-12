import { createRoot } from "react-dom/client";
import { flushSync } from "react-dom";
import type { CampaignLanguage } from "../firebase/campaigns";
import type { Creation } from "../firebase/creations";
import type { GalleryAsset } from "../firebase/gallery";
import { CreationCanvasPreview } from "./PostManager";
import { exportCanvasPng } from "./exportCanvasPng";

export async function exportInstagramImage(creation: Creation, language: CampaignLanguage, title: string, description: string, assets: GalleryAsset[]): Promise<Blob> {
  const host = document.createElement("div");
  host.style.cssText = "position:fixed;left:-20000px;top:0;pointer-events:none";
  host.setAttribute("aria-hidden", "true");
  document.body.appendChild(host);
  const root = createRoot(host);
  try {
    // Modal preparation can start in a React effect. Render the export outside
    // that commit so flushSync has actually populated the DOM before reading it.
    await new Promise<void>((resolve) => window.requestAnimationFrame(() => resolve()));
    flushSync(() => root.render(<CreationCanvasPreview creation={creation} campaignTitle={title} campaignDescription={description} galleryAssets={assets} language={language} previewWidth={827} showPlaceholder={false} />));
    const canvas = host.firstElementChild as HTMLDivElement;
    canvas.style.width = "827px";
    const png = await exportCanvasPng(canvas, creation.format, assets);
    const bitmap = await createImageBitmap(png);
    try {
      const output = document.createElement("canvas");
      output.width = 1080; output.height = 1350;
      const context = output.getContext("2d");
      if (!context) throw new Error("Impossible de préparer le JPEG.");
      context.fillStyle = "#fffcf7"; context.fillRect(0, 0, 1080, 1350);
      const scale = Math.min(1080 / bitmap.width, 1350 / bitmap.height);
      const width = Math.round(bitmap.width * scale), height = Math.round(bitmap.height * scale);
      context.drawImage(bitmap, Math.round((1080 - width) / 2), Math.round((1350 - height) / 2), width, height);
      const jpeg = await new Promise<Blob>((resolve, reject) => output.toBlob((blob) => blob ? resolve(blob) : reject(new Error("Encodage JPEG impossible.")), "image/jpeg", .94));
      if (jpeg.size > 8 * 1024 * 1024) throw new Error("Le visuel dépasse la limite de 8 Mo.");
      return jpeg;
    } finally { bitmap.close(); }
  } finally { root.unmount(); host.remove(); }
}
