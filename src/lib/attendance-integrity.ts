import type { SupabaseClient } from '@supabase/supabase-js';

type AttendancePersonType = 'first_timer' | 'new_believer';

interface AttendanceHistoryRow {
  id: string;
  date: string;
  is_present: boolean;
  marked_by: string | null;
}

/**
 * Copy-first migration for a person whose ID changes during promotion.
 * Existing target dates are merged with "present wins", and source rows are
 * deleted only after the complete target upsert succeeds.
 */
export async function migrateAttendanceHistory(
  supabase: SupabaseClient,
  sourceId: string,
  sourceType: AttendancePersonType,
  targetMemberId: string,
  branchId: string
): Promise<number> {
  const { data: sourceRows, error: sourceError } = await supabase
    .from('attendance')
    .select('id, date, is_present, marked_by')
    .eq('person_id', sourceId)
    .eq('person_type', sourceType)
    .eq('branch_id', branchId);

  if (sourceError) throw new Error(`Could not read attendance before promotion: ${sourceError.message}`);
  const rows = (sourceRows || []) as AttendanceHistoryRow[];
  if (rows.length === 0) return 0;

  const dates = rows.map((row) => row.date);
  const { data: existingRows, error: existingError } = await supabase
    .from('attendance')
    .select('date, is_present, marked_by')
    .eq('person_id', targetMemberId)
    .eq('person_type', 'member')
    .eq('branch_id', branchId)
    .in('date', dates);

  if (existingError) throw new Error(`Could not check promoted attendance: ${existingError.message}`);
  const existingByDate = new Map(
    (existingRows || []).map((row: { date: string; is_present: boolean; marked_by: string | null }) => [row.date, row])
  );

  const { error: copyError } = await supabase.from('attendance').upsert(
    rows.map((row) => {
      const existing = existingByDate.get(row.date);
      return {
        person_id: targetMemberId,
        person_type: 'member',
        date: row.date,
        is_present: Boolean(row.is_present || existing?.is_present),
        marked_by: existing?.marked_by || row.marked_by,
        branch_id: branchId,
      };
    }),
    { onConflict: 'person_id,date,person_type' }
  );

  if (copyError) throw new Error(`Could not preserve attendance during promotion: ${copyError.message}`);

  const { error: deleteError } = await supabase
    .from('attendance')
    .delete()
    .in('id', rows.map((row) => row.id))
    .eq('person_id', sourceId)
    .eq('person_type', sourceType)
    .eq('branch_id', branchId);

  if (deleteError) {
    // Both copies remain valid and visible; duplication is safer than loss.
    throw new Error(`Attendance was copied but the old reference remains: ${deleteError.message}`);
  }

  return rows.length;
}
