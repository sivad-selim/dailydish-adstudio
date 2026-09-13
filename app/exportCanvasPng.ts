import { toBlob } from "html-to-image";
import { FORMAT_CONFIG } from "./adFormats";
import { toOpaquePng } from "./opaquePng";
import { getGalleryAssetDataUrl, type GalleryAsset } from "../firebase/gallery";
import type { AdFormat } from "../firebase/postPages";

const withTimeout = <Value,>(promise: Promise<Value>, milliseconds: number) =>
  new Promise<Value>((resolve, reject) => {
    const timeout = window.setTimeout(
      () => reject(new Error("L’export a dépassé le délai autorisé.")),
      milliseconds,
    );
    promise.then(
      (value) => {
        window.clearTimeout(timeout);
        resolve(value);
      },
      (error) => {
        window.clearTimeout(timeout);
        reject(error);
      },
    );
  });

export async function exportCanvasPng(canvas: HTMLDivElement, format: AdFormat, galleryAssets: GalleryAsset[]): Promise<Blob> {
  const originalImageSources = new Map<HTMLImageElement, string>();
  const originalVectorPaints: Array<{
    element: SVGElement;
    attribute: "fill" | "stroke" | "stop-color";
    value: string;
  }> = [];
  try {
    const targetFormat = FORMAT_CONFIG[format];
    await document.fonts.ready;

    const exportImageData = new Map<string, string>();
    const canvasAssetIds = Array.from(
      canvas.querySelectorAll<HTMLImageElement>(
        ".canvas-image[data-gallery-asset-id]",
      ),
    )
      .map((image) => image.dataset.galleryAssetId)
      .filter((assetId): assetId is string => Boolean(assetId));
    const exportAssets = galleryAssets.filter((asset) =>
      canvasAssetIds.includes(asset.id),
    );
    await Promise.all(
      exportAssets.map(async (asset) => {
        exportImageData.set(
          asset.id,
          await getGalleryAssetDataUrl(asset),
        );
      }),
    );
    const backgroundAssetId = canvas.querySelector<HTMLImageElement>(
      ".canvas-background-image[data-background-asset-id]",
    )?.dataset.backgroundAssetId;
    const selectedBackgroundAsset = galleryAssets.find((asset) => asset.id === backgroundAssetId);
    const backgroundDataUrl = selectedBackgroundAsset
      ? await getGalleryAssetDataUrl(selectedBackgroundAsset) : "";

    const dataUrls = [backgroundDataUrl, ...exportImageData.values()].filter(
      Boolean,
    );
    await Promise.all(
      dataUrls.map(
        (dataUrl) =>
          new Promise<void>((resolve, reject) => {
            const image = new window.Image();
            image.onload = () => resolve();
            image.onerror = () =>
              reject(new Error("Une image n’a pas pu être préparée."));
            image.src = dataUrl;
          }),
      ),
    );

    const backgroundImage = canvas.querySelector<HTMLImageElement>(
      ".canvas-background-image[data-background-asset-id]",
    );
    if (backgroundImage && backgroundDataUrl) {
      originalImageSources.set(backgroundImage, backgroundImage.src);
      backgroundImage.src = backgroundDataUrl;
    }
    canvas
      .querySelectorAll<HTMLImageElement>(
        ".canvas-image[data-gallery-asset-id]",
      )
      .forEach((image) => {
        const assetId = image.dataset.galleryAssetId;
        if (!assetId) return;
        const dataUrl = exportImageData.get(assetId);
        if (!dataUrl) return;
        originalImageSources.set(image, image.src);
        image.src = dataUrl;
      });
    await new Promise<void>((resolve) =>
      window.requestAnimationFrame(() => resolve()),
    );

    canvas
      .querySelectorAll<SVGElement>(
        ".background-vector [fill], .background-vector [stroke], .background-vector [stop-color]",
      )
      .forEach((element) => {
        (["fill", "stroke", "stop-color"] as const).forEach((attribute) => {
          const value = element.getAttribute(attribute);
          if (!value?.includes("var(")) return;

          const resolvedValue = window
            .getComputedStyle(element)
            .getPropertyValue(attribute)
            .trim();
          if (!resolvedValue) return;

          originalVectorPaints.push({ element, attribute, value });
          element.setAttribute(attribute, resolvedValue);
        });
      });

    const pngBlob = await withTimeout(
      toBlob(canvas, {
        backgroundColor: "#fffcf7",
        cacheBust: true,
        canvasHeight: targetFormat.height,
        canvasWidth: targetFormat.width,
        pixelRatio: 1,
        skipAutoScale: true,
      }),
      30_000,
    );
    if (!pngBlob) {
      throw new Error("Le navigateur n’a pas pu encoder l’image PNG.");
    }
    return await toOpaquePng(pngBlob);
  } finally {
    originalImageSources.forEach((source, image) => {
      image.src = source;
    });
    originalVectorPaints.forEach(({ element, attribute, value }) => {
      element.setAttribute(attribute, value);
    });
  }
}

