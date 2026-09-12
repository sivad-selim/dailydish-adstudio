"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { GalleryAsset } from "../firebase/gallery";
import { subscribeToGalleryFolders, type GalleryFolder } from "../firebase/galleryFolders";
import { GalleryAssetVisual } from "./GalleryAssetVisual";

type GalleryImagePickerProps = {
  label: string;
  assets: GalleryAsset[];
  selectedAsset: GalleryAsset | null;
  emptyLabel?: string;
  loading?: boolean;
  fit?: "contain" | "cover";
  onSelect: (asset: GalleryAsset) => void;
  onRemove: () => void;
  onOpenGallery: () => void;
  onUploadFile?: (file: File) => Promise<GalleryAsset>;
};

export function GalleryImagePicker({
  label,
  assets,
  selectedAsset,
  emptyLabel = "Aucune image sélectionnée",
  loading = false,
  fit = "contain",
  onSelect,
  onRemove,
  onOpenGallery,
  onUploadFile,
}: GalleryImagePickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [folders, setFolders] = useState<GalleryFolder[]>([]);
  const [folderId, setFolderId] = useState("");
  const [foldersLoading, setFoldersLoading] = useState(false);
  const [folderError, setFolderError] = useState("");
  const contentRef = useRef<HTMLDivElement>(null);
  const uploadingRef = useRef(false);
  const mountedRef = useRef(true);

  const openPicker = () => {
    setFolderId(selectedAsset?.folderId ?? "");
    setFoldersLoading(true);
    setFolderError("");
    setIsOpen(true);
  };

  useEffect(() => {
    if (!isOpen) return;
    return subscribeToGalleryFolders(
      (nextFolders) => { setFolders(nextFolders); setFoldersLoading(false); },
      () => {
        setFolderError("Les dossiers n’ont pas pu être chargés. Fermez puis rouvrez le sélecteur pour réessayer.");
        setFoldersLoading(false);
      },
    );
  }, [isOpen]);

  const visibleAssets = assets.filter((asset) => (asset.folderId ?? "") === folderId);
  const currentFolderName = folderId ? folders.find((folder) => folder.id === folderId)?.name ?? "Dossier" : "Racine";

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  const importFile = async (files: FileList) => {
    if (!onUploadFile || uploadingRef.current) return;
    setUploadError("");
    if (files.length !== 1) {
      setUploadError("Déposez une seule image dans cette case.");
      return;
    }
    uploadingRef.current = true;
    setUploading(true);
    try {
      const asset = await onUploadFile(files[0]);
      if (mountedRef.current) onSelect(asset);
    } catch (error) {
      if (mountedRef.current) setUploadError(error instanceof Error ? error.message : "L’image n’a pas pu être importée.");
    } finally {
      uploadingRef.current = false;
      if (mountedRef.current) setUploading(false);
    }
  };

  useEffect(() => {
    if (!isOpen) return;

    const previousOverflow = document.body.style.overflow;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setIsOpen(false);
    };

    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [isOpen]);

  const pickerModal = isOpen
    ? createPortal(
        <div className="gallery-selector-backdrop">
          <section
            className={`gallery-selector-modal fit-${fit}`}
            role="dialog"
            aria-modal="true"
            aria-label="Choisir une image dans la galerie"
          >
            <header className="gallery-selector-header">
              <div>
                <p>Bibliothèque visuelle</p>
                <h2>Choisir une image</h2>
                <span>Parcourez vos dossiers et sélectionnez une image.</span>
              </div>
              <div className="gallery-selector-header-actions">
                <button
                  type="button"
                  className="gallery-selector-manage"
                  onClick={() => {
                    setIsOpen(false);
                    onOpenGallery();
                  }}
                >
                  Ajouter dans la Galerie
                </button>
                <button
                  type="button"
                  className="gallery-selector-close"
                  aria-label="Fermer le sélecteur"
                  title="Fermer"
                  onClick={() => setIsOpen(false)}
                >
                  ×
                </button>
              </div>
            </header>

            <div className="gallery-selector-content" ref={contentRef}>
              <nav className="gallery-folder-toolbar gallery-selector-folders" aria-label="Dossiers de la galerie" aria-busy={foldersLoading}>
                <div className="gallery-folder-list">
                  {[{ id: "", name: "Racine" }, ...folders].map((folder) => (
                    <button type="button" key={folder.id}
                      className={`gallery-folder ${folderId === folder.id ? "selected" : ""}`}
                      aria-current={folderId === folder.id ? "page" : undefined}
                      onClick={() => {
                        setFolderId(folder.id);
                        contentRef.current?.scrollTo({ top: 0 });
                      }}
                    >
                      <span aria-hidden="true">{folder.id ? "📁" : "⌂"}</span>
                      <span>{folder.name}</span>
                      <small>{assets.filter((asset) => (asset.folderId ?? "") === folder.id).length}</small>
                    </button>
                  ))}
                </div>
              </nav>
              {folderError && <p className="gallery-error" role="alert">{folderError}</p>}
              <h3 className="gallery-selector-folder-heading">{currentFolderName} <small>· {visibleAssets.length} image{visibleAssets.length > 1 ? "s" : ""}</small></h3>
              {loading || foldersLoading ? (
                <p className="gallery-selector-message">Chargement de la galerie…</p>
              ) : assets.length === 0 ? (
                <div className="gallery-selector-empty">
                  <strong>La galerie est vide</strong>
                  <p>Ajoutez d’abord une image, puis revenez la sélectionner.</p>
                  <button
                    type="button"
                    onClick={() => {
                      setIsOpen(false);
                      onOpenGallery();
                    }}
                  >
                    Ouvrir la Galerie
                  </button>
                </div>
              ) : visibleAssets.length === 0 ? (
                <div className="gallery-selector-empty">
                  <strong>{folderId ? "Ce dossier est vide" : "Aucune image à la racine"}</strong>
                  <p>Ouvrez un autre dossier pour choisir une image.</p>
                </div>
              ) : (
                <div className="gallery-selector-grid">
                  {visibleAssets.map((asset) => (
                    <button
                      type="button"
                      key={asset.id}
                      className={
                        selectedAsset?.id === asset.id ? "selected" : ""
                      }
                      aria-pressed={selectedAsset?.id === asset.id}
                      onClick={() => {
                        onSelect(asset);
                        setIsOpen(false);
                      }}
                    >
                      <span className="gallery-selector-thumbnail">
                        <GalleryAssetVisual asset={asset} />
                        {selectedAsset?.id === asset.id && <b>✓</b>}
                      </span>
                      <span className="gallery-selector-copy">
                        <strong title={asset.name}>{asset.name}</strong>
                        <small>{currentFolderName}</small>
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </section>
        </div>,
        document.body,
      )
    : null;

  return (
    <>
      <div className={`gallery-image-picker fit-${fit}`}>
        <strong className="gallery-image-picker-label">{label}</strong>

        <div className="gallery-image-picker-row">
          <button
            type="button"
            className={`gallery-image-preview ${selectedAsset ? "has-image" : "is-empty"} ${isDragging ? "is-dragging" : ""}`}
            aria-live="polite"
            aria-label={`Choisir une image — ${label}`}
            disabled={uploading}
            onClick={openPicker}
            onDragOver={(event) => {
              if (uploading || (!onUploadFile && !event.dataTransfer.types.includes("application/x-dailydish-gallery-image"))) return;
              if (!event.dataTransfer.types.includes("Files") && !event.dataTransfer.types.includes("application/x-dailydish-gallery-image")) return;
              event.preventDefault();
              event.dataTransfer.dropEffect = "copy";
              setIsDragging(true);
            }}
            onDragLeave={(event) => {
              if (event.relatedTarget instanceof Node && event.currentTarget.contains(event.relatedTarget)) return;
              setIsDragging(false);
            }}
            onDrop={(event) => {
              event.preventDefault();
              setIsDragging(false);
              if (uploading) return;
              const assetId = event.dataTransfer.getData("application/x-dailydish-gallery-image");
              const asset = assets.find((candidate) => candidate.id === assetId);
              if (asset) { setUploadError(""); onSelect(asset); }
              else if (event.dataTransfer.files.length) void importFile(event.dataTransfer.files);
            }}
          >
            {uploading ? <span>Importation…</span> : selectedAsset ? (
              <GalleryAssetVisual
                asset={selectedAsset}
                alt={selectedAsset.name}
              />
            ) : (
              <span>{emptyLabel}</span>
            )}
          </button>

          {selectedAsset ? (
            <button
              type="button"
              className="gallery-image-action remove"
              disabled={uploading}
              aria-label={`Retirer ${selectedAsset.name}`}
              title="Retirer l’image"
              onClick={() => {
                setIsOpen(false);
                onRemove();
              }}
            >
              <span className="trash-icon" aria-hidden="true" />
            </button>
          ) : (
            <button
              type="button"
              className="gallery-image-action add"
              disabled={uploading}
              aria-label="Choisir une image dans la galerie"
              title="Choisir une image"
              aria-expanded={isOpen}
              onClick={openPicker}
            >
              +
            </button>
          )}
        </div>
        {onUploadFile && <small className="image-drop-hint">Glissez une image ou cliquez pour choisir.</small>}
        {uploadError && <p className="gallery-error" role="alert">{uploadError}</p>}
      </div>
      {pickerModal}
    </>
  );
}
