import { assertIsoMonth, type IsoMonth } from "./dates";
import { LedgerError } from "./errors";
import { applyMovement, emptyLevel, type Item, type StockLevel, type StockMovement } from "./inventory";
import { reverseEntry, type JournalEntry } from "./journal";
import { post, type Command, type PostingResult } from "./posting";

/**
 * An in-memory set of books for one business. Used by tests, the demo seed and
 * as the reference behaviour the database layer must match.
 */
export class Book {
  readonly entries: JournalEntry[] = [];
  readonly movements: StockMovement[] = [];
  private readonly levelMap = new Map<string, StockLevel>();
  private readonly itemMap = new Map<string, Item>();
  private readonly done = new Map<string, PostingResult>();
  closedThrough: IsoMonth | undefined;

  constructor(items: readonly Item[] = []) {
    items.forEach((i) => this.addItem(i));
  }

  addItem(item: Item): void {
    if (this.itemMap.has(item.id)) throw new LedgerError(`Item ${item.id} already exists`);
    this.itemMap.set(item.id, item);
  }

  get items(): ReadonlyMap<string, Item> {
    return this.itemMap;
  }

  get levels(): ReadonlyMap<string, StockLevel> {
    return this.levelMap;
  }

  level(itemId: string): StockLevel {
    return this.levelMap.get(itemId) ?? emptyLevel(itemId);
  }

  /** Run a command. Re-running a command with the same id returns the first result and changes nothing. */
  execute(cmd: Command): PostingResult {
    const previous = this.done.get(cmd.id);
    if (previous) return previous;
    const result = post(cmd, { items: this.itemMap, levels: this.levelMap, closedThrough: this.closedThrough });
    this.commit(cmd.id, result);
    return result;
  }

  reverse(entryId: string, options: { id: string; date: string; memo?: string }): JournalEntry {
    if (this.done.has(options.id)) return this.done.get(options.id)!.entry!;
    const original = this.entries.find((e) => e.id === entryId);
    if (!original) throw new LedgerError(`No entry ${entryId}`);
    if (this.entries.some((e) => e.reverses === entryId)) throw new LedgerError(`Entry ${entryId} is already reversed`);
    const entry = reverseEntry(original, options);
    const movements = this.movements
      .filter((m) => m.entryId === entryId)
      .map((m, i) => ({ ...m, id: `${options.id}:${i}`, date: options.date, qty: -m.qty, cost: -m.cost, entryId: options.id }));
    this.commit(options.id, { entry, movements });
    return entry;
  }

  closeMonth(month: IsoMonth): void {
    assertIsoMonth(month);
    if (this.closedThrough && month < this.closedThrough) throw new LedgerError("That month is already closed");
    this.closedThrough = month;
  }

  /** All-or-nothing: work out every new stock level before changing anything. */
  private commit(id: string, result: PostingResult): void {
    const next = new Map<string, StockLevel>();
    for (const m of result.movements) {
      next.set(m.itemId, applyMovement(next.get(m.itemId) ?? this.level(m.itemId), m));
    }
    if (result.entry) this.entries.push(result.entry);
    this.movements.push(...result.movements);
    next.forEach((level, itemId) => this.levelMap.set(itemId, level));
    this.done.set(id, result);
  }
}
