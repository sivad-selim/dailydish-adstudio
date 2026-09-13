import {useEffect, useRef, useState} from "react";
import type {MessageLanguage} from "../firebase/messages";
import type {PostPage} from "../firebase/postPages";
import type {GalleryAsset} from "../firebase/gallery";
import {instagramImageUrl} from "../firebase/instagramPublishing";
import {PageCanvasPreview} from "./PageCanvasPreview";

// Many events refer to the same cover. Resolve its Storage URL once per session.
const urls = new Map<string, Promise<string>>();
function coverUrl(path: string) {
  if (!urls.has(path)) {
    if (urls.size > 500) urls.clear();
    urls.set(path, instagramImageUrl(path).catch((error) => {urls.delete(path); throw error;}));
  }
  return urls.get(path)!;
}
export function PublicationReportPreview({imagePath, postPage, title, description, language, assets}: {
  imagePath?: string; postPage?: PostPage; title: string; description: string; language: MessageLanguage; assets: GalleryAsset[];
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
      : postPage ? <PageCanvasPreview postPage={postPage} language={language} messageTitle={title} messageDescription={description} galleryAssets={assets} previewWidth={76} />
      : <span aria-label="Aperçu indisponible">—</span>}
  </div>;
}
