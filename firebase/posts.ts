import {
  collection, doc, getFirestore, onSnapshot, orderBy, query,
  runTransaction, serverTimestamp, updateDoc, type Timestamp, type Unsubscribe,
} from "firebase/firestore";
import { allowedEmail, firebaseApp, firebaseAuth } from "./firebaseAuth";
import { newPostPageData, type PostPage } from "./postPages";

export type StudioPostType = "single" | "gallery";
export type StudioPost = { id: string; folderId: string; type: StudioPostType; pageIds: string[]; updatedAt: number };
const db = getFirestore(firebaseApp, "ad-studio");
const posts = collection(db, "posts");
const pages = collection(db, "post-pages");
const authorize = () => {
  if (firebaseAuth.currentUser?.email?.trim().toLowerCase() !== allowedEmail) throw new Error("Accès Firebase non autorisé.");
};
const readPost = (id: string, data: Record<string, unknown>): StudioPost => {
  const pageIds = data.pageIds as string[];
  return {id, folderId: String(data.folderId ?? ""), pageIds, type: pageIds.length > 1 ? "gallery" : "single", updatedAt: (data.updatedAt as Timestamp)?.toMillis?.() ?? 0};
};
const stamp = () => ({updatedAt: serverTimestamp()});
function checkPages(ids: string[]) {
  if (!ids.length || ids.length > 10 || new Set(ids).size !== ids.length) throw new Error("Un post contient de 1 à 10 pages distinctes.");
}
export function subscribeToPosts(receive: (posts: StudioPost[]) => void, error: (error: Error) => void): Unsubscribe {
  authorize();
  return onSnapshot(query(posts, orderBy("updatedAt", "desc")), (snapshot) => receive(snapshot.docs.map((row) => readPost(row.id, row.data()))), error);
}

/** A new post and all its initial pages are created atomically. */
export async function createStudioPost(folderId: string, initialPageCount: 1 | 2 = 1): Promise<StudioPost> {
  authorize();
  const post = doc(posts);
  const refs = Array.from({length: initialPageCount}, () => doc(pages));
  const pageIds = refs.map((page) => page.id);
  checkPages(pageIds);
  await runTransaction(db, async (transaction) => {
    transaction.set(post, {folderId, pageIds, ownerEmail: allowedEmail, createdAt: serverTimestamp(), ...stamp()});
    refs.forEach((page) => transaction.set(page, newPostPageData(post.id)));
  });
  return {id: post.id, folderId, type: initialPageCount === 1 ? "single" : "gallery", pageIds, updatedAt: 0};
}
export async function moveStudioPost(id: string, folderId: string) {
  authorize();
  await updateDoc(doc(posts, id), {folderId, ...stamp()});
}
export async function addPostPage(postId: string, sourceId?: string, draft?: PostPage): Promise<string> {
  authorize();
  const post = doc(posts, postId), page = doc(pages);
  await runTransaction(db, async (transaction) => {
    const snapshot = await transaction.get(post);
    const source = sourceId ? await transaction.get(doc(pages, sourceId)) : null;
    if (!snapshot.exists()) throw new Error("Le post n’existe plus.");
    const ids: string[] = snapshot.data().pageIds;
    if (sourceId && (!ids.includes(sourceId) || !source?.exists())) throw new Error("La page n’appartient plus à ce post.");
    const next = [...ids]; next.splice(sourceId ? ids.indexOf(sourceId) + 1 : ids.length, 0, page.id); checkPages(next);
    // A duplicate receives its own ID and complete independent text/layout values.
    let data = newPostPageData(postId);
    if (source?.exists()) {
      data = {...data, ...source.data(), postId, createdAt: serverTimestamp(), ...stamp()};
      if (draft) data = {...data, name: draft.name, format: draft.format, theme: draft.theme, background: draft.background, backgroundAssetId: draft.backgroundAssetId, properties: draft.properties};
    }
    transaction.set(page, data);
    transaction.update(post, {pageIds: next, ...stamp()});
  });
  return page.id;
}
export async function reorderPostPages(postId: string, ids: string[]) {
  authorize(); checkPages(ids);
  const ref = doc(posts, postId);
  await runTransaction(db, async (transaction) => {
    const snapshot = await transaction.get(ref);
    const current: string[] = snapshot.data()?.pageIds ?? [];
    if (current.length !== ids.length || current.some((id) => !ids.includes(id))) throw new Error("Les pages ont changé. Réessaie avec leur nouvel ordre.");
    transaction.update(ref, {pageIds: ids, ...stamp()});
  });
}
export async function removePostPage(postId: string, pageId: string) {
  authorize();
  const post = doc(posts, postId), page = doc(pages, pageId);
  await runTransaction(db, async (transaction) => {
    const snapshot = await transaction.get(post);
    const owned = await transaction.get(page);
    const ids: string[] = snapshot.data()?.pageIds ?? [];
    if (!ids.includes(pageId) || owned.data()?.postId !== postId) throw new Error("Cette page n’appartient plus au post.");
    const remaining = ids.filter((id) => id !== pageId);
    transaction.delete(page);
    if (remaining.length) transaction.update(post, {pageIds: remaining, ...stamp()});
    else transaction.delete(post);
  });
}
export async function deleteStudioPost(postId: string) {
  authorize();
  const ref = doc(posts, postId);
  await runTransaction(db, async (transaction) => {
    const snapshot = await transaction.get(ref);
    if (!snapshot.exists()) return;
    const owned = await Promise.all((snapshot.data().pageIds as string[]).map((id) => transaction.get(doc(pages, id))));
    if (owned.some((page) => !page.exists() || page.data().postId !== postId)) throw new Error("Les pages ont changé. Recharge le post avant de le supprimer.");
    owned.forEach((page) => transaction.delete(page.ref));
    transaction.delete(ref);
  });
}
export async function duplicateStudioPost(postId: string, folderId?: string): Promise<string> {
  authorize();
  const copy = doc(posts);
  await runTransaction(db, async (transaction) => {
    const source = await transaction.get(doc(posts, postId));
    if (!source.exists()) throw new Error("Le post n’existe plus.");
    const owned = await Promise.all((source.data().pageIds as string[]).map((id) => transaction.get(doc(pages, id))));
    if (owned.some((page) => !page.exists() || page.data().postId !== postId)) throw new Error("Une page est introuvable.");
    const refs = owned.map(() => doc(pages));
    owned.forEach((page, index) => transaction.set(refs[index], {...page.data(), postId: copy.id, createdAt: serverTimestamp(), ...stamp()}));
    transaction.set(copy, {...source.data(), pageIds: refs.map((ref) => ref.id), folderId: folderId ?? source.data().folderId, createdAt: serverTimestamp(), ...stamp()});
  });
  return copy.id;
}
export async function swapPageMessages(postId: string, firstId: string, secondId: string) {
  authorize();
  if (firstId === secondId) return;
  await runTransaction(db, async (transaction) => {
    const post = await transaction.get(doc(posts, postId));
    const first = await transaction.get(doc(pages, firstId)), second = await transaction.get(doc(pages, secondId));
    const ids: string[] = post.data()?.pageIds ?? [];
    if (!ids.includes(firstId) || !ids.includes(secondId) || first.data()?.postId !== postId || second.data()?.postId !== postId) throw new Error("Les pages ont changé. Réessaie.");
    transaction.update(first.ref, {translations: second.data()!.translations, ...stamp()});
    transaction.update(second.ref, {translations: first.data()!.translations, ...stamp()});
  });
}
export async function transferPostPage(sourcePostId: string, pageId: string, targetPostId: string | null, folderId: string, beforePageId = "") {
  authorize();
  if (sourcePostId === targetPostId) throw new Error("Destination identique.");
  const sourceRef = doc(posts, sourcePostId), targetRef = targetPostId ? doc(posts, targetPostId) : doc(posts), pageRef = doc(pages, pageId);
  await runTransaction(db, async (transaction) => {
    const source = await transaction.get(sourceRef), target = targetPostId ? await transaction.get(targetRef) : null, page = await transaction.get(pageRef);
    const from: string[] = source.data()?.pageIds ?? [];
    if (!from.includes(pageId) || page.data()?.postId !== sourcePostId) throw new Error("Cette page a déjà été déplacée.");
    if (targetPostId && !target?.exists()) throw new Error("Le post de destination n’existe plus.");
    const to: string[] = [...(target?.data()?.pageIds ?? [])];
    const index = beforePageId ? to.indexOf(beforePageId) : to.length;
    if (index < 0) throw new Error("L’ordre des pages a changé.");
    to.splice(index, 0, pageId); checkPages(to);
    const remaining = from.filter((id) => id !== pageId);
    if (remaining.length) transaction.update(sourceRef, {pageIds: remaining, ...stamp()});
    else transaction.delete(sourceRef);
    if (target?.exists()) transaction.update(targetRef, {pageIds: to, ...stamp()});
    else transaction.set(targetRef, {folderId, pageIds: to, ownerEmail: allowedEmail, createdAt: serverTimestamp(), ...stamp()});
    transaction.update(pageRef, {postId: targetRef.id, ...stamp()});
  });
}
