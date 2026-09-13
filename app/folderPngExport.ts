import type { MessageLanguage } from "../firebase/messages";
import type { PostPage } from "../firebase/postPages";
import type { StudioPost } from "../firebase/posts";

export function getFolderPngEntries(posts: StudioPost[], postPages: PostPage[]) {
  const byId = new Map(postPages.map((postPage) => [postPage.id, postPage]));
  // Number posts from the bottom of the displayed folder; keep gallery pages in their own order.
  return [...posts].reverse().flatMap((post, postIndex) => {
    if (!post.pageIds.length) throw new Error(`Le post ${postIndex + 1} ne contient aucune image.`);
    return post.pageIds.flatMap((pageId, imageIndex) => {
      const postPage = byId.get(pageId);
      if (!postPage) throw new Error(`L’image ${imageIndex + 1} du post ${postIndex + 1} est introuvable. Rechargez les posts avant de réessayer.`);
      return (["fr", "en", "pt"] as MessageLanguage[]).map((language) => ({
        postPage,
        language,
        filename: `${language}_post_${postIndex + 1}${post.type === "gallery" ? `_image_${imageIndex + 1}` : ""}.png`,
      }));
    });
  });
}
