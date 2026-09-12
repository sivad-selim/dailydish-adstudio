import type { CampaignLanguage } from "../firebase/campaigns";
import type { Creation } from "../firebase/creations";
import type { StudioPost } from "../firebase/posts";

export function getFolderPngEntries(posts: StudioPost[], creations: Creation[]) {
  const byId = new Map(creations.map((creation) => [creation.id, creation]));
  // Number posts from the bottom of the displayed folder; keep gallery pages in their own order.
  return [...posts].reverse().flatMap((post, postIndex) => {
    if (!post.pageIds.length) throw new Error(`Le post ${postIndex + 1} ne contient aucune image.`);
    return post.pageIds.flatMap((pageId, imageIndex) => {
      const creation = byId.get(pageId);
      if (!creation) throw new Error(`L’image ${imageIndex + 1} du post ${postIndex + 1} est introuvable. Rechargez les posts avant de réessayer.`);
      return (["fr", "en", "pt"] as CampaignLanguage[]).map((language) => ({
        creation,
        language,
        filename: `${language}_post_${postIndex + 1}${post.type === "gallery" ? `_image_${imageIndex + 1}` : ""}.png`,
      }));
    });
  });
}
