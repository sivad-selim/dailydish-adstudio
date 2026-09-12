import { getFunctions, httpsCallable } from "firebase/functions";
import { firebaseApp } from "./firebaseAuth";

export type InstagramAccount = "en" | "fr" | "br";
export type InstagramConnection = { account: InstagramAccount; username: string; userId: string; checkedAt: string };
const verify = httpsCallable<{ account: InstagramAccount }, InstagramConnection>(
  getFunctions(firebaseApp, "us-central1"), "verifyAdStudioInstagram", { timeout: 30000 },
);
export async function verifyInstagramConnection(account: InstagramAccount) {
  return (await verify({ account })).data;
}

export function instagramConnectionError(error: unknown) {
  const code = (error as { code?: string })?.code;
  if (code === "functions/failed-precondition" || code === "functions/invalid-argument") {
    return (error as Error).message;
  }
  if (code === "functions/unauthenticated") return "Reconnecte-toi à l’Ad Studio pour vérifier Instagram.";
  if (code === "functions/permission-denied") return "Cette connexion est réservée au propriétaire de l’Ad Studio.";
  return "Connexion indisponible. Vérifie que la fonction serveur et les tokens Instagram ont été installés, puis réessaie.";
}
