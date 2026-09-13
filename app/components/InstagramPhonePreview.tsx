import type { CSSProperties, ReactNode } from "react";
import { InstagramGuides } from "./InstagramGuides";

// Manufacturer resolution and pixel density define relative physical screen sizes.
// These are rectangular screen bounds, not chassis sizes or OS logical viewports.
// https://store.google.com/product/pixel_10_pro_specs
// https://support.apple.com/111876
// https://support.apple.com/111866
// https://support.apple.com/121032
export const PREVIEW_PHONES = {
  "pixel-10-pro-xl": { label: 'Pixel 10 Pro XL · 6,8″', width: 1344, height: 2992, ppi: 486 },
  "pixel-10-pro": { label: 'Pixel 10 Pro · 6,3″', width: 1280, height: 2856, ppi: 495 },
  "iphone-12": { label: 'iPhone 12 · 6,1″', width: 1170, height: 2532, ppi: 460 },
  "iphone-se": { label: 'iPhone SE (2022) · 4,7″', width: 750, height: 1334, ppi: 326 },
  "iphone-16-pro-max": { label: 'iPhone 16 Pro Max · 6,9″', width: 1320, height: 2868, ppi: 460 },
} as const;
const widestScreenInches = Math.max(...Object.values(PREVIEW_PHONES).map(device => device.width / device.ppi));
export type PreviewPhone = keyof typeof PREVIEW_PHONES;

export function phonePreviewSize(phone: PreviewPhone, previewWidth: number, imageWidth: number, imageHeight: number) {
  const device = PREVIEW_PHONES[phone];
  // Use one physical scale across devices instead of stretching each to the same width.
  const scale = previewWidth / widestScreenInches;
  const width = scale * device.width / device.ppi;
  const height = scale * device.height / device.ppi;
  return { width, height, imageWidth: Math.min(width, height * imageWidth / imageHeight) };
}

/** The artwork keeps its own export root. The phone and UI are siblings around it. */
export function InstagramPhonePreview({ enabled, phone, previewWidth, imageWidth, imageHeight, showAdButton, children }: {
  enabled: boolean;
  phone: PreviewPhone;
  previewWidth: number;
  imageWidth: number;
  imageHeight: number;
  showAdButton: boolean;
  children: (width: number) => ReactNode;
}) {
  if (!enabled) return <>{children(previewWidth)}</>;
  const size = phonePreviewSize(phone, previewWidth, imageWidth, imageHeight);
  return <div className="instagram-phone-preview" style={{
    width: size.width,
    height: size.height,
    "--instagram-ui-scale": (PREVIEW_PHONES["iphone-12"].width / PREVIEW_PHONES["iphone-12"].ppi) / (PREVIEW_PHONES[phone].width / PREVIEW_PHONES[phone].ppi),
  } as CSSProperties}>
    <div className="instagram-phone-artwork">{children(size.imageWidth)}</div>
    <InstagramGuides showAdButton={showAdButton} />
  </div>;
}
