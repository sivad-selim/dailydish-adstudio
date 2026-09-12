import { doc, getFirestore, onSnapshot, runTransaction } from "firebase/firestore";
import { allowedEmail, firebaseApp, firebaseAuth } from "./firebaseAuth";

export type PlannedPublication = {
  id: string;
  postId: string;
  date: string;
  publishedAt: string;
};
const planRef = doc(getFirestore(firebaseApp, "ad-studio"), "publication-plans", "main");
function authorize() {
  if (firebaseAuth.currentUser?.email?.toLowerCase() !== allowedEmail) throw new Error("Accès non autorisé.");
}
function readEntries(data: unknown): PlannedPublication[] {
  if (!Array.isArray(data)) return [];
  return data.filter((entry) => entry && typeof entry.id === "string" && typeof entry.postId === "string")
    .map((entry) => ({ id: entry.id, postId: entry.postId, date: typeof entry.date === "string" ? entry.date : "", publishedAt: typeof entry.publishedAt === "string" ? entry.publishedAt : "" }));
}
export function subscribeToPublicationPlan(onChange: (entries: PlannedPublication[]) => void, onError: (error: Error) => void) {
  authorize();
  return onSnapshot(planRef, (snapshot) => onChange(readEntries(snapshot.data()?.entries)), onError);
}
export async function updatePublicationPlan(change: (entries: PlannedPublication[]) => PlannedPublication[]) {
  authorize();
  await runTransaction(getFirestore(firebaseApp, "ad-studio"), async (transaction) => {
    const snapshot = await transaction.get(planRef);
    transaction.set(planRef, { entries: change(readEntries(snapshot.data()?.entries)) });
  });
}
