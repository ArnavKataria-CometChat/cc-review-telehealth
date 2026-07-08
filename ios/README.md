# Telehealth Consult Platform — iOS App

Native **SwiftUI** client for the telehealth consult platform: patients book video
consults with doctors, clinic **staff** coordinate scheduling, and **admins** oversee
clinics. This is the **Phase A baseline** — the full domain + role-based access
control (RBAC), with **no chat or calling** yet. The screen where CometChat will plug
in (appointment detail) is built as an explicit, disabled placeholder so Phase B is a
drop-in.

- **Stack:** Swift 5 / SwiftUI, iOS 17+, no third-party dependencies
- **Networking:** `async/await` `URLSession` against the Express backend (`../backend`)
- **Auth:** email/password → JWT; the token is attached as a Bearer header on every
  authenticated request and persisted so a warm launch skips login
- **Build gate:** `xcodebuild -sdk iphonesimulator build` (simulator, no code-signing)

---

## Roles & access (RBAC)

The client mirrors the backend's per-route RBAC: after login the app routes to a
role-specific home, and every screen only exposes actions the caller's role is
allowed to perform. The backend remains the source of truth and re-checks every
request.

| Role | Sees / can do in the app |
| --- | --- |
| **patient** | Browse doctors (filter by specialty), pick an open slot, **book**, view own appointments, cancel a scheduled visit, read own consult notes |
| **doctor** | Own schedule, appointment detail, **start → complete** a consult, **write consult notes** |
| **staff** | All appointments, **reassign/reschedule**, cancel, **slot manager** (create/close slots) — no clinical notes |
| **admin** | Clinics CRUD, user directory + create, **audit log** — read-only on notes |

---

## Architecture

```
Telehealth/
  App/
    TelehealthApp.swift        @main; owns SessionStore, runs bootstrap()
  Core/
    Models.swift               Codable models mirroring the backend view shapes
    AppConfig.swift            Base URL from Info.plist / env (no hard-coded secrets)
    APIError.swift             Backend error envelope → typed APIError
    APIClient.swift            async URLSession wrapper (auth header, JSON, 401 handling)
    Endpoints.swift            One typed method per REST route + request/response DTOs
    SessionStore.swift         @MainActor auth state + top-level routing phase
    Formatting.swift           ISO-8601 date parsing/formatting helpers
  Views/
    RootView.swift             Routes: loading → login → role home
    Common/UIComponents.swift  Badges, loading/empty/error states, AsyncButton
    Auth/LoginView.swift       Email/password + one-tap demo accounts
    Patient/                   Browse doctors → slots → book → my appointments
    Doctor/                    My schedule (reuses the shared appointments list)
    Staff/                     All appointments + slot manager
    Admin/                     Clinics, Users, Audit
    Shared/                    AppointmentDetailView (the Phase B seam), reassign,
                               reusable appointment list/row, profile
  Assets.xcassets/             App icon + accent color
  Info.plist                   Bundle config, ATS local-networking, APIBaseURL
```

The Xcode project uses a **file-system-synchronized group**, so any `.swift` file
added under `Telehealth/` is compiled automatically — no `project.pbxproj` edits.

---

## Backend REST contract (expected)

Base URL defaults to `http://localhost:4000/api` (the local `../backend`). All
authenticated requests send `Authorization: Bearer <token>`. Errors use the envelope
`{ "error": { "code", "message", "details"? } }`. This is the exact contract the app
is coded against:

| Method & path | Role(s) | Used by |
| --- | --- | --- |
| `POST /auth/login` | public | Login screen |
| `GET  /users/me` | any | Session bootstrap, profile |
| `GET  /doctors?specialty=&clinicId=` | any | Patient browse, pickers |
| `GET  /doctors/:id/slots?status=open` | any | Doctor detail, booking |
| `POST /doctors/:id/slots` | staff, admin | Slot manager (create) |
| `PATCH /slots/:id` | staff, admin | Slot manager (open/close) |
| `POST /appointments` | patient | Booking |
| `GET  /appointments?status=` | any (role-scoped) | Every appointments list |
| `GET  /appointments/:id` | participants, staff, admin | Appointment detail |
| `PATCH /appointments/:id` | role-gated | Status transitions, reassign/reschedule |
| `POST /appointments/:id/notes` | treating doctor | Write consult note |
| `GET  /appointments/:id/notes` | participants, staff, admin | Read notes |
| `GET  /clinics` · `POST` · `PATCH /:id` · `DELETE /:id` | admin | Clinics CRUD |
| `GET  /admin/users?role=` · `POST /admin/users` | admin | User directory + create |
| `GET  /admin/audit?limit=` | admin | Audit log |

Appointment status machine (enforced by the backend, reflected in the UI's
available actions): `scheduled → in_progress → completed`, with
`scheduled|in_progress → cancelled`.

---

## Configuration (no hard-coded secrets)

The backend base URL is resolved from the environment, in order of precedence:

1. `API_BASE_URL` launch environment variable (set a scheme env var or pass on the
   `xcodebuild`/`simctl` command line) — handy for pointing at staging.
2. The **`APIBaseURL`** key in `Info.plist` (default `http://localhost:4000/api`).

There are **no secrets in the app**. Phase B's CometChat credentials live in the
backend env; the app will fetch a backend-issued CometChat auth token at that point.

> **App Transport Security:** the Phase A backend serves plain HTTP on `localhost`.
> `Info.plist` enables `NSAllowsLocalNetworking` so the Simulator can reach it.
> Production should use HTTPS.

---

## Run locally

1. **Start the backend** (see `../backend/README.md`):
   ```bash
   cd ../backend && npm install && npm run dev   # http://localhost:4000
   ```
2. **Open the app** in Xcode and run on any iOS 17+ Simulator:
   ```bash
   open Telehealth.xcodeproj
   ```
   Then press ⌘R. Or build & launch from the command line:
   ```bash
   xcodebuild -project Telehealth.xcodeproj -scheme Telehealth \
     -sdk iphonesimulator -configuration Debug \
     -destination 'platform=iOS Simulator,name=iPhone 16' \
     CODE_SIGNING_ALLOWED=NO build
   ```
3. **Sign in** with a seeded demo account (one tap on the login screen). All share
   the password `Passw0rd!`:

   | Role | Email |
   | --- | --- |
   | patient | `patient@telehealth.test` |
   | doctor | `house@telehealth.test` |
   | staff | `staff@telehealth.test` |
   | admin | `admin@telehealth.test` |

> Running in the Simulator, `localhost` resolves to the host Mac, so the default base
> URL reaches the local backend with no extra setup.

---

## Verify (build gate)

```bash
./verify.sh
```

Builds the app for the iOS Simulator **without code-signing** and exits non-zero on
any failure — the native gate for the `ios/` component:

```bash
xcodebuild -project Telehealth.xcodeproj -scheme Telehealth \
  -sdk iphonesimulator -configuration Debug \
  CODE_SIGNING_ALLOWED=NO build
```

---

## Phase B seam (CometChat — not implemented here)

Per the spec, Phase B adds **1:1 chat + video** on the **appointment detail** screen,
scoped to that appointment's **patient and doctor**. This baseline deliberately
leaves it unbuilt but ready:

- `AppointmentDetailView` renders a **Consult Room** section with disabled
  *Join Video Call* / *Open Chat* buttons — the exact injection point. It is shown
  only to the two participants (patient/doctor); staff and admin never see it.
- Every `PublicUser` carries a stable server-side `id` + `role` to map onto a
  CometChat user.
- The appointment view's `participants: [patientId, doctorId]` array is the precise
  1:1 conversation scope.
- **staff** = coordination/system messages only; **admin** = read-only metadata audit
  (already reflected in the read-only notes/audit screens).

**No chat SDKs, websockets, or CometChat code are present in Phase A.**
