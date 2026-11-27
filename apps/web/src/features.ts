"use client";

import { useSyncExternalStore } from "react";

/**
 * Demo feature switches. Order: URL param (?tour=on|off, ?bank=on|off, remembered once
 * used) → this browser's saved choice → default. Works without storage. Reset demo
 * leaves these alone.
 */

export type Feature = "tour" | "bankImport";
type Flags = Record<Feature, boolean>;

const DEFAULTS: Flags = { tour: true, bankImport: false };
const PARAMS: Record<string, Feature> = { tour: "tour", bank: "bankImport" };
const KEY = "fetola-flags";

let flags: Flags | null = null;
const listeners = new Set<() => void>();

function readSaved(): Partial<Flags> {
  try {
    const raw = window.localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Partial<Flags>) : {};
  } catch {
    return {};
  }
}

function save(next: Flags) {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // No storage: the choice lasts until the page is closed.
  }
}

function load(): Flags {
  const next = { ...DEFAULTS, ...readSaved() };
  const params = new URLSearchParams(window.location.search);
  let fromUrl = false;
  for (const [param, feature] of Object.entries(PARAMS)) {
    const v = params.get(param);
    if (v === "on" || v === "off") {
      next[feature] = v === "on";
      fromUrl = true;
    }
  }
  if (fromUrl) save(next);
  return next;
}

function get(): Flags {
  flags ??= load();
  return flags;
}

export function setFlag(feature: Feature, on: boolean) {
  flags = { ...get(), [feature]: on };
  save(flags);
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** False on the server and during hydration, then the resolved value. */
export function useFeature(feature: Feature): boolean {
  return useSyncExternalStore(subscribe, () => get()[feature], () => false);
}
