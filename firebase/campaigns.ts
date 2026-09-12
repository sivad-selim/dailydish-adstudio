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
  updateDoc,
  type Unsubscribe,
} from "firebase/firestore";
import { allowedEmail, firebaseApp, firebaseAuth } from "./firebaseAuth";

export type CampaignLanguage = "fr" | "en" | "pt";
export type CampaignTranslation = {
  title: string;
  description: string;
};
export type CampaignTranslations = Record<
  CampaignLanguage,
  CampaignTranslation
>;
export type Campaign = {
  id: string;
  folderId?: string;
  translations: CampaignTranslations;
};

export const getCampaignTitle = (campaign: Campaign): string =>
  campaign.translations.fr.title.trim() ||
  campaign.translations.en.title.trim() ||
  campaign.translations.pt.title.trim() ||
  "Campagne sans titre";

export const CAMPAIGN_LANGUAGES: Array<{
  id: CampaignLanguage;
  shortLabel: string;
  label: string;
}> = [
  { id: "fr", shortLabel: "FR", label: "Français" },
  { id: "en", shortLabel: "EN", label: "English" },
  { id: "pt", shortLabel: "PT", label: "Português" },
];

export const EMPTY_TRANSLATIONS: CampaignTranslations = {
  fr: { title: "", description: "" },
  en: { title: "", description: "" },
  pt: { title: "", description: "" },
};

const campaignDatabase = getFirestore(firebaseApp, "ad-studio");
const campaignsCollection = collection(campaignDatabase, "campaigns");

const normalizedEmail = () =>
  firebaseAuth.currentUser?.email?.trim().toLowerCase() ?? "";

const assertAuthorizedUser = () => {
  if (normalizedEmail() !== allowedEmail) {
    throw new Error("Accès Firebase non autorisé.");
  }
};

const readTranslation = (
  value: unknown,
  language: CampaignLanguage,
): CampaignTranslation => {
  const translation =
    value && typeof value === "object"
      ? (value as Record<string, unknown>)[language]
      : undefined;
  const record =
    translation && typeof translation === "object"
      ? (translation as Record<string, unknown>)
      : {};
  return {
    title: typeof record.title === "string" ? record.title : "",
    description:
      typeof record.description === "string" ? record.description : "",
  };
};

export const subscribeToCampaigns = (
  onCampaigns: (campaigns: Campaign[]) => void,
  onError: (error: Error) => void,
): Unsubscribe => {
  assertAuthorizedUser();
  const campaignsQuery = query(
    campaignsCollection,
    orderBy("updatedAt", "desc"),
  );

  return onSnapshot(
    campaignsQuery,
    (snapshot) => {
      onCampaigns(
        snapshot.docs.map((snapshotDocument) => {
          const data = snapshotDocument.data();
          return {
            id: snapshotDocument.id,
            folderId: typeof data.folderId === "string" ? data.folderId : "",
            translations: {
              fr: readTranslation(data.translations, "fr"),
              en: readTranslation(data.translations, "en"),
              pt: readTranslation(data.translations, "pt"),
            },
          };
        }),
      );
    },
    (error) => onError(error),
  );
};

export const createCampaign = async (folderId = ""): Promise<string> => {
  assertAuthorizedUser();
  const createdCampaign = await addDoc(campaignsCollection, {
    ownerEmail: allowedEmail,
    folderId,
    translations: EMPTY_TRANSLATIONS,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return createdCampaign.id;
};

export const saveCampaign = async (campaign: Campaign): Promise<void> => {
  assertAuthorizedUser();
  await setDoc(
    doc(campaignsCollection, campaign.id),
    {
      ownerEmail: allowedEmail,
      translations: campaign.translations,
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  );
};

export const deleteCampaign = async (campaignId: string): Promise<void> => {
  assertAuthorizedUser();
  await deleteDoc(doc(campaignsCollection, campaignId));
};

export const moveCampaign = async (campaignId: string, folderId: string): Promise<void> => {
  assertAuthorizedUser();
  // A move must never overwrite translations from an open editor.
  await updateDoc(doc(campaignsCollection, campaignId), {
    folderId,
    updatedAt: serverTimestamp(),
  });
};
