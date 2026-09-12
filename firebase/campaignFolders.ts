import {
  addDoc,
  collection,
  getFirestore,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
} from "firebase/firestore";
import { allowedEmail, firebaseApp, firebaseAuth } from "./firebaseAuth";

export type CampaignFolder = { id: string; name: string };
const foldersCollection = collection(
  getFirestore(firebaseApp, "ad-studio"),
  "campaign-folders",
);

export const subscribeToCampaignFolders = (
  onFolders: (folders: CampaignFolder[]) => void,
  onError: (error: Error) => void,
) => onSnapshot(
  query(foldersCollection, orderBy("name", "asc")),
  (snapshot) => onFolders(snapshot.docs.map((folder) => ({
    id: folder.id,
    name: typeof folder.data().name === "string" ? folder.data().name : "Dossier sans nom",
  }))),
  onError,
);

export async function createCampaignFolder(name: string): Promise<string> {
  if (firebaseAuth.currentUser?.email?.trim().toLowerCase() !== allowedEmail) {
    throw new Error("Accès Firebase non autorisé.");
  }
  const normalizedName = name.trim();
  if (!normalizedName || normalizedName.length > 80) {
    throw new Error("Le nom du dossier doit contenir entre 1 et 80 caractères.");
  }
  const folder = await addDoc(foldersCollection, {
    name: normalizedName,
    ownerEmail: allowedEmail,
    createdAt: serverTimestamp(),
  });
  return folder.id;
}
