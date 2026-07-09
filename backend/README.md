# Telehealth Consult Platform — Backend API

Backend service for a telehealth consult platform where **patients** book video
consults with **doctors**, **staff** coordinate scheduling, and **admins** oversee
clinics. The full domain + RBAC, plus **Phase B CometChat** server-side integration:
mapping app users → CometChat users and minting per-user auth tokens, with
appointment-scoped 1:1 chat/call access (see [Phase B](#phase-b--cometchat-integration-server-side)).

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
| `POST /admin/users` | admin | Create doctor/staff/patient/admin (also provisions a CometChat user) |
| `GET  /admin/audit?limit=` | admin | Audit trail |
| `GET  /cometchat/config` | any | Non-secret client bootstrap: `{ configured, appId, region }` |
| `POST /cometchat/token` | any | Provision/sync the caller's CometChat user + mint their auth token |
| `GET  /cometchat/appointments/:id/chat` | role-scoped | 1:1 chat/call context for an appointment (see Phase B below) |
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

### CometChat (Phase B)

| Var | Where | Notes |
| --- | --- | --- |
| `COMETCHAT_APP_ID` | server + safe for clients | Returned by `GET /cometchat/config` |
| `COMETCHAT_REGION` | server + safe for clients | `us` \| `eu` \| `in` |
| `COMETCHAT_AUTH_KEY` | not used by backend | Client/dev convenience key; kept in env only |
| `COMETCHAT_REST_API_KEY` | **server only** | fullAccess scope — mints tokens + user CRUD. Never sent to clients or committed |

If these are empty the backend still builds and runs; the CometChat routes return
`503 cometchat_not_configured` until they are set. `.env` is gitignored.

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
  routes/             auth, users, doctors, slots, appointments, clinics, admin, cometchat
  services/           audit log, cometchat (REST client: user sync + token mint)
```

---

## Phase B — CometChat integration (server-side)

The spec calls for 1:1 chat + video on the **appointment detail** screen, scoped to
that appointment's **patient and doctor**. The backend owns the server-side half:
mapping app users → CometChat users and minting auth tokens. **The REST API Key
never leaves the server** — clients receive only App ID, Region, and a per-user
token, and log in with `CometChatUIKit.loginWithAuthToken(token)`.

### Token + user provisioning

- **`POST /cometchat/token`** — derives the UID from the verified session (never the
  request body), idempotently creates/syncs the caller's CometChat user, and returns
  `{ uid, authToken, appId, region }`. The app role is carried on the CometChat user
  via `metadata.appRole` + `tags` (the built-in `role` field is dashboard-gated and
  rejects arbitrary values).
- Admin user-creation also provisions a CometChat user (best-effort, non-blocking).
- No credentials → routes return `503 cometchat_not_configured`; the rest of the API
  is unaffected.

### RBAC → CometChat conversation scoping

`GET /cometchat/appointments/:id/chat` enforces exactly who may converse/call:

| Caller | Result |
| --- | --- |
| **patient** (the appointment's own) | `200` — `peer` = the booked doctor, `canChat/canCall: true` |
| **doctor** (the appointment's own) | `200` — `peer` = the patient, `canChat/canCall: true` |
| **staff** | `403` — no clinical chat |
| **admin** | `200` — read-only audit metadata (`participants`, `canChat/canCall: false`) |
| patient/doctor who isn't a participant | `403` |

The conversation is implicitly scoped per appointment: the two participant UIDs are
the app user ids, so the client points a 1:1 conversation at exactly the returned
`peer`. Calling reuses the same participant pair.

`appointmentView` still returns `participants: [patientId, doctorId]` for the
appointment-detail screen. Implementation lives in `src/services/cometchat.ts` +
`src/routes/cometchat.ts`; no chat SDK/websocket runs inside this backend — the
clients hold the realtime connection.
