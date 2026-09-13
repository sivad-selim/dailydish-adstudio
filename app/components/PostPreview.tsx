import type { ReactNode } from "react";
import type { PostPage } from "../../firebase/postPages";
import { MESSAGE_LANGUAGES } from "../../firebase/messages";
import type { GalleryAsset } from "../../firebase/gallery";
import type { InstagramPublication } from "../../firebase/instagramPublishing";
import { PageCanvasPreview } from "../PageCanvasPreview";
import { InstagramPublicationStatus } from "../InstagramPublicationStatus";
import { Icon } from "./Icon";

type Props = {
  postPage?: PostPage;

  galleryAssets: GalleryAsset[];
  gallery: boolean;
  publications: InstagramPublication[];
  status: string;
  onOpen?: () => void;
  onToggleGallery?: () => void;
  expanded?: boolean;
  actions?: ReactNode;
};

/** Same cover, gallery badge and publication footer in Posts, picker and planner.
 * Drag/drop remains on the owning card; this component never owns a drag target.
 */
export function PostPreview({ postPage, galleryAssets, gallery, publications, status, onOpen, onToggleGallery, expanded, actions }: Props) {
  const message = postPage;
  const language = MESSAGE_LANGUAGES.find(({ id }) => message?.translations[id].title.trim() || message?.translations[id].description.trim())?.id ?? "fr";
  const content = message?.translations[language];
  const visual = postPage ? <PageCanvasPreview postPage={postPage} messageTitle={content?.title ?? ""} messageDescription={content?.description ?? ""} language={language} galleryAssets={galleryAssets} /> : <span className="post-empty-preview">Aucune page</span>;
  return <div className="studio-post-preview">
    <div className="studio-post-cover">
      {onOpen ? <button type="button" className="page-preview studio-post-image" onClick={onOpen} aria-label={gallery ? "Modifier la galerie" : "Modifier le post"}>{visual}</button> : <div className="page-preview studio-post-image">{visual}</div>}
      {gallery && (onToggleGallery ? <button type="button" className="studio-gallery-badge" onClick={onToggleGallery} aria-label="Afficher les pages de la galerie" aria-expanded={expanded} title="Afficher les pages"><Icon name="collections" /></button> : <span className="studio-gallery-badge" title="Galerie"><Icon name="collections" /></span>)}
    </div>
    <div className="studio-post-footer"><InstagramPublicationStatus items={publications} status={status} />{actions && <div className="studio-post-actions">{actions}</div>}</div>
  </div>;
}
