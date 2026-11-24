import type { Command } from "@app/ledger";

/**
 * Persistence for the browser demo. Only the user's own commands are stored; the
 * sample business is rebuilt from `anchorDate`. Every access is guarded: private
 * windows, blocked storage or quota errors must never break the app.
 */

const KEY = "fetola-demo";
export const STORAGE_VERSION = 1;

export interface SavedDemo {
  version: number;
  anchorDate: string;
  userCommands: Command[];
}

export function readSaved(): SavedDemo | null {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as SavedDemo;
    if (parsed?.version !== STORAGE_VERSION || typeof parsed.anchorDate !== "string" || !Array.isArray(parsed.userCommands)) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

/** Returns false when the browser would not store it (the app carries on in memory). */
export function writeSaved(data: Omit<SavedDemo, "version">): boolean {
  try {
    window.localStorage.setItem(KEY, JSON.stringify({ version: STORAGE_VERSION, ...data }));
    return true;
  } catch {
    return false;
  }
}

export function clearSaved(): void {
  try {
    window.localStorage.removeItem(KEY);
  } catch {
    // Nothing to clear if storage is unavailable.
  }
}
