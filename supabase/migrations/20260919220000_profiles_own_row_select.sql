-- Allow every authenticated user to read their own profile row.
-- Without this, AuthProvider can get null (RLS miss) and show "Finish Setting Up"
-- even when the account already belongs to a branch.
-- Also keep branch-wide visibility for teammate lists.

DROP POLICY IF EXISTS "Users can view profiles in their branch" ON profiles;
DROP POLICY IF EXISTS "Users can view own profile or branch profiles" ON profiles;

CREATE POLICY "Users can view own profile or branch profiles"
  ON profiles FOR SELECT
  USING (
    id = auth.uid()
    OR branch_id = get_user_branch_id()
    OR get_user_role() = 'bishop'
  );

-- Users with no branch yet must still be able to update their own row during setup.
DROP POLICY IF EXISTS "Users can update their own profile" ON profiles;

CREATE POLICY "Users can update their own profile"
  ON profiles FOR UPDATE
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());
