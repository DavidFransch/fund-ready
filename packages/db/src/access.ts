import { and, eq, isNotNull, isNull } from "drizzle-orm";
import type { Db } from "./client";
import { memberships, programmeBusinesses, programmeMembers } from "./schema";

export type BusinessAccess = { kind: "member"; role: "owner" | "accountant" } | { kind: "funder"; programmeId: string };

/**
 * Who may see a business: its own members, or members of a programme the business
 * has consented to share with (and not revoked). Returns null when access is denied.
 */
export async function businessAccess(db: Db, userId: string, businessId: string): Promise<BusinessAccess | null> {
  const [member] = await db
    .select({ role: memberships.role })
    .from(memberships)
    .where(and(eq(memberships.userId, userId), eq(memberships.businessId, businessId)));
  if (member) return { kind: "member", role: member.role };

  const [shared] = await db
    .select({ programmeId: programmeBusinesses.programmeId })
    .from(programmeBusinesses)
    .innerJoin(programmeMembers, eq(programmeMembers.programmeId, programmeBusinesses.programmeId))
    .where(
      and(
        eq(programmeMembers.userId, userId),
        eq(programmeBusinesses.businessId, businessId),
        isNotNull(programmeBusinesses.consentedAt),
        isNull(programmeBusinesses.revokedAt),
      ),
    );
  return shared ? { kind: "funder", programmeId: shared.programmeId } : null;
}

/** Only members can record anything; funders are read-only. */
export function canWrite(access: BusinessAccess | null): boolean {
  return access?.kind === "member";
}
