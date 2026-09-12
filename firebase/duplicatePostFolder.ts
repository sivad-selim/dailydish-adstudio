import { orderFolderPosts } from "../app/postOrder";
import { createCreationFolder, deleteCreationFolder, saveFolderPostOrder, type CreationFolder } from "./creationFolders";
import { duplicateCreation, deleteCreation, type Creation } from "./creations";
import { createStudioPost, saveStudioPost, deleteStudioPost, type StudioPost } from "./posts";

export async function duplicatePostFolder(
  folder: CreationFolder,
  posts: StudioPost[],
  creations: Creation[],
): Promise<void> {
  const byId = new Map(creations.map((creation) => [creation.id, creation]));
  // Validate the entire snapshot before creating anything.
  const source = orderFolderPosts(posts.filter((post) => post.folderId === folder.id), folder.postOrder).map((post) => ({
    post,
    pages: post.pageIds.map((id) => {
      const page = byId.get(id);
      if (!page) throw new Error("Une page est introuvable. Rechargez les posts avant de réessayer.");
      return page;
    }),
  }));
  const folderId = await createCreationFolder(`${folder.name} — Copie`);
  const postIds: string[] = [];
  const pageIds: string[] = [];
  try {
    // Posts are displayed newest first: copy from bottom to top to keep their order.
    for (const { post, pages } of source.reverse()) {
      const copy = await createStudioPost(folderId, post.type);
      postIds.push(copy.id);
      const copiedPages: string[] = [];
      for (const page of pages) {
        const id = await duplicateCreation(page, { folderId, postId: copy.id });
        pageIds.push(id);
        copiedPages.push(id);
      }
      await saveStudioPost({ ...copy, pageIds: copiedPages });
    }
    await saveFolderPostOrder(folderId, [...postIds].reverse());
  } catch (error) {
    const cleanup = await Promise.allSettled([
      ...pageIds.map((id) => deleteCreation(id)),
      ...postIds.map((id) => deleteStudioPost(id)),
    ]);
    if (cleanup.some((result) => result.status === "rejected")) {
      throw new Error("La copie a échoué et son nettoyage est incomplet. Supprimez le dossier de copie avant de réessayer.");
    }
    try {
      await deleteCreationFolder(folderId);
    } catch {
      throw new Error("La copie a échoué. Le dossier de copie vide n’a pas pu être supprimé.");
    }
    throw error;
  }
}
