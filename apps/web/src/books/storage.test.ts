import { afterEach, describe, expect, it, vi } from "vitest";
import { clearSaved, readSaved, writeSaved } from "./storage";

function fakeWindow(storage: Partial<Storage> | "blocked") {
  const win = {} as Window;
  Object.defineProperty(win, "localStorage", {
    get() {
      if (storage === "blocked") throw new DOMException("blocked", "SecurityError");
      return storage;
    },
  });
  vi.stubGlobal("window", win);
}

afterEach(() => vi.unstubAllGlobals());

describe("demo storage", () => {
  it("never throws when storage is blocked", () => {
    fakeWindow("blocked");
    expect(readSaved()).toBeNull();
    expect(writeSaved({ anchorDate: "2026-11-30", userCommands: [] })).toBe(false);
    expect(() => clearSaved()).not.toThrow();
  });

  it("reports a failed write (quota full) instead of throwing", () => {
    fakeWindow({ setItem: () => { throw new DOMException("full", "QuotaExceededError"); }, getItem: () => null });
    expect(writeSaved({ anchorDate: "2026-11-30", userCommands: [] })).toBe(false);
  });

  it("round-trips and ignores corrupt or old data", () => {
    const data = new Map<string, string>();
    fakeWindow({ getItem: (k) => data.get(k) ?? null, setItem: (k, v) => void data.set(k, v), removeItem: (k) => void data.delete(k) });
    expect(writeSaved({ anchorDate: "2026-11-30", userCommands: [] })).toBe(true);
    expect(readSaved()).toMatchObject({ anchorDate: "2026-11-30", userCommands: [] });
    data.set("fetola-demo", "{not json");
    expect(readSaved()).toBeNull();
    data.set("fetola-demo", JSON.stringify({ version: 0, anchorDate: "x", userCommands: [] }));
    expect(readSaved()).toBeNull();
  });
});
