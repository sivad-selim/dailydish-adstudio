import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getFirestore,
  onSnapshot,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  type Timestamp,
  type Unsubscribe,
} from "firebase/firestore";
import { allowedEmail, firebaseApp, firebaseAuth } from "./firebaseAuth";

export type StudioPostType = "single" | "gallery";

export type StudioPost = {
  id: string;
  folderId: string;
  type: StudioPostType;
  pageIds: string[];
  updatedAt: number;
};

const postDatabase = getFirestore(firebaseApp, "ad-studio");
const postsCollection = collection(postDatabase, "posts");

const assertAuthorizedUser = () => {
  const email = firebaseAuth.currentUser?.email?.trim().toLowerCase() ?? "";
  if (email !== allowedEmail) throw new Error("Accès Firebase non autorisé.");
};

const readPost = (id: string, data: Record<string, unknown>): StudioPost => {
  const timestamp = data.updatedAt as Timestamp | undefined;
  return {
    id,
    folderId: typeof data.folderId === "string" ? data.folderId : "",
    type: data.type === "gallery" ? "gallery" : "single",
    pageIds: Array.isArray(data.pageIds)
      ? data.pageIds.filter((pageId): pageId is string => typeof pageId === "string")
      : [],
    updatedAt: timestamp?.toMillis?.() ?? 0,
  };
};

export const subscribeToPosts = (
  onPosts: (posts: StudioPost[]) => void,
  onError: (error: Error) => void,
): Unsubscribe => {
  assertAuthorizedUser();
  const postsQuery = query(postsCollection, orderBy("updatedAt", "desc"));
  return onSnapshot(
    postsQuery,
    (snapshot) =>
      onPosts(
        snapshot.docs.map((snapshotDocument) =>
          readPost(snapshotDocument.id, snapshotDocument.data()),
        ),
      ),
    onError,
  );
};

export const createStudioPost = async (
  folderId: string,
  type: StudioPostType,
): Promise<StudioPost> => {
  assertAuthorizedUser();
  const createdPost = await addDoc(postsCollection, {
    folderId,
    type,
    pageIds: [],
    ownerEmail: allowedEmail,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return { id: createdPost.id, folderId, type, pageIds: [], updatedAt: 0 };
};

export const insertDuplicatedPostPage = async (
  postId: string,
  sourcePageId: string,
  duplicatedPageId: string,
): Promise<void> => {
  assertAuthorizedUser();
  const postRef = doc(postsCollection, postId);
  await runTransaction(postDatabase, async (transaction) => {
    const snapshot = await transaction.get(postRef);
    if (!snapshot.exists()) throw new Error("La galerie n’existe plus.");
    const post = readPost(snapshot.id, snapshot.data());
    const index = post.pageIds.indexOf(sourcePageId);
    if (index < 0) throw new Error("La page n’est plus dans cette galerie.");
    const pageIds = [...post.pageIds];
    pageIds.splice(index + 1, 0, duplicatedPageId);
    transaction.update(postRef, { pageIds, type: "gallery", updatedAt: serverTimestamp() });
  });
};

export const saveStudioPost = async (post: StudioPost): Promise<void> => {
  assertAuthorizedUser();
  await setDoc(
    doc(postsCollection, post.id),
    {
      folderId: post.folderId,
      type: post.type,
      pageIds: post.pageIds,
      ownerEmail: allowedEmail,
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  );
};

export const deleteStudioPost = async (postId: string): Promise<void> => {
  assertAuthorizedUser();
  await deleteDoc(doc(postsCollection, postId));
};

export const ensureLegacySinglePost = async (
  creationId: string,
  folderId: string,
): Promise<void> => {
  assertAuthorizedUser();
  await setDoc(
    doc(postsCollection, `legacy-${creationId}`),
    {
      folderId,
      type: "single",
      pageIds: [creationId],
      ownerEmail: allowedEmail,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  );
};

// Move the existing creation; commit both post containers together.
export const transferPostPage = async (
  sourcePostId: string,
  pageId: string,
  targetPostId: string | null,
  folderId: string,
  beforePageId = "",
): Promise<void> => {
  assertAuthorizedUser();
  if (targetPostId === sourcePostId) throw new Error("Destination identique.");
  const sourceRef = doc(postsCollection, sourcePostId);
  const targetRef = targetPostId ? doc(postsCollection, targetPostId) : doc(postsCollection);
  const creationRef = doc(postDatabase, "creations", pageId);
  await runTransaction(postDatabase, async (transaction) => {
    const sourceSnapshot = await transaction.get(sourceRef);
    const targetSnapshot = targetPostId ? await transaction.get(targetRef) : null;
    const creationSnapshot = await transaction.get(creationRef);
    if (!sourceSnapshot.exists() || !creationSnapshot.exists()) throw new Error("Page introuvable.");
    const source = readPost(sourcePostId, sourceSnapshot.data());
    if (!source.pageIds.includes(pageId)) throw new Error("Cette page a déjà été déplacée.");
    const target = targetSnapshot?.exists() ? readPost(targetPostId!, targetSnapshot.data()) : null;
    if (targetPostId && (!target || target.type !== "gallery")) throw new Error("La galerie a changé. Réessayez.");
    if (target?.pageIds.includes(pageId)) throw new Error("Page déjà présente.");
    const destinationFolder = target?.folderId ?? folderId;
    const destinationPages = [...(target?.pageIds ?? [])];
    const index = beforePageId ? destinationPages.indexOf(beforePageId) : destinationPages.length;
    if (index < 0) throw new Error("L’ordre de la galerie a changé. Réessayez.");
    destinationPages.splice(index, 0, pageId);
    const remainingPages = source.pageIds.filter((id) => id !== pageId);
    if (remainingPages.length) {
      transaction.update(sourceRef, {
        pageIds: remainingPages,
        type: remainingPages.length === 1 ? "single" : "gallery",
        updatedAt: serverTimestamp(),
      });
    } else {
      transaction.delete(sourceRef);
    }
    if (target) {
      transaction.update(targetRef, { pageIds: destinationPages, updatedAt: serverTimestamp() });
    } else {
      transaction.set(targetRef, {
        folderId: destinationFolder, type: "single", pageIds: destinationPages,
        ownerEmail: allowedEmail, createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
      });
    }
    transaction.update(creationRef, { postId: targetRef.id, folderId: destinationFolder });
  });
};
