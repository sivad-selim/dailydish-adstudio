"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createCampaignFolder, subscribeToCampaignFolders, type CampaignFolder } from "../firebase/campaignFolders";
import {
  CAMPAIGN_LANGUAGES,
  getCampaignTitle,
  type Campaign,
  type CampaignLanguage,
} from "../firebase/campaigns";

type CampaignManagerProps = {
  campaigns: Campaign[];
  selectedCampaignId: string;
  loading: boolean;
  errorMessage: string;
  onSelectCampaign: (campaignId: string) => void;
  onCreateCampaign: (folderId: string) => Promise<void>;
  onSaveCampaign: (campaign: Campaign) => Promise<void>;
  onDeleteCampaign: (campaignId: string) => Promise<void>;
  onMoveCampaign: (campaignId: string, folderId: string) => Promise<void>;
};

const CAMPAIGN_DRAG_TYPE = "application/x-dailydish-campaign";

const cloneCampaign = (campaign: Campaign): Campaign => ({
  ...campaign,
  translations: {
    fr: { ...campaign.translations.fr },
    en: { ...campaign.translations.en },
    pt: { ...campaign.translations.pt },
  },
});

const completedLanguages = (campaign: Campaign) =>
  CAMPAIGN_LANGUAGES.filter(({ id }) => {
    const translation = campaign.translations[id];
    return Boolean(translation.title.trim());
  }).length;

export function CampaignManager({
  campaigns,
  selectedCampaignId,
  loading,
  errorMessage,
  onSelectCampaign,
  onCreateCampaign,
  onSaveCampaign,
  onDeleteCampaign,
  onMoveCampaign,
}: CampaignManagerProps) {
  const selectedCampaign = useMemo(
    () =>
      campaigns.find((campaign) => campaign.id === selectedCampaignId) ?? null,
    [campaigns, selectedCampaignId],
  );
  const [draft, setDraft] = useState<Campaign | null>(null);
  const [language, setLanguage] = useState<CampaignLanguage>("fr");
  const [isCreating, setIsCreating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [deletingCampaignId, setDeletingCampaignId] = useState("");
  const [localMessage, setLocalMessage] = useState("");
  const [folders, setFolders] = useState<CampaignFolder[]>([]);
  const [folderId, setFolderId] = useState(() => selectedCampaign?.folderId ?? "");
  const [foldersLoading, setFoldersLoading] = useState(true);
  const [showFolderForm, setShowFolderForm] = useState(false);
  const [folderName, setFolderName] = useState("");
  const [creatingFolder, setCreatingFolder] = useState(false);
  const [folderError, setFolderError] = useState("");
  const [dropTarget, setDropTarget] = useState<string | null>(null);
  const [movingId, setMovingId] = useState("");
  const [moveStatus, setMoveStatus] = useState("");
  const folderInputRef = useRef<HTMLInputElement>(null);
  const moveInFlight = useRef(false);
  const previousCampaign = useRef<Campaign | null>(null);

  useEffect(() => subscribeToCampaignFolders(
    (nextFolders) => { setFolders(nextFolders); setFoldersLoading(false); },
    () => { setFolderError("Les dossiers n’ont pas pu être chargés. Rechargez la page."); setFoldersLoading(false); },
  ), []);

  useEffect(() => {
    if (showFolderForm) folderInputRef.current?.focus();
  }, [showFolderForm]);

  useEffect(() => {
    const previous = previousCampaign.current;
    previousCampaign.current = selectedCampaign;
    if (selectedCampaign && previous?.id === selectedCampaign.id &&
      JSON.stringify(previous.translations) === JSON.stringify(selectedCampaign.translations)) {
      // Folder changes and unrelated snapshots must preserve unsaved text.
      setDraft((current) => current ? { ...current, folderId: selectedCampaign.folderId } : cloneCampaign(selectedCampaign));
    } else {
      setDraft(selectedCampaign ? cloneCampaign(selectedCampaign) : null);
      setLocalMessage("");
    }
  }, [selectedCampaign]);

  const visibleCampaigns = campaigns.filter((campaign) => (campaign.folderId ?? "") === folderId);
  const currentFolderName = folders.find((folder) => folder.id === folderId)?.name ?? "Racine";

  const addFolder = async () => {
    if (creatingFolder || !folderName.trim()) return;
    setCreatingFolder(true);
    setFolderError("");
    try {
      const id = await createCampaignFolder(folderName);
      setFolders((current) => current.some((folder) => folder.id === id) ? current
        : [...current, { id, name: folderName.trim() }].sort((a, b) => a.name.localeCompare(b.name)));
      setFolderId(id);
      setFolderName("");
      setShowFolderForm(false);
    } catch (error) {
      setFolderError(error instanceof Error ? error.message : "Le dossier n’a pas pu être créé.");
    } finally { setCreatingFolder(false); }
  };

  const moveToFolder = async (campaign: Campaign, destination: string) => {
    if (moveInFlight.current || deletingCampaignId || (campaign.folderId ?? "") === destination) return;
    moveInFlight.current = true;
    setMovingId(campaign.id);
    setFolderError("");
    setMoveStatus("");
    try {
      await onMoveCampaign(campaign.id, destination);
      setMoveStatus(`Campagne déplacée vers ${folders.find((folder) => folder.id === destination)?.name ?? "la racine"}.`);
    } catch {
      setFolderError("La campagne n’a pas pu être déplacée. Réessayez.");
    } finally { moveInFlight.current = false; setMovingId(""); }
  };

  const createNewCampaign = async () => {
    setIsCreating(true);
    setLocalMessage("");
    try {
      await onCreateCampaign(folderId);
    } catch {
      setLocalMessage("La campagne n’a pas pu être créée.");
    } finally {
      setIsCreating(false);
    }
  };

  const persistDraft = async () => {
    if (!draft) return false;
    setIsSaving(true);
    setLocalMessage("");
    try {
      await onSaveCampaign(draft);
      setLocalMessage("Campagne enregistrée");
      return true;
    } catch {
      setLocalMessage("La campagne n’a pas pu être enregistrée.");
      return false;
    } finally {
      setIsSaving(false);
    }
  };

  const removeCampaign = async (campaign: Campaign) => {
    const campaignTitle = getCampaignTitle(campaign);
    const confirmed = window.confirm(
      `Supprimer « ${campaignTitle} » ? Les créations existantes resteront disponibles, mais ne seront plus rattachées à cette campagne.`,
    );
    if (!confirmed) return;

    setDeletingCampaignId(campaign.id);
    setLocalMessage("");
    try {
      await onDeleteCampaign(campaign.id);
    } catch {
      setLocalMessage("La campagne n’a pas pu être supprimée.");
    } finally {
      setDeletingCampaignId("");
    }
  };

  const updateTranslation = (
    field: "title" | "description",
    value: string,
  ) => {
    setDraft((current) =>
      current
        ? {
            ...current,
            translations: {
              ...current.translations,
              [language]: {
                ...current.translations[language],
                [field]: value,
              },
            },
          }
        : null,
    );
    setLocalMessage("");
  };

  const activeTranslation = draft?.translations[language];
  const activeLanguageLabel = CAMPAIGN_LANGUAGES.find(
    ({ id }) => id === language,
  )?.label;

  return (
    <section className="campaign-page" aria-label="Gestion des campagnes">
      <div className="campaign-page-header">
        <div>
          <p>Contenus multilingues</p>
          <h2>Campagnes</h2>
          <span>
            Préparez une seule campagne, puis déclinez-la en français, anglais
            et portugais.
          </span>
        </div>
        <button
          className="campaign-primary-button"
          type="button"
          disabled={isCreating}
          onClick={() => void createNewCampaign()}
        >
          {isCreating ? "Création…" : "+ Nouvelle campagne"}
        </button>
      </div>

      {errorMessage && <p className="campaign-system-error">{errorMessage}</p>}

      <div className="gallery-folder-toolbar campaign-folder-toolbar">
        <nav className="gallery-folder-list" aria-label="Dossiers des campagnes" aria-busy={foldersLoading}>
          {[{ id: "", name: "Racine" }, ...folders].map((folder) => (
            <button key={folder.id} type="button"
              className={`gallery-folder ${folderId === folder.id ? "selected" : ""} ${dropTarget === folder.id ? "drop-target" : ""}`}
              aria-current={folderId === folder.id ? "page" : undefined}
              onClick={() => setFolderId(folder.id)}
              onDragOver={(event) => {
                if (!event.dataTransfer.types.includes(CAMPAIGN_DRAG_TYPE) || movingId) return;
                event.preventDefault();
                event.dataTransfer.dropEffect = "move";
                setDropTarget(folder.id);
              }}
              onDragLeave={(event) => {
                if (event.relatedTarget instanceof Node && event.currentTarget.contains(event.relatedTarget)) return;
                setDropTarget(null);
              }}
              onDrop={(event) => {
                if (!event.dataTransfer.types.includes(CAMPAIGN_DRAG_TYPE)) return;
                event.preventDefault();
                setDropTarget(null);
                const campaign = campaigns.find((item) => item.id === event.dataTransfer.getData(CAMPAIGN_DRAG_TYPE));
                if (campaign) void moveToFolder(campaign, folder.id);
              }}
            >
              <span aria-hidden="true">{folder.id ? "📁" : "⌂"}</span><span>{folder.name}</span>
              <small>{campaigns.filter((campaign) => (campaign.folderId ?? "") === folder.id).length}</small>
            </button>
          ))}
        </nav>
        <button className="gallery-new-folder" type="button" disabled={foldersLoading} onClick={() => setShowFolderForm(true)}>+ Nouveau dossier</button>
      </div>
      {showFolderForm && (
        <form className="gallery-folder-form" onSubmit={(event) => { event.preventDefault(); void addFolder(); }}>
          <label htmlFor="campaign-folder-name">Nom du dossier</label>
          <input ref={folderInputRef} id="campaign-folder-name" maxLength={80} value={folderName} disabled={creatingFolder} onChange={(event) => setFolderName(event.target.value)} placeholder="Ex. Rentrée, Recettes…" />
          <button type="submit" disabled={creatingFolder || !folderName.trim()}>{creatingFolder ? "Création…" : "Créer"}</button>
          <button type="button" disabled={creatingFolder} onClick={() => { setShowFolderForm(false); setFolderName(""); }}>Annuler</button>
        </form>
      )}
      <p className="campaign-folder-hint">Glissez une campagne sur un dossier pour la ranger. Les nouvelles campagnes sont créées dans le dossier ouvert.</p>
      {folderError && <p className="campaign-system-error" role="alert">{folderError}</p>}
      <p className="gallery-move-status" role="status">{movingId ? "Déplacement en cours…" : moveStatus}</p>

      <div className="campaign-layout">
        <aside className="campaign-list" aria-label="Liste des campagnes">
          <div className="campaign-list-heading">
            <strong>{currentFolderName}</strong>
            <span>{visibleCampaigns.length}</span>
          </div>

          {loading ? (
            <p className="campaign-list-message">Chargement…</p>
          ) : visibleCampaigns.length === 0 ? (
            <div className="campaign-empty-list">
              <strong>Aucune campagne</strong>
              <span>Créez une campagne ici ou déplacez-en une depuis un autre dossier.</span>
            </div>
          ) : (
            visibleCampaigns.map((campaign) => {
              const selected = campaign.id === selectedCampaignId;
              const campaignTitle = getCampaignTitle(campaign);
              return (
                <div className={`campaign-list-row ${movingId === campaign.id ? "is-moving" : ""}`} key={campaign.id}
                  draggable={!movingId && !deletingCampaignId}
                  onDragStart={(event) => { event.dataTransfer.setData(CAMPAIGN_DRAG_TYPE, campaign.id); event.dataTransfer.effectAllowed = "move"; }}
                  onDragEnd={() => setDropTarget(null)}
                >
                  <button
                    className={`campaign-list-item ${selected ? "selected" : ""}`}
                    type="button"
                    aria-pressed={selected}
                    onClick={() => onSelectCampaign(campaign.id)}
                  >
                    <strong>{campaignTitle}</strong>
                    <span>{completedLanguages(campaign)}/3 langues complètes</span>
                  </button>
                  <button
                    className="campaign-list-delete"
                    type="button"
                    disabled={!!deletingCampaignId || !!movingId}
                    onClick={() => void removeCampaign(campaign)}
                    aria-label={`Supprimer ${campaignTitle}`}
                    title="Supprimer la campagne"
                  >
                    <span className="trash-icon" aria-hidden="true" />
                  </button>
                </div>
              );
            })
          )}
        </aside>

        <div className="campaign-editor">
          {!draft ? (
            <div className="campaign-empty-editor">
              <div className="campaign-empty-icon">✦</div>
              <h3>{campaigns.length ? "Sélectionnez une campagne" : "Créez votre première campagne"}</h3>
              <p>
                Vous pourrez ensuite rédiger le titre et la description dans
                les trois langues. Vous choisirez cette campagne vous-même
                depuis une création.
              </p>
            </div>
          ) : (
            <>
              <div className="campaign-editor-topline">
                <span>{completedLanguages(draft)}/3 prêtes</span>
              </div>

              <div className="campaign-language-tabs" role="tablist">
                {CAMPAIGN_LANGUAGES.map((languageOption) => (
                  <button
                    key={languageOption.id}
                    type="button"
                    role="tab"
                    aria-selected={language === languageOption.id}
                    className={language === languageOption.id ? "selected" : ""}
                    onClick={() => setLanguage(languageOption.id)}
                  >
                    <strong>{languageOption.shortLabel}</strong>
                    <span>{languageOption.label}</span>
                  </button>
                ))}
              </div>

              <div className="campaign-copy-form">
                <div className="campaign-form-heading">
                  <div>
                    <p>Contenu de la publicité</p>
                    <h3>{activeLanguageLabel}</h3>
                  </div>
                  <span
                    className={activeTranslation?.title.trim() ? "complete" : ""}
                  >
                    {activeTranslation?.title.trim() ? "Complet" : "À compléter"}
                  </span>
                </div>

                <label className="field-label" htmlFor="campaign-title">
                  Titre
                  <span>{activeTranslation?.title.length ?? 0}/70</span>
                </label>
                <textarea
                  id="campaign-title"
                  className="title-field"
                  value={activeTranslation?.title ?? ""}
                  maxLength={70}
                  onChange={(event) =>
                    updateTranslation("title", event.target.value)
                  }
                />

                <label className="field-label" htmlFor="campaign-description">
                  Description (facultative)
                  <span>{activeTranslation?.description.length ?? 0}/200</span>
                </label>
                <textarea
                  id="campaign-description"
                  value={activeTranslation?.description ?? ""}
                  maxLength={200}
                  onChange={(event) =>
                    updateTranslation("description", event.target.value)
                  }
                />
              </div>

              <div className="campaign-editor-actions">
                <span aria-live="polite">{localMessage}</span>
                <button
                  className="campaign-secondary-button"
                  type="button"
                  disabled={isSaving}
                  onClick={() => void persistDraft()}
                >
                  {isSaving ? "Enregistrement…" : "Enregistrer"}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </section>
  );
}
