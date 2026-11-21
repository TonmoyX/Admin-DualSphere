# DualSphere — Admin Panel

The staff dashboard for **DualSphere**, a social network with both identity-based and anonymous posting. Admins and moderators use it to moderate content, manage users, configure the platform and run audited security actions.

This repo is one of three:

| Repo | What it is | Default port |
| --- | --- | --- |
| **Admin** (this repo) | The staff / moderation panel (Next.js) | `3001` |
| Frontend | The user-facing Next.js web app | `3000` |
| Backend | Express API, PostgreSQL, Socket.io | `4000` |

The panel has no data of its own. Everything comes from the backend's `/api/v1/admin` and `/api/v1/moderation` endpoints, and the backend enforces all permissions.

---

## Tech stack

- **Next.js 16** (App Router) + **React 19** + **TypeScript**
- **Tailwind CSS v4** + **shadcn/ui** (sidebar, tables, dialogs, charts)
- **Recharts** for dashboard charts
- **TanStack Query** for data fetching and caching
- **Socket.io client** for live updates
- **Zod**, **date-fns**, **lucide-react**, **sonner**, **Framer Motion**

---

## Who can use it

Only accounts with the **`moderator`** or **`admin`** role can sign in.

- **Admins** have every permission.
- **Moderators** only get the permissions an admin grants them. If nothing is set, they get a sensible default set. The sidebar and pages adapt to the signed-in user's permissions.
- Some actions are **admin-only and cannot be delegated**: changing roles, deleting accounts, unmasking anonymous authors, and managing moderator permissions.

---

## Pages

| Page | What it does |
| --- | --- |
| **Dashboard** | Platform stats and activity charts |
| **Reports** | Report queue for posts, comments, messages and users: dismiss, review or take action |
| **Posts** | Browse all posts, hide / restore |
| **Comments** | Browse all comments, hide / restore |
| **Abuse flags** | Posts flagged by the automatic spam / abuse filters |
| **Users** | Search accounts, see details, ban / unban, verify, reset abuse score, revoke sessions, reset 2FA, change roles, edit moderator permissions, delete accounts |
| **Media** | Browse uploaded photos and videos, delete files |
| **Feedback** | Inbox for "Report a problem" messages from users |
| **Identity lookup** | Unmask the author of an anonymous post (see below) |
| **Audit logs** | Read the staff audit log and verify its integrity |
| **Settings** | Site-wide branding, feature toggles (for example anonymous posting), limits, moderation rules, maintenance mode |
| **Account** | Your own staff account and two-factor setup |

### Identity lookup (unmasking anonymous authors)
This is the most sensitive feature, and it has several safeguards:

- Admin only
- Needs a **written reason** of at least 10 characters
- Needs an **MFA code** when 2FA is turned on (and admins are strongly encouraged to turn it on)
- Needs an explicit confirmation that the action is permanently logged
- The backend writes the audit entry **before** decrypting, so every attempt is recorded, including failed ones

### Tamper-evident audit log
Every staff action is recorded in a hash-chained, HMAC-signed log. From the **Audit logs** page, an admin can verify the whole chain or a single entry. If any past record was changed or removed, verification fails.

---

## Project structure

```
src/
├── app/
│   ├── login/                 # Staff sign-in
│   └── (panel)/               # Pages behind the sidebar layout
│       ├── page.tsx           # Dashboard
│       ├── reports/  posts/  comments/  abuse/
│       ├── users/  media/  feedback/
│       ├── identity/  audit-logs/
│       ├── settings/  account/
│       └── layout.tsx         # Sidebar + auth / permission gate
├── components/
│   ├── admin/                 # app sidebar, permissions editor, shared admin pieces
│   ├── common/                # theme picker
│   └── ui/                    # shadcn/ui components
├── hooks/
├── lib/                       # api client, socket, theme, types
└── providers/
```

---

## Getting started

### Requirements
- Node.js 20+
- The **DualSphere backend** running (by default at `http://localhost:4000`)
- A staff account. The backend's seed script (`npm run db:seed`) creates the first admin from that repo's `.env`.

### Setup

```bash
# 1. Install dependencies
npm install

# 2. Create your local environment file
cp .env.example .env.local

# 3. Start the dev server (port 3001)
npm run dev
```

Open http://localhost:3001 and sign in with a staff account.

### Environment variables

Set these in `.env.local`. They are public, browser-side values. **Never put secrets here.**

| Variable | Purpose |
| --- | --- |
| `NEXT_PUBLIC_API_URL` | Backend API base URL |
| `NEXT_PUBLIC_FRONTEND_URL` | URL of the user-facing web app (used for "view on site" links) |

> `.env.local` is gitignored. Only `.env.example` is committed.

### Scripts

| Command | Description |
| --- | --- |
| `npm run dev` | Start the dev server on port 3001 |
| `npm run build` | Production build |
| `npm start` | Serve the production build on port 3001 |
| `npm run lint` | Run ESLint |

---

## Security notes

- Auth uses HttpOnly cookies issued by the backend, so the panel never stores tokens in JavaScript.
- The backend's `CORS_ORIGINS` must include this panel's URL.
- In production, serve the panel from its own subdomain, turn on 2FA for every staff account, and give moderators only the permissions they need.
