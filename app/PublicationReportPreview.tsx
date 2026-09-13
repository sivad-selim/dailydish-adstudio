import {useEffect, useRef, useState} from "react";
import type {CampaignLanguage} from "../firebase/campaigns";
import type {Creation} from "../firebase/creations";
import type {GalleryAsset} from "../firebase/gallery";
import {instagramImageUrl} from "../firebase/instagramPublishing";
import {CreationCanvasPreview} from "./CreationCanvasPreview";

// Many events refer to the same cover. Resolve its Storage URL once per session.
const urls = new Map<string, Promise<string>>();
function coverUrl(path: string) {
  if (!urls.has(path)) {
    if (urls.size > 500) urls.clear();
    urls.set(path, instagramImageUrl(path).catch((error) => {urls.delete(path); throw error;}));
  }
  return urls.get(path)!;
}
export function PublicationReportPreview({imagePath, creation, title, description, language, assets}: {
  imagePath?: string; creation?: Creation; title: string; description: string; language: CampaignLanguage; assets: GalleryAsset[];
}) {
  const retried = useRef(false);
  const [image, setImage] = useState<{path: string; url: string} | null>(null);
  useEffect(() => {
    let active = true;
    retried.current = false;
    if (imagePath) void coverUrl(imagePath).then((url) => {if (active) setImage({path: imagePath, url});}).catch(() => {if (active) setImage(null);});
    return () => {active = false;};
  }, [imagePath]);
  return <div className="planner-report-preview">
    {imagePath ? (image?.path === imagePath ? <img src={image.url} alt={title || `Post ${language === "pt" ? "BR" : language.toUpperCase()}`} loading="lazy" onError={() => {
      // Publishing rotates the Storage download token; refresh a cached URL once.
      if (retried.current) {setImage(null); return;}
      retried.current = true;
      urls.delete(imagePath);
      void coverUrl(imagePath).then((url) => setImage({path: imagePath, url})).catch(() => setImage(null));
    }} /> : <span aria-label="Aperçu indisponible">—</span>)
      : creation ? <CreationCanvasPreview creation={creation} language={language} campaignTitle={title} campaignDescription={description} galleryAssets={assets} previewWidth={76} showPlaceholder={false} />
      : <span aria-label="Aperçu indisponible">—</span>}
  </div>;
}
