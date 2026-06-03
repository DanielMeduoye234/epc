# EPC Dashboard - Everything by Prayer

Church Growth Dashboard for tracking New Believers, First Timers, and Members.

## Getting Started

### 1. Set up Supabase

1. Go to [supabase.com](https://supabase.com) and create a new project.
2. Navigate to **SQL Editor** in your Supabase dashboard.
3. Copy and paste the contents of `supabase/schema.sql` and run it.
4. Go to **Settings > API** and copy your:
   - **Project URL** (e.g., `https://xxxx.supabase.co`)
   - **Anon public key**

### 2. Configure Environment Variables

Edit `.env.local` in the project root:

```
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
```

### 3. Create Your First Branch and Super Admin

1. In Supabase **Authentication**, create a new user (email + password).
2. In the **SQL Editor**, run:

```sql
INSERT INTO branches (name, location, branch_code)
VALUES ('EPC Apache', 'Your Location', 'epc-apache');

INSERT INTO profiles (id, full_name, email, role, branch_id)
VALUES (
  'PASTE_YOUR_AUTH_USER_UUID_HERE',
  'Your Name',
  'your-email@example.com',
  'super_admin',
  (SELECT id FROM branches WHERE branch_code = 'epc-apache')
);
```

### 4. Run the Development Server

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) and log in with your credentials.

## Features

- **New Believers** - Record people who give their lives to Christ
- **First Timers** - Track first-time visitors (auto-promoted to Member after 3 weeks attendance)
- **Members** - Manage church members with attendance tracking
- **Analytics** - Visual growth charts and Bacenta distribution
- **Attendance** - Weekly attendance marking for Shepherds
- **Multi-Branch** - Each EPC branch has isolated data
- **Role-Based Access** - Super Admin, Shepherd, Recorder

## Brand Colors

- White: `#FFFFFF`
- Black: `#000000`
- Gradient Orange: `from-orange-400 to-orange-600`

## Tech Stack

- **Frontend:** Next.js 16 + TypeScript + Tailwind CSS
- **Backend:** Supabase (PostgreSQL + Auth + RLS)
- **Charts:** Recharts
- **Icons:** Lucide React

## Project Structure

```
src/
├── app/
│   ├── login/page.tsx              # Login page
│   ├── dashboard/
│   │   ├── page.tsx                # Dashboard with analytics
│   │   ├── layout.tsx              # Dashboard layout with sidebar
│   │   ├── new-believers/page.tsx  # New Believers CRUD
│   │   ├── first-timers/page.tsx   # First Timers CRUD
│   │   ├── members/page.tsx        # Members list
│   │   ├── attendance/page.tsx     # Attendance marking
│   │   ├── settings/page.tsx       # User management (Super Admin)
│   │   └── profile/[type]/[id]/    # Profile detail page
│   └── auth/callback/route.ts      # Auth callback handler
├── components/
│   ├── AuthProvider.tsx            # Auth context provider
│   └── Sidebar.tsx                 # Navigation sidebar
├── lib/
│   ├── types.ts                    # TypeScript interfaces
│   └── supabase/
│       ├── client.ts               # Browser Supabase client
│       └── server.ts               # Server Supabase client
└── middleware.ts                    # Auth middleware
```

## Roles

| Role | Permissions |
|------|------------|
| Super Admin | Full access to all data in their branch, manage users |
| Shepherd | View/update assigned members, mark attendance, record conversions |
| Recorder | Record new believer information only |
