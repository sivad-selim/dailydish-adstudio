import {useEffect, useRef, useState} from "react";
import type {PostPage} from "../firebase/postPages";
import type {StudioPost} from "../firebase/posts";
import type {GalleryAsset} from "../firebase/gallery";
import type {PlannedPublication} from "../firebase/publicationPlan";
import {DEFAULT_SCHEDULE, isFutureSchedule, saveScheduleSettings, subscribePreparedSchedules, subscribeScheduledAttempts, subscribeScheduleSettings, type PreparedSchedule, type ScheduleSettings, type ScheduledAttempt} from "../firebase/scheduling";
import {prepareScheduledPost, scheduleSourceVersions} from "./prepareScheduledPost";

export function usePublicationScheduling(posts: StudioPost[], postPages: PostPage[],  assets: GalleryAsset[]) {
  const [settings, setSettings] = useState(DEFAULT_SCHEDULE);
  const [loaded, setLoaded] = useState(false);
  const [prepared, setPrepared] = useState<PreparedSchedule[]>([]);
  const [attempts, setAttempts] = useState<ScheduledAttempt[]>([]);
  const [error, setError] = useState("");
  const [progress, setProgress] = useState({entryId: "", message: ""});
  const [saving, setSaving] = useState(false);
  const [now, setNow] = useState(() => new Date());
  const lock = useRef(false);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    const fail = () => setError("La programmation n’a pas pu être synchronisée. Recharge la page.");
    const unsubscribe = [
      subscribeScheduleSettings((next) => {setSettings(next); setLoaded(true);}, fail),
      subscribePreparedSchedules(setPrepared, fail), subscribeScheduledAttempts(setAttempts, fail),
    ];
    const timer = window.setInterval(() => setNow(new Date()), 15000);
    return () => {mounted.current = false; unsubscribe.forEach((stop) => stop()); window.clearInterval(timer);};
  }, []);
  useEffect(() => {
    if (!progress.entryId) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [progress.entryId]);
  async function prepare(entry: PlannedPublication) {
    if (lock.current || !loaded) return;
    const post = posts.find((item) => item.id === entry.postId);
    if (!post) {setError("Le post n’existe plus."); return;}
    if (!isFutureSchedule(entry.date, settings)) return;
    lock.current = true;
    setError("");
    setProgress({entryId: entry.id, message: "Préparation…"});
    try {
      await prepareScheduledPost(entry, post, postPages, assets, (message) => {if (mounted.current) setProgress({entryId: entry.id, message});});
    } catch (failure) {
      if (mounted.current) setError(failure instanceof Error ? failure.message : "La préparation a échoué.");
    } finally {
      lock.current = false;
      if (mounted.current) setProgress({entryId: "", message: ""});
    }
  }
  async function saveSettings(next: Pick<ScheduleSettings, "time" | "timeZone">) {
    if (lock.current) return;
    lock.current = true; setSaving(true); setError("");
    try {await saveScheduleSettings(next);} catch (failure) {setError(failure instanceof Error ? failure.message : "Enregistrement impossible.");}
    finally {lock.current = false; setSaving(false);}
  }
  function state(entry: PlannedPublication): {label: string; refresh: boolean; message?: string} {
    if (!entry.date) return {label: "", refresh: false};
    const jobs = attempts.filter((item) => item.entryId === entry.id);
    if (progress.entryId === entry.id) return {label: progress.message, refresh: false};
    if (jobs.some((item) => item.status === "running" || item.status === "queued")) {
      const interrupted = jobs.some((item) => item.status === "running" && now.getTime() - (item.startedAt ?? 0) > 10 * 60000);
      return {label: interrupted ? "Résultat à vérifier" : "Publication en cours…", refresh: false};
    }
    if (jobs.length) return {label: jobs.length === 6 && jobs.every((item) => item.status === "published") ? "6 envois terminés" : "Voir le rapport", refresh: false};
    if (!isFutureSchedule(entry.date, settings, now)) return {label: "", refresh: false};
    const data = prepared.find((item) => item.entryId === entry.id);
    const post = posts.find((item) => item.id === entry.postId);
    if (!data || data.revision !== entry.scheduleRevision || data.date !== entry.date) return {label: "À préparer", refresh: true};
    const versions = post ? scheduleSourceVersions(post, postPages) : {};
    if (JSON.stringify(Object.entries(versions).sort()) !== JSON.stringify(Object.entries(data.clientVersions).sort())) return {label: "À actualiser", refresh: true};
    if (data.status === "failed") return {label: "Préparation échouée", refresh: true, message: data.message};
    if (data.status === "preparing") return {label: "Préparation incomplète", refresh: true};
    return {label: "Programmé · Instagram + Facebook · EN FR BR", refresh: false};
  }
  return {settings, loaded, error, progress, saving, prepare, saveSettings, state, busy: Boolean(progress.entryId) || saving};
}
