BEGIN;

-- Keep promotion and attendance-history migration in one transaction. Older
-- versions changed first_timers.status without moving attendance to the new
-- members.id, which made history disappear from member-facing reports.
CREATE OR REPLACE FUNCTION promote_first_timers_to_members()
RETURNS void AS $$
DECLARE
  ft RECORD;
  monthly_count INT;
  new_member_id UUID;
BEGIN
  FOR ft IN
    SELECT * FROM first_timers WHERE status = 'first_timer'
  LOOP
    SELECT MAX(cnt) INTO monthly_count
    FROM (
      SELECT COUNT(*) AS cnt
      FROM attendance
      WHERE person_id = ft.id
        AND person_type = 'first_timer'
        AND is_present = TRUE
      GROUP BY DATE_TRUNC('month', date::timestamp)
    ) monthly;

    IF monthly_count >= 2 THEN
      INSERT INTO members (
        first_timer_id, full_name, first_name, last_name, nickname,
        address, bacenta, phone_number, who_brought,
        date_joined, membership_date, assigned_shepherd, branch_id, status
      )
      VALUES (
        ft.id, ft.full_name, ft.first_name, ft.last_name, ft.nickname,
        ft.address, ft.bacenta, ft.phone_number, ft.who_brought,
        ft.date_joined, CURRENT_DATE, ft.assigned_shepherd, ft.branch_id, 'active'
      )
      RETURNING id INTO new_member_id;

      UPDATE attendance
      SET person_id = new_member_id, person_type = 'member'
      WHERE person_id = ft.id
        AND person_type = 'first_timer'
        AND branch_id = ft.branch_id;

      UPDATE first_timers
      SET status = 'member', promoted_at = NOW()
      WHERE id = ft.id;
    END IF;
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Repair attendance orphaned by promotions made before the function above.
-- Copy first, merge conflicts safely, and only then remove the old-ID rows.
INSERT INTO attendance (person_id, person_type, date, is_present, marked_by, branch_id, created_at)
SELECT m.id, 'member'::person_type, a.date, a.is_present, a.marked_by, a.branch_id, a.created_at
FROM attendance a
JOIN members m ON m.first_timer_id = a.person_id
WHERE a.person_type = 'first_timer'
ON CONFLICT (person_id, date, person_type) DO UPDATE
SET is_present = attendance.is_present OR EXCLUDED.is_present,
    marked_by = COALESCE(EXCLUDED.marked_by, attendance.marked_by);

DELETE FROM attendance a
USING members m
WHERE m.first_timer_id = a.person_id
  AND a.person_type = 'first_timer';

COMMIT;
