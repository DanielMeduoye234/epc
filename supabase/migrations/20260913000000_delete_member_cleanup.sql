-- Migration: 20260913000000_delete_member_cleanup.sql
-- Description: Clean up polymorphic records (attendance, chat_messages) when a member is deleted,
-- ensuring no orphaned database records remain.

CREATE OR REPLACE FUNCTION delete_member_cleanup()
RETURNS TRIGGER AS $$
BEGIN
  -- 1. Clean up polymorphic attendance records for this member
  DELETE FROM attendance
  WHERE person_id = OLD.id
    AND person_type = 'member';

  -- 2. Clean up polymorphic chat messages for this member
  DELETE FROM chat_messages
  WHERE person_id = OLD.id
    AND person_type = 'member';

  -- Note: follow_ups, visitations, alerts, and birthday_messages
  -- are automatically cleaned up by their ON DELETE CASCADE foreign key constraints.

  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_delete_member_cleanup ON members;
CREATE TRIGGER trigger_delete_member_cleanup
BEFORE DELETE ON members
FOR EACH ROW
EXECUTE FUNCTION delete_member_cleanup();

-- Update delete policy on members to allow super_admin, bishop, and assigned shepherds
DROP POLICY IF EXISTS "Super admins can delete members" ON members;
DROP POLICY IF EXISTS "Authorized users can delete members" ON members;

CREATE POLICY "Authorized users can delete members"
  ON members FOR DELETE
  USING (
    branch_id = get_user_branch_id()
    AND (
      get_user_role() IN ('super_admin', 'bishop')
      OR (
        get_user_role() = 'shepherd'
        AND (
          assigned_shepherd = auth.uid()
          OR bacenta IN (
            SELECT b.name FROM shepherd_bacentas sb
            JOIN bacentas b ON b.id = sb.bacenta_id
            WHERE sb.shepherd_id = auth.uid()
          )
        )
      )
    )
  );
