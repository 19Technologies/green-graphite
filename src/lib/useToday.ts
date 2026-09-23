"use client";
import { useSyncExternalStore } from "react";
import { isoDay } from "./vault";

function subscribe(onChange: () => void) {
  const id = setInterval(onChange, 60_000);
  return () => clearInterval(id);
}

/** Today's date as YYYY-MM-DD, or null while rendering on the server. */
export function useToday() {
  return useSyncExternalStore(subscribe, () => isoDay(new Date()), () => null);
}

export const parseDay = (day: string) => {
  const [y, m, d] = day.split("-").map(Number);
  return new Date(y, m - 1, d);
};
