export type UserRole = 'bishop' | 'super_admin' | 'shepherd' | 'recorder';
export type PersonStatus = 'first_timer' | 'member';
export type MemberStatus = 'active' | 'inactive' | 'flagged';

export interface Branch {
  id: string;
  name: string;
  location: string | null;
  branch_code: string;
  created_at: string;
}

export interface Profile {
  id: string;
  full_name: string;
  email: string;
  role: UserRole;
  branch_id: string;
  bacenta_id: string | null;
  created_at: string;
  branch?: Branch;
  bacenta?: Bacenta | null;
  bacentas?: Bacenta[];
}

export interface ShepherdBacenta {
  shepherd_id: string;
  bacenta_id: string;
  branch_id: string;
  created_at: string;
  bacenta?: Bacenta;
  shepherd?: Profile;
}

export interface NewBeliever {
  id: string;
  full_name: string;
  first_name: string | null;
  last_name: string | null;
  nickname: string | null;
  address: string;
  bacenta: string;
  phone_number: string;
  who_brought: string;
  date_saved: string;
  birthday: string | null;
  branch_id: string;
  recorded_by: string;
  photo_url: string | null;
  created_at: string;
}

export interface FirstTimer {
  id: string;
  full_name: string;
  first_name: string | null;
  last_name: string | null;
  nickname: string | null;
  address: string;
  bacenta: string;
  phone_number: string;
  who_brought: string;
  date_joined: string;
  birthday: string | null;
  branch_id: string;
  assigned_shepherd: string | null;
  status: PersonStatus;
  photo_url: string | null;
  promoted_at: string | null;
  created_at: string;
  attendance_count?: number;
}

export interface Member {
  id: string;
  first_timer_id: string | null;
  full_name: string;
  first_name: string | null;
  last_name: string | null;
  nickname: string | null;
  address: string;
  bacenta: string;
  phone_number: string;
  who_brought: string;
  date_joined: string;
  membership_date: string;
  assigned_shepherd: string | null;
  branch_id: string;
  status: MemberStatus;
  photo_url: string | null;
  birthday?: string | null;
  created_at: string;
}

export interface Attendance {
  id: string;
  person_id: string;
  person_type: 'new_believer' | 'first_timer' | 'member';
  date: string;
  is_present: boolean;
  marked_by: string;
  branch_id: string;
  created_at: string;
}

export type BroadcastAudience = 'all' | 'new_believers' | 'first_timers' | 'members';
export type BroadcastStatus = 'draft' | 'scheduled' | 'sent' | 'failed';
export type MessageType = 'prayer' | 'news' | 'reminder' | 'event';

export interface Broadcast {
  id: string;
  title: string;
  message: string;
  image_url: string | null;
  audience: BroadcastAudience;
  message_type: MessageType;
  scheduled_at: string | null;
  sent_at: string | null;
  status: BroadcastStatus;
  recipients_count: number;
  branch_id: string;
  created_by: string;
  created_at: string;
}

export interface PrayerSchedule {
  id: string;
  title: string;
  message: string;
  day_of_week: number; // 0=Sunday, 1=Monday, ..., 6=Saturday
  time: string; // HH:mm format
  audience: BroadcastAudience;
  is_active: boolean;
  branch_id: string;
  created_by: string;
  created_at: string;
}

// Follow-up tracking
export type FollowUpType = 'call' | 'visit' | 'whatsapp' | 'prayer';
export type FollowUpStatus = 'completed' | 'no_answer' | 'scheduled';

export interface FollowUp {
  id: string;
  member_id: string;
  member_name?: string;
  shepherd_id: string;
  shepherd_name?: string;
  type: FollowUpType;
  status: FollowUpStatus;
  notes: string;
  date: string;
  branch_id: string;
  created_at: string;
}

// Visitation
export interface Visitation {
  id: string;
  member_id: string;
  member_name?: string;
  shepherd_id: string;
  shepherd_name?: string;
  scheduled_date: string;
  completed: boolean;
  notes: string;
  address: string;
  branch_id: string;
  created_at: string;
}

// Alerts
export type AlertType = 'absence' | 'birthday' | 'promotion_ready' | 'follow_up_needed';
export type AlertPriority = 'high' | 'medium' | 'low';

export interface Alert {
  id: string;
  type: AlertType;
  priority: AlertPriority;
  title: string;
  message: string;
  member_id?: string;
  member_name?: string;
  shepherd_id?: string;
  is_read: boolean;
  branch_id: string;
  created_at: string;
}

// Chat messages (WhatsApp two-way)
export type ChatDirection = 'outbound' | 'inbound';
export type ChatStatus = 'sent' | 'delivered' | 'read' | 'failed';

export interface ChatMessage {
  id: string;
  person_id: string;
  person_type: 'new_believer' | 'first_timer' | 'member';
  phone_number: string;
  direction: ChatDirection;
  message: string;
  wa_message_id: string | null;
  status: ChatStatus;
  branch_id: string;
  sent_by: string | null;
  created_at: string;
}

export interface Bacenta {
  id: string;
  name: string;
  leader_name: string | null;
  location: string | null;
  branch_id: string;
  created_at: string;
}
