// Study helpers. No scheduling or difficulty ratings: just decks you flip through,
// plus a per-day activity log that feeds the heatmap and streak.
import { isoDay } from "./vault";

export function shuffled<T>(items: T[]): T[] {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export interface HeatDay {
  date: string;
  count: number;
  level: 0 | 1 | 2 | 3 | 4;
  future: boolean;
}

/** `weeks` columns of 7 days (Mon→Sun), ending with the week containing `today`. */
export function heatmap(activity: Record<string, number>, today: Date, weeks = 16): HeatDay[][] {
  const dow = (today.getDay() + 6) % 7; // Monday = 0
  const start = new Date(today);
  start.setDate(today.getDate() - dow - (weeks - 1) * 7);
  const max = Math.max(1, ...Object.values(activity));
  const todayKey = isoDay(today);
  const cols: HeatDay[][] = [];
  for (let w = 0; w < weeks; w++) {
    const col: HeatDay[] = [];
    for (let d = 0; d < 7; d++) {
      const date = new Date(start);
      date.setDate(start.getDate() + w * 7 + d);
      const key = isoDay(date);
      const count = activity[key] ?? 0;
      const ratio = count / max;
      const level = (count === 0 ? 0 : ratio > 0.75 ? 4 : ratio > 0.5 ? 3 : ratio > 0.25 ? 2 : 1) as HeatDay["level"];
      col.push({ date: key, count, level, future: key > todayKey });
    }
    cols.push(col);
  }
  return cols;
}

/** Consecutive days with activity, counting back from today (or yesterday). */
export function streak(activity: Record<string, number>, today: Date) {
  const d = new Date(today);
  if (!activity[isoDay(d)]) d.setDate(d.getDate() - 1);
  let n = 0;
  while (activity[isoDay(d)]) {
    n++;
    d.setDate(d.getDate() - 1);
  }
  return n;
}

export function formatDuration(ms: number) {
  const s = Math.round(ms / 1000);
  const m = Math.floor(s / 60);
  return m ? `${m}m ${String(s % 60).padStart(2, "0")}s` : `${s}s`;
}
