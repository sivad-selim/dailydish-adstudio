import {useCallback, useEffect, useImperativeHandle, useRef, useState, type RefObject} from "react";
import {MESSAGE_LANGUAGES, type MessageLanguage, type MessageTranslations} from "../firebase/messages";
import {savePageMessage, type PostPage} from "../firebase/postPages";
import type {GalleryAsset} from "../firebase/gallery";
import {PageCanvasPreview} from "./PageCanvasPreview";
import {SectionHeading} from "./SectionHeading";
import {Button, Icon} from "./components";

export type MessageEditorHandle = {flush: () => Promise<void>};
function PageMessageEditor({page, language, editorRef, onPreview, onError}: {
  page: PostPage; language: MessageLanguage; editorRef: RefObject<MessageEditorHandle | null>;
  onPreview: (text: MessageTranslations) => void; onError: (message: string) => void;
}) {
  const [draft, setDraft] = useState(page.translations);
  const [status, setStatus] = useState("");
  const draftRef = useRef(draft);
  const saved = useRef(page.translations);
  const [savedValue, setSavedValue] = useState(page.translations);
  const running = useRef<Promise<void> | null>(null);
  const callbacks = useRef({onPreview, onError});
  useEffect(() => { callbacks.current = {onPreview, onError}; }, [onPreview, onError]);
  const dirty = JSON.stringify(draft) !== JSON.stringify(savedValue);
  const persisted = JSON.stringify(page.translations);

  // Merge external translations only into untouched fields. A dirty field keeps its
  // original baseline so savePageMessage can detect, rather than hide, a conflict.
  useEffect(() => {
    if (running.current) return;
    const incoming = JSON.parse(persisted) as MessageTranslations;
    const next = structuredClone(draftRef.current);
    const baseline = structuredClone(saved.current);
    for (const {id} of MESSAGE_LANGUAGES) {
      for (const field of ["title", "description"] as const) {
        if (next[id][field] === baseline[id][field]) {
          next[id][field] = incoming[id][field];
          baseline[id][field] = incoming[id][field];
        }
      }
    }
    saved.current = baseline;
    setSavedValue(baseline);
    if (JSON.stringify(next) !== JSON.stringify(draftRef.current)) {
      draftRef.current = next;
      setDraft(next);
      callbacks.current.onPreview(next);
    }
  }, [persisted, status]);

  const flush = useCallback(async () => {
    if (running.current) return running.current;
    const task = async () => {
      while (JSON.stringify(draftRef.current) !== JSON.stringify(saved.current)) {
        const before = saved.current;
        const after = draftRef.current;
        setStatus("Enregistrement…");
        await savePageMessage(page.id, before, after);
        saved.current = after;
        setSavedValue(after);
      }
    };
    running.current = task();
    try {
      await running.current;
      setStatus("Enregistré");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Enregistrement impossible.";
      setStatus(message);
      callbacks.current.onError(message);
      throw error;
    } finally {
      running.current = null;
    }
  }, [page.id]);
  useImperativeHandle(editorRef, () => ({flush}), [flush]);
  useEffect(() => {
    if (!dirty) return;
    const timer = window.setTimeout(() => { void flush().catch(() => undefined); }, 600);
    return () => window.clearTimeout(timer);
  }, [draft, dirty, flush]);
  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);
  const change = (field: "title" | "description", value: string) => {
    const text = {...draftRef.current, [language]: {...draftRef.current[language], [field]: value}};
    draftRef.current = text; setDraft(text); onPreview(text); setStatus("Modifications en cours…");
  };
  return <div className="page-message-form">
    <label className="field-label" htmlFor={`page-title-${page.id}`}>Titre</label>
    <textarea id={`page-title-${page.id}`} rows={3} value={draft[language].title} onChange={(event) => change("title", event.target.value)} />
    <label className="field-label" htmlFor={`page-description-${page.id}`}>Description (facultative)</label>
    <textarea id={`page-description-${page.id}`} rows={4} value={draft[language].description} onChange={(event) => change("description", event.target.value)} />
    <div className="page-message-status" role="status">{status}{dirty && <button type="button" onClick={() => void flush().catch(() => undefined)}>Enregistrer</button>}</div>
  </div>;
}

type Props = {
  pages: PostPage[]; activeId: string; language: MessageLanguage; assets: GalleryAsset[];
  editorRef: RefObject<MessageEditorHandle | null>;
  onLanguageChange: (language: MessageLanguage) => Promise<void>;
  onSelect: (id: string) => Promise<void>; onPreview: (text: MessageTranslations) => void;
  onAdd: () => Promise<void>; onReorder: (ids: string[]) => Promise<void>;
  onDelete: (page: PostPage) => Promise<void>; onSwap: (first: string, second: string) => Promise<void>;
  onError: (message: string) => void;
};
export function PostPagesPanel({pages, activeId, language, assets, editorRef, onLanguageChange, onSelect, onPreview, onAdd, onReorder, onDelete, onSwap, onError}: Props) {
  const [dragged, setDragged] = useState("");
  const [busy, setBusy] = useState(false);
  const [swapSource, setSwapSource] = useState("");
  const [swapTarget, setSwapTarget] = useState("");
  const dialog = useRef<HTMLDialogElement>(null);
  async function perform(action: () => Promise<void>) {
    if (busy) return;
    setBusy(true);
    try { await editorRef.current?.flush(); await action(); onError(""); }
    catch (error) { onError(error instanceof Error ? error.message : "La modification a échoué."); }
    finally { setBusy(false); }
  }
  function move(source: string, target: string) {
    const ids = pages.map((page) => page.id);
    const from = ids.indexOf(source), to = ids.indexOf(target);
    if (from < 0 || to < 0 || from === to) return;
    ids.splice(from, 1); ids.splice(to, 0, source);
    void perform(() => onReorder(ids)); setDragged("");
  }
  const title = (page: PostPage) => page.translations[language].title.trim() || "Sans titre";
  return <section className="post-pages-panel">
    <SectionHeading><h2>Pages</h2></SectionHeading>
    <div className="studio-language-picker" aria-label="Langue des pages">
      {MESSAGE_LANGUAGES.map((item) => <button key={item.id} type="button" disabled={busy} className={language === item.id ? "selected" : ""} aria-pressed={language === item.id} onClick={() => void perform(() => onLanguageChange(item.id))}>{item.id === "pt" ? "BR" : item.shortLabel}</button>)}
    </div>
    <div className="post-page-stack">
      {pages.map((page, index) => <div key={page.id} className={`post-page-card ${page.id === activeId ? "active" : ""} ${dragged === page.id ? "dragging" : ""}`}
        onDragOver={(event) => {if (dragged) {event.preventDefault(); event.dataTransfer.dropEffect = "move";}}}
        onDrop={(event) => {if (dragged) {event.preventDefault(); event.stopPropagation(); move(dragged, page.id);}}}>
        <div className="post-page-heading">
          <button type="button" className="post-page-handle" draggable={!busy} aria-label={`Déplacer la page ${index + 1}`} onDragStart={(event) => {event.dataTransfer.setData("application/x-dailydish-sidebar-page", page.id); event.dataTransfer.effectAllowed = "move"; event.dataTransfer.setDragImage(event.currentTarget.parentElement!, 16, 16); setDragged(page.id);}} onDragEnd={() => setDragged("")}><Icon name="drag_indicator" /></button>
          <button type="button" className="post-page-title" disabled={busy} onClick={() => void perform(() => onSelect(page.id))} aria-expanded={page.id === activeId}><span>{index + 1} · {title(page)}</span><Icon name={page.id === activeId ? "expand_less" : "expand_more"} /></button>
          <div className="post-page-actions">
            <button type="button" disabled={busy || index === 0} title="Monter la page" aria-label={`Monter la page ${index + 1}`} onClick={() => move(page.id, pages[index - 1].id)}><Icon name="arrow_upward" /></button>
            <button type="button" disabled={busy || index === pages.length - 1} title="Descendre la page" aria-label={`Descendre la page ${index + 1}`} onClick={() => move(page.id, pages[index + 1].id)}><Icon name="arrow_downward" /></button>
            <button type="button" disabled={busy || pages.length < 2} title="Intervertir les messages…" aria-label={`Intervertir le message de la page ${index + 1}`} onClick={() => {setSwapSource(page.id); setSwapTarget(""); dialog.current?.showModal();}}><Icon name="swap_horiz" /></button>
            <button type="button" disabled={busy} title="Supprimer la page" aria-label={`Supprimer la page ${index + 1}`} onClick={() => void perform(() => onDelete(page))}><Icon name="delete" /></button>
          </div>
        </div>
        {page.id === activeId && <PageMessageEditor key={page.id} page={page} language={language} editorRef={editorRef} onPreview={onPreview} onError={onError} />}
      </div>)}
    </div>
    <Button disabled={busy || pages.length >= 10} onClick={() => void perform(onAdd)}><Icon name="add" />Ajouter une page</Button>
    <dialog className="page-swap-dialog" ref={dialog}>
      <h2>Intervertir les messages</h2>
      <p>Choisis l’autre page. Les titres et descriptions seront échangés dans toutes les langues. Les images et les layouts resteront à leur place.</p>
      <div className="page-swap-choices">{pages.filter((page) => page.id !== swapSource).map((page) => <button type="button" key={page.id} className={swapTarget === page.id ? "selected" : ""} aria-pressed={swapTarget === page.id} onClick={() => setSwapTarget(page.id)}>
        <span className="page-swap-thumbnail page-preview"><PageCanvasPreview postPage={page} messageTitle={page.translations[language].title} messageDescription={page.translations[language].description} language={language} galleryAssets={assets}  /></span>
        <span>Page {pages.indexOf(page) + 1} · {title(page)}</span>
      </button>)}</div>
      <div className="page-swap-actions"><Button variant="secondary" disabled={busy} onClick={() => dialog.current?.close()}>Annuler</Button><Button variant="primary" disabled={!swapTarget || busy} onClick={() => void perform(async () => {await onSwap(swapSource, swapTarget); dialog.current?.close();})}>Intervertir les messages</Button></div>
    </dialog>
  </section>;
}
