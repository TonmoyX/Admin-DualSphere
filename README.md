# DualSphere — Admin Panel

The staff dashboard for **DualSphere**, a social network with both identity-based and anonymous posting. Admins and moderators use it to moderate content, manage users, configure the platform and run audited security actions.

This repo is one of three:

| Repo | What it is |
| --- | --- |
| **Admin** (this repo) | The staff / moderation panel (Next.js) |
| Frontend | The user-facing Next.js web app |
| Backend | Express API, PostgreSQL, Socket.io |

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

## Sensitive features

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

## Getting started

### Requirements
- Node.js 20+
- The **DualSphere backend** running
- A staff account. The backend's seed script (`npm run db:seed`) creates the first admin from that repo's `.env`.

### Environment variables

Set these in `.env.local`. They are public, browser-side values. **Never put secrets here.**

| Variable | Purpose |
| --- | --- |
| `NEXT_PUBLIC_API_URL` | Backend API base URL |
| `NEXT_PUBLIC_FRONTEND_URL` | URL of the user-facing web app (used for "view on site" links) |

> `.env.local` is gitignored. Only `.env.example` is committed.

---

## Security notes

- Auth uses HttpOnly cookies issued by the backend, so the panel never stores tokens in JavaScript.
- The backend's `CORS_ORIGINS` must include this panel's URL.
- In production, serve the panel from its own subdomain, turn on 2FA for every staff account, and give moderators only the permissions they need.
