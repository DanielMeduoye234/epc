-- Migration: 20260927000000_sync_new_believers_to_members.sql
-- Description: Ensure people under new_believers are automatically part of members table with zero duplication.

BEGIN;

-- 1. Add new_believer_id column to members if not already present
ALTER TABLE members
ADD COLUMN IF NOT EXISTS new_believer_id UUID REFERENCES new_believers(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_members_new_believer_id ON members(new_believer_id);

-- 2. Link existing members who match new_believers by phone or name to avoid duplication
UPDATE members m
SET new_believer_id = nb.id
FROM new_believers nb
WHERE m.branch_id = nb.branch_id
  AND m.new_believer_id IS NULL
  AND (
    (
      regexp_replace(m.phone_number, '[^0-9]', '', 'g') <> ''
      AND regexp_replace(nb.phone_number, '[^0-9]', '', 'g') <> ''
      AND regexp_replace(m.phone_number, '[^0-9]', '', 'g') = regexp_replace(nb.phone_number, '[^0-9]', '', 'g')
    )
    OR (
      LOWER(TRIM(m.full_name)) = LOWER(TRIM(nb.full_name))
    )
  );

-- 3. Backfill any remaining new_believers who do not exist in members yet
INSERT INTO members (
  new_believer_id,
  full_name,
  first_name,
  last_name,
  nickname,
  address,
  bacenta,
  phone_number,
  who_brought,
  date_joined,
  membership_date,
  branch_id,
  status,
  birthday,
  photo_url,
  created_at
)
SELECT
  nb.id,
  nb.full_name,
  COALESCE(nb.first_name, split_part(nb.full_name, ' ', 1)),
  COALESCE(nb.last_name, NULLIF(substr(nb.full_name, length(split_part(nb.full_name, ' ', 1)) + 2), '')),
  nb.nickname,
  COALESCE(NULLIF(nb.address, ''), 'To be updated'),
  COALESCE(NULLIF(nb.bacenta, ''), 'Unassigned'),
  nb.phone_number,
  COALESCE(NULLIF(nb.who_brought, ''), 'To be updated'),
  COALESCE(nb.date_saved, CURRENT_DATE),
  COALESCE(nb.date_saved, CURRENT_DATE),
  nb.branch_id,
  'active'::member_status,
  nb.birthday,
  nb.photo_url,
  COALESCE(nb.created_at, NOW())
FROM new_believers nb
WHERE NOT EXISTS (
  SELECT 1 FROM members m
  WHERE m.branch_id = nb.branch_id
    AND (
      m.new_believer_id = nb.id
      OR (
        regexp_replace(m.phone_number, '[^0-9]', '', 'g') <> ''
        AND regexp_replace(nb.phone_number, '[^0-9]', '', 'g') <> ''
        AND regexp_replace(m.phone_number, '[^0-9]', '', 'g') = regexp_replace(nb.phone_number, '[^0-9]', '', 'g')
      )
      OR LOWER(TRIM(m.full_name)) = LOWER(TRIM(nb.full_name))
    )
);

-- 4. PostgreSQL trigger function to automatically reflect new/updated new_believers in members
CREATE OR REPLACE FUNCTION sync_new_believer_to_member()
RETURNS TRIGGER AS $$
DECLARE
  existing_member_id UUID;
  clean_phone TEXT;
BEGIN
  clean_phone := regexp_replace(NEW.phone_number, '[^0-9]', '', 'g');

  -- Check if a member is already linked or exists with same phone / name in branch
  SELECT id INTO existing_member_id
  FROM members
  WHERE branch_id = NEW.branch_id
    AND (
      new_believer_id = NEW.id
      OR (
        clean_phone <> ''
        AND length(clean_phone) >= 7
        AND regexp_replace(phone_number, '[^0-9]', '', 'g') = clean_phone
      )
      OR LOWER(TRIM(full_name)) = LOWER(TRIM(NEW.full_name))
    )
  LIMIT 1;

  IF existing_member_id IS NOT NULL THEN
    -- Update existing member to link new_believer_id and sync latest info if needed
    UPDATE members
    SET
      new_believer_id = NEW.id,
      full_name = NEW.full_name,
      first_name = COALESCE(NEW.first_name, members.first_name),
      last_name = COALESCE(NEW.last_name, members.last_name),
      nickname = COALESCE(NEW.nickname, members.nickname),
      phone_number = NEW.phone_number,
      address = COALESCE(NULLIF(NEW.address, ''), members.address),
      bacenta = COALESCE(NULLIF(NEW.bacenta, ''), members.bacenta),
      who_brought = COALESCE(NULLIF(NEW.who_brought, ''), members.who_brought),
      birthday = COALESCE(NEW.birthday, members.birthday),
      photo_url = COALESCE(NEW.photo_url, members.photo_url)
    WHERE id = existing_member_id;
  ELSE
    -- Insert new member record for this new believer
    INSERT INTO members (
      new_believer_id,
      full_name,
      first_name,
      last_name,
      nickname,
      address,
      bacenta,
      phone_number,
      who_brought,
      date_joined,
      membership_date,
      branch_id,
      status,
      birthday,
      photo_url,
      created_at
    )
    VALUES (
      NEW.id,
      NEW.full_name,
      COALESCE(NEW.first_name, split_part(NEW.full_name, ' ', 1)),
      COALESCE(NEW.last_name, NULLIF(substr(NEW.full_name, length(split_part(NEW.full_name, ' ', 1)) + 2), '')),
      NEW.nickname,
      COALESCE(NULLIF(NEW.address, ''), 'To be updated'),
      COALESCE(NULLIF(NEW.bacenta, ''), 'Unassigned'),
      NEW.phone_number,
      COALESCE(NULLIF(NEW.who_brought, ''), 'To be updated'),
      COALESCE(NEW.date_saved, CURRENT_DATE),
      COALESCE(NEW.date_saved, CURRENT_DATE),
      NEW.branch_id,
      'active'::member_status,
      NEW.birthday,
      NEW.photo_url,
      COALESCE(NEW.created_at, NOW())
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Attach trigger to new_believers table
DROP TRIGGER IF EXISTS trigger_sync_new_believer_to_member ON new_believers;
CREATE TRIGGER trigger_sync_new_believer_to_member
AFTER INSERT OR UPDATE ON new_believers
FOR EACH ROW
EXECUTE FUNCTION sync_new_believer_to_member();

COMMIT;
