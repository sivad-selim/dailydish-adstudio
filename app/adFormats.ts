import type { AdFormat } from "../firebase/postPages";

export const FORMAT_CONFIG: Record<AdFormat, {
  label: string; dimensions: string; width: number; height: number; exportName: string; destination: string;
}> = {
  portrait: {
    label: "Publication 4:5", dimensions: "1080 × 1350 px",
    width: 1080, height: 1350, exportName: "4x5", destination: "Instagram",
  },
  story: {
    label: "Publication 9:16", dimensions: "1080 × 1920 px",
    width: 1080, height: 1920, exportName: "9x16", destination: "Instagram · Google Play",
  },
  "app-store": {
    label: "App Store iPhone", dimensions: "1320 × 2868 px",
    width: 1320, height: 2868, exportName: "app-store-1320x2868", destination: "App Store iPhone",
  },
};
