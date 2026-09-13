import {collection, doc, getFirestore, limit, onSnapshot, orderBy, query} from "firebase/firestore";
import {getFunctions, httpsCallable} from "firebase/functions";
import {firebaseApp} from "./firebaseAuth";
import type {InstagramAccount} from "./instagram";
export type ScheduleSettings = {time: string; timeZone: string; updatedAt: number};
export const DEFAULT_SCHEDULE: ScheduleSettings = {time: "20:00", timeZone: "America/Sao_Paulo", updatedAt: 0};
export type PreparedSchedule = {entryId: string; postId: string; revision: string; date: string; status: "preparing" | "ready" | "failed"; clientVersions: Record<string, number>; message?: string; name: string; startedAt: number; readyAt?: number};
export type ScheduleReport = {entryId?: string; postId?: string; titles?: Partial<Record<InstagramAccount, string>>; covers?: Partial<Record<InstagramAccount, string>>; id: string; at: number; name: string; account: string; kind: string; message: string};
export type ScheduledAttempt = {entryId: string; account: InstagramAccount; status: string; startedAt?: number};
const db = getFirestore(firebaseApp, "ad-studio");
const functions = getFunctions(firebaseApp, "us-central1");
export const subscribeScheduleSettings = (receive: (settings: ScheduleSettings) => void, error: () => void) => onSnapshot(doc(db, "publication-settings", "main"), (snapshot) => receive({...DEFAULT_SCHEDULE, ...snapshot.data()}), error);
export const subscribePreparedSchedules = (receive: (items: PreparedSchedule[]) => void, error: () => void) => onSnapshot(collection(db, "publication-schedules"), (snapshot) => receive(snapshot.docs.map((item) => item.data() as PreparedSchedule)), error);
export const REPORT_PAGE_SIZE = 50;
export type ReportCursor = {page: number; at: number; id: string};
export type ScheduleReportPage = {items: ScheduleReport[]; page: number; total: number; cutoff: number; cursor: ReportCursor | null};
export const loadScheduleReportPage = async (input: {page: number; cutoff?: number; cursor?: ReportCursor}) =>
  (await httpsCallable<typeof input, ScheduleReportPage>(functions, "getAdStudioScheduleReports")(input)).data;
export const subscribeLatestReport = (receive: (id: string) => void, error: () => void) => onSnapshot(query(collection(db, "publication-reports"), orderBy("at", "desc"), limit(1)), (snapshot) => receive(snapshot.docs[0]?.id ?? ""), error);
export const subscribeScheduledAttempts = (receive: (items: ScheduledAttempt[]) => void, error: () => void) => onSnapshot(collection(db, "publication-schedule-attempts"), (snapshot) => receive(snapshot.docs.map((item) => item.data() as ScheduledAttempt)), error);
export const saveScheduleSettings = (settings: Pick<ScheduleSettings, "time" | "timeZone">) => httpsCallable(functions, "setAdStudioScheduleSettings")(settings);
export const prepareSchedule = async (input: Record<string, unknown>) => (await httpsCallable<Record<string, unknown>, {preparationId?: string}>(functions, "prepareAdStudioSchedule", {timeout: 120000})(input)).data;
export function zonedMinute(now: Date, timeZone: string) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat("en-CA", {timeZone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23"}).formatToParts(now).map((part) => [part.type, part.value]));
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`;
}
export const isFutureSchedule = (date: string, settings: ScheduleSettings, now = new Date()) => `${date}T${settings.time}` > zonedMinute(now, settings.timeZone);
