"use client";
import { Button } from "./components/Button";
import { PageHeader, Icon } from "./components";
import { SectionHeading } from "./SectionHeading";

import { useEffect, useRef, useState } from "react";
import { CAMPAIGN_LANGUAGES, type Campaign } from "../firebase/campaigns";
import type { CreationFolder } from "../firebase/creationFolders";
import type { Creation } from "../firebase/creations";
import type { GalleryAsset } from "../firebase/gallery";
import { FORMAT_CONFIG } from "./adFormats";
import { CreationCanvasPreview } from "./PostManager";

type CreationManagerProps = {
  creations: Creation[];
  folders: CreationFolder[];
  campaigns: Campaign[];
  galleryAssets: GalleryAsset[];
  loading: boolean;
  errorMessage: string;
  onCreate: (folderId?: string) => Promise<void>;
  onCreateFolder: (name: string) => Promise<void>;
  onOpen: (creationId: string) => void;
  onDuplicate: (creation: Creation) => Promise<void>;
  onDelete: (creation: Creation) => Promise<void>;
  onDeleteFolder: (folder: CreationFolder) => Promise<void>;
  onMove: (creation: Creation, folderId: string) => Promise<void>;
  onRenameFolder: (folder: CreationFolder, name: string) => Promise<void>;
};

const UNFILED_DROP_KEY = "__unfiled__";
const AUTO_SCROLL_EDGE = 140;
const AUTO_SCROLL_MAX_SPEED = 18;

const formatUpdatedAt = (timestamp: number) => {
  if (!timestamp) return "À l’instant";
  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(timestamp));
};

export function CreationManager({
  creations,
  folders,
  campaigns,
  galleryAssets,
  loading,
  errorMessage,
  onCreate,
  onCreateFolder,
  onOpen,
  onDuplicate,
  onDelete,
  onDeleteFolder,
  onMove,
  onRenameFolder,
}: CreationManagerProps) {
  const [creatingInFolder, setCreatingInFolder] = useState<string | null>(null);
  const [isCreatingFolder, setIsCreatingFolder] = useState(false);
  const [duplicatingCreationId, setDuplicatingCreationId] = useState("");
  const [deletingCreationId, setDeletingCreationId] = useState("");
  const [deletingFolderId, setDeletingFolderId] = useState("");
  const [renamingFolderId, setRenamingFolderId] = useState("");
  const [draggedCreationId, setDraggedCreationId] = useState("");
  const [dragOverFolderKey, setDragOverFolderKey] = useState("");
  const [collapsedFolderKeys, setCollapsedFolderKeys] = useState<Set<string>>(
    () => new Set(),
  );
  const [localError, setLocalError] = useState("");
  const dragPointerYRef = useRef<number | null>(null);
  const autoScrollFrameRef = useRef<number | null>(null);

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
    if (pointerY < AUTO_SCROLL_EDGE) {
      const intensity = Math.min(
        1,
        (AUTO_SCROLL_EDGE - pointerY) / AUTO_SCROLL_EDGE,
      );
      speed = -Math.max(2, Math.round(AUTO_SCROLL_MAX_SPEED * intensity));
    } else if (pointerY > window.innerHeight - AUTO_SCROLL_EDGE) {
      const intensity = Math.min(
        1,
        (pointerY - (window.innerHeight - AUTO_SCROLL_EDGE)) /
          AUTO_SCROLL_EDGE,
      );
      speed = Math.max(2, Math.round(AUTO_SCROLL_MAX_SPEED * intensity));
    }

    if (speed === 0) return;
    window.scrollBy(0, speed);
    autoScrollFrameRef.current = window.requestAnimationFrame(runAutoScroll);
  };

  const updateAutoScroll = (pointerY: number) => {
    dragPointerYRef.current = pointerY;
    const isNearEdge =
      pointerY < AUTO_SCROLL_EDGE ||
      pointerY > window.innerHeight - AUTO_SCROLL_EDGE;

    if (!isNearEdge) {
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

  const startCreating = async (folderId = "") => {
    if (creatingInFolder !== null) return;
    setCreatingInFolder(folderId || UNFILED_DROP_KEY);
    setLocalError("");
    try {
      await onCreate(folderId);
    } catch {
      setLocalError("La création n’a pas pu être créée.");
    } finally {
      setCreatingInFolder(null);
    }
  };

  const startCreatingFolder = async () => {
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

  const removeFolder = async (folder: CreationFolder) => {
    const confirmed = window.confirm(
      `Supprimer le dossier « ${folder.name} » ? Ses créations seront déplacées dans « Sans dossier ».`,
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

  const moveCreation = async (creationId: string, folderId: string) => {
    const creation = creations.find((candidate) => candidate.id === creationId);
    stopAutoScroll();
    setDraggedCreationId("");
    setDragOverFolderKey("");
    if (!creation || creation.folderId === folderId) return;

    setLocalError("");
    try {
      await onMove(creation, folderId);
    } catch {
      setLocalError("La création n’a pas pu être déplacée.");
    }
  };

  const toggleFolder = (folderKey: string) => {
    setCollapsedFolderKeys((current) => {
      const next = new Set(current);
      if (next.has(folderKey)) next.delete(folderKey);
      else next.add(folderKey);
      return next;
    });
  };

  const removeCreation = async (creation: Creation) => {
    const confirmed = window.confirm(
      `Supprimer « ${creation.name} » ? Cette action ne pourra pas être annulée.`,
    );
    if (!confirmed) return;

    setDeletingCreationId(creation.id);
    setLocalError("");
    try {
      await onDelete(creation);
    } catch {
      setLocalError("La création n’a pas pu être supprimée.");
    } finally {
      setDeletingCreationId("");
    }
  };

  const copyCreation = async (creation: Creation) => {
    if (duplicatingCreationId) return;
    setDuplicatingCreationId(creation.id);
    setLocalError("");
    try {
      await onDuplicate(creation);
    } catch {
      setLocalError("La création n’a pas pu être dupliquée.");
    } finally {
      setDuplicatingCreationId("");
    }
  };

  const knownFolderIds = new Set(folders.map((folder) => folder.id));
  const unfiledCreations = creations.filter(
    (creation) => !creation.folderId || !knownFolderIds.has(creation.folderId),
  );
  const folderGroups = [
    ...folders.map((folder) => ({
      id: folder.id,
      name: folder.name,
      folder,
      creations: creations.filter(
        (creation) => creation.folderId === folder.id,
      ),
    })),
    {
      id: "",
      name: "Sans dossier",
      folder: null,
      creations: unfiledCreations,
    },
  ];

  return (
    <section
      className="creation-page"
      aria-label="Mes créations"
      onDragOver={(event) => {
        if (draggedCreationId) updateAutoScroll(event.clientY);
      }}
    >
      <PageHeader title="Créations" description="Retrouve tes visuels et leurs réglages.">
        <div className="creation-page-header-actions">
          <Button variant="secondary"
            className="campaign-secondary-button"
            type="button"
            disabled={isCreatingFolder}
            onClick={() => void startCreatingFolder()}
          >
            <Icon name="folder" />{isCreatingFolder ? "Création…" : "Nouveau dossier"}
          </Button>
        </div>
      </PageHeader>

      {(errorMessage || localError) && (
        <p className="campaign-system-error" role="alert">
          {localError || errorMessage}
        </p>
      )}

      {loading ? (
        <div className="creation-empty-state">Chargement des créations…</div>
      ) : creations.length === 0 && folders.length === 0 ? (
        <div className="creation-empty-state">
          <div className="creation-empty-symbol"><Icon name="folder" /></div>
          <h3>Créez votre premier visuel</h3>
          <p>
            Ouvrez une création vierge, puis choisissez son nom, sa campagne et
            tous ses réglages directement dans le Studio.
          </p>
        </div>
      ) : (
        <div className="creation-grid">
          {folderGroups.map((group) => {
            const dropKey = group.id || UNFILED_DROP_KEY;
            const isCollapsed = collapsedFolderKeys.has(dropKey);
            return (
              <section
                className={`creation-folder-section ${dragOverFolderKey === dropKey ? "drag-over" : ""}`}
                key={dropKey}
                onDragOver={(event) => {
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
                  event.preventDefault();
                  event.stopPropagation();
                  const creationId =
                    event.dataTransfer.getData("text/plain") ||
                    draggedCreationId;
                  void moveCreation(creationId, group.id);
                }}
              >
                <SectionHeading as="header" className="creation-folder-header">
                  <div className="creation-folder-title">
                    <Icon name="folder" />
                    <h3>{group.name}</h3>
                  </div>
                  <div className="creation-folder-actions">
                    {group.folder && (
                      <>
                        <button
                          className="creation-folder-add-button"
                          type="button"
                          disabled={creatingInFolder !== null}
                          onClick={() => void startCreating(group.id)}
                        >
                          {creatingInFolder === dropKey
                            ? "Ouverture…"
                            : "+ Nouvelle création"}
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
                      <small>
                        {group.creations.length} création
                        {group.creations.length === 1 ? "" : "s"}
                      </small>
                      <Icon name="expand_more" className={`studio-folder-chevron ${isCollapsed ? "collapsed" : ""}`} />
                    </button>
                  </div>
                </SectionHeading>

                {!isCollapsed && group.creations.length === 0 && (
                  <div className="creation-folder-empty">
                    Glissez une création ici
                  </div>
                )}

                {!isCollapsed && group.creations.map((creation) => {
            const campaign = campaigns.find(
              (currentCampaign) => currentCampaign.id === creation.campaignId,
            );
            const language = CAMPAIGN_LANGUAGES.find(({ id }) =>
              campaign?.translations[id].title.trim() || campaign?.translations[id].description.trim(),
            )?.id ?? "fr";
            const translation = campaign?.translations[language];
            const campaignTitle = translation?.title.trim() ?? "";
            const campaignDescription = translation?.description.trim() ?? "";
            return (
              <article
                className={`creation-card ${draggedCreationId === creation.id ? "dragging" : ""}`}
                draggable
                key={creation.id}
                onDragStart={(event) => {
                  event.dataTransfer.effectAllowed = "move";
                  event.dataTransfer.setData("text/plain", creation.id);
                  setDraggedCreationId(creation.id);
                  updateAutoScroll(event.clientY);
                }}
                onDragEnd={() => {
                  stopAutoScroll();
                  setDraggedCreationId("");
                  setDragOverFolderKey("");
                }}
              >
                <button
                  type="button"
                  className="creation-preview"
                  onClick={() => onOpen(creation.id)}
                  aria-label={`Modifier ${campaignTitle || creation.name}`}
                >
                  <CreationCanvasPreview
                    creation={creation}
                    campaignTitle={campaignTitle}
                    campaignDescription={campaignDescription}
                    language={language}
                    galleryAssets={galleryAssets}
                  />
                </button>
                <div className="creation-card-body">
                  <div className="creation-card-summary">
                    <strong title={campaignTitle}>{campaignTitle}</strong>
                    <span title={campaignDescription}>
                      {campaignDescription}
                    </span>
                  </div>
                  <div className="creation-card-meta">
                    <span>
                      {FORMAT_CONFIG[creation.format].label}
                    </span>
                    <span>
                      Modifié le {formatUpdatedAt(creation.updatedAt)}
                    </span>
                  </div>
                  <div className="creation-card-actions">
                    <button
                      className="creation-edit-button"
                      type="button"
                      onClick={() => onOpen(creation.id)}
                    >
                      Modifier
                    </button>
                    <button
                      className="creation-duplicate-button"
                      type="button"
                      disabled={duplicatingCreationId === creation.id}
                      onClick={() => void copyCreation(creation)}
                    >
                      {duplicatingCreationId === creation.id
                        ? "Duplication…"
                        : "Dupliquer"}
                    </button>
                    <button
                      className="creation-delete-button"
                      type="button"
                      disabled={deletingCreationId === creation.id}
                      onClick={() => void removeCreation(creation)}
                      aria-label={`Supprimer ${creation.name}`}
                      title="Supprimer la création"
                    >
                      <Icon name="delete" />
                    </button>
                  </div>
                </div>
              </article>
            );
                })}
              </section>
            );
          })}
        </div>
      )}
    </section>
  );
}
