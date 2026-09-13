import { collection, getFirestore, onSnapshot, query, where } from "firebase/firestore";
import { getFunctions, httpsCallable } from "firebase/functions";
import { getDownloadURL, getStorage, ref, uploadBytes } from "firebase/storage";
import { firebaseApp, firebaseAuth } from "./firebaseAuth";
import type { InstagramAccount } from "./instagram";

export type InstagramPublication = {
  platform?: "instagram" | "facebook";
  entryId: string; postId: string; account: InstagramAccount; imagePath: string; imagePaths?: string[]; preparedCount?: number; processingIndex?: number; phase?: "preparing" | "publishing"; caption: string;
  status: "pending" | "failed" | "uncertain" | "published";
  permalink?: string; message?: string; publishedAt?: string; leaseUntil?: number;
};
const storage = getStorage(firebaseApp, "gs://daily-dish-b10b4-ad-studio");
const publish = httpsCallable<Pick<InstagramPublication, "entryId" | "postId" | "account" | "imagePath" | "imagePaths" | "caption">, InstagramPublication>(
  getFunctions(firebaseApp, "us-central1"), "publishAdStudioInstagram", { timeout: 570000 },
);
export function subscribeInstagramPublications(entryId: string, receive: (items: InstagramPublication[]) => void, fail: () => void) {
  return onSnapshot(query(collection(getFirestore(firebaseApp, "ad-studio"), "instagram-publications"), where("entryId", "==", entryId)),
    (snapshot) => receive(snapshot.docs.map((item) => item.data() as InstagramPublication)), fail);
}
export async function uploadInstagramImage(entryId: string, account: InstagramAccount, jpeg: Blob) {
  const uid = firebaseAuth.currentUser?.uid;
  if (!uid) throw new Error("Reconnecte-toi à l’Ad Studio.");
  const imagePath = `instagram-publishing/${uid}/${entryId}/${account}/${crypto.randomUUID()}.jpg`;
  await uploadBytes(ref(storage, imagePath), jpeg, { contentType: "image/jpeg" });
  return imagePath;
}
export const instagramImageUrl = (path: string) => getDownloadURL(ref(storage, path));
export async function publishInstagramPost(input: Pick<InstagramPublication, "entryId" | "postId" | "account" | "imagePath" | "imagePaths" | "caption">) {
  return (await publish(input)).data;
}
export function subscribeAllInstagramPublications(receive: (items: InstagramPublication[]) => void, fail: () => void) {
  return onSnapshot(collection(getFirestore(firebaseApp, "ad-studio"), "instagram-publications"),
    (snapshot) => receive(snapshot.docs.map((item) => item.data() as InstagramPublication)), fail);
}
export async function resetInstagramPublication(job: InstagramPublication) {
  return httpsCallable(getFunctions(firebaseApp, "us-central1"), "resetAdStudioInstagramPublication")({entryId: job.entryId, account: job.account, imagePath: job.imagePath});
}
