import {
  collection,
  doc,
  getFirestore,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  runTransaction,
  type Timestamp,
  type Unsubscribe,
} from "firebase/firestore";
import { allowedEmail, firebaseApp, firebaseAuth } from "./firebaseAuth";
import { readTranslations, type MessageTranslations, type MessageLanguage } from "./messages";
import { centerLegacyImages, type FormatChangeAnchor } from "../app/imagePositioning";

import {createDefaultPageLayout, createDefaultPostPageContent, createPageImage, type AdFormat, type PageImage, type TextColorSelection, type PageLayout, type PostPage} from "./postPageModel";
export * from "./postPageModel";

const database = getFirestore(firebaseApp, "ad-studio");
const pagesCollection = collection(database, "post-pages");

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

const readPageImages = (
  value: unknown,
  fallback: PageImage[],
): PageImage[] => {
  if (!Array.isArray(value)) {
    return fallback.map((image) => ({ ...image }));
  }

  return value.map((storedImage, index) => {
    const image = asRecord(storedImage);
    const fallbackImage = fallback[index] ?? createPageImage(`image-${index + 1}`);
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

const readPageLayout = (
  value: unknown,
  fallback: PageLayout,
): PageLayout => {
  const properties = asRecord(value);
  const storeButtons = asRecord(properties.storeButtons);
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
        "bubble",
      ],
      fallback.textBackdrop,
    ),
    textBubbleTarget: readEnum(properties.textBubbleTarget, ["both", "title", "description"] as const, "both"),
    storeButtons: {
      enabled: storeButtons.enabled === true,
      direction: readEnum(storeButtons.direction, ["row", "column"], fallback.storeButtons.direction),
      bottomMargin: Math.min(80, Math.max(0, readNumber(storeButtons.bottomMargin, fallback.storeButtons.bottomMargin))),
      scale: Math.min(150, Math.max(25, readNumber(storeButtons.scale, fallback.storeButtons.scale))),
      iosAssetId: typeof storeButtons.iosAssetId === "string" ? storeButtons.iosAssetId : "",
      androidAssetId: typeof storeButtons.androidAssetId === "string" ? storeButtons.androidAssetId : "",
    },
    images: readPageImages(properties.images, fallback.images),
  };
};

export const readPostPage = (
  id: string,
  data: Record<string, unknown>,
): PostPage => {
  const format = readEnum<AdFormat>(data.format, ["portrait", "story", "app-store"], "portrait");
  const properties = centerLegacyImages(readPageLayout(
    data.properties,
    createDefaultPageLayout(),
  ), format);
  const timestamp = data.updatedAt as Timestamp | undefined;

  return {
    id,
    name:
      typeof data.name === "string" && data.name.trim()
        ? data.name
        : "Page sans titre",
    postId: typeof data.postId === "string" ? data.postId : "",
    translations: readTranslations(data.translations),
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

export const subscribeToPostPages = (
  onPostPages: (postPages: PostPage[]) => void,
  onError: (error: Error) => void,
): Unsubscribe => {
  assertAuthorizedUser();
  const pagesQuery = query(
    pagesCollection,
    orderBy("updatedAt", "desc"),
  );

  return onSnapshot(
    pagesQuery,
    (snapshot) =>
      onPostPages(
        snapshot.docs.map((snapshotDocument) =>
          readPostPage(snapshotDocument.id, snapshotDocument.data()),
        ),
      ),
    onError,
  );
};

/** Layout defaults for a newly owned page. Text is copied by value. */
export function newPostPageData(postId: string) {
  return {
    ...createDefaultPostPageContent(postId), ownerEmail: allowedEmail,
    createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
  };
}

type PageVisual = Pick<PostPage, "id" | "name" | "format" | "theme" | "background" | "backgroundAssetId" | "properties">;

/** Text and ownership have separate atomic operations. An unchanged preview never
 * invalidates prepared publications or updates its modification date. */
export async function savePostPage(page: PageVisual): Promise<void> {
  assertAuthorizedUser();
  const ref = doc(pagesCollection, page.id);
  await runTransaction(database, async (transaction) => {
    const snapshot = await transaction.get(ref);
    if (!snapshot.exists()) throw new Error("Cette page a été supprimée.");
    const current = readPostPage(snapshot.id, snapshot.data());
    const values: Record<string, unknown> = {};
    for (const field of ["name", "format", "theme", "background", "backgroundAssetId", "properties"] as const) {
      if (JSON.stringify(page[field]) !== JSON.stringify(current[field])) values[field] = page[field];
    }
    if (Object.keys(values).length) transaction.update(ref, {...values, updatedAt: serverTimestamp()});
  });
}

/** Patch only edited text fields. Refuse conflicting edits instead of overwriting them. */
export async function savePageMessage(id: string, before: MessageTranslations, after: MessageTranslations) {
  assertAuthorizedUser();
  const changes: Array<{language: MessageLanguage; field: "title" | "description"}> = [];
  for (const language of ["en", "fr", "pt"] as const) {
    for (const field of ["title", "description"] as const) {
      if (before[language][field] !== after[language][field]) changes.push({language, field});
    }
  }
  if (!changes.length) return;
  const ref = doc(pagesCollection, id);
  await runTransaction(database, async (transaction) => {
    const snapshot = await transaction.get(ref);
    if (!snapshot.exists()) throw new Error("Cette page a été supprimée.");
    const current = readTranslations(snapshot.data().translations);
    const values: Record<string, unknown> = {updatedAt: serverTimestamp()};
    for (const {language, field} of changes) {
      if (current[language][field] !== before[language][field] && current[language][field] !== after[language][field]) {
        throw new Error("Ce texte a été modifié ailleurs. Copie tes modifications avant de recharger la page.");
      }
      values[`translations.${language}.${field}`] = after[language][field];
    }
    transaction.update(ref, values);
  });
}
