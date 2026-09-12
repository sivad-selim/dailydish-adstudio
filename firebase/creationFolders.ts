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
  updateDoc,
  type Unsubscribe,
} from "firebase/firestore";
import { allowedEmail, firebaseApp, firebaseAuth } from "./firebaseAuth";

export type CreationFolder = {
  id: string;
  name: string;
  postOrder?: string[];
};

const folderDatabase = getFirestore(firebaseApp, "ad-studio");
const foldersCollection = collection(folderDatabase, "creation-folders");

const assertAuthorizedUser = () => {
  const email = firebaseAuth.currentUser?.email?.trim().toLowerCase() ?? "";
  if (email !== allowedEmail) {
    throw new Error("Accès Firebase non autorisé.");
  }
};

export const subscribeToCreationFolders = (
  onFolders: (folders: CreationFolder[]) => void,
  onError: (error: Error) => void,
): Unsubscribe => {
  assertAuthorizedUser();
  const foldersQuery = query(foldersCollection, orderBy("name", "asc"));

  return onSnapshot(
    foldersQuery,
    (snapshot) =>
      onFolders(
        snapshot.docs.map((folderDocument) => ({
          id: folderDocument.id,
          postOrder: Array.isArray(folderDocument.data().postOrder)
            ? folderDocument.data().postOrder.filter((id: unknown): id is string => typeof id === "string")
            : [],
          name:
            typeof folderDocument.data().name === "string"
              ? folderDocument.data().name
              : "Dossier sans nom",
        })),
      ),
    onError,
  );
};

export const createCreationFolder = async (name: string): Promise<string> => {
  assertAuthorizedUser();
  const normalizedName = name.trim();
  if (!normalizedName) throw new Error("Le nom du dossier est vide.");

  const folder = await addDoc(foldersCollection, {
    name: normalizedName,
    ownerEmail: allowedEmail,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return folder.id;
};

export const deleteCreationFolder = async (folderId: string): Promise<void> => {
  assertAuthorizedUser();
  await deleteDoc(doc(foldersCollection, folderId));
};

export const renameCreationFolder = async (
  folderId: string,
  name: string,
): Promise<void> => {
  assertAuthorizedUser();
  const normalizedName = name.trim();
  if (!normalizedName) throw new Error("Le nom du dossier est vide.");

  await updateDoc(doc(foldersCollection, folderId), {
    name: normalizedName,
    updatedAt: serverTimestamp(),
  });
};

export const saveFolderPostOrder = async (folderId: string, postIds: string[]): Promise<void> => {
  assertAuthorizedUser();
  await updateDoc(doc(foldersCollection, folderId), {
    postOrder: [...new Set(postIds)],
    updatedAt: serverTimestamp(),
  });
};
