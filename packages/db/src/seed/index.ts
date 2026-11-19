import { eq } from "drizzle-orm";
import type { Db } from "../client";
import { executeCommand } from "../books";
import { budgets, businesses, complianceRecords, items, programmeBusinesses, programmes } from "../schema";
import { generateDemo, seedUuid, type SeedBusiness } from "./generate";

export { generateDemo, seedUuid };

export const DEMO_PROGRAMME_ID = seedUuid("programme:demo");

/** Insert the demo businesses, their history and a demo funder programme. Returns business ids by key. */
export async function seedDemo(db: Db, end: string): Promise<Record<string, string>> {
  const demo = generateDemo(end);
  await db
    .insert(programmes)
    .values({ id: DEMO_PROGRAMME_ID, name: "Township Enterprise Programme (demo)", funderName: "Demo funder" })
    .onConflictDoNothing();
  const ids: Record<string, string> = {};
  for (const b of demo) {
    ids[b.key] = await seedBusiness(db, b);
  }
  return ids;
}

async function seedBusiness(db: Db, b: SeedBusiness): Promise<string> {
  const businessId = seedUuid(`business:${b.key}`);
  const [existing] = await db.select({ id: businesses.id }).from(businesses).where(eq(businesses.id, businessId));
  if (existing) return businessId;

  await db.insert(businesses).values({ id: businessId, name: b.name, area: b.area, sector: b.sector, registrationNumber: b.registrationNumber });
  await db.insert(items).values(
    b.items.map(({ key, cost: _cost, ...i }) => ({
      id: seedUuid(`${b.key}:item:${key}`),
      businessId,
      name: i.name,
      kind: i.kind,
      unit: i.unit,
      salePrice: i.salePrice,
      reorderLevel: i.reorderLevel ?? null,
    })),
  );
  for (const command of b.commands) {
    await executeCommand(db, { businessId, userId: null, command });
  }
  // Close months only after history is in: closed months reject new entries.
  if (b.closedThrough) await db.update(businesses).set({ closedThrough: b.closedThrough }).where(eq(businesses.id, businessId));
  if (b.budgets.length) await db.insert(budgets).values(b.budgets.map((x) => ({ businessId, accountCode: x.account, amount: x.amount })));
  await db.insert(complianceRecords).values({
    businessId,
    taxReturnsUpToDate: b.compliance.taxReturnsUpToDate,
    cipcAnnualReturnFiled: b.compliance.cipcAnnualReturnFiled,
    cipcNextDue: b.compliance.cipcNextDue,
    afsPrepared: b.compliance.afsPrepared,
    extras: b.compliance.extras,
  });
  await db.insert(programmeBusinesses).values({ programmeId: DEMO_PROGRAMME_ID, businessId, consentedAt: new Date() });
  return businessId;
}
