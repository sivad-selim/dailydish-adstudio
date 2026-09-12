import {
  ChangeEvent,
  DragEvent as ReactDragEvent,
  useEffect,
  useRef,
  useState,
} from "react";
import type { GalleryAsset } from "../firebase/gallery";
import { createGalleryFolder, subscribeToGalleryFolders, type GalleryFolder } from "../firebase/galleryFolders";
import { GalleryAssetVisual } from "./GalleryAssetVisual";

const GALLERY_DRAG_TYPE = "application/x-dailydish-gallery-image";

type GalleryManagerProps = {
  assets: GalleryAsset[];
  loading: boolean;
  uploading: boolean;
  errorMessage: string;
  onUpload: (files: File[], folderId: string) => Promise<void>;
  onDelete: (asset: GalleryAsset) => Promise<void>;
  onMove: (asset: GalleryAsset, folderId: string) => Promise<void>;
};

const formatFileSize = (size: number) => {
  if (size < 1024 * 1024) return `${Math.max(1, Math.round(size / 1024))} Ko`;
  return `${(size / (1024 * 1024)).toFixed(1).replace(".", ",")} Mo`;
};

export function GalleryManager({
  assets,
  loading,
  uploading,
  errorMessage,
  onUpload,
  onDelete,
  onMove,
}: GalleryManagerProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [deletingId, setDeletingId] = useState("");
  const [confirmingDeleteId, setConfirmingDeleteId] = useState("");
  const [deleteError, setDeleteError] = useState("");
  const [folders, setFolders] = useState<GalleryFolder[]>([]);
  const [foldersLoading, setFoldersLoading] = useState(true);
  const [folderId, setFolderId] = useState("");
  const [newFolderName, setNewFolderName] = useState("");
  const [creatingFolder, setCreatingFolder] = useState(false);
  const [showFolderForm, setShowFolderForm] = useState(false);
  const [folderError, setFolderError] = useState("");
  const [dropTarget, setDropTarget] = useState<string | null>(null);
  const [movingId, setMovingId] = useState("");
  const moveInFlight = useRef(false);
  const [moveStatus, setMoveStatus] = useState("");

  useEffect(() => {
    if (showFolderForm) folderInputRef.current?.focus();
  }, [showFolderForm]);

  useEffect(() => subscribeToGalleryFolders(
    (nextFolders) => {
      setFolders(nextFolders);
      setFoldersLoading(false);
    },
    () => {
      setFolderError("Les dossiers n’ont pas pu être chargés. Rechargez la galerie.");
      setFoldersLoading(false);
    },
  ), []);

  const visibleAssets = assets.filter((asset) => (asset.folderId ?? "") === folderId);
  const currentFolderName = folders.find((folder) => folder.id === folderId)?.name ?? "Racine";

  const moveAsset = async (asset: GalleryAsset, destination: string) => {
    if (moveInFlight.current || deletingId || (asset.folderId ?? "") === destination) return;
    moveInFlight.current = true;
    setMovingId(asset.id);
    setFolderError("");
    setMoveStatus("");
    try {
      await onMove(asset, destination);
      setMoveStatus(`Image déplacée vers ${folders.find((folder) => folder.id === destination)?.name ?? "la racine"}.`);
    } catch {
      setFolderError("L’image n’a pas pu être déplacée. Réessayez.");
    } finally {
      moveInFlight.current = false;
      setMovingId("");
    }
  };

  const folderDrop = (event: ReactDragEvent<HTMLButtonElement>, destination: string) => {
    if (!event.dataTransfer.types.includes(GALLERY_DRAG_TYPE)) return;
    event.preventDefault();
    setDropTarget(null);
    const asset = assets.find((item) => item.id === event.dataTransfer.getData(GALLERY_DRAG_TYPE));
    if (asset) void moveAsset(asset, destination);
  };

  const addFolder = async () => {
    if (creatingFolder || !newFolderName.trim()) return;
    setCreatingFolder(true);
    setFolderError("");
    try {
      const id = await createGalleryFolder(newFolderName);
      setFolders((current) => current.some((folder) => folder.id === id)
        ? current
        : [...current, { id, name: newFolderName.trim() }].sort((a, b) => a.name.localeCompare(b.name)));
      setFolderId(id);
      setNewFolderName("");
      setShowFolderForm(false);
    } catch (error) {
      setFolderError(error instanceof Error ? error.message : "Le dossier n’a pas pu être créé.");
    } finally {
      setCreatingFolder(false);
    }
  };

  const sendFiles = async (files: FileList | File[]) => {
    const imageFiles = Array.from(files);
    if (imageFiles.length === 0) return;
    if (uploading) return;
    await onUpload(imageFiles, folderId);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleFileInput = (event: ChangeEvent<HTMLInputElement>) => {
    if (event.target.files) void sendFiles(event.target.files);
  };

  const handleDrag = (event: ReactDragEvent<HTMLButtonElement>) => {
    if (!event.dataTransfer.types.includes("Files")) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = "copy";
    setIsDragging(true);
  };

  const handleDragLeave = (event: ReactDragEvent<HTMLButtonElement>) => {
    const nextTarget = event.relatedTarget;
    if (nextTarget instanceof Node && event.currentTarget.contains(nextTarget)) {
      return;
    }
    setIsDragging(false);
  };

  const handleDrop = (event: ReactDragEvent<HTMLButtonElement>) => {
    if (!event.dataTransfer.types.includes("Files")) return;
    event.preventDefault();
    setIsDragging(false);
    void sendFiles(event.dataTransfer.files);
  };

  const removeAsset = async (asset: GalleryAsset) => {
    setDeletingId(asset.id);
    setDeleteError("");
    try {
      await onDelete(asset);
      setConfirmingDeleteId("");
    } catch {
      setDeleteError("Cette image n’a pas pu être supprimée. Réessayez.");
    } finally {
      setDeletingId("");
    }
  };

  return (
    <section className="gallery-page">
      <header className="gallery-page-header">
        <div>
          <p>Bibliothèque visuelle</p>
          <h2>Galerie</h2>
          <span>
            Importez vos images et retrouvez-les sur tous vos appareils.
          </span>
        </div>
        <strong>{assets.length} image{assets.length > 1 ? "s" : ""}</strong>
      </header>

      <div className="gallery-content">
        <div className="gallery-folder-toolbar">
          <nav className="gallery-folder-list" aria-label="Dossiers de la galerie" aria-busy={foldersLoading}>
            {[{ id: "", name: "Racine" }, ...folders].map((folder) => (
              <button
                key={folder.id}
                type="button"
                className={`gallery-folder ${folderId === folder.id ? "selected" : ""} ${dropTarget === folder.id ? "drop-target" : ""}`}
                aria-current={folderId === folder.id ? "page" : undefined}
                onClick={() => { setFolderId(folder.id); setConfirmingDeleteId(""); }}
                onDragOver={(event) => {
                  if (!event.dataTransfer.types.includes(GALLERY_DRAG_TYPE) || movingId) return;
                  event.preventDefault();
                  event.dataTransfer.dropEffect = "move";
                  setDropTarget(folder.id);
                }}
                onDragLeave={(event) => {
                  if (event.relatedTarget instanceof Node && event.currentTarget.contains(event.relatedTarget)) return;
                  setDropTarget(null);
                }}
                onDrop={(event) => folderDrop(event, folder.id)}
              >
                <span aria-hidden="true">{folder.id ? "📁" : "⌂"}</span>
                <span>{folder.name}</span>
                <small>{assets.filter((asset) => (asset.folderId ?? "") === folder.id).length}</small>
              </button>
            ))}
          </nav>
          <button className="gallery-new-folder" type="button" disabled={foldersLoading} onClick={() => setShowFolderForm(true)}>+ Nouveau dossier</button>
        </div>
        {showFolderForm && (
          <form className="gallery-folder-form" onSubmit={(event) => { event.preventDefault(); void addFolder(); }}>
            <label htmlFor="gallery-folder-name">Nom du dossier</label>
            <input ref={folderInputRef} id="gallery-folder-name" maxLength={80} value={newFolderName} onChange={(event) => setNewFolderName(event.target.value)} disabled={creatingFolder} placeholder="Ex. Captures, Recettes…" />
            <button type="submit" disabled={creatingFolder || !newFolderName.trim()}>{creatingFolder ? "Création…" : "Créer"}</button>
            <button type="button" disabled={creatingFolder} onClick={() => { setShowFolderForm(false); setNewFolderName(""); }}>Annuler</button>
          </form>
        )}
        <div className="gallery-folder-heading">
          <h3>{currentFolderName} <small>· {visibleAssets.length} image{visibleAssets.length > 1 ? "s" : ""}</small></h3>
          <p>Glissez une image sur un dossier pour la ranger.</p>
        </div>
        <input
          ref={fileInputRef}
          className="visually-hidden"
          type="file"
          accept="image/png,image/jpeg,image/webp,.png,.jpg,.jpeg,.webp"
          multiple
          onChange={handleFileInput}
        />
        <button
          type="button"
          className={`gallery-dropzone ${isDragging ? "is-dragging" : ""}`}
          disabled={uploading}
          onClick={() => fileInputRef.current?.click()}
          onDragEnter={handleDrag}
          onDragOver={handleDrag}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          <span className="gallery-upload-symbol" aria-hidden="true">+</span>
          <strong>
            {uploading
              ? "Importation en cours…"
              : isDragging
                ? "Déposez les images ici"
                : folderId ? `Ajouter des images dans « ${currentFolderName} »` : "Ajouter des images"}
          </strong>
          <small>Cliquez ou glissez-déposez · PNG, JPG ou WebP · 15 Mo maximum</small>
        </button>

        {(errorMessage || deleteError || folderError) && (
          <p className="gallery-error" role="alert">
            {folderError || deleteError || errorMessage}
          </p>
        )}
        <p className="gallery-move-status" role="status">{movingId ? "Déplacement en cours…" : moveStatus}</p>

        <div className="gallery-grid" aria-busy={loading || uploading}>
          {loading ? (
            <div className="gallery-loading">Chargement de la galerie…</div>
          ) : (
            visibleAssets.length === 0 ? (
              <div className="gallery-loading">{folderId ? "Ce dossier est vide. Ajoutez des images ou glissez-en depuis un autre dossier." : "Aucune image à la racine. Ajoutez des images ou ouvrez un dossier."}</div>
            ) : visibleAssets.map((asset) => (
              <article className={`gallery-card ${movingId === asset.id ? "is-moving" : ""}`} key={asset.id}
                draggable={!movingId && !deletingId}
                onDragStart={(event) => {
                  event.dataTransfer.setData(GALLERY_DRAG_TYPE, asset.id);
                  event.dataTransfer.effectAllowed = "move";
                }}
                onDragEnd={() => setDropTarget(null)}
              >
                <div className="gallery-thumbnail">
                  <GalleryAssetVisual asset={asset} alt={asset.name} />
                </div>
                <div className="gallery-card-copy">
                  <strong title={asset.name}>{asset.name}</strong>
                  <span>{formatFileSize(asset.size)}</span>
                </div>
                <div className="gallery-card-actions">
                  {confirmingDeleteId === asset.id ? (
                      <>
                        <button
                          type="button"
                          disabled={!!movingId || !!deletingId}
                          onClick={() => setConfirmingDeleteId("")}
                        >
                          Annuler
                        </button>
                        <button
                          type="button"
                          className="gallery-delete-button"
                          disabled={!!movingId || !!deletingId}
                          onClick={() => void removeAsset(asset)}
                          aria-label={`Confirmer la suppression de ${asset.name}`}
                        >
                          {deletingId === asset.id ? "Suppression…" : "Confirmer"}
                        </button>
                      </>
                    ) : (
                      <button
                        type="button"
                        className="gallery-delete-button"
                        disabled={!!movingId || !!deletingId}
                        onClick={() => {
                          setDeleteError("");
                          setConfirmingDeleteId(asset.id);
                        }}
                        aria-label={`Supprimer ${asset.name}`}
                      >
                        Supprimer
                      </button>
                    )}
                </div>
              </article>
            ))
          )}
        </div>
      </div>
    </section>
  );
}
