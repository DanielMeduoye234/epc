/** View-only flock matching. Does not write or rewrite stored records. */

export function normalizeBacentaName(name: string | null | undefined): string {
  return (name || '').trim().toLowerCase();
}

export function shepherdBacentaNames(profile: {
  bacentas?: Array<{ name: string }> | null;
  bacenta?: { name: string } | null;
}): string[] {
  const assigned = (profile.bacentas || []).map((b) => b.name).filter(Boolean);
  if (assigned.length > 0) return assigned;
  if (profile.bacenta?.name) return [profile.bacenta.name];
  return [];
}

export function isInShepherdFlock(
  person: { assigned_shepherd?: string | null; bacenta?: string | null },
  shepherdId: string,
  bacentaNames: string[]
): boolean {
  if (person.assigned_shepherd && person.assigned_shepherd === shepherdId) return true;
  const personBacenta = normalizeBacentaName(person.bacenta);
  if (!personBacenta) return false;
  return bacentaNames.some((name) => normalizeBacentaName(name) === personBacenta);
}

export function phoneDigitGroups(phone: string | null | undefined): string[] {
  return (phone || '')
    .split(/[/,;]+/)
    .map((part) => part.replace(/\D/g, ''))
    .filter((digits) => digits.length >= 7);
}

export function phonesOverlap(
  a: string | null | undefined,
  b: string | null | undefined
): boolean {
  const left = new Set(phoneDigitGroups(a));
  if (left.size === 0) return false;
  return phoneDigitGroups(b).some((digits) => left.has(digits));
}

export function isShepherdCareRecord(
  record: {
    shepherd_id?: string | null;
    member?: { assigned_shepherd?: string | null; bacenta?: string | null } | null;
  },
  shepherdId: string,
  bacentaNames: string[]
): boolean {
  if (record.shepherd_id === shepherdId) return true;
  if (record.member && isInShepherdFlock(record.member, shepherdId, bacentaNames)) return true;
  return false;
}

/** Same person across tables: matching name AND overlapping phone. Name-only is not enough. */
export function isLikelySamePerson(
  a: { full_name: string; phone_number?: string | null },
  b: { full_name: string; phone_number?: string | null }
): boolean {
  if (a.full_name.toLowerCase().trim() !== b.full_name.toLowerCase().trim()) return false;
  return phonesOverlap(a.phone_number, b.phone_number);
}

/**
 * Exclusive owner for admin rollups so branch totals do not double-count.
 * Direct assignment wins; otherwise the first shepherd covering that bacenta
 * (case-insensitive name match). View-only — does not rewrite stored rows.
 */
export function exclusiveShepherdOwner(
  person: { assigned_shepherd?: string | null; bacenta?: string | null },
  shepherdIds: Set<string>,
  bacentaToShepherds: Record<string, string[]>
): string | null {
  if (person.assigned_shepherd && shepherdIds.has(person.assigned_shepherd)) {
    return person.assigned_shepherd;
  }
  const key = normalizeBacentaName(person.bacenta);
  if (!key) return null;
  const owners = bacentaToShepherds[key];
  return owners?.[0] || null;
}

/** Build case-insensitive bacenta → shepherd ids map for exclusive ownership. */
export function buildBacentaShepherdIndex(
  rows: Array<{ shepherd_id: string; bacenta_name: string | null | undefined }>
): Record<string, string[]> {
  const index: Record<string, string[]> = {};
  for (const row of rows) {
    const key = normalizeBacentaName(row.bacenta_name);
    if (!key) continue;
    if (!index[key]) index[key] = [];
    if (!index[key].includes(row.shepherd_id)) index[key].push(row.shepherd_id);
  }
  return index;
}
