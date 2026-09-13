import { orderFolderPosts } from "../app/postOrder";
import { createPostFolder, deletePostFolder, saveFolderPostOrder, type PostFolder } from "./postFolders";
import { duplicateStudioPost, deleteStudioPost, type StudioPost } from "./posts";

export async function duplicatePostFolder(folder: PostFolder, posts: StudioPost[]): Promise<void> {
  const source = orderFolderPosts(posts.filter((post) => post.folderId === folder.id), folder.postOrder);
  const folderId = await createPostFolder(`${folder.name} — Copie`);
  const copies: string[] = [];
  try {
    for (const post of [...source].reverse()) copies.push(await duplicateStudioPost(post.id, folderId));
    await saveFolderPostOrder(folderId, [...copies].reverse());
  } catch (error) {
    const cleanup = await Promise.allSettled(copies.map(deleteStudioPost));
    if (cleanup.some((item) => item.status === "rejected")) throw new Error("La copie a échoué. Son dossier contient une copie partielle à supprimer.");
    await deletePostFolder(folderId);
    throw error;
  }
}
