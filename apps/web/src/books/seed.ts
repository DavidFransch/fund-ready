import {
  addDays,
  addMonths,
  Book,
  monthOf,
  positions,
  rand,
  supplierBalances,
  type Command,
  type ExpenseCategoryId,
  type Item,
  type SaleLine,
} from "@app/ledger";

/**
 * Deterministic sample business for the demo, built through the ledger so it can
 * never contain anything the books would reject. Same pattern as the database seed
 * (packages/db/src/seed/generate.ts), but browser-safe: no node:crypto.
 */

export const BUSINESS = { name: "Mama Tee Spaza", owner: "Thandeka", area: "Gugulethu" } as const;

/** The item the demo script buys, sells and counts. It always ends the history at HERO_QTY. */
export const HERO_ITEM = "oil";
export const HERO_QTY = 4;

export const SUPPLIERS = {
  wholesaler: "Gugs Wholesalers",
  van: "Bread and milk van",
  plastics: "Plastics wholesaler",
} as const;

interface SampleItem extends Item {
  /** Purchase cost per unit. Constant, so average cost stays a round number for the demo. */
  cost: number;
  supplier: string;
}

export const SAMPLE_ITEMS: SampleItem[] = [
  { id: "bread", name: "Brown bread", kind: "stock", unit: "loaves", salePrice: rand(20), reorderLevel: 20, cost: rand(14), supplier: SUPPLIERS.van },
  { id: "milk", name: "Milk 1L", kind: "stock", unit: "cartons", salePrice: rand(24), reorderLevel: 15, cost: rand(17), supplier: SUPPLIERS.van },
  { id: "cooldrink", name: "Cooldrink 2L", kind: "stock", unit: "bottles", salePrice: rand(32), reorderLevel: 12, cost: rand(22), supplier: SUPPLIERS.wholesaler },
  { id: "maize", name: "Maize meal 5kg", kind: "stock", unit: "bags", salePrice: rand(75), reorderLevel: 8, cost: rand(55), supplier: SUPPLIERS.wholesaler },
  { id: "sugar", name: "Sugar 2.5kg", kind: "stock", unit: "bags", salePrice: rand(62), reorderLevel: 8, cost: rand(45), supplier: SUPPLIERS.wholesaler },
  { id: "oil", name: "Sunflower oil 2L", kind: "stock", unit: "bottles", salePrice: rand(65), reorderLevel: 6, cost: rand(48), supplier: SUPPLIERS.wholesaler },
  { id: "soap", name: "Washing powder 1kg", kind: "stock", unit: "boxes", salePrice: rand(48), reorderLevel: 6, cost: rand(32), supplier: SUPPLIERS.wholesaler },
];

export const ITEMS: Item[] = SAMPLE_ITEMS.map((i) => ({
  id: i.id,
  name: i.name,
  kind: i.kind,
  unit: i.unit,
  salePrice: i.salePrice,
  ...(i.reorderLevel != null ? { reorderLevel: i.reorderLevel } : {}),
}));

/** cyrb53 string hash: small, fast and good enough to seed a demo. */
function hash(str: string, seed = 0): number {
  let h1 = 0xdeadbeef ^ seed;
  let h2 = 0x41c6ce57 ^ seed;
  for (let i = 0; i < str.length; i++) {
    const ch = str.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return 4294967296 * (2097151 & h2) + (h1 >>> 0);
}

/** Small seeded random generator so the demo is identical every time. */
function rng(seed: string) {
  let a = hash(seed) >>> 0;
  const next = () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    next,
    int: (min: number, max: number) => min + Math.floor(next() * (max - min + 1)),
    chance: (p: number) => next() < p,
  };
}

/** Deterministic UUID (v4 layout) from a string. */
export function seedUuid(name: string): string {
  const h = [0, 1, 2, 3].map((i) => hash(name, i).toString(16).padStart(14, "0").slice(-8)).join("");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-a${h.slice(17, 20)}-${h.slice(20, 32)}`;
}

/** A command without its id (distributes over the union so each kind keeps its fields). */
type CommandInput = Command extends infer C ? (C extends Command ? Omit<C, "id"> : never) : never;

const dayOfWeek = (date: string) => new Date(`${date}T00:00:00Z`).getUTCDay(); // 0 = Sunday

export interface SampleBusiness {
  book: Book;
  commands: Command[];
  start: string;
  end: string;
  /** Commands the ledger refused while generating; should always be zero. */
  rejected: number;
}

/**
 * History from the first day of last month up to the day before `today`,
 * so "today" is empty for the demo and this week / this month have data.
 */
export function generateSampleBusiness(today: string): SampleBusiness {
  const end = addDays(today, -1);
  const start = `${addMonths(monthOf(end), -1)}-01`;
  const book = new Book(ITEMS);
  const commands: Command[] = [];
  const r = rng(`mama-tee:${today}`);
  let n = 0;
  let rejected = 0;

  const add = (cmd: CommandInput): boolean => {
    const full = { ...cmd, id: seedUuid(`mama-tee:${today}:${n++}`) } as Command;
    try {
      book.execute(full);
      commands.push(full);
      return true;
    } catch {
      rejected++;
      return false;
    }
  };
  const item = (id: string) => SAMPLE_ITEMS.find((i) => i.id === id)!;
  const qty = (id: string) => book.level(id).qty;
  const cash = () => positions(book.entries).cashBox;
  const saleLine = (id: string, q: number): SaleLine => ({ itemId: id, description: item(id).name, qty: q, unitPrice: item(id).salePrice });
  const restock = (date: string, ids: string[], supplier: string, paidFrom: "cash" | "bank" | "credit") => {
    const lines = ids
      .map((id) => ({ itemId: id, qty: (item(id).reorderLevel ?? 5) * 2 - qty(id), cost: 0 }))
      .filter((l) => l.qty > 0)
      .map((l) => ({ ...l, cost: item(l.itemId).cost * l.qty }));
    if (!lines.length) return;
    const amount = lines.reduce((s, l) => s + l.cost, 0);
    add({ kind: "expense", date, amount, category: "stock", paidFrom, supplier, stockLines: lines });
  };
  const pay = (date: string, amount: number, category: ExpenseCategoryId, supplier?: string) => {
    const paidFrom = cash() >= amount + rand(300) ? "cash" : "bank";
    add({ kind: "expense", date, amount, category, paidFrom, ...(supplier ? { supplier } : {}) });
  };

  add({
    kind: "opening_balance",
    date: start,
    cashBox: rand(1500),
    bank: rand(12000),
    stock: SAMPLE_ITEMS.map((i) => ({ itemId: i.id, qty: (i.reorderLevel ?? 5) * 2, cost: i.cost * (i.reorderLevel ?? 5) * 2 })),
  });

  for (let d = start; d <= end; d = addDays(d, 1)) {
    const dow = dayOfWeek(d);
    if (d.endsWith("-01")) {
      add({ kind: "expense", date: d, amount: rand(1200), category: "rent", paidFrom: "bank", supplier: "Landlord" });
      add({ kind: "expense", date: d, amount: rand(69), category: "bank_fees", paidFrom: "bank" });
    }
    if (d.endsWith("-15")) pay(d, rand(450), "electricity", "Prepaid electricity");
    if (d.endsWith("-05") || d.endsWith("-20")) pay(d, rand(99), "data", "Airtime");

    // Morning and afternoon trade; quieter on Sundays.
    for (const share of dow === 0 ? [0.6, 0.5] : [0.7, 0.6, 0.7]) {
      const lines = SAMPLE_ITEMS.filter((i) => qty(i.id) > 0 && r.chance(share) && !(d === end && i.id === HERO_ITEM)).map((i) =>
        saleLine(i.id, Math.min(qty(i.id), r.int(1, Math.max(1, Math.round((i.reorderLevel ?? 5) / 4))))),
      );
      // On the last day, sell the demo item down towards its known quantity, a couple at a time.
      if (d === end && qty(HERO_ITEM) > HERO_QTY) lines.push(saleLine(HERO_ITEM, Math.min(2, qty(HERO_ITEM) - HERO_QTY)));
      if (lines.length) add({ kind: "sale", date: d, paidWith: r.chance(0.85) ? "cash" : "card", lines });
    }

    // Bread and milk come off the van every second day, paid from the cash box.
    if (dow % 2 === 1) restock(d, ["bread", "milk"], SUPPLIERS.van, cash() > rand(900) ? "cash" : "bank");
    // Dry goods on account from the wholesaler every Monday, settled by EFT on Fridays.
    // (The demo item is left out on the last day so it can land on its known quantity.)
    if (dow === 1) restock(d, ["cooldrink", "maize", "sugar", "oil", "soap"].filter((id) => d !== end || id !== HERO_ITEM), SUPPLIERS.wholesaler, "credit");
    if (dow === 5) {
      const owed = supplierBalances(commands).find((b) => b.supplier === SUPPLIERS.wholesaler)?.amount ?? 0;
      if (owed > 0) add({ kind: "payment_made", date: d, amount: owed, from: "bank", supplier: SUPPLIERS.wholesaler });
    }
    if (dow === 6) pay(d, rand(400), "wages", "Sipho (Saturday helper)");
    // Thandeka pays herself from the till every Saturday.
    if (dow === 6 && cash() > rand(800)) add({ kind: "owner_drawing", date: d, amount: rand(500), from: "cash" });
    if (dow === 3 && r.chance(0.7)) pay(d, rand(85), "packaging", SUPPLIERS.plastics);
    if (dow === 4 && r.chance(0.5)) pay(d, rand(r.chance(0.5) ? 60 : 120), "transport", "Taxi");
    if (d.endsWith("-28")) {
      add({
        kind: "stock_count",
        date: d,
        counts: ["bread", "milk"].map((id) => ({ itemId: id, counted: Math.max(0, qty(id) - r.int(0, 2)), reason: "lost" as const })),
      });
    }
    // Keep the cash box sensible: bank the surplus on Saturdays, top up when it runs low.
    if (dow === 6 && cash() > rand(2000)) {
      add({ kind: "transfer", date: d, amount: Math.floor((cash() - rand(1200)) / 10000) * 10000, from: "cash", to: "bank" });
    }
    if (cash() < rand(500)) add({ kind: "transfer", date: d, amount: rand(1000), from: "bank", to: "cash" });
  }

  // Whatever is still off after the last day's trade: sell the extra, or buy the shortfall.
  const hero = qty(HERO_ITEM);
  if (hero > HERO_QTY) {
    add({ kind: "sale", date: end, paidWith: "cash", lines: [saleLine(HERO_ITEM, hero - HERO_QTY)] });
  } else if (hero < HERO_QTY) {
    const q = HERO_QTY - hero;
    const cost = item(HERO_ITEM).cost * q;
    add({ kind: "expense", date: end, amount: cost, category: "stock", paidFrom: "cash", supplier: SUPPLIERS.wholesaler, stockLines: [{ itemId: HERO_ITEM, qty: q, cost }] });
  }

  return { book, commands, start, end, rejected };
}
