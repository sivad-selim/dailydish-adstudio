"use client";
import { Icon } from "./components/Icon";
import { Button } from "./components/Button";

import { useEffect, useRef, useState } from "react";
import type { PostPage } from "../firebase/postPages";
import type { GalleryAsset } from "../firebase/gallery";
import type { StudioPost } from "../firebase/posts";
import type { PlannedPublication } from "../firebase/publicationPlan";
import { SOCIAL_ACCOUNTS, SOCIAL_PLATFORMS, socialAccount, platformLabel, pendingSocialTargets, type SocialTarget, type SocialPlatform } from "./socialPublicationModel";
import { socialImageUrl, verifySocialTarget, resetSocialPublication, publishSocialPost, subscribeSocialPublications, uploadSocialImage, type SocialPublication } from "../firebase/socialPublishing";
import { exportInstagramImage } from "./exportInstagramImage";
import { publicationTranslation } from "./instagramPublicationModel";
import { publicationFlags, publicationDate } from "./InstagramPublicationStatus";
import { SectionHeading } from "./SectionHeading";
import "./instagramPublication.css";

type Preview = { url: string; blob?: Blob };
type Props = {
  entry: PlannedPublication; post?: StudioPost; postPages: PostPage[];  assets: GalleryAsset[];
  disabled: boolean; error: string;
  remove: () => void; close: () => void;
};
const errorMessage = (error: unknown) => error instanceof Error ? error.message : "L’envoi n’a pas pu être terminé. Réessaie.";

export function InstagramPublicationEditor({ entry, post, postPages, assets, disabled, error, remove, close }: Props) {
  const postPage = postPages.find((item) => item.id === post?.pageIds[0]);
  const message = postPage;
  const pages = (post?.pageIds ?? []).map((id) => postPages.find((item) => item.id === id));
  const valid = pages.length > 0 && pages.length <= 10 && pages.every(Boolean);
  const [resetTarget, setResetTarget] = useState<SocialPublication | null>(null);
  const [resetError, setResetError] = useState("");
  const [selected, setSelected] = useState<SocialTarget[]>(() => SOCIAL_ACCOUNTS.map(({id}) => id));
  const [platforms, setPlatforms] = useState<SocialPlatform[]>([...SOCIAL_PLATFORMS]);
  const visibleAccounts = SOCIAL_ACCOUNTS.filter(({platform}) => platforms.includes(platform));
  const [captions, setCaptions] = useState<Record<SocialTarget, string>>(() => Object.fromEntries(SOCIAL_ACCOUNTS.map(({id, language}) => [id, publicationTranslation(message, language).caption])) as Record<SocialTarget, string>);
  const [previews, setPreviews] = useState<Partial<Record<SocialTarget, Preview[]>>>({});
  const [sequence, setSequence] = useState({index: 0, total: 0});
  const [progress, setProgress] = useState<Partial<Record<SocialTarget, string>>>({});
  const [previewErrors, setPreviewErrors] = useState<Partial<Record<SocialTarget, string>>>({});
  const [jobs, setJobs] = useState<Partial<Record<SocialTarget, SocialPublication>>>({});
  const jobsRef = useRef(jobs);
  const [initial, setInitial] = useState<SocialPublication[] | null>(null);
  const initialized = useRef(false);
  const [historyError, setHistoryError] = useState(false);
  const [localErrors, setLocalErrors] = useState<Partial<Record<SocialTarget, string>>>({});
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const [running, setRunning] = useState<SocialTarget | null>(null);
  const [recap, setRecap] = useState(false);
  const [targets, setTargets] = useState<SocialTarget[]>([]);
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  useEffect(() => subscribeSocialPublications(entry.id, (items) => {
    const next = Object.fromEntries(items.map((item) => [item.account, item]));
    jobsRef.current = next; setJobs(next); setHistoryError(false);
    if (!initialized.current) { initialized.current = true; setInitial(items); }
  }, () => setHistoryError(true)), [entry.id]);

  // Only the cover is rendered on opening. Remaining pages are generated on publication.
  useEffect(() => {
    if (!initial || !valid) return;
    let active = true;
    const urls: string[] = [];
    const covers = new Map<string, Blob>();
    void (async () => {
      for (const {id, language} of SOCIAL_ACCOUNTS) {
        if (!active) break;
        try {
          const previous = initial.find((job) => job.account === id);
          const paths = previous ? previous.imagePaths ?? [previous.imagePath] : undefined;
          const total = 1;
          const prepared: Preview[] = [];
          for (let index = 0; index < total; index++) {
            if (!active) break;
            setProgress((old) => ({...old, [id]: `Préparation : ${index + 1} sur ${total}`}));
            const page = pages[index];
            const translation = publicationTranslation(page, language);
            const blob = paths ? undefined : covers.get(language) ?? await exportInstagramImage(page!, language, translation.title, translation.description, assets);
            if (blob) covers.set(language, blob);
            const url = paths ? await socialImageUrl(paths[index]) : URL.createObjectURL(blob!);
            if (blob) urls.push(url);
            if (!active) { if (blob) URL.revokeObjectURL(url); break; }
            prepared.push({url, blob});
          }
          if (!active) break;
          setPreviews((old) => ({...old, [id]: prepared}));
          setProgress((old) => ({...old, [id]: undefined}));
          if (previous) setCaptions((old) => ({...old, [id]: previous.caption}));
        } catch (failure) { if (active) setPreviewErrors((old) => ({...old, [id]: errorMessage(failure)})); }
      }
    })();
    return () => { active = false; urls.forEach((url) => URL.revokeObjectURL(url)); };
    // initial is set once after the first durable history snapshot.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initial]);

  async function sendAccount(account: SocialTarget) {
    const previous = jobsRef.current[account];
    if (previous?.status === "published") return;
    if (mounted.current) { setRunning(account); setLocalErrors((old) => ({...old, [account]: undefined})); }
    try {
      const imagePaths = previous ? previous.imagePaths ?? [previous.imagePath] : [];
      if (!previous) {
        if (mounted.current) setProgress((old) => ({...old, [account]: "Vérification de la connexion…"}));
        await verifySocialTarget(account);
        const language = SOCIAL_ACCOUNTS.find((item) => item.id === account)!.language;
        const images: Blob[] = [];
        for (let index = 0; index < pages.length; index++) {
          if (mounted.current) setProgress((old) => ({...old, [account]: `Étape 1 sur 4 · Génération des images : ${index + 1} sur ${pages.length}`}));
          const page = pages[index]!;
          const translation = publicationTranslation(page, language);
          images.push(index === 0 && previews[account]?.[0]?.blob ? previews[account]![0].blob! : await exportInstagramImage(page, language, translation.title, translation.description, assets));
        }
        for (let index = 0; index < images.length; index++) {
          if (mounted.current) setProgress((old) => ({...old, [account]: `Étape 2 sur 4 · Transfert des images : ${index + 1} sur ${images.length}`}));
          imagePaths.push(await uploadSocialImage(entry.id, account, images[index]));
        }
      }
      if (mounted.current) setProgress((old) => ({...old, [account]: undefined}));
      const result = await publishSocialPost({entryId: entry.id, postId: entry.postId, account, imagePath: imagePaths[0], imagePaths, caption: previous?.caption ?? captions[account]});
      jobsRef.current = {...jobsRef.current, [account]: result};
      if (mounted.current) setJobs((old) => ({...old, [account]: result}));
    } catch (failure) {
      if (mounted.current) setLocalErrors((old) => ({...old, [account]: errorMessage(failure)}));
    } finally { if (mounted.current) setRunning(null); }
  }
  async function send(accounts: SocialTarget[]) {
    if (busyRef.current || historyError || !initial) return;
    busyRef.current = true; setBusy(true); setRecap(true);
    const ordered = SOCIAL_ACCOUNTS.map(({id}) => id).filter((id) => accounts.includes(id));
    if (!recap) setTargets(visibleAccounts.map(({id}) => id).filter((id) => selected.includes(id)));
    try { for (let index = 0; index < ordered.length; index++) {setSequence({index: index + 1, total: ordered.length}); await sendAccount(ordered[index]);} }
    finally { busyRef.current = false; if (mounted.current) setBusy(false); }
  }
  function publishedStatus(job: SocialPublication) {
    return <div className="instagram-clear-status"><span>{publicationFlags[socialAccount(job.account).account]} {job.publishedAt ? `Publié le ${publicationDate(job.publishedAt)}` : "Publié"}</span><button type="button" disabled={busy} aria-label={`Effacer le suivi ${job.account.toUpperCase()}`} title="Effacer le suivi dans le Studio" onClick={() => { setResetError(""); setResetTarget(job); }}><Icon name="delete" /></button></div>;
  }
  if (resetTarget) return <div className="instagram-publication-editor" aria-busy={busy}><header><h3>Effacer le suivi {platformLabel(socialAccount(resetTarget.account).platform)} {publicationFlags[socialAccount(resetTarget.account).account]}</h3></header><div className="instagram-reset-confirm"><p>La date de publication de ce compte sera effacée dans le Studio.</p><p><strong>Le post restera sur {platformLabel(socialAccount(resetTarget.account).platform)}.</strong> Pour le retirer, supprime-le ou archive-le manuellement sur ce réseau.</p>{resetTarget.permalink && <a href={resetTarget.permalink} target="_blank" rel="noreferrer">Ouvrir le post</a>}<p>Tu pourras ensuite publier à nouveau depuis le Studio.</p>{resetError && <p role="alert" className="planner-error">{resetError}</p>}</div><footer><button disabled={busy} onClick={() => setResetTarget(null)}>Annuler</button><Button variant="primary" className="planner-primary" disabled={busy} onClick={async () => {setBusy(true); try {await resetSocialPublication(resetTarget); close();} catch (failure) {setResetError(errorMessage(failure));} finally {if (mounted.current) setBusy(false);}}}>{busy ? "Effacement…" : "Effacer le suivi"}</Button></footer></div>;
  const remaining = pendingSocialTargets(selected, platforms, jobs);
  const ready = valid && initial !== null && !historyError && remaining.length > 0 && remaining.every((id) => Boolean(previews[id]) && [...captions[id]].length <= 2200);
  const hasResults = Object.keys(jobs).length > 0;
  return <div className="instagram-publication-editor" aria-busy={busy}>
    <header><div><h3>{recap ? "Résultat de la publication" : "Préparer la publication"}</h3><p>{postPage?.name || "Publication"}</p></div><button type="button" disabled={busy} aria-label="Fermer la publication" onClick={close}><Icon name="close" /></button></header>
    {recap ? <>
      {busy && running && <p className="instagram-sequence" role="status">{postPage?.name || "Publication"} · Compte {sequence.index} sur {sequence.total} · {SOCIAL_ACCOUNTS.find(({id}) => id === running)?.label}</p>}
      <div className="instagram-results" role="status" aria-live="polite">{SOCIAL_ACCOUNTS.filter(({id}) => targets.includes(id)).map(({id, label, username}) => {
        const result = jobs[id];
        const success = result?.status === "published";
        const waiting = busy && !result && !localErrors[id];
        const uncertainFacebook = socialAccount(id).platform === "facebook" && result?.status === "uncertain";
        return <article className={`instagram-result ${success ? "success" : ""}`} key={id}>
          <div><strong>{label} · {username}</strong><p>{success ? (result.publishedAt ? `Publié le ${publicationDate(result.publishedAt)}` : "Publié") : running === id ? (progress[id] || (result?.phase === "publishing" ? "Étape 4 sur 4 · Publication…" : `Étape 3 sur 4 · Préparation des images : ${result?.processingIndex ?? 1} sur ${result?.imagePaths?.length ?? pages.length}`)) : waiting ? "En attente…" : (result?.status === "uncertain" || result?.status === "pending") ? "Résultat à vérifier" : "Non publié"}</p>
            {!success && !waiting && running !== id && <p className="planner-error">{localErrors[id] || result?.message || "Relance la vérification pour obtenir le résultat."}</p>}
            {uncertainFacebook && <a href={socialAccount(id).pageUrl} target="_blank" rel="noreferrer">Vérifier sur la page Facebook</a>}
            {success && result.permalink && <a href={result.permalink} target="_blank" rel="noreferrer">Voir la publication</a>}
          </div>
          {success && publishedStatus(result)}
          {!success && !uncertainFacebook && <button disabled={busy || historyError} onClick={() => void send([id])}>{result?.status === "uncertain" || result?.status === "pending" ? "Vérifier le résultat" : "Réessayer"}</button>}
        </article>;
      })}</div>
      <footer><button disabled={busy} onClick={() => setRecap(false)}>Retour</button><Button variant="primary" className="planner-primary" disabled={busy} onClick={close}>Fermer</Button></footer>
    </> : <>
      <section><SectionHeading><h2>Publier sur les réseaux</h2></SectionHeading>
        <div className="instagram-account-checks" role="group" aria-label="Réseaux de publication">{SOCIAL_PLATFORMS.map((platform) => <label key={platform}><input type="checkbox" checked={platforms.includes(platform)} disabled={busy} onChange={(event) => { const checked = event.target.checked; setPlatforms((old) => checked ? [...old, platform] : old.filter((item) => item !== platform)); if (checked) setSelected((old) => [...new Set([...old, ...SOCIAL_ACCOUNTS.filter((item) => item.platform === platform).map(({id}) => id)])]); }} />{platformLabel(platform)}</label>)}</div>
        {!valid && <p className="planner-help">Choisis un post contenant de 1 à 10 pages disponibles.</p>}
        {historyError && <p role="alert" className="planner-error">Impossible de lire l’historique des envois. Ferme et rouvre cette fenêtre avant de publier.</p>}
        {valid && <div className="instagram-language-previews">{visibleAccounts.map(({id, label, username}) => <article key={id} className={selected.includes(id) ? "" : "instagram-language-disabled"}>
          <h4>{label} · {username}</h4>
          {selected.includes(id) ? <>
          {previews[id]?.length ? <img src={previews[id]![0].url} alt={`Première page pour ${username}`} /> : <div className="instagram-preview-loading" role="status">{previewErrors[id] || "Préparation de l’aperçu…"}</div>}
          <label>Légende <span>(facultative)</span><textarea value={captions[id]} disabled={busy || Boolean(jobs[id])} onChange={(event) => setCaptions((old) => ({...old, [id]: event.target.value}))} rows={4} /></label>
          {[...captions[id]].length > 2200 && <p className="planner-error">La légende dépasse 2 200 caractères.</p>}
          {jobs[id]?.status === "published" && <>{publishedStatus(jobs[id]!)}</>}
          {jobs[id] && jobs[id]?.status !== "published" && <p className="planner-help">Une tentative existe : le visuel et la légende d’origine sont conservés pour la reprise.</p>}
          </> : <div className="instagram-language-empty" aria-label="Compte non sélectionné" /> }
        </article>)}</div>}
        {platforms.includes("facebook") && <p className="planner-help">Facebook publie les visuels en publication photo. Le calendrier programme les six destinations Instagram et Facebook.</p>}
        <p className="planner-help">{pages.length > 1 ? "Seule la première page est affichée ; les autres seront générées lors de la publication. La légende est commune au carrousel ; elle reprend par défaut celle de la première page. " : ""}Les aperçus utilisent les traductions disponibles. Les textes vides sont acceptés.</p>
        <div className="instagram-publish-actions"><Button variant="primary" className="planner-primary" disabled={!ready || busy || disabled} onClick={() => void send(remaining)}>{remaining.length ? `Publier sur ${remaining.length} compte${remaining.length > 1 ? "s" : ""}` : "Sélectionne un compte à publier"}</Button>
          <div className="instagram-account-checks">{visibleAccounts.map(({id, label}) => <label key={id}><input type="checkbox" checked={selected.includes(id)} disabled={busy} onChange={(event) => setSelected((old) => event.target.checked ? [...old, id] : old.filter((key) => key !== id))} />{label}</label>)}</div>
        </div>
        {hasResults && <button onClick={() => { setTargets(SOCIAL_ACCOUNTS.filter(({id}) => jobs[id]).map(({id}) => id)); setRecap(true); }}>Voir les résultats par compte</button>}
      </section>
      <footer className="instagram-entry-footer"><button disabled={disabled || busy} onClick={remove}>Retirer de la planification</button></footer>
    </>}
    {error && <p role="alert" className="planner-error">{error}</p>}
  </div>;
}
