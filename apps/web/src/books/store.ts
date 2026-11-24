import { LedgerError, post, type Book, type Command, type PostingResult } from "@app/ledger";
import { useSyncExternalStore } from "react";
import { localToday } from "./dates";
import { generateSampleBusiness } from "./seed";
import { clearSaved, readSaved, writeSaved } from "./storage";

/**
 * The demo's books, held in the browser. Screens only talk to `useBooks()`, so this
 * can later be swapped for server actions backed by packages/db.
 */

export interface BooksSnapshot {
  /** Changes on every update; use it as a memo key for derived data. */
  version: number;
  today: string;
  anchorDate: string;
  book: Book;
  /** Every accepted command in order: sample history first, then the user's. */
  commands: readonly Command[];
  userCommandIds: ReadonlySet<string>;
  /** False when the browser refuses storage: changes last until the page is closed. */
  saved: boolean;
}

export type ExecuteOutcome = { ok: true; result: PostingResult } | { ok: false; message: string };
export type PreviewOutcome = ExecuteOutcome;

export interface BooksBackend {
  subscribe(listener: () => void): () => void;
  getSnapshot(): BooksSnapshot | null;
  preview(cmd: Command): PreviewOutcome;
  execute(cmd: Command): ExecuteOutcome;
  reset(): void;
}

const message = (e: unknown) => (e instanceof LedgerError ? e.message : "Something went wrong. Please try again.");

function build(anchorDate: string, userCommands: readonly Command[], version: number, saved: boolean): BooksSnapshot {
  const { book, commands } = generateSampleBusiness(anchorDate);
  const all = [...commands];
  const userIds = new Set<string>();
  for (const cmd of userCommands) {
    try {
      book.execute(cmd);
      all.push(cmd);
      userIds.add(cmd.id);
    } catch {
      // A stored command the books no longer accept is dropped rather than breaking the demo.
    }
  }
  return { version, today: localToday(), anchorDate, book, commands: all, userCommandIds: userIds, saved };
}

function userCommandsOf(s: BooksSnapshot): Command[] {
  return s.commands.filter((c) => s.userCommandIds.has(c.id));
}

function createLocalBackend(): BooksBackend {
  let snapshot: BooksSnapshot | null = null;
  const listeners = new Set<() => void>();
  const emit = () => listeners.forEach((l) => l());

  const load = (): BooksSnapshot => {
    const today = localToday();
    const saved = readSaved();
    // With nothing recorded yet, keep the history ending yesterday so "today" starts empty.
    const anchor = saved && saved.userCommands.length > 0 ? saved.anchorDate : today;
    const s = build(anchor, saved?.userCommands ?? [], 1, true);
    return { ...s, saved: writeSaved({ anchorDate: anchor, userCommands: userCommandsOf(s) }) };
  };

  return {
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    getSnapshot() {
      if (typeof window === "undefined") return null;
      snapshot ??= load();
      return snapshot;
    },
    preview(cmd) {
      const s = this.getSnapshot();
      if (!s) return { ok: false, message: "Still loading" };
      try {
        return { ok: true, result: post(cmd, { items: s.book.items, levels: s.book.levels, closedThrough: s.book.closedThrough }) };
      } catch (e) {
        return { ok: false, message: message(e) };
      }
    },
    execute(cmd) {
      const s = this.getSnapshot();
      if (!s) return { ok: false, message: "Still loading" };
      try {
        const result = s.book.execute(cmd);
        const commands = [...s.commands, cmd];
        const userCommandIds = new Set(s.userCommandIds).add(cmd.id);
        const next = { ...s, version: s.version + 1, commands, userCommandIds, today: localToday() };
        snapshot = { ...next, saved: writeSaved({ anchorDate: s.anchorDate, userCommands: userCommandsOf(next) }) };
        emit();
        return { ok: true, result };
      } catch (e) {
        return { ok: false, message: message(e) };
      }
    },
    reset() {
      clearSaved();
      const today = localToday();
      const s = build(today, [], (snapshot?.version ?? 0) + 1, true);
      snapshot = { ...s, saved: writeSaved({ anchorDate: today, userCommands: [] }) };
      emit();
    },
  };
}

export const books: BooksBackend = createLocalBackend();

const serverSnapshot = () => null;

/** The books, or null while loading (on the server and during hydration). */
export function useBooks() {
  const snapshot = useSyncExternalStore(books.subscribe, () => books.getSnapshot(), serverSnapshot);
  return { snapshot, preview: books.preview.bind(books), execute: books.execute.bind(books), reset: books.reset.bind(books) };
}
