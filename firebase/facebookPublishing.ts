import { collection, getFirestore, onSnapshot, query, where } from "firebase/firestore";
import { getFunctions, httpsCallable } from "firebase/functions";
import { getDownloadURL, getStorage, ref, uploadBytes } from "firebase/storage";
import { firebaseApp, firebaseAuth } from "./firebaseAuth";
import type { InstagramAccount } from "./instagram";

export type FacebookPublication = {
  entryId: string; postId: string; account: InstagramAccount; imagePath: string; imagePaths?: string[]; preparedCount?: number; processingIndex?: number; phase?: "preparing" | "publishing"; caption: string;
  status: "pending" | "failed" | "uncertain" | "published";
  permalink?: string; message?: string; publishedAt?: string; leaseUntil?: number;
};
const storage = getStorage(firebaseApp, "gs://daily-dish-b10b4-ad-studio");
export async function verifyFacebookConnection(account: InstagramAccount) {
  try {
    return (await httpsCallable(getFunctions(firebaseApp, "us-central1"), "verifyAdStudioFacebook", {timeout: 30000})({account})).data;
  } catch (error) {
    const code = (error as {code?: string})?.code;
    if (code === "functions/failed-precondition") throw error;
    throw new Error("Connexion Facebook indisponible. Vérifie que les fonctions et les jetons des pages sont installés sur le serveur.");
  }
}
const publish = httpsCallable<Pick<FacebookPublication, "entryId" | "postId" | "account" | "imagePath" | "imagePaths" | "caption">, FacebookPublication>(
  getFunctions(firebaseApp, "us-central1"), "publishAdStudioFacebook", { timeout: 570000 },
);
export function subscribeFacebookPublications(entryId: string, receive: (items: FacebookPublication[]) => void, fail: () => void) {
  return onSnapshot(query(collection(getFirestore(firebaseApp, "ad-studio"), "facebook-publications"), where("entryId", "==", entryId)),
    (snapshot) => receive(snapshot.docs.map((item) => item.data() as FacebookPublication)), fail);
}
export async function uploadFacebookImage(entryId: string, account: InstagramAccount, jpeg: Blob) {
  const uid = firebaseAuth.currentUser?.uid;
  if (!uid) throw new Error("Reconnecte-toi à l’Ad Studio.");
  const imagePath = `facebook-publishing/${uid}/${entryId}/${account}/${crypto.randomUUID()}.jpg`;
  await uploadBytes(ref(storage, imagePath), jpeg, { contentType: "image/jpeg" });
  return imagePath;
}
export const facebookImageUrl = (path: string) => getDownloadURL(ref(storage, path));
export async function publishFacebookPost(input: Pick<FacebookPublication, "entryId" | "postId" | "account" | "imagePath" | "imagePaths" | "caption">) {
  return (await publish(input)).data;
}
export function subscribeAllFacebookPublications(receive: (items: FacebookPublication[]) => void, fail: () => void) {
  return onSnapshot(collection(getFirestore(firebaseApp, "ad-studio"), "facebook-publications"),
    (snapshot) => receive(snapshot.docs.map((item) => item.data() as FacebookPublication)), fail);
}
export async function resetFacebookPublication(job: FacebookPublication) {
  return httpsCallable(getFunctions(firebaseApp, "us-central1"), "resetAdStudioFacebookPublication")({entryId: job.entryId, account: job.account, imagePath: job.imagePath});
}
