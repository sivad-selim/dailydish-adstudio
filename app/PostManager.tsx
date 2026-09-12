"use client";

import { createRoot } from "react-dom/client";
import { flushSync } from "react-dom";
import { exportCanvasPng } from "./exportCanvasPng";
import { orderFolderPosts, movePostInOrder } from "./postOrder";
import { getFolderPngEntries } from "./folderPngExport";
import {
  type CSSProperties,
  type DragEvent as ReactDragEvent,
  type PointerEvent as ReactPointerEvent,
  type Ref,
  type RefObject,
  useEffect,
  useRef,
  useState,
} from "react";
import { CAMPAIGN_LANGUAGES, type Campaign, type CampaignLanguage } from "../firebase/campaigns";
import type { CreationFolder } from "../firebase/creationFolders";
import { TEXT_SPACING, getImageAssetId, type Creation } from "../firebase/creations";
import type { GalleryAsset } from "../firebase/gallery";
import type { StudioPost, StudioPostType } from "../firebase/posts";
import { InstagramPublicationStatus, useInstagramHistory } from "./InstagramPublicationStatus";
import { CanvasBackgroundImage } from "./CanvasBackgroundImage";
import {
  DRAG_AUTO_SCROLL_EDGE,
  DRAG_AUTO_SCROLL_MAX_SPEED,
} from "./dragScroll";
import { ThemeableBackgroundArtwork } from "./ThemeableBackgroundArtwork";
import {
  getBackgroundColorStyle,
  getDefaultBackgroundColors,
  getDefaultTextColors,
  getTextColorStyle,
  getThemeStyle,
  isDarkColor,
  resolveBackgroundColors,
  resolveTextColors,
} from "./themePalettes";

const IMAGE_BASE_WIDTH = 47;
const BACKGROUND_PALETTE_SHAPE_COUNT = 4;
const PHONE_FRAME_CONTROLS_MIN_SCALE = 62;
const UNFILED_DROP_KEY = "__unfiled__";

export type PostListViewState = { expandedPostId: string; collapsedFolderKeys: string[] };

type PostManagerProps = {
  viewStateRef: RefObject<PostListViewState>;
  posts: StudioPost[];
  creations: Creation[];
  folders: CreationFolder[];
  campaigns: Campaign[];
  galleryAssets: GalleryAsset[];
  loading: boolean;
  errorMessage: string;
  onCreatePost: (folderId: string, type: StudioPostType) => Promise<string>;
  onAddPage: (post: StudioPost) => Promise<void>;
  onOpenPage: (creationId: string) => void;
  onEditPost: (post: StudioPost) => void;
  onDuplicatePost: (post: StudioPost) => Promise<void>;
  onDeletePost: (post: StudioPost) => Promise<void>;
  onReorderPosts: (folderId: string, postIds: string[]) => Promise<void>;
  onTransferPage: (sourcePostId: string, pageId: string, targetPostId: string | null, folderId: string, beforePageId?: string) => Promise<void>;
  onReorderPages: (post: StudioPost, pageIds: string[]) => Promise<void>;
  onCreateFolder: (name: string) => Promise<void>;
  onDuplicateFolder: (folder: CreationFolder) => Promise<void>;
  onDeleteFolder: (folder: CreationFolder) => Promise<void>;
  onMovePost: (post: StudioPost, folderId: string) => Promise<void>;
  onRenameFolder: (folder: CreationFolder, name: string) => Promise<void>;
};



const getCampaignContent = (
  creation: Creation | undefined,
  campaigns: Campaign[],
) => {
  const campaign = campaigns.find(
    (candidate) => candidate.id === creation?.campaignId,
  );
  const language = CAMPAIGN_LANGUAGES.find(({ id }) =>
    campaign?.translations[id].title.trim() || campaign?.translations[id].description.trim(),
  )?.id ?? "fr";
  const translation = campaign?.translations[language];
  return {
    language,
    title: translation?.title.trim() ?? "",
    description: translation?.description.trim() ?? "",
  };
};

export function CreationCanvasPreview({
  creation,
  campaignTitle,
  campaignDescription,
  galleryAssets,
  language = "fr",
  showPlaceholder = true,
  interactive = false,
  previewWidth,
  rootRef,
  onImagePointerDown,
  onImagePointerMove,
  onImagePointerUp,
  onImagePointerCancel,
}: {
  creation: Creation;
  campaignTitle: string;
  campaignDescription: string;
  galleryAssets: GalleryAsset[];
  language?: CampaignLanguage;
  showPlaceholder?: boolean;
  interactive?: boolean;
  previewWidth?: number;
  rootRef?: Ref<HTMLDivElement>;
  onImagePointerDown?: (
    event: ReactPointerEvent<HTMLDivElement>,
    image: Creation["properties"]["images"][number],
  ) => void;
  onImagePointerMove?: (event: ReactPointerEvent<HTMLDivElement>) => void;
  onImagePointerUp?: () => void;
  onImagePointerCancel?: () => void;
}) {
  const backgroundAsset = galleryAssets.find(
    (asset) => asset.id === creation.backgroundAssetId,
  );
  const backgroundImageUrl = backgroundAsset?.url ?? "";
  const activeBackgroundColors = resolveBackgroundColors(
    creation.properties.backgroundColors,
    getDefaultBackgroundColors(
      creation.theme,
      BACKGROUND_PALETTE_SHAPE_COUNT,
    ),
  );
  const darkTextBackdrop =
    creation.properties.textBackdrop === "gradient-dark" ||
    creation.properties.textBackdrop === "band-dark" ||
    isDarkColor(activeBackgroundColors.base);
  const thumbnailTextColors = resolveTextColors(
    creation.properties.textColors,
    getDefaultTextColors(creation.theme, darkTextBackdrop),
  );
  const themeStyle = {
    ...getThemeStyle(creation.theme),
    ...getBackgroundColorStyle(activeBackgroundColors),
    ...getTextColorStyle(thumbnailTextColors),
    "--theme-label-bg":
      creation.properties.assistantBackgroundColor ||
      activeBackgroundColors.base,
  };
  const [textVerticalPosition, textHorizontalPosition] =
    creation.properties.textPosition.split("-");

  return (
    <div
      ref={rootRef}
      className={`creation-preview-canvas ad-canvas format-${creation.format} theme-${creation.theme} background-${creation.background} ${backgroundImageUrl ? "background-illustrated background-gallery-image" : ""}`}
      style={
        {
          ...(previewWidth ? { "--preview-width": `${previewWidth}px` } : {}),
          ...themeStyle,
        } as CSSProperties
      }
      aria-hidden={interactive ? undefined : true}
    >
      {backgroundImageUrl && (
        <CanvasBackgroundImage
          assetId={creation.backgroundAssetId}
          positionY={creation.properties.backgroundPositionY}
          url={backgroundImageUrl}
        />
      )}
      {!backgroundImageUrl && (
        <ThemeableBackgroundArtwork background={creation.background} />
      )}
      <div className="blob blob-green" />
      <div className="blob blob-purple" />
      <div className="blob blob-blue" />

      <div
        className={`ad-copy text-row-${textVerticalPosition} text-align-${textHorizontalPosition} text-backdrop-${creation.properties.textBackdrop} ${creation.properties.showAssistantLabel ? "with-assistant" : "without-assistant"} ${campaignDescription ? "with-description" : "without-description"}`}
        style={
          {
            "--text-width": `${creation.properties.textWidth}%`,
            "--text-margin-x": `${creation.properties.textMarginHorizontal}cqw`,
            "--text-margin-y": `${creation.properties.textMarginVertical}cqw`,
            "--text-rotation": `${creation.properties.textRotation}deg`,
            "--text-surface-padding": `${TEXT_SPACING}cqw`,
          } as CSSProperties
        }
      >
        <span className="text-backdrop-surface" aria-hidden="true" />
        {creation.properties.showAssistantLabel && (
          <div className="assistant-label">
            <span aria-hidden="true">✦</span>
            <span className="assistant-label-text">Assistant DailyDish</span>
          </div>
        )}
        {(campaignTitle || showPlaceholder) && <h2 className={campaignTitle.length > 58 ? "long-title" : ""}>
          {campaignTitle || "Votre titre"}
        </h2>}
        {campaignDescription && <p>{campaignDescription}</p>}
      </div>

      {creation.properties.images.map((image, imageIndex) => {
        const asset = galleryAssets.find(
          (galleryAsset) => galleryAsset.id === getImageAssetId(image, language),
        );
        const width = (IMAGE_BASE_WIDTH * image.scale) / 100;
        const shadowOpacity =
          image.shadowDistance === 0 ? 0 : image.shadowStrength * 0.006;
        const shadowBlur = image.shadowDistance * 0.24;
        return (
          <div
            key={image.id}
            className={`canvas-image-object ${image.frame ? "with-phone-frame" : "without-phone-frame"} ${image.frame && image.scale >= PHONE_FRAME_CONTROLS_MIN_SCALE ? "show-phone-frame-controls" : ""} ${image.aboveText ? "above-text" : "below-text"} ${asset ? "has-image" : "is-empty"}`}
            style={
              {
                "--image-x": `${image.x}cqw`,
                "--image-y": `${image.y}cqw`,
                "--image-width": `${width}cqw`,
                "--image-rotation": `${image.rotation}deg`,
                "--image-shadow-blur": `${shadowBlur}cqw`,
                "--image-shadow-color": `rgba(21, 33, 20, ${shadowOpacity})`,
                zIndex: image.aboveText ? 8 + (image.foregroundOrder ?? 0) : 4,
              } as CSSProperties
            }
            aria-label={
              interactive ? `Déplacer l’image ${imageIndex + 1}` : undefined
            }
            onPointerDown={
              interactive && onImagePointerDown
                ? (event) => onImagePointerDown(event, image)
                : undefined
            }
            onPointerMove={interactive ? onImagePointerMove : undefined}
            onPointerUp={interactive ? onImagePointerUp : undefined}
            onPointerCancel={interactive ? onImagePointerCancel : undefined}
          >
            <div className="canvas-image-viewport">
              {asset ? (
                <img
                  className="canvas-image"
                  src={asset.url}
                  data-gallery-asset-id={asset.id}
                  alt=""
                  draggable={false}
                />
              ) : (
                <div className="image-placeholder">
                  <img src="/brand/add-photo.png" alt="" />
                  <strong>Choisissez une image</strong>
                </div>
              )}
            </div>
            {image.frame && (
              <div className="phone-frame-controls" aria-hidden="true">
                <span />
                <span />
                <i />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

export function PostManager({
  viewStateRef,
  posts,
  creations,
  folders,
  campaigns,
  galleryAssets,
  loading,
  errorMessage,
  onCreatePost,
  onAddPage,
  onOpenPage,
  onEditPost,
  onDuplicatePost,
  onDeletePost,
  onReorderPages,
  onTransferPage,
  onReorderPosts,
  onCreateFolder,
  onDeleteFolder,
  onDuplicateFolder,
  onMovePost,
  onRenameFolder,
}: PostManagerProps) {
  const [postTypeFolderId, setPostTypeFolderId] = useState<string | null>(null);
  const instagramHistory = useInstagramHistory();
  const [creatingPost, setCreatingPost] = useState(false);
  const [isCreatingFolder, setIsCreatingFolder] = useState(false);
  const [expandedPostId, setExpandedPostId] = useState(viewStateRef.current.expandedPostId);
  const [duplicatingPostId, setDuplicatingPostId] = useState("");
  const [deletingPostId, setDeletingPostId] = useState("");
  const [addingPagePostId, setAddingPagePostId] = useState("");
  const [deletingFolderId, setDeletingFolderId] = useState("");
  const [duplicatingFolderId, setDuplicatingFolderId] = useState("");
  const duplicatingFolderRef = useRef(false);
  const [renamingFolderId, setRenamingFolderId] = useState("");
  const [postDrop, setPostDrop] = useState<{ id: string; after: boolean } | null>(null);
  const [savingPostOrder, setSavingPostOrder] = useState(false);
  const savingPostOrderRef = useRef(false);
  const [draggedPostId, setDraggedPostId] = useState("");
  const [draggedPageId, setDraggedPageId] = useState("");
  const [dragOverPageId, setDragOverPageId] = useState("");
  const [dragOverFolderKey, setDragOverFolderKey] = useState("");
  const [collapsedFolderKeys, setCollapsedFolderKeys] = useState<Set<string>>(
    () => new Set(viewStateRef.current.collapsedFolderKeys),
  );
  useEffect(() => {
    viewStateRef.current = { expandedPostId, collapsedFolderKeys: [...collapsedFolderKeys] };
  }, [expandedPostId, collapsedFolderKeys, viewStateRef]);
  const [localError, setLocalError] = useState("");
  const dragPointerYRef = useRef<number | null>(null);
  const autoScrollFrameRef = useRef<number | null>(null);

  const [folderExport, setFolderExport] = useState<{ key: string; done: number; total: number } | null>(null);
  const exportInProgress = useRef(false);

  const exportFolder = async (key: string, name: string, folderPosts: StudioPost[]) => {
    if (exportInProgress.current || !folderPosts.length) return;
    exportInProgress.current = true;
    setLocalError("");
    const host = document.createElement("div");
    host.style.cssText = "position:fixed;left:-20000px;top:0;pointer-events:none;";
    host.setAttribute("aria-hidden", "true");
    document.body.appendChild(host);
    const root = createRoot(host);
    try {
      const entries = getFolderPngEntries(folderPosts, creations);
      setFolderExport({ key, done: 0, total: entries.length });
      const { default: JSZip } = await import("jszip");
      const zip = new JSZip();
      for (const [index, entry] of entries.entries()) {
        const translation = campaigns.find((campaign) => campaign.id === entry.creation.campaignId)
          ?.translations[entry.language];
        flushSync(() => root.render(
          <CreationCanvasPreview
            creation={entry.creation}
            campaignTitle={translation?.title.trim() ?? ""}
            campaignDescription={translation?.description.trim() ?? ""}
            galleryAssets={galleryAssets}
            language={entry.language}
            previewWidth={827}
          />,
        ));
        const canvas = host.firstElementChild as HTMLDivElement;
        // Preserve the editor's layout width even on narrow mobile viewports.
        canvas.style.width = "827px";
        const png = await exportCanvasPng(canvas, entry.creation.format, galleryAssets);
        zip.file(entry.filename, await png.arrayBuffer());
        setFolderExport({ key, done: index + 1, total: entries.length });
      }
      // PNG files are already compressed; storing them avoids redundant work.
      const archive = await zip.generateAsync({ type: "blob", compression: "STORE" });
      const url = URL.createObjectURL(archive);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${name.replace(/[<>:"/\\|?*\x00-\x1f]/g, "_").trim() || "posts"}_PNG.zip`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (error) {
      setLocalError(`L’export du dossier a échoué : ${error instanceof Error ? error.message : "Veuillez réessayer."}`);
    } finally {
      root.unmount();
      host.remove();
      exportInProgress.current = false;
      setFolderExport(null);
    }
  };

  const stopAutoScroll = () => {
    dragPointerYRef.current = null;
    if (autoScrollFrameRef.current !== null) {
      window.cancelAnimationFrame(autoScrollFrameRef.current);
      autoScrollFrameRef.current = null;
    }
  };

  const runAutoScroll = () => {
    autoScrollFrameRef.current = null;
    const pointerY = dragPointerYRef.current;
    if (pointerY === null) return;
    let speed = 0;
    if (pointerY < DRAG_AUTO_SCROLL_EDGE) {
      const intensity = Math.min(
        1,
        (DRAG_AUTO_SCROLL_EDGE - pointerY) / DRAG_AUTO_SCROLL_EDGE,
      );
      speed = -Math.max(
        2,
        Math.round(DRAG_AUTO_SCROLL_MAX_SPEED * intensity),
      );
    } else if (pointerY > window.innerHeight - DRAG_AUTO_SCROLL_EDGE) {
      const intensity = Math.min(
        1,
        (pointerY - (window.innerHeight - DRAG_AUTO_SCROLL_EDGE)) /
          DRAG_AUTO_SCROLL_EDGE,
      );
      speed = Math.max(
        2,
        Math.round(DRAG_AUTO_SCROLL_MAX_SPEED * intensity),
      );
    }
    if (speed === 0) return;
    window.scrollBy(0, speed);
    autoScrollFrameRef.current = window.requestAnimationFrame(runAutoScroll);
  };

  const updateAutoScroll = (pointerY: number) => {
    dragPointerYRef.current = pointerY;
    const nearEdge =
      pointerY < DRAG_AUTO_SCROLL_EDGE ||
      pointerY > window.innerHeight - DRAG_AUTO_SCROLL_EDGE;
    if (!nearEdge) {
      if (autoScrollFrameRef.current !== null) {
        window.cancelAnimationFrame(autoScrollFrameRef.current);
        autoScrollFrameRef.current = null;
      }
      return;
    }
    if (autoScrollFrameRef.current === null) {
      autoScrollFrameRef.current = window.requestAnimationFrame(runAutoScroll);
    }
  };

  useEffect(
    () => () => {
      if (autoScrollFrameRef.current !== null) {
        window.cancelAnimationFrame(autoScrollFrameRef.current);
      }
    },
    [],
  );

  const pagesForPost = (post: StudioPost) =>
    post.pageIds
      .map((pageId) => creations.find((creation) => creation.id === pageId))
      .filter((page): page is Creation => Boolean(page));

  const createPost = async (type: StudioPostType) => {
    if (postTypeFolderId === null || creatingPost) return;
    setCreatingPost(true);
    setLocalError("");
    try {
      const postId = await onCreatePost(postTypeFolderId, type);
      if (type === "gallery") setExpandedPostId(postId);
      setPostTypeFolderId(null);
    } catch {
      setLocalError("Le post n’a pas pu être créé.");
    } finally {
      setCreatingPost(false);
    }
  };

  const createFolder = async () => {
    if (isCreatingFolder) return;
    const name = window.prompt("Nom du dossier");
    if (!name?.trim()) return;
    setIsCreatingFolder(true);
    setLocalError("");
    try {
      await onCreateFolder(name.trim());
    } catch {
      setLocalError("Le dossier n’a pas pu être créé.");
    } finally {
      setIsCreatingFolder(false);
    }
  };

  const duplicateFolder = async (folder: CreationFolder) => {
    if (duplicatingFolderRef.current) return;
    duplicatingFolderRef.current = true;
    setDuplicatingFolderId(folder.id);
    setLocalError("");
    try {
      await onDuplicateFolder(folder);
    } catch (error) {
      setLocalError(error instanceof Error ? error.message : "Le dossier n’a pas pu être dupliqué.");
    } finally {
      duplicatingFolderRef.current = false;
      setDuplicatingFolderId("");
    }
  };

  const renameFolder = async (folder: CreationFolder) => {
    if (renamingFolderId) return;
    const name = window.prompt("Nouveau nom du dossier", folder.name);
    if (!name?.trim() || name.trim() === folder.name) return;
    setRenamingFolderId(folder.id);
    setLocalError("");
    try {
      await onRenameFolder(folder, name.trim());
    } catch {
      setLocalError("Le dossier n’a pas pu être renommé.");
    } finally {
      setRenamingFolderId("");
    }
  };

  const removeFolder = async (folder: CreationFolder) => {
    const confirmed = window.confirm(
      `Supprimer le dossier « ${folder.name} » ? Ses posts seront déplacés dans « Sans dossier ».`,
    );
    if (!confirmed) return;
    setDeletingFolderId(folder.id);
    setLocalError("");
    try {
      await onDeleteFolder(folder);
    } catch {
      setLocalError("Le dossier n’a pas pu être supprimé.");
    } finally {
      setDeletingFolderId("");
    }
  };

  const duplicatePost = async (post: StudioPost) => {
    if (duplicatingPostId) return;
    setDuplicatingPostId(post.id);
    setLocalError("");
    try {
      await onDuplicatePost(post);
    } catch {
      setLocalError("Le post n’a pas pu être dupliqué.");
    } finally {
      setDuplicatingPostId("");
    }
  };

  const removePost = async (post: StudioPost) => {
    const confirmed = window.confirm(
      `Supprimer ce post${post.type === "gallery" ? " et toutes ses pages" : ""} ? Cette action ne pourra pas être annulée.`,
    );
    if (!confirmed) return;
    setDeletingPostId(post.id);
    setLocalError("");
    try {
      await onDeletePost(post);
      if (expandedPostId === post.id) setExpandedPostId("");
    } catch {
      setLocalError("Le post n’a pas pu être supprimé.");
    } finally {
      setDeletingPostId("");
    }
  };

  const addPage = async (post: StudioPost) => {
    if (addingPagePostId) return;
    setAddingPagePostId(post.id);
    setLocalError("");
    try {
      await onAddPage(post);
    } catch {
      setLocalError("La page n’a pas pu être ajoutée.");
    } finally {
      setAddingPagePostId("");
    }
  };

  const movePost = async (postId: string, folderId: string) => {
    stopAutoScroll();
    setDraggedPostId("");
    setDragOverFolderKey("");
    const post = posts.find((candidate) => candidate.id === postId);
    if (!post || post.folderId === folderId) return;
    setLocalError("");
    try {
      await onMovePost(post, folderId);
    } catch {
      setLocalError("Le post n’a pas pu être déplacé.");
    }
  };

  const draggedSource = draggedPageId
    ? posts.find((post) => post.pageIds.includes(draggedPageId))
    : posts.find((post) => post.id === draggedPostId && post.type === "single" && post.pageIds.length === 1);
  const movingPageId = draggedPageId || draggedSource?.pageIds[0] || "";
  const canTransferTo = (post: StudioPost) => Boolean(
    draggedSource && movingPageId && draggedSource.id !== post.id && post.type === "gallery" && !savingPostOrderRef.current,
  );
  const transferPage = async (target: StudioPost | null, folderId: string, beforePageId = "") => {
    if (!draggedSource || !movingPageId || savingPostOrderRef.current) return;
    const sourceId = draggedSource.id;
    const pageId = movingPageId;
    savingPostOrderRef.current = true;
    setSavingPostOrder(true);
    stopAutoScroll();
    setDraggedPageId("");
    setDraggedPostId("");
    setDragOverPageId("");
    setDragOverFolderKey("");
    setPostDrop(null);
    setLocalError("");
    try {
      await onTransferPage(sourceId, pageId, target?.id ?? null, folderId, beforePageId);
    } catch (error) {
      setLocalError(error instanceof Error ? error.message : "Le déplacement n’a pas pu être enregistré.");
    } finally {
      savingPostOrderRef.current = false;
      setSavingPostOrder(false);
    }
  };
  const galleryTransferProps = (post: StudioPost, beforePageId = "") => ({
    onDragOver: (event: ReactDragEvent<HTMLElement>) => {
      if (!canTransferTo(post)) return;
      event.preventDefault();
      event.stopPropagation();
      event.dataTransfer.dropEffect = "move";
      setDragOverPageId(beforePageId || post.id);
      setPostDrop(null);
      setDragOverFolderKey("");
      updateAutoScroll(event.clientY);
    },
    onDragLeave: (event: ReactDragEvent<HTMLElement>) => {
      if (!event.currentTarget.contains(event.relatedTarget as Node)) setDragOverPageId("");
    },
    onDrop: (event: ReactDragEvent<HTMLElement>) => {
      if (!canTransferTo(post)) return;
      event.preventDefault();
      event.stopPropagation();
      void transferPage(post, post.folderId, beforePageId);
    },
  });
  const galleryDropZone = (post: StudioPost) => canTransferTo(post) ? (
    <div className={`post-transfer-zone ${dragOverPageId === post.id ? "active" : ""}`} {...galleryTransferProps(post)}>
      Déposer ici pour ajouter à la fin de la galerie
    </div>
  ) : null;

  const reorderPage = async (post: StudioPost, targetPageId: string) => {
    if (!draggedPageId || draggedPageId === targetPageId) return;
    const pageIds = [...post.pageIds];
    const sourceIndex = pageIds.indexOf(draggedPageId);
    const targetIndex = pageIds.indexOf(targetPageId);
    if (sourceIndex < 0 || targetIndex < 0) return;
    pageIds.splice(sourceIndex, 1);
    pageIds.splice(targetIndex, 0, draggedPageId);
    setDraggedPageId("");
    setDragOverPageId("");
    stopAutoScroll();
    try {
      await onReorderPages(post, pageIds);
    } catch {
      setLocalError("L’ordre des pages n’a pas pu être enregistré.");
    }
  };

  const scrollGalleryAtPointer = (
    scroller: HTMLElement,
    pointerX: number,
  ) => {
    const bounds = scroller.getBoundingClientRect();
    const edge = 90;
    if (pointerX < bounds.left + edge) scroller.scrollLeft -= 14;
    else if (pointerX > bounds.right - edge) scroller.scrollLeft += 14;
  };

  const toggleFolder = (folderKey: string) => {
    setCollapsedFolderKeys((current) => {
      const next = new Set(current);
      if (next.has(folderKey)) next.delete(folderKey);
      else next.add(folderKey);
      return next;
    });
  };

  const knownFolderIds = new Set(folders.map((folder) => folder.id));
  const unfiledPosts = posts.filter(
    (post) => !post.folderId || !knownFolderIds.has(post.folderId),
  );
  const folderGroups = [
    ...folders.map((folder) => ({
      id: folder.id,
      name: folder.name,
      folder,
      posts: orderFolderPosts(posts.filter((post) => post.folderId === folder.id), folder.postOrder),
    })),
    { id: "", name: "Sans dossier", folder: null, posts: orderFolderPosts(unfiledPosts) },
  ];

  const postDropProps = (post: StudioPost, expanded = false) => {
    const canReorder = () => !draggedPageId && !savingPostOrderRef.current &&
      draggedPostId !== post.id &&
      posts.some((source) => source.id === draggedPostId && source.folderId === post.folderId) &&
      folders.some((folder) => folder.id === post.folderId);
    const isAfter = (event: ReactDragEvent<HTMLElement>) => {
      const bounds = event.currentTarget.getBoundingClientRect();
      return expanded ? event.clientY > bounds.top + bounds.height / 2 : event.clientX > bounds.left + bounds.width / 2;
    };
    return {
      onDragOver: (event: ReactDragEvent<HTMLElement>) => {
        if (!canReorder()) return;
        event.preventDefault();
        event.stopPropagation();
        event.dataTransfer.dropEffect = "move";
        setDragOverFolderKey("");
        setPostDrop({ id: post.id, after: isAfter(event) });
        updateAutoScroll(event.clientY);
      },
      onDragLeave: (event: ReactDragEvent<HTMLElement>) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node)) setPostDrop(null);
      },
      onDrop: async (event: ReactDragEvent<HTMLElement>) => {
        if (!canReorder()) return;
        event.preventDefault();
        event.stopPropagation();
        const group = folderGroups.find((group) => group.id === post.folderId);
        if (!group) return;
        const ids = group.posts.map((item) => item.id);
        const ordered = movePostInOrder(ids, draggedPostId, post.id, isAfter(event));
        stopAutoScroll();
        setPostDrop(null);
        setDraggedPostId("");
        setDragOverFolderKey("");
        if (ordered.every((id, index) => id === ids[index])) return;
        savingPostOrderRef.current = true;
        setSavingPostOrder(true);
        setLocalError("");
        try {
          await onReorderPosts(post.folderId, ordered);
        } catch {
          setLocalError("L’ordre des posts n’a pas pu être enregistré. Réessayez.");
        } finally {
          savingPostOrderRef.current = false;
          setSavingPostOrder(false);
        }
      },
    };
  };
  const postDropClass = (id: string) => postDrop?.id === id ? ` post-drop-${postDrop.after ? "after" : "before"}` : "";

  const renderPostCard = (post: StudioPost) => {
    const pages = pagesForPost(post);
    const firstPage = pages[0];
    const content = getCampaignContent(firstPage, campaigns);
    const isGallery = post.type === "gallery";
    return (
      <article
        className={`creation-card post-card ${draggedPostId === post.id ? "dragging" : ""}${postDropClass(post.id)}`}
        {...postDropProps(post)}
        draggable={!savingPostOrder}
        key={post.id}
        onDragStart={(event) => {
          event.dataTransfer.effectAllowed = "move";
          event.dataTransfer.setData("text/plain", post.id);
          setDraggedPostId(post.id);
          updateAutoScroll(event.clientY);
        }}
        onDragEnd={() => {
          stopAutoScroll();
          setDraggedPostId("");
          setPostDrop(null);
          setDragOverFolderKey("");
        }}
      >
        {isGallery && galleryDropZone(post)}
        <div className="post-card-preview">
          <button
            type="button"
            className="creation-preview"
            onClick={() => {
              if (isGallery) {
                if (firstPage) onEditPost(post);
              } else if (firstPage) {
                onOpenPage(firstPage.id);
              }
            }}
            aria-label={isGallery ? "Modifier le post galerie" : "Modifier le post"}
          >
            {firstPage ? (
              <CreationCanvasPreview
                creation={firstPage}
                campaignTitle={content.title}
                campaignDescription={content.description}
                language={content.language}
                galleryAssets={galleryAssets}
              />
            ) : (
              <span className="post-empty-preview">Aucune page</span>
            )}
          </button>
          {isGallery && (
            <button
              type="button"
              className="post-gallery-badge"
              onClick={() =>
                setExpandedPostId((current) =>
                  current === post.id ? "" : post.id,
                )
              }
              aria-label="Afficher les pages du post galerie"
              aria-expanded={expandedPostId === post.id}
            >
              <i />
              <i />
            </button>
          )}
        </div>
        <div className="creation-card-body">
          <InstagramPublicationStatus items={instagramHistory.items.filter((item) => item.postId === post.id)} status={instagramHistory.status} />
          <div className="creation-card-actions">
            <button
              className="creation-duplicate-button"
              type="button"
              aria-label={duplicatingPostId === post.id ? "Duplication en cours" : "Dupliquer le post"}
              title="Dupliquer le post"
              disabled={duplicatingPostId === post.id}
              onClick={() => void duplicatePost(post)}
            >
              <span className="material-action-icon material-action-copy" aria-hidden="true" />
            </button>
            <button
              className="creation-delete-button"
              type="button"
              disabled={deletingPostId === post.id}
              onClick={() => void removePost(post)}
              aria-label="Supprimer le post"
              title="Supprimer le post"
            >
              <span className="trash-icon" aria-hidden="true" />
            </button>
          </div>
        </div>
      </article>
    );
  };

  const renderExpandedGallery = (post: StudioPost) => {
    const pages = pagesForPost(post);
    const firstContent = getCampaignContent(pages[0], campaigns);
    return (
      <article className={`gallery-post-expanded${postDropClass(post.id)}`} key={post.id} {...postDropProps(post, true)}>
        <header
          className="gallery-post-expanded-header"
          draggable={!savingPostOrder}
          onDragStart={(event) => {
            event.dataTransfer.effectAllowed = "move";
            event.dataTransfer.setData("text/plain", post.id);
            setDraggedPostId(post.id);
          }}
          onDragEnd={() => {
            stopAutoScroll();
            setDraggedPostId("");
          setPostDrop(null);
          }}
        >
          <div>
            <span className="post-gallery-inline-icon" aria-hidden="true"><i /><i /></span>
            <div>
              <small>Post galerie · {pages.length} page{pages.length === 1 ? "" : "s"}</small>
              <h3>{firstContent.title || "Galerie sans campagne"}</h3>
            </div>
          </div>
          <div className="gallery-post-expanded-actions">
            <button
              type="button"
              className="campaign-primary-button"
              disabled={addingPagePostId === post.id}
              onClick={() => void addPage(post)}
            >
              {addingPagePostId === post.id ? "Ajout…" : "+ Ajouter une page"}
            </button>
            <button
              type="button"
              className="gallery-post-edit-button"
              disabled={pages.length === 0}
              onClick={() => onEditPost(post)}
            >
              <span className="pencil-icon" aria-hidden="true" />
              Edit
            </button>
            <button
              type="button"
              className="gallery-post-close-button"
              onClick={() => setExpandedPostId("")}
            >
              <span aria-hidden="true">×</span>
              Close
            </button>
          </div>
        </header>

        {galleryDropZone(post)}
        {pages.length === 0 ? (
          <div className="gallery-post-empty">
            <p>Cette galerie ne contient encore aucune page.</p>
            <button
              type="button"
              className="campaign-primary-button"
              onClick={() => void addPage(post)}
            >
              + Ajouter une page
            </button>
          </div>
        ) : (
          <div
            className="gallery-post-pages"
            onDragOver={(event) => {
              if (!draggedPageId) return;
              event.preventDefault();
              scrollGalleryAtPointer(event.currentTarget, event.clientX);
            }}
          >
            {pages.map((page, index) => {
              const content = getCampaignContent(page, campaigns);
              return (
                <article
                  className={`gallery-page-row ${draggedPageId === page.id ? "dragging" : ""} ${dragOverPageId === page.id ? "drag-over" : ""}`}
                  draggable={!savingPostOrder}
                  data-insert-before={canTransferTo(post) && dragOverPageId === page.id ? "true" : undefined}
                  key={page.id}
                  onDragStart={(event) => {
                    event.stopPropagation();
                    event.dataTransfer.effectAllowed = "move";
                    event.dataTransfer.setData("application/x-dailydish-page", page.id);
                    setDraggedPostId("");
                    setDraggedPageId(page.id);
                    updateAutoScroll(event.clientY);
                  }}
                  onDragOver={(event) => {
                    if (canTransferTo(post)) {
                      galleryTransferProps(post, page.id).onDragOver(event);
                      return;
                    }
                    if (!draggedPageId || !post.pageIds.includes(draggedPageId)) return;
                    event.preventDefault();
                    event.stopPropagation();
                    setDragOverPageId(page.id);
                    updateAutoScroll(event.clientY);
                    const scroller = event.currentTarget.closest(
                      ".gallery-post-pages",
                    );
                    if (scroller instanceof HTMLElement) {
                      scrollGalleryAtPointer(scroller, event.clientX);
                    }
                  }}
                  onDrop={(event) => {
                    if (canTransferTo(post)) {
                      galleryTransferProps(post, page.id).onDrop(event);
                      return;
                    }
                    if (!draggedPageId || !post.pageIds.includes(draggedPageId)) return;
                    event.preventDefault();
                    event.stopPropagation();
                    void reorderPage(post, page.id);
                  }}
                  onDragEnd={() => {
                    stopAutoScroll();
                    setDraggedPageId("");
                    setDragOverPageId("");
                    setDragOverFolderKey("");
                  }}
                >
                  <div className="gallery-page-order" title="Glissez pour réordonner ou sortir cette page de la galerie">
                    <span aria-hidden="true">⠿</span>
                    <strong>{index + 1}</strong>
                  </div>
                  <button
                    type="button"
                    className="creation-preview gallery-page-preview"
                    onClick={() => onOpenPage(page.id)}
                    aria-label={`Modifier la page ${index + 1}`}
                  >
                    <CreationCanvasPreview
                      creation={page}
                      campaignTitle={content.title}
                      campaignDescription={content.description}
                language={content.language}
                      galleryAssets={galleryAssets}
                    />
                  </button>
                </article>
              );
            })}
          </div>
        )}
      </article>
    );
  };

  return (
    <section
      className="creation-page"
      aria-label="Mes posts"
      onDragOver={(event) => {
        if (draggedPostId || draggedPageId) updateAutoScroll(event.clientY);
      }}
    >
      <header className="creation-page-header">
        <div>
          <p>Visuels publicitaires</p>
          <h2>Posts</h2>
          <span>Chaque post contient une image unique ou plusieurs pages de galerie.</span>
        </div>
        <div className="creation-page-header-actions">
          <button
            className="campaign-secondary-button"
            type="button"
            disabled={isCreatingFolder}
            onClick={() => void createFolder()}
          >
            {isCreatingFolder ? "Création…" : "+ Nouveau dossier"}
          </button>
        </div>
      </header>

      {(errorMessage || localError) && (
        <p className="campaign-system-error" role="alert">{localError || errorMessage}</p>
      )}

      {savingPostOrder && <p role="status">Enregistrement du déplacement…</p>}

      {folderExport && (
        <p role="status" aria-live="polite">
          {folderExport.done === folderExport.total
            ? "Préparation du ZIP…"
            : `Export PNG : ${folderExport.done} / ${folderExport.total} images`}
        </p>
      )}

      {loading ? (
        <div className="creation-empty-state">Chargement des posts…</div>
      ) : posts.length === 0 && folders.length === 0 ? (
        <div className="creation-empty-state">
          <div className="creation-empty-symbol">✦</div>
          <h3>Créez votre premier dossier</h3>
          <p>Les nouveaux posts sont toujours créés à l’intérieur d’un dossier.</p>
        </div>
      ) : (
        <div className="creation-grid post-grid">
          {folderGroups.map((group) => {
            const dropKey = group.id || UNFILED_DROP_KEY;
            const isCollapsed = collapsedFolderKeys.has(dropKey);
            return (
              <section
                className={`creation-folder-section ${dragOverFolderKey === dropKey ? "drag-over" : ""}`}
                key={dropKey}
                onDragOver={(event) => {
                  if ((!draggedPostId && !draggedPageId) || savingPostOrderRef.current) return;
                  event.preventDefault();
                  event.dataTransfer.dropEffect = "move";
                  setDragOverFolderKey(dropKey);
                }}
                onDragLeave={(event) => {
                  if (!event.currentTarget.contains(event.relatedTarget as Node)) {
                    setDragOverFolderKey("");
                  }
                }}
                onDrop={(event) => {
                  if ((!draggedPostId && !draggedPageId) || savingPostOrderRef.current) return;
                  event.preventDefault();
                  event.stopPropagation();
                  if (draggedPageId) {
                    void transferPage(null, group.id);
                    return;
                  }
                  void movePost(
                    event.dataTransfer.getData("text/plain") || draggedPostId,
                    group.id,
                  );
                }}
              >
                <header className="creation-folder-header">
                  <div className="creation-folder-title">
                    <span className="creation-folder-icon" aria-hidden="true" />
                    <h3>{group.name}</h3>
                  </div>
                  <div className="creation-folder-actions">
                    <button
                      className="creation-folder-add-button"
                      type="button"
                      disabled={folderExport !== null || group.posts.length === 0}
                      onClick={() => void exportFolder(dropKey, group.name, group.posts)}
                      aria-label={`Exporter le dossier ${group.name} en PNG dans toutes les langues`}
                      title="Télécharger tous les posts en PNG (FR, EN, PT) dans un ZIP"
                    >
                      {folderExport?.key === dropKey
                        ? `PNG ${folderExport.done}/${folderExport.total}…`
                        : "PNG"}
                    </button>
                    {group.folder && (
                      <>
                        <button
                          className="creation-folder-add-button"
                          type="button"
                          onClick={() => setPostTypeFolderId(group.id)}
                        >
                          + Nouveau post
                        </button>
                        <button
                          className="creation-folder-edit-button"
                          type="button"
                          aria-busy={duplicatingFolderId === group.id}
                          disabled={Boolean(duplicatingFolderId)}
                          onClick={() => void duplicateFolder(group.folder)}
                          aria-label={`Dupliquer le dossier ${group.name} avec tous ses posts`}
                          title="Créer une copie du dossier et de tous ses posts"
                        >
                          <span className="material-action-icon material-action-copy" aria-hidden="true" />
                        </button>
                        <button
                          className="creation-folder-edit-button"
                          type="button"
                          disabled={renamingFolderId === group.folder.id}
                          onClick={() => void renameFolder(group.folder)}
                          aria-label={`Renommer le dossier ${group.name}`}
                          title="Renommer le dossier"
                        >
                          <span className="material-action-icon material-action-edit" aria-hidden="true" />
                        </button>
                        <button
                          className="creation-folder-delete-button"
                          type="button"
                          disabled={deletingFolderId === group.folder.id}
                          onClick={() => void removeFolder(group.folder)}
                          aria-label={`Supprimer le dossier ${group.name}`}
                          title="Supprimer le dossier"
                        >
                          <span className="material-action-icon material-action-delete" aria-hidden="true" />
                        </button>
                      </>
                    )}
                    <button
                      className="creation-folder-toggle"
                      type="button"
                      aria-expanded={!isCollapsed}
                      onClick={() => toggleFolder(dropKey)}
                    >
                      <small>{group.posts.length} post{group.posts.length === 1 ? "" : "s"}</small>
                      <span
                        className={`creation-folder-chevron ${isCollapsed ? "collapsed" : ""}`}
                        aria-hidden="true"
                      />
                    </button>
                  </div>
                </header>

                {draggedPageId && (
                  <div className="post-transfer-zone">Déposer ici pour créer un post simple dans {group.name}</div>
                )}
                {!isCollapsed && group.posts.length === 0 && (
                  <div className="creation-folder-empty">Glissez un post ici</div>
                )}

                {!isCollapsed &&
                  group.posts.map((post) =>
                    post.type === "gallery" && expandedPostId === post.id
                      ? renderExpandedGallery(post)
                      : renderPostCard(post),
                  )}
              </section>
            );
          })}
        </div>
      )}

      {postTypeFolderId !== null && (
        <div className="post-type-backdrop" role="presentation">
          <section className="post-type-dialog" role="dialog" aria-modal="true" aria-labelledby="post-type-title">
            <header>
              <div>
                <p>Nouveau post</p>
                <h3 id="post-type-title">Quel type de post veux-tu créer ?</h3>
              </div>
              <button type="button" onClick={() => setPostTypeFolderId(null)} aria-label="Fermer">×</button>
            </header>
            <div className="post-type-options">
              <button type="button" disabled={creatingPost} onClick={() => void createPost("single")}>
                <span className="post-type-single-icon" aria-hidden="true" />
                <strong>Image unique</strong>
                <small>Un visuel, une page à éditer.</small>
              </button>
              <button type="button" disabled={creatingPost} onClick={() => void createPost("gallery")}>
                <span className="post-type-gallery-icon" aria-hidden="true"><i /><i /></span>
                <strong>Galerie</strong>
                <small>Plusieurs pages à organiser.</small>
              </button>
            </div>
          </section>
        </div>
      )}
    </section>
  );
}
