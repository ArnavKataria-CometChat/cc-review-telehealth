# Telehealth Consult Platform — Backend API

Backend service for a telehealth consult platform where **patients** book video
consults with **doctors**, **staff** coordinate scheduling, and **admins** oversee
clinics. This is the **Phase A baseline**: the full domain + RBAC, with **no chat or
calling** yet. The seams where CometChat plugs in later are documented but unbuilt.

- **Stack:** Node.js + Express + TypeScript (strict)
- **Auth:** email/password → JWT session carrying a stable `{ userId, role }`
- **Storage:** in-memory repository, seeded at boot (swap for a DB by editing
  `src/db/store.ts` only)
- **Build gate:** `docker build` (this component ships as a container)

---

## Roles & access (RBAC)

Every `/api` route below `/auth/login` requires a valid Bearer token. Role is
enforced per-route with `authenticate` + `authorize(...)` middleware.

| Role | Can |
| --- | --- |
| **patient** | Browse doctors, view own open slots, **book**, view/cancel own appointments, join own consult, read own notes |
| **doctor** | See own schedule & appointments, run consults (`in_progress` → `completed`), **write consult notes** |
| **staff** | Manage doctor slots (create/close), **reassign/reschedule** appointments, cancel — **no clinical notes** |
| **admin** | Clinic + user CRUD, **full audit log** — read-only on notes/conversations, never a clinical author |

---

## Domain model

`User(id, role, name, email)` · `Clinic(id, name, address)` ·
`Doctor(userId, specialty, clinicId)` · `Patient(userId, mrn, dob)` ·
`Slot(id, doctorId, startsAt, durationMin, status)` ·
`Appointment(id, patientId, doctorId, slotId, status, reason)` ·
`ConsultationNote(id, appointmentId, doctorId, body, createdAt)`

Appointment status machine: `scheduled → in_progress → completed`, with
`scheduled|in_progress → cancelled`. Transitions are role-gated (only the treating
doctor/admin runs a consult; patient/doctor/staff can cancel).

---

## API

Base path: `/api`. All responses are JSON. Errors use
`{ "error": { "code, message } }`.

| Method & path | Role(s) | Purpose |
| --- | --- | --- |
| `POST /auth/login` | public | Login → `{ token, user }` |
| `GET  /users/me` | any | Current identity + role profile |
| `GET  /doctors?specialty=&clinicId=` | any | Browse/filter doctors |
| `GET  /doctors/:id/slots?status=open` | any | A doctor's slots |
| `POST /doctors/:id/slots` | staff, admin | Create a schedule slot |
| `POST /doctors` | admin | Link a doctor-user to clinic/specialty |
| `PATCH /slots/:id` | staff, admin | Open/close a slot |
| `POST /appointments` | patient | Book an open slot |
| `GET  /appointments?status=` | any | **Role-scoped** list (patient→own, doctor→own, staff/admin→all) |
| `GET  /appointments/:id` | participants, staff, admin | Appointment detail |
| `PATCH /appointments/:id` | role-gated | Status change / reassign / reschedule |
| `POST /appointments/:id/notes` | treating doctor | Write consult note |
| `GET  /appointments/:id/notes` | participants, staff, admin | Read notes (staff/admin read-only) |
| `GET  /clinics` | admin | List clinics |
| `POST /clinics` · `PATCH /clinics/:id` · `DELETE /clinics/:id` | admin | Clinic CRUD |
| `GET  /admin/users?role=` | admin | User directory |
| `POST /admin/users` | admin | Create doctor/staff/patient/admin |
| `GET  /admin/audit?limit=` | admin | Audit trail |
| `GET  /health` | public | Liveness probe |

---

## Configuration

Copy `.env.example` → `.env`. No secrets are hardcoded.

| Var | Default | Notes |
| --- | --- | --- |
| `PORT` | `4000` | HTTP port |
| `NODE_ENV` | `development` | |
| `CORS_ORIGIN` | `*` | Comma-separated origins, or `*` |
| `JWT_SECRET` | dev fallback | **Set in production.** If unset in prod, an ephemeral random secret is minted (sessions won't survive a restart) |
| `JWT_EXPIRES_IN` | `12h` | Token lifetime |
| `BCRYPT_ROUNDS` | `10` | Password hash cost |
| `SEED_PASSWORD` | `Passw0rd!` | Password for all seeded demo accounts |

CometChat placeholders (`COMETCHAT_*`) are listed in `.env.example` for Phase B and
are **not** used yet.

---

## Run locally

```bash
npm install
cp .env.example .env      # optional; sensible defaults work out of the box
npm run dev               # hot-reload dev server on http://localhost:4000
# or
npm run build && npm start
```

## Run with Docker

```bash
docker build -t telehealth-backend .
docker run --rm -p 4000:4000 -e JWT_SECRET=please-change-me telehealth-backend
```

## Verify (build gate)

```bash
./verify.sh               # npm ci → typecheck → build → docker build; non-zero on any failure
```

---

## Seeded demo accounts

All use the `SEED_PASSWORD` (default `Passw0rd!`).

| Role | Email |
| --- | --- |
| admin | `admin@telehealth.test` |
| staff | `staff@telehealth.test` |
| doctor | `house@telehealth.test`, `grey@telehealth.test` |
| patient | `patient@telehealth.test`, `robin@telehealth.test` |

### Quick smoke (patient books, doctor consults)

```bash
BASE=http://localhost:4000
TOK=$(curl -s -X POST $BASE/api/auth/login -H 'content-type: application/json' \
  -d '{"email":"patient@telehealth.test","password":"Passw0rd!"}' | jq -r .token)
curl -s $BASE/api/users/me -H "authorization: Bearer $TOK" | jq
curl -s "$BASE/api/doctors?specialty=Diagnostics" -H "authorization: Bearer $TOK" | jq
```

---

## Project layout

```
src/
  app.ts              Express app factory (CORS, JSON, logging, error handling)
  index.ts            Entrypoint: seed + listen
  config.ts           Env-based config
  auth/               password (bcrypt) + JWT session sign/verify
  middleware/         authenticate, authorize, error handler, HttpError
  domain/             entity types + response views
  db/                 in-memory store + seed
  routes/             auth, users, doctors, slots, appointments, clinics, admin
  services/           audit log
```

---

## Phase B seam (CometChat — not implemented here)

The spec calls for 1:1 chat + video on the **appointment detail** screen, scoped to
that appointment's **patient and doctor**. This baseline deliberately leaves it
unbuilt but ready:

- Each `User` already has a stable server-side `id` + `role` to map to a CometChat
  user.
- `appointmentView` returns `participants: [patientId, doctorId]` — the exact 1:1
  conversation scope.
- Secrets belong in backend env (`COMETCHAT_*` placeholders in `.env.example`); the
  frontend will log in with a backend-issued CometChat auth token.
- Staff = coordination/system messages only; admin = read-only metadata audit.

**No chat SDKs, websockets, or CometChat code are present in Phase A.**
