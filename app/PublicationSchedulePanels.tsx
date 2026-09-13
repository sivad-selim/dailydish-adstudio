import {Fragment, useEffect, useState, type ReactNode} from "react";
import {Dropdown} from "./Dropdown";
import {SectionHeading} from "./SectionHeading";
import {Button} from "./components/Button";
import {PublicationReportPreview} from "./PublicationReportPreview";
import type {PostPage} from "../firebase/postPages";
import type {GalleryAsset} from "../firebase/gallery";
import type {StudioPost} from "../firebase/posts";
import type {PlannedPublication} from "../firebase/publicationPlan";
import type {InstagramAccount} from "../firebase/instagram";
import type {ScheduleReport, ScheduleSettings} from "../firebase/scheduling";

export function PublicationScheduleSettings({settings, disabled, save, children}: {settings: ScheduleSettings; disabled: boolean; save: (settings: Pick<ScheduleSettings, "time" | "timeZone">) => Promise<void>; children?: ReactNode}) {
  const [time, setTime] = useState(settings.time);
  const [timeZone, setTimeZone] = useState(settings.timeZone);
  useEffect(() => {setTime(settings.time); setTimeZone(settings.timeZone);}, [settings]);
  return <section className="planner-settings-panel" aria-label="À programmer">
    <SectionHeading><h2>À programmer</h2></SectionHeading>
    <form onSubmit={(event) => {event.preventDefault(); void save({time, timeZone});}}>
      <div className="planner-setting-field">
      <label className="field-label" htmlFor="planner-timezone">Fuseau horaire</label>
      <Dropdown id="planner-timezone" value={timeZone} disabled={disabled} onChange={(event) => setTimeZone(event.target.value)}>
        <option value="America/Sao_Paulo">Rio de Janeiro</option><option value="Europe/Paris">Paris</option>
      </Dropdown>
      </div>
      <div className="planner-setting-field planner-setting-time">
      <label className="field-label" htmlFor="planner-time">Heure de publication</label>
      <input id="planner-time" type="time" required value={time} disabled={disabled} onChange={(event) => setTime(event.target.value)} />
      </div>
      <Button type="submit" variant="primary" disabled={disabled || (time === settings.time && timeZone === settings.timeZone)}>Enregistrer</Button>
      <p className="planner-settings-note">EN, FR et BR · Horaire commun aux posts à venir. Après l’heure, aucun rattrapage.</p>
    </form>
    {children}
  </section>;
}
export function reportPageNumbers(page: number, pages: number): (number | string)[] {
  const visible = [...new Set([1, pages, ...Array.from({length: 5}, (_, index) => page - 2 + index)])].filter((value) => value >= 1 && value <= pages).sort((a, b) => a - b);
  return visible.flatMap((value, index) => index && value - visible[index - 1] > 1 ? [`gap-${value}`, value] : [value]);
}
export function PublicationScheduleReport({items, timeZone, entries = [], posts = [], postPages = [], assets = [], page = 1, total = items.length, loading = false, error = "", hasNew = false, onPage, onRefresh}: {
  page?: number; total?: number; loading?: boolean; error?: string; hasNew?: boolean; onPage?: (page: number) => void; onRefresh?: () => void;
  items: ScheduleReport[]; timeZone: string; entries?: PlannedPublication[]; posts?: StudioPost[]; postPages?: PostPage[];  assets?: GalleryAsset[];
}) {
  const day = new Intl.DateTimeFormat("fr-FR", {timeZone, day: "numeric", month: "short", year: "numeric"});
  const time = new Intl.DateTimeFormat("fr-FR", {timeZone, hour: "2-digit", minute: "2-digit", second: "2-digit"});
  const pages = Math.max(1, Math.ceil(total / 50));
  return <section className="planner-report-panel" aria-label="Rapport des publications" aria-busy={loading}>
    <div className="planner-report-toolbar">
      <p>{timeZone === "Europe/Paris" ? "Heure de Paris" : "Heure de Rio de Janeiro"} · 50 événements par page</p>
      {onRefresh && <Button disabled={loading} onClick={onRefresh}>{hasNew ? "Nouveaux événements · Actualiser" : "Actualiser"}</Button>}
    </div>
    {error && <p role="alert">{error}</p>}
    {loading && <p role="status">Chargement du rapport…</p>}
    {!items.length ? (!loading && !error && <p>Aucun événement pour le moment.</p>) : <div className="planner-report-scroll"><table className="planner-report-table">
      <thead><tr><th scope="col">Date</th><th scope="col">Aperçu</th><th scope="col">Langue</th><th scope="col">Événement</th></tr></thead>
      <tbody>{items.map((item, index) => {
        const account: InstagramAccount = item.account === "fr" || item.account === "br" ? item.account : "en";
        const language = account === "br" ? "pt" : account;
        const postId = item.postId || entries.find((entry) => entry.id === item.entryId)?.postId;
        const post = posts.find((candidate) => candidate.id === postId);
        const postPage = postPages.find((candidate) => candidate.id === post?.pageIds[0]);
        const message = postPage;
        const title = item.titles?.[account] ?? message?.translations[language]?.title?.trim() ?? "";
        const hasPost = Boolean(item.entryId || postId);
        const startsDay = index === 0 || day.format(items[index - 1].at) !== day.format(item.at);
        return <Fragment key={item.id}>
        {startsDay && <tr className="planner-report-day"><th colSpan={4}><span>{day.format(item.at)}</span></th></tr>}
        <tr className={`planner-report-event ${item.kind}`}>
          <td><time dateTime={new Date(item.at).toISOString()}><span>{day.format(item.at)}</span><strong>{time.format(item.at)}</strong></time></td>
          <td>{hasPost ? <PublicationReportPreview imagePath={item.covers?.[account]} postPage={postPage} title={title} description={message?.translations[language]?.description ?? ""} language={language} assets={assets} /> : <span aria-label="Sans aperçu">—</span>}</td>
          <td className="planner-report-language">{item.account ? item.account.toUpperCase() : hasPost ? "EN · FR · BR" : "—"}</td>
          <td>{(hasPost ? title : item.name) && <strong>{hasPost ? title : item.name}</strong>}<p>{item.message}</p></td>
        </tr></Fragment>;
      })}</tbody>
    </table></div>}
    {total > 0 && <nav className="planner-report-pagination" aria-label="Pages du rapport">
      <span>{(page - 1) * 50 + 1}–{Math.min(page * 50, total)} sur {total} événements</span>
      <div>
        <Button disabled={loading || page === 1} onClick={() => onPage?.(page - 1)} aria-label="Page précédente">‹</Button>
        {reportPageNumbers(page, pages).map((value) => typeof value === "number"
          ? <Button key={value} disabled={loading} variant={page === value ? "primary" : "secondary"} aria-label={`Page ${value}`} aria-current={page === value ? "page" : undefined} onClick={() => onPage?.(value)}>{value}</Button>
          : <span key={value} aria-hidden="true">…</span>)}
        <Button disabled={loading || page === pages} onClick={() => onPage?.(page + 1)} aria-label="Page suivante">›</Button>
      </div>
    </nav>}
  </section>;
}
