import type { ReactNode } from "react";
import type { Creation } from "../../firebase/creations";
import { CAMPAIGN_LANGUAGES, type Campaign } from "../../firebase/campaigns";
import type { GalleryAsset } from "../../firebase/gallery";
import type { InstagramPublication } from "../../firebase/instagramPublishing";
import { CreationCanvasPreview } from "../CreationCanvasPreview";
import { InstagramPublicationStatus } from "../InstagramPublicationStatus";
import { Icon } from "./Icon";

type Props = {
  creation?: Creation;
  campaigns: Campaign[];
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
export function PostPreview({ creation, campaigns, galleryAssets, gallery, publications, status, onOpen, onToggleGallery, expanded, actions }: Props) {
  const campaign = campaigns.find((item) => item.id === creation?.campaignId);
  const language = CAMPAIGN_LANGUAGES.find(({ id }) => campaign?.translations[id].title.trim() || campaign?.translations[id].description.trim())?.id ?? "fr";
  const content = campaign?.translations[language];
  const visual = creation ? <CreationCanvasPreview creation={creation} campaignTitle={content?.title ?? ""} campaignDescription={content?.description ?? ""} language={language} galleryAssets={galleryAssets} /> : <span className="post-empty-preview">Aucune page</span>;
  return <div className="studio-post-preview">
    <div className="studio-post-cover">
      {onOpen ? <button type="button" className="creation-preview studio-post-image" onClick={onOpen} aria-label={gallery ? "Modifier la galerie" : "Modifier le post"}>{visual}</button> : <div className="creation-preview studio-post-image">{visual}</div>}
      {gallery && (onToggleGallery ? <button type="button" className="studio-gallery-badge" onClick={onToggleGallery} aria-label="Afficher les pages de la galerie" aria-expanded={expanded} title="Afficher les pages"><Icon name="collections" /></button> : <span className="studio-gallery-badge" title="Galerie"><Icon name="collections" /></span>)}
    </div>
    <div className="studio-post-footer"><InstagramPublicationStatus items={publications} status={status} />{actions && <div className="studio-post-actions">{actions}</div>}</div>
  </div>;
}
