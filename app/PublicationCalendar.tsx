"use client";
import { PageHeader, Icon } from "./components";

import { useEffect, useRef, useState } from "react";
import type { StudioPost } from "../firebase/posts";
import type { PostPage } from "../firebase/postPages";
import type { PostFolder } from "../firebase/postFolders";
import type { GalleryAsset } from "../firebase/gallery";
import { subscribeToPublicationPlan, updatePublicationPlan, type PlannedPublication } from "../firebase/publicationPlan";
import { PostPreview } from "./components/PostPreview";
import { SectionHeading } from "./SectionHeading";
import { Dropdown } from "./Dropdown";
import { useSocialHistory } from "./InstagramPublicationStatus";
import { InstagramPublicationEditor } from "./InstagramPublicationEditor";
import { orderFolderPosts } from "./postOrder";
import { localDateKey, monthDays, movePublication, placeUnscheduled } from "./calendarModel";
import { startPlannerDragPreview } from "./plannerDragPreview";
import {usePublicationScheduling} from "./usePublicationScheduling";
import {PublicationScheduleSettings} from "./PublicationSchedulePanels";
import {PublicationReportBrowser} from "./PublicationReportBrowser";
import {isFutureSchedule, zonedMinute} from "../firebase/scheduling";
import "./publicationCalendar.css";

type Props = { posts: StudioPost[]; postPages: PostPage[]; folders: PostFolder[];  galleryAssets: GalleryAsset[]; loading: boolean };
const displayDate = (date: string) => date ? new Date(`${date}T12:00:00`).toLocaleDateString("fr-FR") : "Sans date";

export function PublicationCalendar({ posts, postPages, folders, galleryAssets, loading }: Props) {
  const instagramHistory = useSocialHistory();
  const scheduling = usePublicationScheduling(posts, postPages, galleryAssets);
  const [entries, setEntries] = useState<PlannedPublication[]>([]);
  const [syncing, setSyncing] = useState(true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const [panel, setPanel] = useState<"calendar" | "report">("calendar");
  const [view, setView] = useState<"month" | "order">("month");
  const [month, setMonth] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [pickerFilter, setPickerFilter] = useState("all");
  const [targetDate, setTargetDate] = useState("");
  const [editingId, setEditingId] = useState("");
  const [draggedId, setDraggedId] = useState("");
  const dragPreview = useRef<(() => void) | null>(null);
  function clearDragPreview() {
    dragPreview.current?.();
    dragPreview.current = null;
  }
  useEffect(() => () => clearDragPreview(), []);
  const picker = useRef<HTMLDialogElement>(null);
  const editor = useRef<HTMLDialogElement>(null);
  useEffect(() => subscribeToPublicationPlan((next) => { setEntries(next); setSyncing(false); }, () => { setError("Le calendrier n’a pas pu être chargé. Recharge la page pour réessayer."); setSyncing(false); }), []);
  const unavailable = busy || syncing || loading || scheduling.busy || !scheduling.loaded;
  async function save(change: (items: PlannedPublication[]) => PlannedPublication[]) {
    if (busyRef.current || syncing || loading || scheduling.busy || !scheduling.loaded) return false;
    busyRef.current = true;
    setBusy(true);
    setError("");
    try {
      const result = await updatePublicationPlan(change);
      for (const entry of result.changed) await scheduling.prepare(entry);
      return true;
    }
    catch { setError("Le changement n’a pas pu être enregistré. Réessaie."); return false; }
    finally { busyRef.current = false; setBusy(false); }
  }
  // Upgrade pre-existing future calendar entries once. They used to be visual only.
  const upgraded = useRef(false);
  useEffect(() => {
    if (upgraded.current || unavailable) return;
    upgraded.current = true;
    if (entries.some((entry) => entry.date && !entry.scheduleRevision && isFutureSchedule(entry.date, scheduling.settings))) {
      void save((items) => items.map((entry) => entry.date && !entry.scheduleRevision && isFutureSchedule(entry.date, scheduling.settings) ? {...entry, scheduleRevision: crypto.randomUUID()} : entry));
    }
  }, [entries, unavailable, scheduling.settings]);
  const patch = (id: string, changes: Partial<PlannedPublication>) => save((items) => items.map((item) => item.id === id ? { ...item, ...changes } : item));
  const pagesFor = (post: StudioPost) => post.pageIds.map((id) => postPages.find((page) => page.id === id)).filter((page): page is PostPage => Boolean(page));
  const postName = (post?: StudioPost) => post ? pagesFor(post)[0]?.name || "Post sans titre" : "Post supprimé";
  const visibleEntries = entries.filter((entry) => filter === "all" || (filter === "published" ? Boolean(entry.publishedAt) : !entry.publishedAt));
  const edited = entries.find((entry) => entry.id === editingId);
  function postVisual(post: StudioPost, entryId?: string) {
    return <PostPreview postPage={pagesFor(post)[0]} galleryAssets={galleryAssets} gallery={post.type === "gallery"}
      publications={instagramHistory.items.filter((item) => item.postId === post.id && (!entryId || item.entryId === entryId))} status={instagramHistory.status} />;
  }
  function openPicker(date: string) { setTargetDate(date); setSearch(""); setPickerFilter("all"); picker.current?.showModal(); }
  function card(entry: PlannedPublication, index?: number) {
    const post = posts.find((candidate) => candidate.id === entry.postId);
    const scheduleState = scheduling.state(entry);
    return <article key={entry.id} className={`planner-card ${entry.publishedAt ? "published" : ""}`} draggable={!unavailable} onDragStart={(event) => { event.stopPropagation(); window.getSelection()?.removeAllRanges();
        clearDragPreview();
        dragPreview.current = startPlannerDragPreview(event.currentTarget, event.dataTransfer, event, view === "order");
        setDraggedId(entry.id); event.dataTransfer.setData("application/x-dailydish-plan", entry.id); event.dataTransfer.effectAllowed = "move"; }} onDragEnd={() => { setDraggedId(""); clearDragPreview(); }}
      onDragOver={(event) => { if (draggedId && !unavailable && (view === "order" || !entry.date)) event.preventDefault(); }}
      onDrop={(event) => { if (!draggedId || unavailable || (view !== "order" && entry.date)) return; event.preventDefault(); event.stopPropagation(); void save((items) => view === "order" ? movePublication(items, draggedId, entry.id) : placeUnscheduled(items, draggedId, entry.id)); setDraggedId(""); }}>
      <button type="button" className="planner-card-open planner-picker-post" aria-label={`Modifier la planification de ${postName(post)}`} onClick={() => { setEditingId(entry.id); editor.current?.showModal(); }}>
        {post ? postVisual(post, entry.id) : <span>Post supprimé</span>}
      </button>
      {scheduleState.label && <div className="planner-schedule-status" role="status" title={scheduleState.message}>
        <span>{scheduleState.label}</span>
        {scheduleState.refresh && <button type="button" disabled={unavailable} onClick={() => { if (!entry.scheduleRevision) void save((items) => items.map((item) => item.id === entry.id ? {...item, scheduleRevision: crypto.randomUUID()} : item)); else void scheduling.prepare(entry); }}>Actualiser</button>}
      </div>}
      {view === "order" && <div className="planner-order-actions"><button disabled={unavailable || index === 0} onClick={() => { const before = visibleEntries[(index ?? 0) - 1]; if (before) void save((items) => movePublication(items, entry.id, before.id)); }} aria-label="Monter la publication"><Icon name="arrow_upward" /></button><button disabled={unavailable || index === visibleEntries.length - 1} onClick={() => { const after = visibleEntries[(index ?? 0) + 1]; if (after) void save((items) => movePublication(items, after.id, entry.id)); }} aria-label="Descendre la publication"><Icon name="arrow_downward" /></button></div>}
    </article>;
  }
  const groups = [...folders, { id: "", name: "Sans dossier" }];
  return <section className="publication-calendar">
    <div className="planner-section-tabs" role="tablist" aria-label="Contenu du calendrier" onKeyDown={(event) => {
      if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
      event.preventDefault();
      const next = event.key === "Home" ? "calendar" : event.key === "End" ? "report" : panel === "calendar" ? "report" : "calendar";
      setPanel(next);
      document.getElementById(`planner-tab-${next}`)?.focus();
    }}>
      <button type="button" role="tab" id="planner-tab-calendar" aria-controls="planner-panel-calendar" aria-selected={panel === "calendar"} tabIndex={panel === "calendar" ? 0 : -1} onClick={() => setPanel("calendar")}>Calendrier</button>
      <button type="button" role="tab" id="planner-tab-report" aria-controls="planner-panel-report" aria-selected={panel === "report"} tabIndex={panel === "report" ? 0 : -1} onClick={() => setPanel("report")}>Rapport</button>
    </div>
    <PageHeader title={panel === "calendar" ? "Calendrier" : "Rapport"} description={panel === "calendar" ? "Glisse tes posts sur une journée pour les publier automatiquement en EN, FR et BR." : "Consulte les événements et les résultats de tes publications."} />
    {error && <p className="planner-error" role="alert">{error}</p>}
    {scheduling.error && <p className="planner-error" role="alert">{scheduling.error}</p>}
    <div className="planner-main" id="planner-panel-calendar" role="tabpanel" aria-labelledby="planner-tab-calendar" hidden={panel !== "calendar"}>
    <div className="planner-toolbar"><div className="planner-switch"><button aria-pressed={view === "month"} onClick={() => setView("month")}>Vue mensuelle</button><button aria-pressed={view === "order"} onClick={() => setView("order")}>Ordre des publications</button></div><Dropdown aria-label="Filtrer les publications" value={filter} onChange={(event) => setFilter(event.target.value)}><option value="all">Toutes</option><option value="pending">À publier</option><option value="published">Publiées</option></Dropdown><span role="status">{syncing || loading ? "Chargement…" : busy ? "Enregistrement…" : `${entries.length} publication${entries.length > 1 ? "s" : ""}`}</span></div>
    {view === "month" ? <>
      <section className="planner-unscheduled" aria-label="À planifier">
        <SectionHeading><h3>À planifier</h3><small>{visibleEntries.filter((entry) => !entry.date).length}</small></SectionHeading>
        <p className="planner-help">Ajoute tes posts, organise-les ici, puis glisse-les vers une journée du calendrier.</p>
        <div className="planner-grid-scroll planner-unscheduled-scroll">
          <div className="planner-unscheduled-grid" onDragOver={(event) => { if (draggedId && !unavailable) event.preventDefault(); }} onDrop={(event) => {
            if (!draggedId || unavailable) return;
            event.preventDefault();
            void save((items) => placeUnscheduled(items, draggedId));
            setDraggedId("");
          }}>
            <button className="planner-add-tile" draggable={false} disabled={unavailable} onClick={() => openPicker("")} onDrop={(event) => {
              if (!draggedId || unavailable) return;
              event.preventDefault(); event.stopPropagation();
              void save((items) => placeUnscheduled(items, draggedId, items.find((item) => !item.date && item.id !== draggedId)?.id));
              setDraggedId("");
            }}><Icon name="add" />Ajouter un post</button>
            {visibleEntries.filter((entry) => !entry.date).map((entry) => card(entry))}
            <div className="planner-empty-slot" aria-label="Emplacement libre pour déposer un post" onDragOver={(event) => { if (draggedId && !unavailable) { event.preventDefault(); event.dataTransfer.dropEffect = "move"; } }}><span>Déposer un post ici</span></div>
          </div>
        </div>
      </section>
      <PublicationScheduleSettings settings={scheduling.settings} disabled={unavailable} save={scheduling.saveSettings}>
      <div className="planner-month-nav"><button aria-label="Mois précédent" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))}><Icon name="chevron_left" /></button><h3>{month.toLocaleDateString("fr-FR", { month: "long", year: "numeric" })}</h3><button aria-label="Mois suivant" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))}><Icon name="chevron_right" /></button><button onClick={() => setMonth(new Date(new Date().getFullYear(), new Date().getMonth(), 1))}>Aujourd’hui</button></div>
      <div className="planner-month-layout"><div className="planner-grid-scroll"><div className="planner-grid">
        {["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"].map((day) => <div className="planner-weekday" key={day}>{day}</div>)}
        {monthDays(month).map((day) => { const key = localDateKey(day); return <div key={key} className={`planner-day ${day.getMonth() !== month.getMonth() ? "outside" : ""} ${key === zonedMinute(new Date(), scheduling.settings.timeZone).slice(0, 10) ? "today" : ""}`} onClick={(event) => { if (event.target === event.currentTarget && !unavailable) openPicker(key); }} onDragOver={(event) => { if (draggedId && !unavailable) event.preventDefault(); }} onDrop={(event) => { if (!draggedId || unavailable) return; event.preventDefault(); event.stopPropagation(); void patch(draggedId, { date: key }); setDraggedId(""); }}><button className="planner-day-add" disabled={unavailable} aria-label={`Ajouter un post le ${displayDate(key)}`} onClick={() => openPicker(key)}><span>{day.getDate()}</span><Icon name="add" /></button>{visibleEntries.filter((entry) => entry.date === key).map((entry) => card(entry))}</div>; })}
      </div></div></div>
      </PublicationScheduleSettings>
      </>
      : <><p className="planner-help">Glisse les publications pour organiser leur ordre. Les dates restent indépendantes.</p><div className="planner-order-list">{visibleEntries.map((entry, index) => card(entry, index))}</div>{!visibleEntries.length && <p className="planner-empty">Aucune publication ici. Ajoute un post pour commencer.</p>}</>}
    </div>
    <div id="planner-panel-report" role="tabpanel" aria-labelledby="planner-tab-report" hidden={panel !== "report"}>
    {panel === "report" && <PublicationReportBrowser timeZone={scheduling.settings.timeZone} entries={entries} posts={posts} postPages={postPages} assets={galleryAssets} />}
    </div>
    <dialog ref={picker} className="planner-dialog"><header><div><h3>Ajouter un post</h3><p>{targetDate ? `Pour le ${displayDate(targetDate)}` : "Dans les posts à planifier"}</p></div><button aria-label="Fermer le sélecteur" onClick={() => picker.current?.close()}><Icon name="close" /></button></header>
      <div className="planner-toolbar"><input type="search" placeholder="Rechercher un post ou un dossier" aria-label="Rechercher un post ou un dossier" value={search} onChange={(event) => setSearch(event.target.value)} /><Dropdown aria-label="Filtrer les posts disponibles" value={pickerFilter} onChange={(event) => setPickerFilter(event.target.value)}><option value="all">Tous les posts</option><option value="unpublished">Jamais publiés</option><option value="published">Déjà publiés</option></Dropdown></div>
      {error && <p role="alert" className="planner-error">{error}</p>}
      {!posts.length && <p>Aucun post disponible. Crée un post dans l’onglet Posts.</p>}
      {groups.map((folder) => {
        const candidates = orderFolderPosts(posts.filter((post) => folder.id ? post.folderId === folder.id : !folders.some((item) => item.id === post.folderId)), folder.postOrder).filter((post) => {
          const published = entries.some((entry) => entry.postId === post.id && entry.publishedAt);
          return `${folder.name} ${postName(post)}`.toLocaleLowerCase().includes(search.toLocaleLowerCase()) && (pickerFilter === "all" || (pickerFilter === "published" ? published : !published));
        });
        if (!candidates.length) return null;
        return <details className="planner-folder" key={folder.id} open><SectionHeading as="summary"><Icon name="expand_more" className="studio-folder-chevron" /><h2>{folder.name}</h2><small>{candidates.length}</small></SectionHeading><div className="planner-picker-grid">{candidates.map((post) => {
          const cover = pagesFor(post)[0];
          return <button aria-label={`Sélectionner ${post.type === "gallery" ? "la galerie" : "le post"} ${postName(post)}`} disabled={unavailable || !cover} className="planner-picker-post" key={post.id} onClick={() => { const entry = { id: crypto.randomUUID(), postId: post.id, date: targetDate, publishedAt: "" }; picker.current?.close(); void save((items) => [...items, entry]).then((ok) => { if (ok) picker.current?.close(); }); }}>{postVisual(post)}</button>;
        })}</div></details>;
      })}
    </dialog>
    <dialog ref={editor} className="planner-dialog planner-entry-dialog" onClose={() => setEditingId("")} onCancel={(event) => { if (editor.current?.querySelector('[aria-busy="true"]')) event.preventDefault(); }}>
      {edited && <InstagramPublicationEditor key={edited.id} entry={edited} post={posts.find((post) => post.id === edited.postId)} postPages={postPages} assets={galleryAssets} disabled={unavailable} error={error} close={() => { editor.current?.close(); setEditingId(""); }} remove={() => { void save((items) => items.filter((item) => item.id !== edited.id)).then((ok) => { if (ok) { editor.current?.close(); setEditingId(""); } }); }} />}
    </dialog>
  </section>;
}
