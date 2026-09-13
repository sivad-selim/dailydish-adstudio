import { doc, getFirestore, onSnapshot, runTransaction } from "firebase/firestore";
import { allowedEmail, firebaseApp, firebaseAuth } from "./firebaseAuth";

export type PlannedPublication = {
  id: string;
  postId: string;
  date: string;
  publishedAt: string;
  scheduleRevision?: string;
};
const planRef = doc(getFirestore(firebaseApp, "ad-studio"), "publication-plans", "main");
function authorize() {
  if (firebaseAuth.currentUser?.email?.toLowerCase() !== allowedEmail) throw new Error("Accès non autorisé.");
}
function readEntries(data: unknown): PlannedPublication[] {
  if (!Array.isArray(data)) return [];
  return data.filter((entry) => entry && typeof entry.id === "string" && typeof entry.postId === "string")
    .map((entry) => ({ id: entry.id, postId: entry.postId, date: typeof entry.date === "string" ? entry.date : "", scheduleRevision: typeof entry.scheduleRevision === "string" ? entry.scheduleRevision : "", publishedAt: typeof entry.publishedAt === "string" ? entry.publishedAt : "" }));
}
export function subscribeToPublicationPlan(onChange: (entries: PlannedPublication[]) => void, onError: (error: Error) => void) {
  authorize();
  return onSnapshot(planRef, (snapshot) => onChange(readEntries(snapshot.data()?.entries)), onError);
}
export async function updatePublicationPlan(change: (entries: PlannedPublication[]) => PlannedPublication[]) {
  authorize();
  return runTransaction(getFirestore(firebaseApp, "ad-studio"), async (transaction) => {
    const snapshot = await transaction.get(planRef);
    const before = readEntries(snapshot.data()?.entries);
    const entries = change(before).map((entry) => {
      const previous = before.find((item) => item.id === entry.id);
      return previous?.date === entry.date && previous?.postId === entry.postId ? entry : {...entry, scheduleRevision: crypto.randomUUID()};
    });
    transaction.set(planRef, { entries });
    return {entries, changed: entries.filter((entry) => entry.date && entry.scheduleRevision !== before.find((previous) => previous.id === entry.id)?.scheduleRevision)};
  });
}
