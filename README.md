# Employee Attendance & Timesheet Management System

A production-ready, full-stack web application built with **Next.js 14** and **Supabase** for managing employee attendance, punch-in/punch-out sessions, timesheets, and leave requests — with role-based access for Admins and Employees.

---

## Features

- 🔐 **Authentication** — Email/password login via Supabase Auth with server-side session handling
- 🕐 **Punch In / Punch Out** — Single or multiple daily sessions with automatic duration calculation
- 📅 **Daily Attendance** — Automated aggregation of working hours per employee per day
- 📋 **Timesheet View** — Weekly and monthly breakdowns with total hours worked
- 🏖️ **Leave Requests** — Employees submit requests; admins approve or reject in one click
- 👩‍💼 **Admin Dashboard** — Full visibility into all employees' attendance, sessions, and leave history
- 🏢 **Company Settings** — Configurable work hours, grace period, timezone, and working days
- 🔑 **Role-Based Access Control** — `admin` and `employee` roles enforced at the database level via RLS
- 📝 **Audit Logs** — Immutable log of all significant actions (admin-only view)
- 🌐 **Timezone Aware** — All timestamps stored in UTC; displayed in company-configured timezone
- 📱 **Responsive UI** — Works on desktop, tablet, and mobile

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | [Next.js 14](https://nextjs.org/) (App Router, Server Components, Route Handlers) |
| Database | [Supabase](https://supabase.com/) (PostgreSQL 15) |
| Auth | Supabase Auth (email/password) |
| ORM / Client | `@supabase/supabase-js` v2 + `@supabase/ssr` |
| Styling | [Tailwind CSS](https://tailwindcss.com/) |
| UI Components | [shadcn/ui](https://ui.shadcn.com/) |
| Language | TypeScript |
| Deployment | [Vercel](https://vercel.com/) |

---

## Prerequisites

- **Node.js** ≥ 18.17 and **npm** ≥ 9 (or pnpm / yarn)
- A free [Supabase](https://supabase.com/) account
- A free [Vercel](https://vercel.com/) account (for deployment)
- Git

---

## Setup Instructions

### 1. Clone the repository

```bash
git clone https://github.com/your-org/attendance-web-app.git
cd attendance-web-app
```

### 2. Install dependencies

```bash
npm install
```

### 3. Create a Supabase project

1. Go to [https://supabase.com/dashboard](https://supabase.com/dashboard) and sign in.
2. Click **New project**, choose your organisation, enter a project name, set a strong database password, and pick a region close to your users.
3. Wait ~2 minutes for the project to provision.

### 4. Configure environment variables

```bash
cp .env.example .env.local
```

Open `.env.local` and fill in the three required values from your Supabase project dashboard (**Settings → API**):

```
NEXT_PUBLIC_SUPABASE_URL=https://xxxxxxxxxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGci...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGci...
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

> **Warning:** `SUPABASE_SERVICE_ROLE_KEY` bypasses Row Level Security. It must **never** be exposed to the browser. It is only used in Next.js **Route Handlers** (server-side).

### 5. Apply the database schema

1. In the Supabase dashboard, navigate to **SQL Editor → New query**.
2. Paste the contents of [`supabase/schema.sql`](./supabase/schema.sql) and click **Run**.
3. You should see: *"Success. No rows returned."*

### 6. Apply Row Level Security policies

1. In the **SQL Editor**, open a new query tab.
2. Paste the contents of [`supabase/rls.sql`](./supabase/rls.sql) and click **Run**.

### 7. Apply seed data

1. In the **SQL Editor**, open another new query tab.
2. Paste the contents of [`supabase/seed.sql`](./supabase/seed.sql) and click **Run**.

This inserts the default `company_settings` row. No test users are created automatically.

### 8. Create the first admin user

1. In the Supabase dashboard, go to **Authentication → Users → Add user**.
2. Enter the admin email (e.g. `admin@mycompany.com`) and a strong password.
3. Click **Create user**. The database trigger will auto-create a `profiles` row.

### 9. Promote the user to Admin role

In the **SQL Editor**, run the following (replace the email):

```sql
UPDATE public.profiles
SET
  role        = 'admin',
  employee_id = 'ADMIN001',
  full_name   = 'System Administrator',
  department  = 'IT',
  designation = 'System Administrator'
WHERE email = 'admin@mycompany.com';
```

Verify with:

```sql
SELECT id, employee_id, full_name, email, role
FROM   public.profiles
WHERE  role = 'admin';
```

### 10. Start the development server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser and log in with the admin credentials you just created.

---

## Deployment to Vercel

1. Push your repository to GitHub (make sure `.env.local` is in `.gitignore` ✅).
2. Go to [https://vercel.com/new](https://vercel.com/new) and import the repository.
3. In the **Environment Variables** section, add the same keys from your `.env.local`:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `NEXT_PUBLIC_APP_URL` → set to your Vercel production URL (e.g. `https://attendance.vercel.app`)
4. Click **Deploy**. Vercel will auto-detect Next.js and configure the build.
5. After deployment, update **Supabase → Authentication → URL Configuration**:
   - **Site URL**: `https://your-app.vercel.app`
   - **Redirect URLs**: `https://your-app.vercel.app/**`

---

## Usage Guide

### Admin

| Action | Where |
|---|---|
| View all employees' attendance | Dashboard → Attendance |
| Approve / reject leave requests | Dashboard → Leave Requests |
| Manage employee profiles | Dashboard → Employees |
| Edit company settings | Dashboard → Settings |
| View audit logs | Dashboard → Audit Logs |
| Generate timesheet reports | Dashboard → Reports |

### Employee

| Action | Where |
|---|---|
| Punch in / punch out | Home → Clock widget |
| View personal attendance history | My Attendance |
| Submit a leave request | Leave → New Request |
| View leave status | Leave → My Requests |
| Edit personal profile | Profile → Edit |

---

## Database Schema

| Table | Purpose |
|---|---|
| `profiles` | Extends `auth.users` with HR fields: employee ID, department, role, etc. |
| `attendance` | One aggregated record per employee per calendar day; stores `total_working_seconds` and `status`. |
| `attendance_sessions` | Individual punch-in/punch-out pairs within a day. Duration is auto-calculated by trigger. |
| `leave_requests` | Employee leave applications with approval workflow (`pending → approved / rejected`). |
| `company_settings` | Single-row global configuration (work hours, grace period, timezone, working days). |
| `audit_logs` | Immutable append-only log of significant actions (actor, action, target table/row, details JSON). |

### Entity Relationship

```
auth.users (1) ──── (1) profiles
profiles   (1) ──── (N) attendance
profiles   (1) ──── (N) attendance_sessions
profiles   (1) ──── (N) leave_requests
attendance (1) ──── (N) attendance_sessions
profiles   (1) ──── (N) audit_logs  [as actor]
profiles   (1) ──── (N) leave_requests  [as approved_by]
```

---

## Security Notes

- **Row Level Security (RLS)** is enabled on every table. Employees can only read and write their own data.
- The `is_admin()` SQL function is `SECURITY DEFINER` and `STABLE` — it cannot be bypassed by crafting a malicious JWT.
- The `SUPABASE_SERVICE_ROLE_KEY` is only used server-side in Next.js Route Handlers and is never sent to the browser.
- Employees cannot directly `UPDATE` the `attendance` table — all mutations go through authenticated API routes that use the service-role client.
- The `audit_logs` table is append-only for authenticated users; no `UPDATE` or `DELETE` policy is defined.
- Employees cannot change their own `role` field — the `profiles_update_own` policy enforces this with a `WITH CHECK` clause.
- All passwords are managed by Supabase Auth (bcrypt-hashed). This app never stores raw passwords.
- Keep your Supabase database password and service-role key in a password manager. Rotate them immediately if compromised.

---

## Contributing

1. Fork the repository and create a feature branch: `git checkout -b feature/my-feature`
2. Commit your changes with conventional commits: `git commit -m "feat: add weekly timesheet export"`
3. Push and open a Pull Request.

---

## License

MIT © 2024 Your Organisation
