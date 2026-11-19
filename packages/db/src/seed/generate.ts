import {
  ACC,
  addDays,
  addMonths,
  Book,
  monthOf,
  positions,
  rand,
  type AccountCode,
  type Command,
  type Item,
  type SaleLine,
} from "@app/ledger";
import { createHash } from "node:crypto";

/**
 * Deterministic demo data: four township businesses with a few months of believable
 * activity. Every command is validated against the in-memory reference books while
 * generating, so the seed can never contain something the ledger would reject.
 */

export interface SeedItem extends Omit<Item, "id"> {
  key: string;
  /** Typical purchase cost per unit, for restocking. */
  cost: number;
}

export interface SeedBusiness {
  key: string;
  name: string;
  area: string;
  sector: string;
  registrationNumber: string;
  items: SeedItem[];
  commands: Command[];
  closedThrough: string | null;
  budgets: { account: AccountCode; amount: number }[];
  compliance: {
    taxReturnsUpToDate: boolean;
    cipcAnnualReturnFiled: boolean;
    cipcNextDue: string | null;
    afsPrepared: boolean;
    extras: Record<string, "not_started" | "draft" | "done">;
  };
}

/** A command without its id (distributes over the union so each kind keeps its fields). */
type CommandInput = Command extends infer C ? (C extends Command ? Omit<C, "id"> : never) : never;

/** Small seeded random generator so the demo is identical every time. */
function rng(seed: string) {
  let a = createHash("sha256").update(seed).digest().readUInt32LE(0);
  const next = () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    next,
    int: (min: number, max: number) => min + Math.floor(next() * (max - min + 1)),
    pick: <T>(xs: readonly T[]): T => xs[Math.floor(next() * xs.length)]!,
    chance: (p: number) => next() < p,
  };
}

/** Deterministic UUID (v4 layout) from a string, so re-seeding produces the same ids. */
export function seedUuid(name: string): string {
  const h = createHash("sha256").update(name).digest("hex");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-a${h.slice(17, 20)}-${h.slice(20, 32)}`;
}

const dayOfWeek = (date: string) => new Date(`${date}T00:00:00Z`).getUTCDay(); // 0 = Sunday

class Generator {
  readonly book: Book;
  readonly commands: Command[] = [];
  readonly r: ReturnType<typeof rng>;
  private n = 0;

  constructor(
    readonly key: string,
    readonly items: SeedItem[],
  ) {
    this.r = rng(key);
    this.book = new Book(items.map((i) => ({ ...i, id: this.itemId(i.key) })));
  }

  itemId(key: string): string {
    return seedUuid(`${this.key}:item:${key}`);
  }

  item(key: string): SeedItem {
    const i = this.items.find((x) => x.key === key);
    if (!i) throw new Error(`No seed item ${key}`);
    return i;
  }

  /** Try a command; keep it only if the ledger accepts it. */
  add(cmd: CommandInput): boolean {
    const full = { ...cmd, id: seedUuid(`${this.key}:cmd:${this.n++}`) } as Command;
    try {
      this.book.execute(full);
      this.commands.push(full);
      return true;
    } catch {
      return false;
    }
  }

  cash(): number {
    return positions(this.book.entries).cashBox;
  }

  qty(key: string): number {
    return this.book.level(this.itemId(key)).qty;
  }

  saleLine(key: string, qty: number): SaleLine {
    const i = this.item(key);
    return { itemId: this.itemId(key), description: i.name, qty, unitPrice: i.salePrice };
  }

  /** Pay from the cash box if there is enough, otherwise from the bank. */
  pay(date: string, amount: number, category: "transport" | "rent" | "wages" | "electricity" | "data" | "bank_fees" | "other", supplier?: string) {
    const paidFrom = this.cash() >= amount + rand(200) ? "cash" : "bank";
    this.add({ kind: "expense", date, amount, category, paidFrom, ...(supplier ? { supplier } : {}) });
  }

  restock(date: string, keys: string[], supplier: string, paidFrom?: "cash" | "bank" | "own") {
    const lines = keys
      .map((k) => {
        const i = this.item(k);
        const target = (i.reorderLevel ?? 5) * 2;
        const qty = target - this.qty(k);
        return { itemId: this.itemId(k), qty, cost: i.cost * qty };
      })
      .filter((l) => l.qty > 0);
    if (!lines.length) return;
    const amount = lines.reduce((s, l) => s + l.cost, 0);
    const from = paidFrom ?? (this.cash() >= amount + rand(300) ? "cash" : "bank");
    this.add({ kind: "expense", date, amount, category: "stock", paidFrom: from, supplier, stockLines: lines });
  }

  /** Keep the cash box at a sensible level by banking the surplus. */
  bankSurplus(date: string, keep: number) {
    const surplus = this.cash() - keep;
    if (surplus > rand(500)) this.add({ kind: "transfer", date, amount: Math.floor(surplus / 10000) * 10000, from: "cash", to: "bank" });
  }
}

function eachDay(from: string, to: string, fn: (date: string) => void) {
  for (let d = from; d <= to; d = addDays(d, 1)) fn(d);
}

// ── The four businesses ─────────────────────────────────────────────────────

function nomsasKitchen(start: string, end: string): SeedBusiness {
  const items: SeedItem[] = [
    { key: "tray", name: "Samoosa tray (50)", kind: "non_stock", unit: "trays", salePrice: rand(500), cost: 0 },
    { key: "vetkoek", name: "Vetkoek (20)", kind: "non_stock", unit: "packs", salePrice: rand(200), cost: 0 },
    { key: "staff", name: "Serving staff, per hour", kind: "non_stock", unit: "hours", salePrice: rand(150), cost: 0 },
    { key: "delivery", name: "Delivery", kind: "non_stock", unit: "trips", salePrice: rand(100), cost: 0 },
    { key: "flour", name: "Cake flour 12.5kg", kind: "stock", unit: "bags", salePrice: 0, reorderLevel: 3, cost: rand(260) },
    { key: "oil", name: "Cooking oil 5L", kind: "stock", unit: "bottles", salePrice: 0, reorderLevel: 2, cost: rand(185) },
    { key: "pastry", name: "Samoosa pastry", kind: "stock", unit: "packs", salePrice: 0, reorderLevel: 10, cost: rand(45) },
    { key: "mince", name: "Beef mince 1kg", kind: "stock", unit: "packs", salePrice: 0, reorderLevel: 4, cost: rand(110) },
    { key: "boxes", name: "Takeaway boxes", kind: "stock", unit: "boxes", salePrice: 0, reorderLevel: 50, cost: rand(3) },
  ];
  const g = new Generator("nomsas-kitchen", items);
  const ingredients = ["flour", "oil", "pastry", "mince", "boxes"];
  g.add({
    kind: "opening_balance",
    date: start,
    cashBox: rand(800),
    bank: rand(4200),
    stock: ingredients.map((k) => ({ itemId: g.itemId(k), qty: (g.item(k).reorderLevel ?? 5) * 2, cost: g.item(k).cost * (g.item(k).reorderLevel ?? 5) * 2 })),
  });
  let invoiceNo = 30;
  eachDay(addDays(start, 1), end, (d) => {
    const dow = dayOfWeek(d);
    if (d.endsWith("-01")) {
      g.add({ kind: "expense", date: d, amount: rand(1500), category: "rent", paidFrom: "bank", supplier: "Landlord" });
      g.add({ kind: "expense", date: d, amount: rand(99), category: "data", paidFrom: "bank" });
      g.add({ kind: "expense", date: d, amount: rand(65), category: "bank_fees", paidFrom: "bank" });
    }
    if (dow === 0) return;
    // Daily walk-in sales.
    const lines: SaleLine[] = [g.saleLine("vetkoek", g.r.int(1, 2))];
    if (g.r.chance(0.3)) lines.push(g.saleLine("tray", 1));
    g.add({ kind: "sale", date: d, paidWith: g.r.chance(0.8) ? "cash" : "card", lines });
    // Weekly catering order for Sizwe Catering, paid by EFT a week later.
    if (dow === 3) {
      invoiceNo += 1;
      g.add({ kind: "sale", date: d, paidWith: "credit", customer: "Sizwe Catering", invoiceNumber: `INV-${String(invoiceNo).padStart(4, "0")}`, lines: [g.saleLine("tray", 3), g.saleLine("staff", 2)] });
      const payDay = addDays(d, 7);
      if (payDay < end) g.add({ kind: "payment_received", date: payDay, amount: rand(1800), into: "bank", customer: "Sizwe Catering", invoiceNumber: `INV-${String(invoiceNo).padStart(4, "0")}` });
    }
    if (dow === 2 || dow === 5) g.add({ kind: "expense", date: d, amount: rand(g.r.pick([60, 80, 120])), category: "transport", paidFrom: g.r.chance(0.2) ? "own" : "cash" });
    if (dow === 1) g.restock(d, ingredients, "Makro Wholesale", g.r.chance(0.1) ? "own" : undefined);
    if (d.endsWith("-25")) g.add({ kind: "owner_drawing", date: d, amount: rand(2000), from: "bank" });
    if (dow === 6) {
      g.pay(d, rand(750), "wages", "Thandi (helper)");
      // Weekly count: most of the drop is ingredients used in cooking, a little lost.
      g.add({
        kind: "stock_count",
        date: d,
        counts: ingredients.map((k) => ({
          itemId: g.itemId(k),
          counted: Math.max(0, Math.floor(g.qty(k) * (0.55 + g.r.next() * 0.2))),
          reason: "used" as const,
        })),
      });
      if (g.r.chance(0.5)) g.add({ kind: "stock_count", date: d, counts: [{ itemId: g.itemId("boxes"), counted: Math.max(0, g.qty("boxes") - g.r.int(2, 6)), reason: "lost" }] });
      g.bankSurplus(d, rand(1200));
    }
  });
  return {
    key: "nomsas-kitchen",
    name: "Nomsa's Kitchen",
    area: "Khayelitsha",
    sector: "Food",
    registrationNumber: "2021/482913/07",
    items,
    commands: g.commands,
    closedThrough: addMonths(monthOf(end), -1),
    budgets: [
      { account: ACC.sales, amount: rand(18000) },
      { account: ACC.costOfSales, amount: rand(6500) },
      { account: ACC.wages, amount: rand(3000) },
      { account: ACC.rent, amount: rand(1500) },
      { account: ACC.transport, amount: rand(1000) },
    ],
    compliance: { taxReturnsUpToDate: true, cipcAnnualReturnFiled: true, cipcNextDue: "2027-03-14", afsPrepared: false, extras: { forecast: "draft", business_plan: "not_started", quotes: "not_started" } },
  };
}

function mamaTeeSpaza(start: string, end: string): SeedBusiness {
  const items: SeedItem[] = [
    { key: "bread", name: "Brown bread", kind: "stock", unit: "loaves", salePrice: rand(18), reorderLevel: 20, cost: rand(14) },
    { key: "milk", name: "Milk 1L", kind: "stock", unit: "cartons", salePrice: rand(22), reorderLevel: 15, cost: rand(17) },
    { key: "cooldrink", name: "Cooldrink 2L", kind: "stock", unit: "bottles", salePrice: rand(30), reorderLevel: 12, cost: rand(22) },
    { key: "maize", name: "Maize meal 5kg", kind: "stock", unit: "bags", salePrice: rand(70), reorderLevel: 8, cost: rand(55) },
    { key: "sugar", name: "Sugar 2.5kg", kind: "stock", unit: "bags", salePrice: rand(58), reorderLevel: 8, cost: rand(45) },
  ];
  const keys = items.map((i) => i.key);
  const g = new Generator("mama-tee-spaza", items);
  g.add({ kind: "opening_balance", date: start, cashBox: rand(1500), bank: rand(9000), stock: keys.map((k) => ({ itemId: g.itemId(k), qty: (g.item(k).reorderLevel ?? 5) * 2, cost: g.item(k).cost * (g.item(k).reorderLevel ?? 5) * 2 })) });
  eachDay(addDays(start, 1), end, (d) => {
    const dow = dayOfWeek(d);
    if (d.endsWith("-01")) {
      g.add({ kind: "expense", date: d, amount: rand(1000), category: "rent", paidFrom: "bank", supplier: "Landlord" });
      g.add({ kind: "expense", date: d, amount: rand(65), category: "bank_fees", paidFrom: "bank" });
    }
    if (d.endsWith("-15")) g.pay(d, rand(400), "electricity", "Prepaid electricity");
    if (d.endsWith("-25")) g.add({ kind: "owner_drawing", date: d, amount: rand(3000), from: "bank" });
    const lines = keys
      .filter((k) => g.qty(k) > 0 && g.r.chance(0.8))
      .map((k) => g.saleLine(k, Math.min(g.qty(k), g.r.int(2, (g.item(k).reorderLevel ?? 5) / 2 + 2))));
    if (lines.length) g.add({ kind: "sale", date: d, paidWith: g.r.chance(0.85) ? "cash" : "card", lines });
    const low = keys.filter((k) => g.qty(k) <= (g.item(k).reorderLevel ?? 0));
    if (low.length && dow !== 0) g.restock(d, low, "Cash and carry");
    if (d.endsWith("-28")) g.add({ kind: "stock_count", date: d, counts: keys.slice(0, 2).map((k) => ({ itemId: g.itemId(k), counted: Math.max(0, g.qty(k) - g.r.int(0, 2)) })) });
    if (dow === 6) g.bankSurplus(d, rand(1500));
  });
  return {
    key: "mama-tee-spaza",
    name: "Mama Tee Spaza",
    area: "Gugulethu",
    sector: "Retail",
    registrationNumber: "2019/117350/07",
    items,
    commands: g.commands,
    closedThrough: addMonths(monthOf(end), -1),
    budgets: [
      { account: ACC.sales, amount: rand(25000) },
      { account: ACC.costOfSales, amount: rand(19000) },
      { account: ACC.rent, amount: rand(1000) },
      { account: ACC.utilities, amount: rand(400) },
    ],
    compliance: { taxReturnsUpToDate: true, cipcAnnualReturnFiled: false, cipcNextDue: null, afsPrepared: true, extras: { forecast: "done", business_plan: "draft", quotes: "not_started" } },
  };
}

function lwaziAuto(start: string, end: string): SeedBusiness {
  const items: SeedItem[] = [
    { key: "labour", name: "Labour, per hour", kind: "non_stock", unit: "hours", salePrice: rand(350), cost: 0 },
    { key: "diagnostic", name: "Diagnostic check", kind: "non_stock", unit: "checks", salePrice: rand(250), cost: 0 },
    { key: "pads", name: "Brake pads (set)", kind: "stock", unit: "sets", salePrice: rand(550), reorderLevel: 3, cost: rand(350) },
    { key: "filter", name: "Oil filter", kind: "stock", unit: "filters", salePrice: rand(120), reorderLevel: 5, cost: rand(60) },
    { key: "oil", name: "Engine oil 5L", kind: "stock", unit: "cans", salePrice: rand(480), reorderLevel: 4, cost: rand(320) },
    { key: "plugs", name: "Spark plugs (set)", kind: "stock", unit: "sets", salePrice: rand(300), reorderLevel: 3, cost: rand(180) },
  ];
  const parts = ["pads", "filter", "oil", "plugs"];
  const g = new Generator("lwazi-auto", items);
  g.add({ kind: "opening_balance", date: start, cashBox: rand(2000), bank: rand(18000), stock: parts.map((k) => ({ itemId: g.itemId(k), qty: (g.item(k).reorderLevel ?? 5) * 2, cost: g.item(k).cost * (g.item(k).reorderLevel ?? 5) * 2 })) });
  const customers = ["Mr Petersen", "Cape Taxi Assoc.", "Mrs Davids", "Sipho M.", "Fleet Couriers"];
  eachDay(addDays(start, 1), end, (d) => {
    const dow = dayOfWeek(d);
    if (d.endsWith("-01")) {
      g.add({ kind: "expense", date: d, amount: rand(3500), category: "rent", paidFrom: "bank", supplier: "Landlord" });
      g.add({ kind: "expense", date: d, amount: rand(180), category: "data", paidFrom: "bank" });
    }
    if (dow === 0) return;
    const jobs = g.r.int(1, 2);
    for (let j = 0; j < jobs; j++) {
      const lines: SaleLine[] = [g.saleLine("labour", g.r.int(1, 3))];
      const part = g.r.pick(parts);
      if (g.qty(part) > 0) lines.push(g.saleLine(part, 1));
      if (part === "oil" && g.qty("filter") > 0) lines.push(g.saleLine("filter", 1));
      if (g.r.chance(0.2)) lines.push(g.saleLine("diagnostic", 1));
      const method = g.r.pick(["cash", "eft", "eft", "card", "credit"] as const);
      const customer = g.r.pick(customers);
      if (g.add({ kind: "sale", date: d, paidWith: method, customer, lines }) && method === "credit") {
        const total = lines.reduce((s, l) => s + l.unitPrice * l.qty, 0);
        const payDay = addDays(d, g.r.int(5, 20));
        if (payDay < end) g.add({ kind: "payment_received", date: payDay, amount: total, into: "bank", customer });
      }
    }
    if (dow === 5) g.pay(d, rand(1500), "wages", "Assistant mechanic");
    if (d.endsWith("-25")) g.add({ kind: "owner_drawing", date: d, amount: rand(15000), from: "bank" });
    const low = parts.filter((k) => g.qty(k) <= (g.item(k).reorderLevel ?? 0));
    if (low.length) g.restock(d, low, "Auto Parts Supplier", "bank");
    if (g.r.chance(0.15)) g.pay(d, rand(g.r.pick([90, 150, 220])), "transport");
    if (d.endsWith("-28")) g.add({ kind: "stock_count", date: d, counts: parts.map((k) => ({ itemId: g.itemId(k), counted: g.qty(k) })) });
    if (dow === 6) g.bankSurplus(d, rand(2000));
  });
  return {
    key: "lwazi-auto",
    name: "Lwazi Auto Repairs",
    area: "Mitchells Plain",
    sector: "Vehicle repair",
    registrationNumber: "2018/090244/07",
    items,
    commands: g.commands,
    closedThrough: addMonths(monthOf(end), -1),
    budgets: [
      { account: ACC.sales, amount: rand(42000) },
      { account: ACC.costOfSales, amount: rand(9000) },
      { account: ACC.wages, amount: rand(6000) },
      { account: ACC.rent, amount: rand(3500) },
    ],
    compliance: { taxReturnsUpToDate: true, cipcAnnualReturnFiled: true, cipcNextDue: "2027-06-30", afsPrepared: true, extras: { forecast: "done", business_plan: "done", quotes: "done" } },
  };
}

function guguHair(start: string, end: string): SeedBusiness {
  const items: SeedItem[] = [
    { key: "braids", name: "Braids", kind: "non_stock", unit: "clients", salePrice: rand(450), cost: 0 },
    { key: "wash", name: "Wash and blow-dry", kind: "non_stock", unit: "clients", salePrice: rand(150), cost: 0 },
    { key: "relaxer", name: "Relaxer", kind: "non_stock", unit: "clients", salePrice: rand(300), cost: 0 },
    { key: "hairfood", name: "Hair food 100ml", kind: "stock", unit: "tubs", salePrice: rand(60), reorderLevel: 6, cost: rand(35) },
    { key: "braidhair", name: "Braiding hair (pack)", kind: "stock", unit: "packs", salePrice: rand(70), reorderLevel: 10, cost: rand(40) },
  ];
  const g = new Generator("gugu-hair", items);
  g.add({ kind: "opening_balance", date: start, cashBox: rand(600), bank: rand(2500), stock: ["hairfood", "braidhair"].map((k) => ({ itemId: g.itemId(k), qty: (g.item(k).reorderLevel ?? 5) * 2, cost: g.item(k).cost * (g.item(k).reorderLevel ?? 5) * 2 })) });
  eachDay(addDays(start, 1), end, (d) => {
    const dow = dayOfWeek(d);
    if (d.endsWith("-01")) g.add({ kind: "expense", date: d, amount: rand(1200), category: "rent", paidFrom: "bank", supplier: "Landlord" });
    if (dow === 6 && g.cash() > rand(1500)) g.add({ kind: "owner_drawing", date: d, amount: Math.floor((g.cash() - rand(800)) / 10000) * 10000, from: "cash" });
    // Gugu records on only some days: the funder view should flag her for a reminder.
    if (dow === 0 || !g.r.chance(0.45)) return;
    const lines: SaleLine[] = [g.saleLine(g.r.pick(["braids", "wash", "relaxer"]), 1)];
    if (g.qty("braidhair") > 2 && lines[0]!.description === "Braids") lines.push(g.saleLine("braidhair", 2));
    if (g.qty("hairfood") > 0 && g.r.chance(0.3)) lines.push(g.saleLine("hairfood", 1));
    g.add({ kind: "sale", date: d, paidWith: g.r.chance(0.7) ? "cash" : "eft", lines });
    if (g.qty("braidhair") <= 10 || g.qty("hairfood") <= 6) g.restock(d, ["braidhair", "hairfood"], "Beauty wholesaler");
  });
  return {
    key: "gugu-hair",
    name: "Gugu Hair Studio",
    area: "Langa",
    sector: "Services",
    registrationNumber: "2023/554120/07",
    items,
    commands: g.commands,
    closedThrough: addMonths(monthOf(end), -3),
    budgets: [
      { account: ACC.sales, amount: rand(9000) },
      { account: ACC.rent, amount: rand(1200) },
    ],
    compliance: { taxReturnsUpToDate: false, cipcAnnualReturnFiled: true, cipcNextDue: "2027-01-31", afsPrepared: false, extras: { forecast: "not_started", business_plan: "not_started", quotes: "not_started" } },
  };
}

/** Build the demo dataset ending on `end` (usually yesterday), starting `months` months earlier. */
export function generateDemo(end: string, months = 3): SeedBusiness[] {
  const start = `${addMonths(monthOf(end), -months)}-01`;
  return [nomsasKitchen(start, end), lwaziAuto(start, end), mamaTeeSpaza(start, end), guguHair(start, end)];
}
