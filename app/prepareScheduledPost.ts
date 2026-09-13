import type {Campaign} from "../firebase/campaigns";
import type {Creation} from "../firebase/creations";
import type {StudioPost} from "../firebase/posts";
import type {GalleryAsset} from "../firebase/gallery";
import type {PlannedPublication} from "../firebase/publicationPlan";
import {prepareSchedule} from "../firebase/scheduling";
import {uploadInstagramImage} from "../firebase/instagramPublishing";
import {exportInstagramImage} from "./exportInstagramImage";
import {PUBLICATION_ACCOUNTS, publicationTranslation} from "./instagramPublicationModel";

export function scheduleSourceVersions(post: StudioPost, creations: Creation[], campaigns: Campaign[]) {
  const versions: Record<string, number> = {[`posts/${post.id}`]: post.updatedAt};
  for (const id of post.pageIds) {
    const page = creations.find((item) => item.id === id);
    versions[`creations/${id}`] = page?.updatedAt ?? 0;
    if (page?.campaignId) versions[`campaigns/${page.campaignId}`] = campaigns.find((item) => item.id === page.campaignId)?.updatedAt ?? 0;
  }
  return versions;
}
export async function prepareScheduledPost(entry: PlannedPublication, post: StudioPost, creations: Creation[], campaigns: Campaign[], assets: GalleryAsset[], progress: (message: string) => void) {
  const revision = entry.scheduleRevision;
  const {preparationId} = await prepareSchedule({phase: "begin", entryId: entry.id, revision, clientVersions: scheduleSourceVersions(post, creations, campaigns)});
  try {
    const payloads: Record<string, unknown> = {};
    const pages = post.pageIds.map((id) => creations.find((page) => page.id === id));
    if (!pages.length || pages.length > 10 || pages.some((page) => !page)) throw new Error("Le post doit contenir de 1 à 10 pages disponibles.");
    for (const {id: account, language, label} of PUBLICATION_ACCOUNTS) {
      const imagePaths: string[] = [];
      for (let index = 0; index < pages.length; index++) {
        const page = pages[index]!;
        const translation = publicationTranslation(campaigns.find((item) => item.id === page.campaignId), language);
        progress(`${label} · Génération ${index + 1}/${pages.length}`);
        const image = await exportInstagramImage(page, language, translation.title, translation.description, assets);
        progress(`${label} · Transfert ${index + 1}/${pages.length}`);
        imagePaths.push(await uploadInstagramImage(entry.id, account, image));
      }
      const caption = publicationTranslation(campaigns.find((item) => item.id === pages[0]!.campaignId), language).caption;
      payloads[account] = {postId: post.id, imagePath: imagePaths[0], imagePaths, caption};
    }
    progress("Vérification et enregistrement…");
    await prepareSchedule({phase: "finish", entryId: entry.id, revision, preparationId, payloads});
  } catch (error) {
    try { await prepareSchedule({phase: "failed", entryId: entry.id, revision, preparationId, message: error instanceof Error ? error.message : "Préparation interrompue."}); } catch { /* Preserve the original actionable error. */ }
    throw error;
  }
}
