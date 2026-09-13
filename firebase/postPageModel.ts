import type {MessageLanguage, MessageTranslations} from "./messages";
import type {FormatChangeAnchor} from "../app/imagePositioning";

export type AdFormat = "portrait" | "story" | "app-store";
export type TextPosition =
  | "top-left"
  | "top-center"
  | "top-right"
  | "middle-left"
  | "middle-center"
  | "middle-right"
  | "bottom-left"
  | "bottom-center"
  | "bottom-right";
export type TextBackdrop =
  | "none"
  | "gradient-light"
  | "gradient-dark"
  | "band-light"
  | "band-theme"
  | "band-dark"
  | "card"
  | "card-theme"
  | "bubble";
export type TextBubbleTarget = "both" | "title" | "description";
export type AdTheme = string;
export type AdBackground =
  | "solid"
  | "gradient"
  | "cream"
  | "sage"
  | "lines"
  | "rays"
  | "ribbons"
  | "orbit"
  | "petals"
  | "bubbles"
  | "mosaic"
  | "capsules"
  | "pop-waves"
  | "corner-fan"
  | "zigzag"
  | "folds"
  | "halos"
  | "flow-columns"
  | "soft-panels"
  | "sunset-bands"
  | "offset-discs"
  | "magic"
  | "scrapbook";

export type PageImage = {
  id: string;
  assetId: string;
  multilingual?: boolean;
  localizedAssetIds?: Partial<Record<MessageLanguage, string>>;
  x: number;
  y: number;
  scale: number;
  rotation: number;
  shadowStrength: number;
  shadowDistance: number;
  frame: boolean;
  aboveText: boolean;
  foregroundOrder?: number;
};

export type BackgroundColorSettings = {
  base: string;
  shapes: string[];
};

export type TextColorTone = "original" | "light" | "dark";

export type TextColorSelection = {
  color: string;
  tone: TextColorTone;
};

export type TextColorSettings = {
  title: TextColorSelection;
  description: TextColorSelection;
  assistant: TextColorSelection;
};

export type StoreButtonSettings = {
  enabled: boolean;
  direction: "row" | "column";
  bottomMargin: number;
  scale: number;
  iosAssetId: string;
  androidAssetId: string;
};

export type PageLayout = {
  imagePositionVersion?: 1;
  formatChangeAnchor?: FormatChangeAnchor;
  backgroundColors: BackgroundColorSettings;
  backgroundPositionY: number;
  assistantBackgroundColor: string;
  textColors: TextColorSettings;
  textPosition: TextPosition;
  textWidth: number;
  textMarginHorizontal: number;
  textMarginVertical: number;
  textRotation: number;
  showAssistantLabel: boolean;
  textBackdrop: TextBackdrop;
  textBubbleTarget?: TextBubbleTarget;
  storeButtons: StoreButtonSettings;
  images: PageImage[];
};

export type PostPage = {
  id: string;
  name: string;
  postId: string;
  translations: MessageTranslations;
  format: AdFormat;
  theme: AdTheme;
  background: AdBackground;
  backgroundAssetId: string;
  properties: PageLayout;
  updatedAt: number;
};

export const TEXT_SPACING = 6;

const DEFAULT_IMAGE_SETTINGS: Omit<PageImage, "id"> = {
  assetId: "",
  multilingual: false,
  x: 0,
  y: 36,
  scale: 100,
  rotation: 0,
  shadowStrength: 60,
  shadowDistance: 6,
  frame: true,
  aboveText: false,
  foregroundOrder: 0,
};

export const createPageImage = (
  id: string,
  overrides: Partial<Omit<PageImage, "id">> = {},
): PageImage => ({
  id,
  ...DEFAULT_IMAGE_SETTINGS,
  ...overrides,
});

export const getImageAssetId = (image: PageImage, language: MessageLanguage): string =>
  image.multilingual ? image.localizedAssetIds?.[language] ?? "" : image.assetId;

export const setImageForeground = (
  images: PageImage[], imageId: string, enabled: boolean,
): PageImage[] => {
  if (!images.some((image) => image.id === imageId)) return images;
  const foreground = images
    .filter((image) => image.aboveText && image.id !== imageId)
    .sort((left, right) => (left.foregroundOrder ?? 0) - (right.foregroundOrder ?? 0));
  const order = new Map(foreground.map((image, index) => [image.id, index + 1]));
  return images.map((image) => image.id === imageId
    ? { ...image, aboveText: enabled, foregroundOrder: enabled ? foreground.length + 1 : 0 }
    : { ...image, foregroundOrder: order.get(image.id) ?? 0 });
};

export const setImageMultilingual = (
  image: PageImage, enabled: boolean, language: MessageLanguage,
): PageImage => ({
  ...image,
  multilingual: enabled,
  assetId: enabled ? image.assetId : getImageAssetId(image, language) || image.assetId,
  localizedAssetIds: enabled
    ? { ...image.localizedAssetIds, [language]: image.localizedAssetIds?.[language] || image.assetId }
    : image.localizedAssetIds ?? {},
});

export const DEFAULT_PAGE_LAYOUT: PageLayout = {
  imagePositionVersion: 1,
  formatChangeAnchor: "center",
  backgroundColors: {
    base: "",
    shapes: [],
  },
  backgroundPositionY: 0,
  assistantBackgroundColor: "",
  textColors: {
    title: { color: "", tone: "original" },
    description: { color: "", tone: "original" },
    assistant: { color: "", tone: "original" },
  },
  textPosition: "top-left",
  textWidth: 84,
  textMarginHorizontal: TEXT_SPACING,
  textMarginVertical: TEXT_SPACING,
  textRotation: 0,
  showAssistantLabel: true,
  textBackdrop: "gradient-light",
  textBubbleTarget: "both",
  storeButtons: { enabled: false, direction: "row", bottomMargin: 6, scale: 100, iosAssetId: "", androidAssetId: "" },
  images: [createPageImage("hero-image-1")],
};

export const createDefaultPageLayout = (): PageLayout => ({
  ...DEFAULT_PAGE_LAYOUT,
  backgroundColors: {
    ...DEFAULT_PAGE_LAYOUT.backgroundColors,
    shapes: [...DEFAULT_PAGE_LAYOUT.backgroundColors.shapes],
  },
  textColors: {
    title: { ...DEFAULT_PAGE_LAYOUT.textColors.title },
    description: { ...DEFAULT_PAGE_LAYOUT.textColors.description },
    assistant: { ...DEFAULT_PAGE_LAYOUT.textColors.assistant },
  },
  images: DEFAULT_PAGE_LAYOUT.images.map((image) => ({ ...image })),
  storeButtons: { ...DEFAULT_PAGE_LAYOUT.storeButtons },
});

export const createDefaultPostPageContent = (postId: string): Omit<PostPage, "id" | "updatedAt"> => ({
  name: "Nouvelle page", postId,
  translations: {en: {title: "", description: ""}, fr: {title: "", description: ""}, pt: {title: "", description: ""}},
  format: "portrait", theme: "dailydish", background: "cream", backgroundAssetId: "",
  properties: createDefaultPageLayout(),
});
