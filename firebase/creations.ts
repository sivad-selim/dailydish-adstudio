import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getFirestore,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  type Timestamp,
  type Unsubscribe,
} from "firebase/firestore";
import { allowedEmail, firebaseApp, firebaseAuth } from "./firebaseAuth";
import type { CampaignLanguage } from "./campaigns";
import { centerLegacyImages, type FormatChangeAnchor } from "../app/imagePositioning";

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
  | "card-theme";
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

export type CreationImage = {
  id: string;
  assetId: string;
  multilingual?: boolean;
  localizedAssetIds?: Partial<Record<CampaignLanguage, string>>;
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

export type CreationProperties = {
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
  images: CreationImage[];
};

export type Creation = {
  id: string;
  name: string;
  postId: string;
  folderId: string;
  campaignId: string;
  format: AdFormat;
  theme: AdTheme;
  background: AdBackground;
  backgroundAssetId: string;
  properties: CreationProperties;
  updatedAt: number;
};

export const TEXT_SPACING = 6;

const DEFAULT_IMAGE_SETTINGS: Omit<CreationImage, "id"> = {
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

export const createCreationImage = (
  id: string,
  overrides: Partial<Omit<CreationImage, "id">> = {},
): CreationImage => ({
  id,
  ...DEFAULT_IMAGE_SETTINGS,
  ...overrides,
});

export const getImageAssetId = (image: CreationImage, language: CampaignLanguage): string =>
  image.multilingual ? image.localizedAssetIds?.[language] ?? "" : image.assetId;

export const setImageForeground = (
  images: CreationImage[], imageId: string, enabled: boolean,
): CreationImage[] => {
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
  image: CreationImage, enabled: boolean, language: CampaignLanguage,
): CreationImage => ({
  ...image,
  multilingual: enabled,
  assetId: enabled ? image.assetId : getImageAssetId(image, language) || image.assetId,
  localizedAssetIds: enabled
    ? { ...image.localizedAssetIds, [language]: image.localizedAssetIds?.[language] || image.assetId }
    : image.localizedAssetIds ?? {},
});

export const DEFAULT_CREATION_PROPERTIES: CreationProperties = {
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
  images: [createCreationImage("hero-image-1")],
};

export const createDefaultCreationProperties = (): CreationProperties => ({
  ...DEFAULT_CREATION_PROPERTIES,
  backgroundColors: {
    ...DEFAULT_CREATION_PROPERTIES.backgroundColors,
    shapes: [...DEFAULT_CREATION_PROPERTIES.backgroundColors.shapes],
  },
  textColors: {
    title: { ...DEFAULT_CREATION_PROPERTIES.textColors.title },
    description: { ...DEFAULT_CREATION_PROPERTIES.textColors.description },
    assistant: { ...DEFAULT_CREATION_PROPERTIES.textColors.assistant },
  },
  images: DEFAULT_CREATION_PROPERTIES.images.map((image) => ({ ...image })),
});

const creationDatabase = getFirestore(firebaseApp, "ad-studio");
const creationsCollection = collection(creationDatabase, "creations");

const normalizedEmail = () =>
  firebaseAuth.currentUser?.email?.trim().toLowerCase() ?? "";

const assertAuthorizedUser = () => {
  if (normalizedEmail() !== allowedEmail) {
    throw new Error("Accès Firebase non autorisé.");
  }
};

const asRecord = (value: unknown): Record<string, unknown> =>
  value && typeof value === "object" ? (value as Record<string, unknown>) : {};

const readNumber = (value: unknown, fallback: number) =>
  typeof value === "number" && Number.isFinite(value) ? value : fallback;

const readEnum = <Value extends string>(
  value: unknown,
  allowedValues: readonly Value[],
  fallback: Value,
) => (typeof value === "string" && allowedValues.includes(value as Value)
  ? (value as Value)
  : fallback);

const readCreationImages = (
  value: unknown,
  fallback: CreationImage[],
): CreationImage[] => {
  if (!Array.isArray(value)) {
    return fallback.map((image) => ({ ...image }));
  }

  return value.map((storedImage, index) => {
    const image = asRecord(storedImage);
    const fallbackImage = fallback[index] ?? createCreationImage(`image-${index + 1}`);
    return {
      id:
        typeof image.id === "string" && image.id
          ? image.id
          : fallbackImage.id,
      assetId:
        typeof image.assetId === "string"
          ? image.assetId
          : fallbackImage.assetId,
      multilingual: image.multilingual === true,
      localizedAssetIds: Object.fromEntries(
        (["fr", "en", "pt"] as const).map((language) => {
          const assetId = asRecord(image.localizedAssetIds)[language];
          return [language, typeof assetId === "string" ? assetId : ""];
        }),
      ),
      x: readNumber(image.x, fallbackImage.x),
      y: readNumber(image.y, fallbackImage.y),
      scale: readNumber(image.scale, fallbackImage.scale),
      rotation: readNumber(image.rotation, fallbackImage.rotation),
      shadowStrength: readNumber(
        image.shadowStrength,
        fallbackImage.shadowStrength,
      ),
      shadowDistance: readNumber(
        image.shadowDistance,
        fallbackImage.shadowDistance,
      ),
      frame:
        typeof image.frame === "boolean" ? image.frame : fallbackImage.frame,
      aboveText:
        typeof image.aboveText === "boolean"
          ? image.aboveText
          : fallbackImage.aboveText,
      foregroundOrder: Math.max(0, readNumber(image.foregroundOrder, 0)),
    };
  });
};

const readCreationProperties = (
  value: unknown,
  fallback: CreationProperties,
): CreationProperties => {
  const properties = asRecord(value);
  const storedBackgroundColors = asRecord(properties.backgroundColors);
  const storedTextColors = asRecord(properties.textColors);
  const readTextColorSelection = (
    value: unknown,
    fallbackSelection: TextColorSelection,
  ): TextColorSelection => {
    if (typeof value === "string") {
      return { ...fallbackSelection };
    }
    const selection = asRecord(value);
    return {
      color:
        typeof selection.color === "string"
          ? selection.color
          : fallbackSelection.color,
      tone: readEnum(
        selection.tone,
        ["original", "light", "dark"],
        fallbackSelection.tone,
      ),
    };
  };
  return {
    ...(properties.imagePositionVersion === 1 ? { imagePositionVersion: 1 as const } : {}),
    formatChangeAnchor: readEnum<FormatChangeAnchor>(properties.formatChangeAnchor, ["top", "center", "bottom"],
      properties.imagePositionVersion === 1 ? "center" : "bottom"),
    backgroundColors: {
      base:
        typeof storedBackgroundColors.base === "string"
          ? storedBackgroundColors.base
          : fallback.backgroundColors.base,
      shapes: Array.isArray(storedBackgroundColors.shapes)
        ? storedBackgroundColors.shapes.filter(
            (color): color is string => typeof color === "string",
          )
        : [...fallback.backgroundColors.shapes],
    },
    backgroundPositionY: readNumber(
      properties.backgroundPositionY,
      fallback.backgroundPositionY,
    ),
    assistantBackgroundColor:
      typeof properties.assistantBackgroundColor === "string"
        ? properties.assistantBackgroundColor
        : fallback.assistantBackgroundColor,
    textColors: {
      title: readTextColorSelection(
        storedTextColors.title,
        fallback.textColors.title,
      ),
      description: readTextColorSelection(
        storedTextColors.description,
        fallback.textColors.description,
      ),
      assistant: readTextColorSelection(
        storedTextColors.assistant,
        fallback.textColors.assistant,
      ),
    },
    textPosition: readEnum(
      properties.textPosition,
      [
        "top-left",
        "top-center",
        "top-right",
        "middle-left",
        "middle-center",
        "middle-right",
        "bottom-left",
        "bottom-center",
        "bottom-right",
      ],
      fallback.textPosition,
    ),
    textWidth: readNumber(properties.textWidth, fallback.textWidth),
    textMarginHorizontal: readNumber(
      properties.textMarginHorizontal,
      fallback.textMarginHorizontal,
    ),
    textMarginVertical: readNumber(
      properties.textMarginVertical,
      fallback.textMarginVertical,
    ),
    textRotation: readNumber(
      properties.textRotation,
      fallback.textRotation,
    ),
    showAssistantLabel:
      typeof properties.showAssistantLabel === "boolean"
        ? properties.showAssistantLabel
        : fallback.showAssistantLabel,
    textBackdrop: readEnum(
      properties.textBackdrop,
      [
        "none",
        "gradient-light",
        "gradient-dark",
        "band-light",
        "band-theme",
        "band-dark",
        "card",
        "card-theme",
      ],
      fallback.textBackdrop,
    ),
    images: readCreationImages(properties.images, fallback.images),
  };
};

const readCreation = (
  id: string,
  data: Record<string, unknown>,
): Creation => {
  const format = readEnum<AdFormat>(data.format, ["portrait", "story", "app-store"], "portrait");
  const properties = centerLegacyImages(readCreationProperties(
    data.properties,
    createDefaultCreationProperties(),
  ), format);
  const timestamp = data.updatedAt as Timestamp | undefined;

  return {
    id,
    name:
      typeof data.name === "string" && data.name.trim()
        ? data.name
        : "Création sans nom",
    postId: typeof data.postId === "string" ? data.postId : "",
    folderId: typeof data.folderId === "string" ? data.folderId : "",
    campaignId: typeof data.campaignId === "string" ? data.campaignId : "",
    format,
    theme:
      typeof data.theme === "string" && data.theme
        ? data.theme
        : "dailydish",
    background: readEnum(
      data.background,
      [
        "solid",
        "gradient",
        "cream",
        "sage",
        "lines",
        "rays",
        "ribbons",
        "orbit",
        "petals",
        "bubbles",
        "mosaic",
        "capsules",
        "pop-waves",
        "corner-fan",
        "zigzag",
        "folds",
        "halos",
        "flow-columns",
        "soft-panels",
        "sunset-bands",
        "offset-discs",
        "magic",
        "scrapbook",
      ],
      "cream",
    ),
    backgroundAssetId:
      typeof data.backgroundAssetId === "string"
        ? data.backgroundAssetId
        : "",
    properties,
    updatedAt: timestamp?.toMillis?.() ?? 0,
  };
};

export const subscribeToCreations = (
  onCreations: (creations: Creation[]) => void,
  onError: (error: Error) => void,
): Unsubscribe => {
  assertAuthorizedUser();
  const creationsQuery = query(
    creationsCollection,
    orderBy("updatedAt", "desc"),
  );

  return onSnapshot(
    creationsQuery,
    (snapshot) =>
      onCreations(
        snapshot.docs.map((snapshotDocument) =>
          readCreation(snapshotDocument.id, snapshotDocument.data()),
        ),
      ),
    onError,
  );
};

export const createCreation = async (
  name: string,
  campaignId: string,
  folderId = "",
  postId = "",
): Promise<string> => {
  assertAuthorizedUser();
  const createdCreation = await addDoc(creationsCollection, {
    name: name.trim() || "Nouvelle création",
    postId,
    folderId,
    campaignId,
    format: "portrait",
    theme: "dailydish",
    background: "cream",
    backgroundAssetId: "",
    properties: createDefaultCreationProperties(),
    ownerEmail: allowedEmail,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return createdCreation.id;
};

export const saveCreation = async (creation: Creation): Promise<void> => {
  assertAuthorizedUser();
  await setDoc(
    doc(creationsCollection, creation.id),
    {
      name: creation.name.trim() || "Création sans nom",
      postId: creation.postId,
      folderId: creation.folderId,
      campaignId: creation.campaignId,
      format: creation.format,
      theme: creation.theme,
      background: creation.background,
      backgroundAssetId: creation.backgroundAssetId,
      properties: creation.properties,
      ownerEmail: allowedEmail,
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  );
};

export const duplicateCreation = async (
  creation: Creation,
  overrides: { folderId?: string; postId?: string } = {},
): Promise<string> => {
  assertAuthorizedUser();
  const duplicatedCreation = await addDoc(creationsCollection, {
    name: `${creation.name.trim() || "Création sans nom"} (copie)`,
    postId: overrides.postId ?? creation.postId,
    folderId: overrides.folderId ?? creation.folderId,
    campaignId: creation.campaignId,
    format: creation.format,
    theme: creation.theme,
    background: creation.background,
    backgroundAssetId: creation.backgroundAssetId,
    properties: {
      ...creation.properties,
      backgroundColors: {
        ...creation.properties.backgroundColors,
        shapes: [...creation.properties.backgroundColors.shapes],
      },
      textColors: {
        title: { ...creation.properties.textColors.title },
        description: { ...creation.properties.textColors.description },
        assistant: { ...creation.properties.textColors.assistant },
      },
      images: creation.properties.images.map((image) => ({ ...image })),
    },
    ownerEmail: allowedEmail,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return duplicatedCreation.id;
};

export const deleteCreation = async (
  creation: Creation | string,
): Promise<void> => {
  assertAuthorizedUser();
  await deleteDoc(
    doc(creationsCollection, typeof creation === "string" ? creation : creation.id),
  );
};
