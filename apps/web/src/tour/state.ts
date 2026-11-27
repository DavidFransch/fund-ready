"use client";

import { useSyncExternalStore } from "react";

/** Where the guided tour is, remembered in this browser so a reload carries on. */
export interface TourState {
  active: boolean;
  step: number;
  /** Ended or finished once: don't start again by itself. */
  seen: boolean;
}

const KEY = "fetola-tour";
const START: TourState = { active: false, step: 0, seen: false };

let state: TourState | null = null;
const listeners = new Set<() => void>();

function get(): TourState {
  if (!state) {
    try {
      const raw = window.localStorage.getItem(KEY);
      state = raw ? { ...START, ...(JSON.parse(raw) as Partial<TourState>) } : START;
    } catch {
      state = START;
    }
  }
  return state;
}

function set(next: TourState) {
  state = next;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // No storage: the tour only remembers its place until the page is closed.
  }
  listeners.forEach((l) => l());
}

export const tour = {
  get,
  start: () => set({ active: true, step: 0, seen: true }),
  goTo: (step: number) => set({ ...get(), step }),
  end: () => set({ ...get(), active: false, seen: true }),
  subscribe(listener: () => void) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
};

const serverState: TourState = { ...START, seen: true };

export function useTour(): TourState {
  return useSyncExternalStore(tour.subscribe, tour.get, () => serverState);
}
