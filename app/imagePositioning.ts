import { FORMAT_CONFIG } from "./adFormats";
import type { AdFormat, PageLayout } from "../firebase/postPages";

export type FormatChangeAnchor = "top" | "center" | "bottom";

const halfHeight = (format: AdFormat) =>
  50 * FORMAT_CONFIG[format].height / FORMAT_CONFIG[format].width;

export function centerLegacyImages(properties: PageLayout, format: AdFormat): PageLayout {
  if (properties.imagePositionVersion === 1 && properties.images.every((image) => Number.isInteger(image.y))) return properties;
  // Previous coordinates used the 9:16 midpoint at a fixed distance from the bottom.
  const offset = properties.imagePositionVersion === 1 ? 0 : halfHeight(format) - halfHeight("story");
  return {
    ...properties,
    imagePositionVersion: 1,
    images: properties.images.map((image) => ({ ...image, y: Math.round(image.y + offset) })),
  };
}

export function changeImageFormat(properties: PageLayout, from: AdFormat, to: AdFormat, anchor: FormatChangeAnchor = "center"): PageLayout {
  const centered = centerLegacyImages(properties, from);
  const delta = halfHeight(to) - halfHeight(from);
  const offset = anchor === "top" ? -delta
    : anchor === "bottom" ? delta : 0;
  return {
    ...centered,
    images: centered.images.map((image) => ({ ...image, y: Math.round(image.y + offset) })),
  };
}
