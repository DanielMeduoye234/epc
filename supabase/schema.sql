-- ============================================================
-- EPC CHURCH GROWTH DASHBOARD - SUPABASE SCHEMA (FULL)
-- Run this in your Supabase SQL Editor
-- ============================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- BRANCHES TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS branches (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  location TEXT,
  branch_code TEXT UNIQUE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================
-- PROFILES TABLE (extends auth.users)
-- ============================================================
CREATE TYPE user_role AS ENUM ('super_admin', 'bishop', 'shepherd', 'recorder');

CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  email TEXT NOT NULL,
  role user_role NOT NULL DEFAULT 'recorder',
  branch_id UUID REFERENCES branches(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================
-- BACENTAS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS bacentas (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  leader_name TEXT,
  location TEXT,
  branch_id UUID NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(name, branch_id)
);

-- ============================================================
-- NEW BELIEVERS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS new_believers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  full_name TEXT NOT NULL,
  address TEXT NOT NULL,
  bacenta TEXT NOT NULL,
  phone_number TEXT NOT NULL,
  who_brought TEXT NOT NULL,
  date_saved DATE DEFAULT CURRENT_DATE,
  branch_id UUID NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
  recorded_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  photo_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================
-- FIRST TIMERS TABLE
-- ============================================================
CREATE TYPE person_status AS ENUM ('first_timer', 'member');

CREATE TABLE IF NOT EXISTS first_timers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  full_name TEXT NOT NULL,
  address TEXT NOT NULL,
  bacenta TEXT NOT NULL,
  phone_number TEXT NOT NULL,
  who_brought TEXT NOT NULL,
  date_joined DATE NOT NULL,
  branch_id UUID NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
  assigned_shepherd UUID REFERENCES profiles(id) ON DELETE SET NULL,
  status person_status DEFAULT 'first_timer',
  photo_url TEXT,
  promoted_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  attendance_count INTEGER DEFAULT 0
);

-- ============================================================
-- MEMBERS TABLE
-- ============================================================
CREATE TYPE member_status AS ENUM ('active', 'inactive', 'flagged');

CREATE TABLE IF NOT EXISTS members (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  first_timer_id UUID REFERENCES first_timers(id) ON DELETE SET NULL,
  full_name TEXT NOT NULL,
  address TEXT NOT NULL,
  bacenta TEXT NOT NULL,
  phone_number TEXT NOT NULL,
  who_brought TEXT NOT NULL,
  date_joined DATE NOT NULL,
  membership_date DATE DEFAULT CURRENT_DATE,
  assigned_shepherd UUID REFERENCES profiles(id) ON DELETE SET NULL,
  branch_id UUID NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
  status member_status DEFAULT 'active',
  photo_url TEXT,
  birthday DATE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================
-- ATTENDANCE TABLE
-- ============================================================
CREATE TYPE person_type AS ENUM ('new_believer', 'first_timer', 'member');

CREATE TABLE IF NOT EXISTS attendance (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  person_id UUID NOT NULL,
  person_type person_type NOT NULL,
  date DATE NOT NULL,
  is_present BOOLEAN DEFAULT TRUE,
  marked_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  branch_id UUID NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(person_id, date, person_type)
);

-- ============================================================
-- FOLLOW-UPS TABLE
-- ============================================================
CREATE TYPE follow_up_type AS ENUM ('call', 'visit', 'whatsapp', 'prayer');
CREATE TYPE follow_up_status AS ENUM ('completed', 'no_answer', 'scheduled');

CREATE TABLE IF NOT EXISTS follow_ups (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  member_id UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  shepherd_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  type follow_up_type NOT NULL,
  status follow_up_status NOT NULL DEFAULT 'scheduled',
  notes TEXT,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  branch_id UUID NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================
-- VISITATIONS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS visitations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  member_id UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  shepherd_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  scheduled_date DATE NOT NULL,
  completed BOOLEAN DEFAULT FALSE,
  completed_at TIMESTAMP WITH TIME ZONE,
  notes TEXT,
  address TEXT,
  branch_id UUID NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================
-- ALERTS TABLE
-- ============================================================
CREATE TYPE alert_type AS ENUM ('absence', 'birthday', 'promotion_ready', 'follow_up_needed');
CREATE TYPE alert_priority AS ENUM ('high', 'medium', 'low');

CREATE TABLE IF NOT EXISTS alerts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  type alert_type NOT NULL,
  priority alert_priority NOT NULL DEFAULT 'medium',
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  member_id UUID REFERENCES members(id) ON DELETE CASCADE,
  first_timer_id UUID REFERENCES first_timers(id) ON DELETE CASCADE,
  shepherd_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  branch_id UUID NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
  is_read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================
-- BROADCASTS TABLE (EPC News)
-- ============================================================
CREATE TYPE broadcast_audience AS ENUM ('all', 'new_believers', 'first_timers', 'members');
CREATE TYPE broadcast_status AS ENUM ('draft', 'scheduled', 'sent', 'failed');
CREATE TYPE message_type AS ENUM ('prayer', 'news', 'reminder', 'event');

CREATE TABLE IF NOT EXISTS broadcasts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  image_url TEXT,
  audience broadcast_audience NOT NULL DEFAULT 'all',
  message_type message_type NOT NULL DEFAULT 'news',
  scheduled_at TIMESTAMP WITH TIME ZONE,
  sent_at TIMESTAMP WITH TIME ZONE,
  status broadcast_status NOT NULL DEFAULT 'draft',
  recipients_count INTEGER DEFAULT 0,
  branch_id UUID NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================
-- PRAYER SCHEDULES TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS prayer_schedules (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  day_of_week INTEGER NOT NULL CHECK (day_of_week >= 0 AND day_of_week <= 6),
  time TEXT NOT NULL,
  audience broadcast_audience NOT NULL DEFAULT 'members',
  is_active BOOLEAN DEFAULT TRUE,
  branch_id UUID NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================

ALTER TABLE branches ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE bacentas ENABLE ROW LEVEL SECURITY;
ALTER TABLE new_believers ENABLE ROW LEVEL SECURITY;
ALTER TABLE first_timers ENABLE ROW LEVEL SECURITY;
ALTER TABLE members ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE follow_ups ENABLE ROW LEVEL SECURITY;
ALTER TABLE visitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE broadcasts ENABLE ROW LEVEL SECURITY;
ALTER TABLE prayer_schedules ENABLE ROW LEVEL SECURITY;

-- Helper functions
CREATE OR REPLACE FUNCTION get_user_branch_id()
RETURNS UUID AS $$
  SELECT branch_id FROM profiles WHERE id = auth.uid();
$$ LANGUAGE SQL SECURITY DEFINER;

CREATE OR REPLACE FUNCTION get_user_role()
RETURNS user_role AS $$
  SELECT role FROM profiles WHERE id = auth.uid();
$$ LANGUAGE SQL SECURITY DEFINER;

-- ============================================================
-- POLICIES: BRANCHES
-- ============================================================
CREATE POLICY "Users can view their own branch"
  ON branches FOR SELECT
  USING (id = get_user_branch_id() OR get_user_role() = 'bishop');

-- ============================================================
-- POLICIES: PROFILES
-- ============================================================
CREATE POLICY "Users can view profiles in their branch"
  ON profiles FOR SELECT
  USING (branch_id = get_user_branch_id() OR get_user_role() = 'bishop');

CREATE POLICY "Super admins and bishops can insert profiles"
  ON profiles FOR INSERT
  WITH CHECK (get_user_role() IN ('super_admin', 'bishop'));

CREATE POLICY "Super admins can update profiles in their branch"
  ON profiles FOR UPDATE
  USING (branch_id = get_user_branch_id() AND get_user_role() IN ('super_admin', 'bishop'));

-- ============================================================
-- POLICIES: BACENTAS
-- ============================================================
CREATE POLICY "Users can view bacentas in their branch"
  ON bacentas FOR SELECT
  USING (branch_id = get_user_branch_id() OR get_user_role() = 'bishop');

CREATE POLICY "Super admins can manage bacentas"
  ON bacentas FOR ALL
  USING (branch_id = get_user_branch_id() AND get_user_role() IN ('super_admin', 'bishop'));

-- ============================================================
-- POLICIES: NEW BELIEVERS
-- ============================================================
CREATE POLICY "Users can view new believers in their branch"
  ON new_believers FOR SELECT
  USING (branch_id = get_user_branch_id() OR get_user_role() = 'bishop');

CREATE POLICY "Recorders and above can add new believers"
  ON new_believers FOR INSERT
  WITH CHECK (branch_id = get_user_branch_id());

CREATE POLICY "Super admins can update new believers"
  ON new_believers FOR UPDATE
  USING (branch_id = get_user_branch_id() AND get_user_role() IN ('super_admin', 'bishop'));

CREATE POLICY "Super admins can delete new believers"
  ON new_believers FOR DELETE
  USING (branch_id = get_user_branch_id() AND get_user_role() IN ('super_admin', 'bishop'));

-- ============================================================
-- POLICIES: FIRST TIMERS
-- ============================================================
CREATE POLICY "Users can view first timers in their branch"
  ON first_timers FOR SELECT
  USING (branch_id = get_user_branch_id() OR get_user_role() = 'bishop');

CREATE POLICY "Recorders and above can add first timers"
  ON first_timers FOR INSERT
  WITH CHECK (branch_id = get_user_branch_id());

CREATE POLICY "Shepherds and above can update first timers"
  ON first_timers FOR UPDATE
  USING (branch_id = get_user_branch_id() AND get_user_role() IN ('super_admin', 'bishop', 'shepherd'));

CREATE POLICY "Super admins can delete first timers"
  ON first_timers FOR DELETE
  USING (branch_id = get_user_branch_id() AND get_user_role() IN ('super_admin', 'bishop'));

-- ============================================================
-- POLICIES: MEMBERS
-- ============================================================
CREATE POLICY "Users can view members in their branch"
  ON members FOR SELECT
  USING (branch_id = get_user_branch_id() OR get_user_role() = 'bishop');

CREATE POLICY "Shepherds and above can add members"
  ON members FOR INSERT
  WITH CHECK (branch_id = get_user_branch_id() AND get_user_role() IN ('super_admin', 'bishop', 'shepherd'));

CREATE POLICY "Shepherds and above can update members"
  ON members FOR UPDATE
  USING (branch_id = get_user_branch_id() AND get_user_role() IN ('super_admin', 'bishop', 'shepherd'));

CREATE POLICY "Super admins can delete members"
  ON members FOR DELETE
  USING (branch_id = get_user_branch_id() AND get_user_role() IN ('super_admin', 'bishop'));

-- ============================================================
-- POLICIES: ATTENDANCE
-- ============================================================
CREATE POLICY "Users can view attendance in their branch"
  ON attendance FOR SELECT
  USING (branch_id = get_user_branch_id() OR get_user_role() = 'bishop');

CREATE POLICY "Shepherds and above can add attendance"
  ON attendance FOR INSERT
  WITH CHECK (branch_id = get_user_branch_id() AND get_user_role() IN ('super_admin', 'bishop', 'shepherd'));

CREATE POLICY "Shepherds and above can update attendance"
  ON attendance FOR UPDATE
  USING (branch_id = get_user_branch_id() AND get_user_role() IN ('super_admin', 'bishop', 'shepherd'));

CREATE POLICY "Shepherds and above can delete attendance"
  ON attendance FOR DELETE
  USING (branch_id = get_user_branch_id() AND get_user_role() IN ('super_admin', 'bishop', 'shepherd'));

-- ============================================================
-- POLICIES: FOLLOW-UPS
-- ============================================================
CREATE POLICY "Users can view follow-ups in their branch"
  ON follow_ups FOR SELECT
  USING (branch_id = get_user_branch_id() OR get_user_role() = 'bishop');

CREATE POLICY "Shepherds and above can add follow-ups"
  ON follow_ups FOR INSERT
  WITH CHECK (branch_id = get_user_branch_id() AND get_user_role() IN ('super_admin', 'bishop', 'shepherd'));

CREATE POLICY "Shepherds and above can update follow-ups"
  ON follow_ups FOR UPDATE
  USING (branch_id = get_user_branch_id() AND get_user_role() IN ('super_admin', 'bishop', 'shepherd'));

-- ============================================================
-- POLICIES: VISITATIONS
-- ============================================================
CREATE POLICY "Users can view visitations in their branch"
  ON visitations FOR SELECT
  USING (branch_id = get_user_branch_id() OR get_user_role() = 'bishop');

CREATE POLICY "Shepherds and above can add visitations"
  ON visitations FOR INSERT
  WITH CHECK (branch_id = get_user_branch_id() AND get_user_role() IN ('super_admin', 'bishop', 'shepherd'));

CREATE POLICY "Shepherds and above can update visitations"
  ON visitations FOR UPDATE
  USING (branch_id = get_user_branch_id() AND get_user_role() IN ('super_admin', 'bishop', 'shepherd'));

-- ============================================================
-- POLICIES: ALERTS
-- ============================================================
CREATE POLICY "Users can view alerts in their branch"
  ON alerts FOR SELECT
  USING (branch_id = get_user_branch_id() OR get_user_role() = 'bishop');

CREATE POLICY "System can insert alerts"
  ON alerts FOR INSERT
  WITH CHECK (branch_id = get_user_branch_id() OR get_user_role() IN ('super_admin', 'bishop'));

CREATE POLICY "Users can update their alerts (mark read)"
  ON alerts FOR UPDATE
  USING (branch_id = get_user_branch_id() OR get_user_role() = 'bishop');

-- ============================================================
-- POLICIES: BROADCASTS
-- ============================================================
CREATE POLICY "Users can view broadcasts in their branch"
  ON broadcasts FOR SELECT
  USING (branch_id = get_user_branch_id() OR get_user_role() = 'bishop');

CREATE POLICY "Super admins can insert broadcasts"
  ON broadcasts FOR INSERT
  WITH CHECK (branch_id = get_user_branch_id() AND get_user_role() IN ('super_admin', 'bishop'));

CREATE POLICY "Super admins can update broadcasts"
  ON broadcasts FOR UPDATE
  USING (branch_id = get_user_branch_id() AND get_user_role() IN ('super_admin', 'bishop'));

CREATE POLICY "Super admins can delete broadcasts"
  ON broadcasts FOR DELETE
  USING (branch_id = get_user_branch_id() AND get_user_role() IN ('super_admin', 'bishop'));

-- ============================================================
-- POLICIES: PRAYER SCHEDULES
-- ============================================================
CREATE POLICY "Users can view prayer schedules in their branch"
  ON prayer_schedules FOR SELECT
  USING (branch_id = get_user_branch_id() OR get_user_role() = 'bishop');

CREATE POLICY "Super admins can insert prayer schedules"
  ON prayer_schedules FOR INSERT
  WITH CHECK (branch_id = get_user_branch_id() AND get_user_role() IN ('super_admin', 'bishop'));

CREATE POLICY "Super admins can update prayer schedules"
  ON prayer_schedules FOR UPDATE
  USING (branch_id = get_user_branch_id() AND get_user_role() IN ('super_admin', 'bishop'));

CREATE POLICY "Super admins can delete prayer schedules"
  ON prayer_schedules FOR DELETE
  USING (branch_id = get_user_branch_id() AND get_user_role() IN ('super_admin', 'bishop'));

-- ============================================================
-- INDEXES
-- ============================================================
CREATE INDEX idx_new_believers_branch ON new_believers(branch_id);
CREATE INDEX idx_new_believers_date ON new_believers(date_saved);
CREATE INDEX idx_first_timers_branch ON first_timers(branch_id);
CREATE INDEX idx_first_timers_status ON first_timers(status);
CREATE INDEX idx_members_branch ON members(branch_id);
CREATE INDEX idx_members_status ON members(status);
CREATE INDEX idx_members_shepherd ON members(assigned_shepherd);
CREATE INDEX idx_members_birthday ON members(birthday);
CREATE INDEX idx_attendance_person ON attendance(person_id, date);
CREATE INDEX idx_attendance_branch ON attendance(branch_id);
CREATE INDEX idx_follow_ups_branch ON follow_ups(branch_id);
CREATE INDEX idx_follow_ups_shepherd ON follow_ups(shepherd_id);
CREATE INDEX idx_follow_ups_member ON follow_ups(member_id);
CREATE INDEX idx_visitations_branch ON visitations(branch_id);
CREATE INDEX idx_visitations_shepherd ON visitations(shepherd_id);
CREATE INDEX idx_visitations_date ON visitations(scheduled_date);
CREATE INDEX idx_alerts_branch ON alerts(branch_id);
CREATE INDEX idx_alerts_read ON alerts(is_read) WHERE is_read = FALSE;
CREATE INDEX idx_broadcasts_branch ON broadcasts(branch_id);
CREATE INDEX idx_broadcasts_status ON broadcasts(status);
CREATE INDEX idx_broadcasts_scheduled ON broadcasts(scheduled_at) WHERE status = 'scheduled';
CREATE INDEX idx_prayer_schedules_branch ON prayer_schedules(branch_id);
CREATE INDEX idx_prayer_schedules_active ON prayer_schedules(day_of_week, time) WHERE is_active = TRUE;

-- ============================================================
-- FUNCTION: Auto-promote First Timers to Members
-- ============================================================
CREATE OR REPLACE FUNCTION promote_first_timers_to_members()
RETURNS void AS $$
DECLARE
  ft RECORD;
  att_count INT;
BEGIN
  FOR ft IN
    SELECT * FROM first_timers WHERE status = 'first_timer'
  LOOP
    SELECT COUNT(*) INTO att_count
    FROM attendance
    WHERE person_id = ft.id
      AND person_type = 'first_timer'
      AND is_present = TRUE;

    IF att_count >= 3 THEN
      INSERT INTO members (first_timer_id, full_name, address, bacenta, phone_number, who_brought, date_joined, membership_date, assigned_shepherd, branch_id, status)
      VALUES (ft.id, ft.full_name, ft.address, ft.bacenta, ft.phone_number, ft.who_brought, ft.date_joined, CURRENT_DATE, ft.assigned_shepherd, ft.branch_id, 'active');

      UPDATE first_timers SET status = 'member', promoted_at = NOW() WHERE id = ft.id;
    END IF;
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- FUNCTION: Flag Inactive Members (no attendance in 14 days)
-- ============================================================
CREATE OR REPLACE FUNCTION flag_inactive_members()
RETURNS void AS $$
DECLARE
  m RECORD;
  last_attendance DATE;
BEGIN
  FOR m IN
    SELECT * FROM members WHERE status = 'active'
  LOOP
    SELECT MAX(date) INTO last_attendance
    FROM attendance
    WHERE person_id = m.id
      AND person_type = 'member'
      AND is_present = TRUE;

    IF last_attendance IS NULL OR last_attendance < CURRENT_DATE - INTERVAL '14 days' THEN
      UPDATE members SET status = 'flagged' WHERE id = m.id;
    END IF;
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- FUNCTION: Generate Birthday Alerts
-- ============================================================
CREATE OR REPLACE FUNCTION generate_birthday_alerts()
RETURNS void AS $$
DECLARE
  m RECORD;
BEGIN
  FOR m IN
    SELECT * FROM members
    WHERE birthday IS NOT NULL
      AND EXTRACT(MONTH FROM birthday) = EXTRACT(MONTH FROM CURRENT_DATE)
      AND EXTRACT(DAY FROM birthday) BETWEEN EXTRACT(DAY FROM CURRENT_DATE) AND EXTRACT(DAY FROM CURRENT_DATE) + 3
      AND status = 'active'
  LOOP
    IF NOT EXISTS (
      SELECT 1 FROM alerts
      WHERE member_id = m.id
        AND type = 'birthday'
        AND created_at::date = CURRENT_DATE
    ) THEN
      INSERT INTO alerts (type, priority, title, message, member_id, shepherd_id, branch_id)
      VALUES (
        'birthday',
        'medium',
        m.full_name || '''s birthday is coming up! 🎂',
        m.full_name || '''s birthday is on ' || TO_CHAR(m.birthday, 'Mon DD') || '. Send a birthday greeting!',
        m.id,
        m.assigned_shepherd,
        m.branch_id
      );
    END IF;
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- FUNCTION: Generate Absence Alerts
-- ============================================================
CREATE OR REPLACE FUNCTION generate_absence_alerts()
RETURNS void AS $$
DECLARE
  m RECORD;
  missed_weeks INT;
BEGIN
  FOR m IN
    SELECT * FROM members WHERE status IN ('active', 'flagged')
  LOOP
    SELECT COUNT(*) INTO missed_weeks
    FROM (
      SELECT DISTINCT date FROM attendance
      WHERE branch_id = m.branch_id AND date >= CURRENT_DATE - INTERVAL '28 days'
    ) AS service_dates
    WHERE NOT EXISTS (
      SELECT 1 FROM attendance
      WHERE person_id = m.id AND person_type = 'member' AND date = service_dates.date AND is_present = TRUE
    );

    IF missed_weeks >= 2 AND NOT EXISTS (
      SELECT 1 FROM alerts
      WHERE member_id = m.id AND type = 'absence' AND created_at >= CURRENT_DATE - INTERVAL '7 days'
    ) THEN
      INSERT INTO alerts (type, priority, title, message, member_id, shepherd_id, branch_id)
      VALUES (
        'absence',
        CASE WHEN missed_weeks >= 3 THEN 'high' ELSE 'medium' END,
        m.full_name || ' missed ' || missed_weeks || ' weeks',
        m.full_name || ' has not attended service for ' || missed_weeks || ' consecutive weeks. Follow-up recommended.',
        m.id,
        m.assigned_shepherd,
        m.branch_id
      );
    END IF;
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- MIGRATIONS: Run these on an existing database
-- ============================================================

-- Add first_name, last_name, nickname, birthday to new_believers
ALTER TABLE new_believers
  ADD COLUMN IF NOT EXISTS first_name TEXT,
  ADD COLUMN IF NOT EXISTS last_name TEXT,
  ADD COLUMN IF NOT EXISTS nickname TEXT,
  ADD COLUMN IF NOT EXISTS birthday DATE;

-- Add first_name, last_name, nickname, birthday to first_timers
ALTER TABLE first_timers
  ADD COLUMN IF NOT EXISTS first_name TEXT,
  ADD COLUMN IF NOT EXISTS last_name TEXT,
  ADD COLUMN IF NOT EXISTS nickname TEXT,
  ADD COLUMN IF NOT EXISTS birthday DATE;

-- Add first_name, last_name, nickname to members
ALTER TABLE members
  ADD COLUMN IF NOT EXISTS first_name TEXT,
  ADD COLUMN IF NOT EXISTS last_name TEXT,
  ADD COLUMN IF NOT EXISTS nickname TEXT;

-- ============================================================
-- CHAT MESSAGES TABLE (WhatsApp two-way chat)
-- ============================================================
CREATE TABLE IF NOT EXISTS chat_messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  person_id UUID NOT NULL,
  person_type TEXT NOT NULL CHECK (person_type IN ('new_believer', 'first_timer', 'member')),
  phone_number TEXT NOT NULL,
  direction TEXT NOT NULL CHECK (direction IN ('outbound', 'inbound')),
  message TEXT NOT NULL,
  wa_message_id TEXT,
  status TEXT DEFAULT 'sent' CHECK (status IN ('sent', 'delivered', 'read', 'failed')),
  branch_id UUID NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
  sent_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_chat_messages_person ON chat_messages(person_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_chat_messages_branch ON chat_messages(branch_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_phone ON chat_messages(phone_number);

CREATE POLICY "Users can view chat messages in their branch"
  ON chat_messages FOR SELECT
  USING (branch_id = get_user_branch_id() OR get_user_role() = 'bishop');

CREATE POLICY "Users can insert chat messages in their branch"
  ON chat_messages FOR INSERT
  WITH CHECK (branch_id = get_user_branch_id() OR true);

-- ============================================================
-- BRANCH SETTINGS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS branch_settings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  branch_id UUID NOT NULL UNIQUE REFERENCES branches(id) ON DELETE CASCADE,
  whatsapp_phone TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE branch_settings ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_branch_settings_branch ON branch_settings(branch_id);

CREATE POLICY "Super admins can view branch settings"
  ON branch_settings FOR SELECT
  USING (branch_id = get_user_branch_id() OR get_user_role() = 'bishop');

CREATE POLICY "Super admins can upsert branch settings"
  ON branch_settings FOR INSERT
  WITH CHECK (branch_id = get_user_branch_id() AND get_user_role() IN ('super_admin', 'bishop'));

CREATE POLICY "Super admins can update branch settings"
  ON branch_settings FOR UPDATE
  USING (branch_id = get_user_branch_id() AND get_user_role() IN ('super_admin', 'bishop'));

-- ============================================================
-- FUNCTION: Promote First Timers after 2 attendances in same month
-- ============================================================
CREATE OR REPLACE FUNCTION promote_first_timers_to_members()
RETURNS void AS $$
DECLARE
  ft RECORD;
  monthly_count INT;
BEGIN
  FOR ft IN
    SELECT * FROM first_timers WHERE status = 'first_timer'
  LOOP
    -- Promote if 2+ attendances occur within any single calendar month
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
      ON CONFLICT DO NOTHING;

      UPDATE first_timers SET status = 'member', promoted_at = NOW() WHERE id = ft.id;
    END IF;
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
