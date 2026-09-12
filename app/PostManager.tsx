"use client";
import { Button } from "./components/Button";
import { CreationCanvasPreview } from "./CreationCanvasPreview";
export { CreationCanvasPreview } from "./CreationCanvasPreview";
import { PostPreview } from "./components/PostPreview";
import { PageHeader, Icon } from "./components";
import { SectionHeading } from "./SectionHeading";

import { createRoot } from "react-dom/client";
import { flushSync } from "react-dom";
import { exportCanvasPng } from "./exportCanvasPng";
import { orderFolderPosts, movePostInOrder } from "./postOrder";
import { getFolderPngEntries } from "./folderPngExport";
import {
  type DragEvent as ReactDragEvent,
  type RefObject,
  useEffect,
  useRef,
  useState,
} from "react";
import { CAMPAIGN_LANGUAGES, type Campaign } from "../firebase/campaigns";
import type { CreationFolder } from "../firebase/creationFolders";
import { type Creation } from "../firebase/creations";
import type { GalleryAsset } from "../firebase/gallery";
import type { StudioPost, StudioPostType } from "../firebase/posts";
import { useInstagramHistory } from "./InstagramPublicationStatus";
import {
  DRAG_AUTO_SCROLL_EDGE,
  DRAG_AUTO_SCROLL_MAX_SPEED,
} from "./dragScroll";

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
        <PostPreview creation={firstPage} campaigns={campaigns} galleryAssets={galleryAssets} gallery={isGallery}
          publications={instagramHistory.items.filter((item) => item.postId === post.id)} status={instagramHistory.status}
          onOpen={() => { if (firstPage) { if (isGallery) onEditPost(post); else onOpenPage(firstPage.id); } }}
          onToggleGallery={isGallery ? () => setExpandedPostId((current) => current === post.id ? "" : post.id) : undefined}
          expanded={expandedPostId === post.id} actions={<>
            <button
              className="creation-duplicate-button"
              type="button"
              aria-label={duplicatingPostId === post.id ? "Duplication en cours" : "Dupliquer le post"}
              title="Dupliquer le post"
              disabled={duplicatingPostId === post.id}
              onClick={() => void duplicatePost(post)}
            >
              <Icon name="content_copy" />
            </button>
            <button
              className="creation-delete-button"
              type="button"
              disabled={deletingPostId === post.id}
              onClick={() => void removePost(post)}
              aria-label="Supprimer le post"
              title="Supprimer le post"
            >
              <Icon name="delete" />
            </button></>} />
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
            <Icon name="collections" />
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
              <Icon name="add" />{addingPagePostId === post.id ? "Ajout…" : "Ajouter une page"}
            </button>
            <button
              type="button"
              className="gallery-post-edit-button"
              disabled={pages.length === 0}
              onClick={() => onEditPost(post)}
            >
              <Icon name="edit" />
              Modifier
            </button>
            <button
              type="button"
              className="gallery-post-close-button"
              onClick={() => setExpandedPostId("")}
            >
              <Icon name="close" />
              Fermer
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
              <Icon name="add" /> Ajouter une page
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
                    <Icon name="drag_indicator" />
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
      <PageHeader title="Posts" description="Crée et organise tes images et tes galeries.">
        <div className="creation-page-header-actions">
          <Button variant="secondary"
            className="campaign-secondary-button"
            type="button"
            disabled={isCreatingFolder}
            onClick={() => void createFolder()}
          >
            <Icon name="folder" />{isCreatingFolder ? "Création…" : "Nouveau dossier"}
          </Button>
        </div>
      </PageHeader>

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
          <div className="creation-empty-symbol"><Icon name="folder" /></div>
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
                <SectionHeading as="header" className="creation-folder-header">
                  <div className="creation-folder-title">
                    <Icon name="folder" />
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
                          <Icon name="add" /> Nouveau post
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
                          <Icon name="content_copy" />
                        </button>
                        <button
                          className="creation-folder-edit-button"
                          type="button"
                          disabled={renamingFolderId === group.folder.id}
                          onClick={() => void renameFolder(group.folder)}
                          aria-label={`Renommer le dossier ${group.name}`}
                          title="Renommer le dossier"
                        >
                          <Icon name="edit" />
                        </button>
                        <button
                          className="creation-folder-delete-button"
                          type="button"
                          disabled={deletingFolderId === group.folder.id}
                          onClick={() => void removeFolder(group.folder)}
                          aria-label={`Supprimer le dossier ${group.name}`}
                          title="Supprimer le dossier"
                        >
                          <Icon name="delete" />
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
                      <Icon name="expand_more" className={`studio-folder-chevron ${isCollapsed ? "collapsed" : ""}`} />
                    </button>
                  </div>
                </SectionHeading>

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
              <button type="button" onClick={() => setPostTypeFolderId(null)} aria-label="Fermer"><Icon name="close" /></button>
            </header>
            <div className="post-type-options">
              <button type="button" disabled={creatingPost} onClick={() => void createPost("single")}>
                <Icon name="image" />
                <strong>Image unique</strong>
                <small>Un visuel, une page à éditer.</small>
              </button>
              <button type="button" disabled={creatingPost} onClick={() => void createPost("gallery")}>
                <Icon name="collections" />
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
