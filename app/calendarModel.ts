import type { PlannedPublication } from "../firebase/publicationPlan";
export function localDateKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}
export function monthDays(month: Date): Date[] {
  const start = new Date(month.getFullYear(), month.getMonth(), 1);
  start.setDate(start.getDate() - (start.getDay() + 6) % 7);
  return Array.from({ length: 42 }, (_, index) => new Date(start.getFullYear(), start.getMonth(), start.getDate() + index));
}
export function movePublication(entries: PlannedPublication[], id: string, beforeId: string): PlannedPublication[] {
  const entry = entries.find((item) => item.id === id);
  if (!entry || id === beforeId || !entries.some((item) => item.id === beforeId)) return entries;
  const next = entries.filter((item) => item.id !== id);
  next.splice(next.findIndex((item) => item.id === beforeId), 0, entry);
  return next;
}

export function placeUnscheduled(entries: PlannedPublication[], id: string, beforeId?: string): PlannedPublication[] {
  const source = entries.find((entry) => entry.id === id);
  if (!source || id === beforeId) return entries;
  const next = entries.filter((entry) => entry.id !== id);
  const target = beforeId ? next.findIndex((entry) => entry.id === beforeId && !entry.date) : -1;
  next.splice(target < 0 ? next.length : target, 0, { ...source, date: "" });
  return next;
}
