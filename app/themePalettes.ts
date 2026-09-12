import type { CSSProperties } from "react";
import type {
  AdTheme,
  BackgroundColorSettings,
  TextColorSelection,
  TextColorSettings,
  TextColorTone,
} from "../firebase/creations";
import {
  CAPTURED_THEME_PALETTES,
  type CapturedThemePalette,
} from "./themePalettes.data";

export type ThemeOption = {
  id: AdTheme;
  label: string;
  colors?: string[];
};

type ThemeStyle = CSSProperties & Record<`--theme-${string}`, string>;

const capturedById = new Map(
  CAPTURED_THEME_PALETTES.map((palette) => [palette.id, palette]),
);

const STATIC_THEME_COLORS: Record<string, string[]> = {
  dailydish: ["#fffcf7", "#dcebd8", "#c5ddbf", "#e4d5f0", "#eaf5ff"],
  lavender: ["#fffcf7", "#ecf5ea", "#e4d5f0", "#eaf5ff", "#f3d6c9"],
  paprika: ["#fff8f3", "#f4c4b2", "#e6a28d", "#dce8d6", "#f2dfb8"],
  lemon: ["#fffdf2", "#f4e9a9", "#ded38a", "#d9cae8", "#d9e8d4"],
  blueberry: ["#fbf9ff", "#dcd3ec", "#c7ceea", "#f0d6da", "#d6e7db"],
  rose: ["#fffafa", "#f2d3d9", "#e5b9c5", "#d9e8d4", "#e5dcf0"],
  lagoon: ["#f8fcfb", "#cfe7e2", "#aad9d2", "#f2d1c4", "#e5d9ed"],
  vanilla: ["#fffcf4", "#f1e3bc", "#ebc9a8", "#d9e7d4", "#ddd1e9"],
  fig: ["#fffafb", "#dcc6df", "#c9ddbf", "#f1d0c4", "#f3e7b9"],
  apricot: ["#fff9f3", "#f3c6a5", "#f7ddb7", "#cddfeb", "#d6e3c7"],
  mint: ["#f9fefb", "#c6e3d3", "#d9caea", "#f0cfd8", "#f2e3b4"],
  cocoa: ["#fffaf7", "#dec6b4", "#ebc8d1", "#c9dccb", "#d9d0e8"],
  "coral-jade": ["#fff9f5", "#f5bfae", "#a8d7c5", "#f5dea4", "#c9c6e8"],
  "saffron-indigo": ["#fffaf0", "#f3d27b", "#b8c4e8", "#b8ddd5", "#efb9aa"],
  "plum-lime": ["#fcf9f6", "#d8afd1", "#dce994", "#9fd7d2", "#f4c2a3"],
  "ocean-mandarin": ["#f7fbfa", "#a9d8e5", "#f4b58e", "#ead184", "#c9d9b6"],
  "mono-rose": ["#fff1f7", "#fbcfe8", "#f9a8d4", "#f472b6", "#db2777"],
  "mono-red": ["#fff4f4", "#fecaca", "#fca5a5", "#f87171", "#dc2626"],
  "mono-orange": ["#fff7ed", "#fed7aa", "#fdba74", "#fb923c", "#ea580c"],
  "mono-amber": ["#fffbeb", "#fde68a", "#fcd34d", "#fbbf24", "#d97706"],
  "mono-yellow": ["#fffde8", "#fef9c3", "#fef08a", "#fde047", "#ca8a04"],
  "mono-lime": ["#f7fee7", "#d9f99d", "#bef264", "#a3e635", "#65a30d"],
  "mono-green": ["#ffffff", "#ecf5ea", "#d4e8d2", "#82d477", "#206a1d"],
  "mono-emerald": ["#ecfdf5", "#a7f3d0", "#6ee7b7", "#34d399", "#059669"],
  "mono-teal": ["#f0fdfa", "#99f6e4", "#5eead4", "#2dd4bf", "#0d9488"],
  "mono-cyan": ["#ecfeff", "#a5f3fc", "#67e8f9", "#22d3ee", "#0891b2"],
  "mono-sky": ["#f0f9ff", "#bae6fd", "#7dd3fc", "#38bdf8", "#0284c7"],
  "mono-cobalt": ["#eff6ff", "#bfdbfe", "#93c5fd", "#3b82f6", "#1d4ed8"],
  "mono-indigo": ["#eef2ff", "#c7d2fe", "#a5b4fc", "#818cf8", "#4f46e5"],
  "mono-violet": ["#f5f3ff", "#ddd6fe", "#c4b5fd", "#a78bfa", "#7c3aed"],
  "mono-purple": ["#faf5ff", "#e9d5ff", "#d8b4fe", "#c084fc", "#9333ea"],
  "mono-fuchsia": ["#fdf4ff", "#f5d0fe", "#f0abfc", "#e879f9", "#c026d3"],
};

const parseHex = (hex: string) => {
  const value = hex.replace("#", "");
  return {
    red: Number.parseInt(value.slice(0, 2), 16),
    green: Number.parseInt(value.slice(2, 4), 16),
    blue: Number.parseInt(value.slice(4, 6), 16),
  };
};

const clamp = (value: number, minimum = 0, maximum = 1) =>
  Math.min(Math.max(value, minimum), maximum);

const toHex = (value: number) =>
  Math.round(clamp(value) * 255)
    .toString(16)
    .padStart(2, "0");

const toLinear = (value: number) =>
  value <= 0.04045
    ? value / 12.92
    : ((value + 0.055) / 1.055) ** 2.4;

const toSrgb = (value: number) =>
  value <= 0.0031308
    ? 12.92 * value
    : 1.055 * value ** (1 / 2.4) - 0.055;

const hexToOklch = (hex: string) => {
  const { red, green, blue } = parseHex(hex);
  const r = toLinear(red / 255);
  const g = toLinear(green / 255);
  const b = toLinear(blue / 255);
  const l = 0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b;
  const m = 0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b;
  const s = 0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b;
  const lRoot = Math.cbrt(l);
  const mRoot = Math.cbrt(m);
  const sRoot = Math.cbrt(s);
  const lightness =
    0.2104542553 * lRoot +
    0.793617785 * mRoot -
    0.0040720468 * sRoot;
  const a =
    1.9779984951 * lRoot -
    2.428592205 * mRoot +
    0.4505937099 * sRoot;
  const labB =
    0.0259040371 * lRoot +
    0.7827717662 * mRoot -
    0.808675766 * sRoot;
  return {
    lightness,
    chroma: Math.sqrt(a * a + labB * labB),
    hue: Math.atan2(labB, a),
  };
};

const oklchToHex = (lightness: number, chroma: number, hue: number) => {
  const a = chroma * Math.cos(hue);
  const labB = chroma * Math.sin(hue);
  const lRoot = lightness + 0.3963377774 * a + 0.2158037573 * labB;
  const mRoot = lightness - 0.1055613458 * a - 0.0638541728 * labB;
  const sRoot = lightness - 0.0894841775 * a - 1.291485548 * labB;
  const l = lRoot ** 3;
  const m = mRoot ** 3;
  const s = sRoot ** 3;
  const red = toSrgb(
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
  );
  const green = toSrgb(
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
  );
  const blue = toSrgb(
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  );
  return `#${toHex(red)}${toHex(green)}${toHex(blue)}`;
};

const luminance = (hex: string) => {
  const { red, green, blue } = parseHex(hex);
  const channel = (value: number) => {
    const normalized = value / 255;
    return normalized <= 0.04045
      ? normalized / 12.92
      : ((normalized + 0.055) / 1.055) ** 2.4;
  };
  return (
    0.2126 * channel(red) +
    0.7152 * channel(green) +
    0.0722 * channel(blue)
  );
};

const rgba = (hex: string, alpha: number) => {
  const { red, green, blue } = parseHex(hex);
  return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
};

export const isDarkColor = (hex: string) => luminance(hex) < 0.34;

export const getTextColorValue = ({
  color,
  tone,
}: TextColorSelection): string => {
  if (!color || tone === "original") return color;
  const { lightness, chroma, hue } = hexToOklch(color);
  const nextLightness =
    tone === "light"
      ? lightness + (1 - lightness) * 0.68
      : lightness * 0.52;
  const nextChroma = chroma * (tone === "light" ? 0.72 : 0.92);
  return oklchToHex(nextLightness, nextChroma, hue);
};

const buildThemeStyle = (palette: CapturedThemePalette): ThemeStyle => {
  const colors = palette.colors.length ? palette.colors : ["#fffcf7"];
  const base = colors[0];
  const decorationColors = colors.length > 1 ? colors.slice(1) : colors;
  const textTone: TextColorTone = isDarkColor(base) ? "light" : "dark";
  const title = getTextColorValue({
    color: decorationColors[0],
    tone: textTone,
  });
  const copy = getTextColorValue({
    color: decorationColors[1] ?? decorationColors[0],
    tone: textTone,
  });
  const assistant = getTextColorValue({
    color: decorationColors[2] ?? decorationColors[0],
    tone: textTone,
  });
  const lightest = [...colors].sort(
    (left, right) => luminance(right) - luminance(left),
  )[0];

  return {
    "--theme-base": base,
    "--theme-bg-1": decorationColors[0],
    "--theme-bg-2": decorationColors[1 % decorationColors.length],
    "--theme-bg-3": decorationColors[2 % decorationColors.length],
    "--theme-bg-4": decorationColors[3 % decorationColors.length],
    "--theme-shade": getTextColorValue({ color: base, tone: "dark" }),
    "--theme-title": title,
    "--theme-copy": copy,
    "--theme-primary": assistant,
    "--theme-border": rgba(title, 0.45),
    "--theme-label-bg": rgba(base, 0.9),
    "--theme-wash": rgba(lightest, palette.category === "pop" ? 0.78 : 0.68),
    "--theme-on-dark-title": title,
    "--theme-on-dark-copy": copy,
    "--theme-on-dark-assistant": assistant,
  };
};

export const CAPTURED_PASTEL_THEMES: ThemeOption[] =
  CAPTURED_THEME_PALETTES.filter(
    (palette) => palette.category === "pastel",
  ).map(({ id, label, colors }) => ({ id, label, colors }));

export const CAPTURED_POP_THEMES: ThemeOption[] = CAPTURED_THEME_PALETTES.filter(
  (palette) => palette.category === "pop",
).map(({ id, label, colors }) => ({ id, label, colors }));

export const CAPTURED_MONOCHOLOR_THEMES: ThemeOption[] =
  CAPTURED_THEME_PALETTES.filter(
    (palette) => palette.category === "monocolor",
  ).map(({ id, label, colors }) => ({ id, label, colors }));

export const getThemeStyle = (themeId: AdTheme): ThemeStyle | undefined => {
  const palette = capturedById.get(themeId);
  if (palette) return buildThemeStyle(palette);
  const colors = STATIC_THEME_COLORS[themeId];
  return colors
    ? buildThemeStyle({
        id: themeId,
        label: themeId,
        category: "pastel",
        colors,
      })
    : undefined;
};

export const getThemePaletteColors = (themeId: AdTheme): string[] => {
  const captured = capturedById.get(themeId);
  return captured?.colors ?? STATIC_THEME_COLORS[themeId] ?? [];
};

export const getDefaultBackgroundColors = (
  themeId: AdTheme,
  shapeCount: number,
): BackgroundColorSettings => {
  const palette = getThemePaletteColors(themeId);
  const colors = palette.length ? palette : ["#fffcf7"];
  const shapeColors = colors.length > 1 ? colors.slice(1) : colors;
  return {
    base: colors[0],
    shapes: Array.from(
      { length: shapeCount },
      (_, index) => shapeColors[index % shapeColors.length],
    ),
  };
};

export const resolveBackgroundColors = (
  stored: BackgroundColorSettings,
  defaults: BackgroundColorSettings,
): BackgroundColorSettings => ({
  base: stored.base || defaults.base,
  shapes: defaults.shapes.map(
    (defaultColor, index) => stored.shapes[index] || defaultColor,
  ),
});

export const getBackgroundColorStyle = (
  colors: BackgroundColorSettings,
): ThemeStyle => {
  const style = {} as ThemeStyle;
  if (colors.base) style["--theme-base"] = colors.base;
  if (colors.shapes.length) {
    [0, 1, 2, 3].forEach((index) => {
      style[`--theme-bg-${index + 1}`] =
        colors.shapes[index % colors.shapes.length];
    });
  }
  return style;
};

export const getDefaultTextColors = (
  themeId: AdTheme,
  preferLightText = false,
): TextColorSettings => {
  const palette = getThemePaletteColors(themeId);
  const colors = palette.length ? palette : ["#206a1d"];
  const sources = colors.length > 1 ? colors.slice(1) : colors;
  const tone: TextColorTone = preferLightText ? "light" : "dark";
  return {
    title: { color: sources[0], tone },
    description: { color: sources[1] ?? sources[0], tone },
    assistant: { color: sources[2] ?? sources[0], tone },
  };
};

const resolveTextColorSelection = (
  stored: TextColorSelection,
  fallback: TextColorSelection,
): TextColorSelection => ({
  color: stored.color || fallback.color,
  tone: stored.color ? stored.tone : fallback.tone,
});

export const resolveTextColors = (
  stored: TextColorSettings,
  defaults: TextColorSettings,
): TextColorSettings => ({
  title: resolveTextColorSelection(stored.title, defaults.title),
  description: resolveTextColorSelection(
    stored.description,
    defaults.description,
  ),
  assistant: resolveTextColorSelection(stored.assistant, defaults.assistant),
});

export const getTextColorStyle = (
  colors: TextColorSettings,
): ThemeStyle => {
  const title = getTextColorValue(colors.title);
  const description = getTextColorValue(colors.description);
  const assistant = getTextColorValue(colors.assistant);
  return {
    "--theme-title": title,
    "--theme-copy": description,
    "--theme-primary": assistant,
    "--theme-on-dark-title": title,
    "--theme-on-dark-copy": description,
    "--theme-on-dark-assistant": assistant,
  };
};
