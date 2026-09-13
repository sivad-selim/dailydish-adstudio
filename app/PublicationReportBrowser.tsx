import {useCallback, useEffect, useRef, useState, type ComponentProps} from "react";
import {loadScheduleReportPage, subscribeLatestReport, type ScheduleReportPage} from "../firebase/scheduling";
import {PublicationScheduleReport} from "./PublicationSchedulePanels";

export function PublicationReportBrowser(props: Omit<ComponentProps<typeof PublicationScheduleReport>, "items">) {
  const [data, setData] = useState<ScheduleReportPage | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [hasNew, setHasNew] = useState(false);
  const session = useRef<{cutoff?: number; pages: Map<number, ScheduleReportPage>}>({pages: new Map()});
  const request = useRef(0);
  const currentPage = useRef(1);
  const load = useCallback(async (page: number, refresh = false) => {
    const version = ++request.current;
    if (refresh) {session.current = {pages: new Map()}; setHasNew(false);}
    currentPage.current = page;
    setError("");
    const cached = session.current.pages.get(page);
    if (cached) {setData(cached); setLoading(false); return;}
    setLoading(true);
    const cursors = [...session.current.pages.values()].flatMap((item) => item.cursor && item.page < page ? [item.cursor] : []).sort((a, b) => b.page - a.page);
    try {
      const next = await loadScheduleReportPage({page, ...(session.current.cutoff !== undefined ? {cutoff: session.current.cutoff} : {}), ...(cursors[0] ? {cursor: cursors[0]} : {})});
      if (version !== request.current) return;
      session.current.cutoff = next.cutoff;
      // Bound the in-memory cache as well as network page size.
      if (session.current.pages.size >= 10) session.current.pages.delete(session.current.pages.keys().next().value!);
      session.current.pages.set(next.page, next);
      currentPage.current = next.page;
      setData(next);
    } catch {if (version === request.current) setError("Le rapport n’a pas pu être chargé. Réessaie avec Actualiser.");}
    finally {if (version === request.current) setLoading(false);}
  }, []);
  useEffect(() => {
    let latest: string | undefined;
    void load(1);
    const stop = subscribeLatestReport((id) => {
      if (latest !== undefined && latest !== id) {
        if (currentPage.current === 1) void load(1, true);
        else setHasNew(true);
      }
      latest = id;
    }, () => setError("La mise à jour en direct est indisponible. Tu peux actualiser le rapport."));
    return () => {stop(); ++request.current;};
  }, [load]);
  return <PublicationScheduleReport {...props} items={data?.items ?? []} page={data?.page ?? 1} total={data?.total ?? 0} loading={loading} error={error} hasNew={hasNew} onPage={(page) => void load(page)} onRefresh={() => void load(1, true)} />;
}
