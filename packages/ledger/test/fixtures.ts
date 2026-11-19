import { Book, rand, type Item } from "../src";

/** Nomsa's Kitchen, matching the canvas mockup. */
export const ITEMS: Item[] = [
  { id: "flour", name: "Cake flour 12.5kg", kind: "stock", unit: "bags", salePrice: 0, reorderLevel: 3 },
  { id: "oil", name: "Cooking oil 5L", kind: "stock", unit: "bottles", salePrice: 0, reorderLevel: 2 },
  { id: "pastry", name: "Samoosa pastry", kind: "stock", unit: "packs", salePrice: 0, reorderLevel: 10 },
  { id: "mince", name: "Beef mince 1kg", kind: "stock", unit: "packs", salePrice: 0, reorderLevel: 4 },
  { id: "boxes", name: "Takeaway boxes", kind: "stock", unit: "boxes", salePrice: 0, reorderLevel: 50 },
  { id: "tray", name: "Samoosa tray (50)", kind: "stock", unit: "trays", salePrice: rand(500) },
  { id: "staff", name: "Serving staff, per hour", kind: "non_stock", unit: "hours", salePrice: rand(150) },
];

export function nomsasBook(): Book {
  const book = new Book(ITEMS);
  book.execute({
    kind: "opening_balance",
    id: "open",
    date: "2026-09-01",
    cashBox: rand(1000),
    bank: rand(5000),
    stock: [
      { itemId: "flour", qty: 2, cost: rand(520) },
      { itemId: "oil", qty: 1, cost: rand(185) },
      { itemId: "pastry", qty: 18, cost: rand(810) },
      { itemId: "mince", qty: 6, cost: rand(660) },
      { itemId: "boxes", qty: 140, cost: rand(420) },
      { itemId: "tray", qty: 9, cost: rand(1800) },
    ],
  });
  return book;
}
