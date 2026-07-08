# Telehealth Consult Platform — Web Portal

Next.js (App Router, TypeScript) web portal for the telehealth consult platform,
where **patients** book video consults with **doctors**, **staff** coordinate
scheduling, and **admins** oversee clinics. This is the **Phase A baseline**: the
full domain + RBAC UI over the backend API, with **no chat or calling** yet. The
appointment-detail screen carries a visible seam where CometChat plugs in later.

- **Stack:** Next.js 14 (App Router) · React 18 · TypeScript (strict)
- **Auth:** email/password → the backend issues a JWT carrying a stable
  `{ userId, role }`; the portal persists it and guards every screen by role
- **Backend:** the sibling `../backend` Express service (see its README)
- **Build gate:** `docker build` (this component ships as a container)

---

## Roles & screens (RBAC)

Every screen is wrapped in a client-side `<Guard>` that redirects anonymous users
to `/login` and blocks the wrong role — **defence in depth on top of the
backend**, which independently enforces RBAC on every route.

| Role | Home | Screens |
| --- | --- | --- |
| **patient** | `/doctors` | Find a doctor (filter → open slots → **book**), My Appointments, appointment detail (cancel, join consult when in progress) |
| **doctor** | `/schedule` | My Schedule (by day) + patient roster, appointment detail (start/complete consult, **write notes**) |
| **staff** | `/slots` | Slot Manager (create / open / close slots), Appointments, **reassign/reschedule** on the detail screen |
| **admin** | `/admin` | Clinics + Users CRUD, Appointments (all), **Audit Log** (read-only) |

---

## REST contract (expected from `../backend`)

The portal calls `${NEXT_PUBLIC_API_BASE_URL}/api/...` with a
`Authorization: Bearer <token>` header. Errors use `{ error: { code, message } }`.

| Method & path | Role(s) | Used by |
| --- | --- | --- |
| `POST /api/auth/login` | public | Login |
| `GET  /api/users/me` | any | Session restore / identity |
| `GET  /api/doctors?specialty=&clinicId=` | any | Patient browse, staff/admin pickers |
| `GET  /api/doctors/:id/slots?status=open` | any | Booking, slot manager |
| `POST /api/doctors/:id/slots` | staff, admin | Slot manager |
| `PATCH /api/slots/:id` | staff, admin | Open/close slot |
| `POST /api/appointments` | patient | Book |
| `GET  /api/appointments?status=` | any | **Role-scoped** list |
| `GET  /api/appointments/:id` | participants, staff, admin | Detail |
| `PATCH /api/appointments/:id` | role-gated | Status transitions, reassign/reschedule |
| `POST /api/appointments/:id/notes` | treating doctor | Write consult note |
| `GET  /api/appointments/:id/notes` | participants, staff, admin | Read notes |
| `GET  /api/clinics` · `POST` · `PATCH /:id` · `DELETE /:id` | admin | Clinics CRUD |
| `GET  /api/admin/users?role=` · `POST /api/admin/users` | admin | Users directory + provisioning |
| `GET  /api/admin/audit?limit=` | admin | Audit log |

The typed client lives in [`src/lib/api.ts`](src/lib/api.ts); response shapes are
mirrored in [`src/lib/types.ts`](src/lib/types.ts).

---

## Project layout

```
web/
├─ src/
│  ├─ app/                     # App Router pages
│  │  ├─ layout.tsx            # AuthProvider + AppShell chrome
│  │  ├─ page.tsx              # role-aware redirect
│  │  ├─ login/                # email + password
│  │  ├─ doctors/              # patient: browse + book
│  │  ├─ appointments/         # list (role-scoped) + [id] detail
│  │  ├─ schedule/             # doctor: my schedule
│  │  ├─ slots/                # staff: slot manager
│  │  └─ admin/                # admin: clinics/users + audit
│  ├─ components/              # AppShell, Guard, ui primitives
│  └─ lib/                     # api client, types, auth context, formatters
├─ Dockerfile                  # multi-stage build → Next standalone runtime
├─ verify.sh                   # typecheck + docker build gate
└─ .env.example
```

---

## Configuration

Copy `.env.example` → `.env.local` and set:

| Var | Purpose |
| --- | --- |
| `NEXT_PUBLIC_API_BASE_URL` | Base URL of the backend (default `http://localhost:4000`). **Inlined at build time** (see Docker note). |

No secrets live in the web bundle. Phase B will add CometChat: the frontend logs
in with a **backend-issued** CometChat auth token; only non-secret values
(`NEXT_PUBLIC_COMETCHAT_APP_ID`, region) would ever reach the browser.

> **Build-time note.** `NEXT_PUBLIC_*` values are baked into the client bundle at
> build time. For Docker, pass `--build-arg NEXT_PUBLIC_API_BASE_URL=...`.

---

## Run locally

Start the backend first (see `../backend/README.md` — it seeds demo accounts):

```bash
cd ../backend && npm install && npm run dev      # http://localhost:4000
```

Then the web portal:

```bash
npm install
cp .env.example .env.local          # adjust NEXT_PUBLIC_API_BASE_URL if needed
npm run dev                         # http://localhost:3000
```

Sign in with a seeded demo account (the login screen lists them). All demo
accounts share the backend's `SEED_PASSWORD` (default `Passw0rd!`):

| Role | Email |
| --- | --- |
| admin | `admin@telehealth.test` |
| staff | `staff@telehealth.test` |
| doctor | `house@telehealth.test` |
| patient | `patient@telehealth.test` |

---

## Build & verify

```bash
# Type-check + Docker build gate (exits non-zero on any failure):
./verify.sh

# Or individually:
npm run typecheck                   # tsc --noEmit
npm run build                       # next build (standalone output)

# Docker:
docker build -t telehealth-web \
  --build-arg NEXT_PUBLIC_API_BASE_URL=http://localhost:4000 .
docker run --rm -p 3000:3000 telehealth-web
```

---

## Phase B seam (CometChat — not built here)

- **Where:** the **appointment detail** screen (`/appointments/[id]`) hosts a
  1:1 chat + video call scoped to exactly that appointment's **patient and
  doctor**. The "Join video consult" button (enabled while a consult is *in
  progress*) is the placeholder for it today.
- **Identity mapping:** each app user already has a stable server-side
  `{ userId, role }`; Phase B creates/syncs a CometChat user per app user
  carrying that role, and a patient may only converse/call with their booked
  doctor (and vice-versa).
- **staff:** no clinical chat — system/coordination messages only.
- **admin:** read-only audit of conversation metadata — never a participant.
- **Secrets:** stay in the backend env; the frontend authenticates to CometChat
  with a backend-issued auth token.
