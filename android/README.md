# Telehealth Consult — Android client (Phase A)

Native Android app for the telehealth consult platform: **patients** book video
consults with **doctors**, **staff** coordinate scheduling, and **admins** oversee
clinics. This is the **Phase A baseline** — the full domain + role-based access
control, with **no chat or calling** yet. The appointment-detail screen contains a
clearly-marked, deliberately-unbuilt seam where CometChat 1:1 video + chat plugs in
during Phase B.

- **Stack:** Kotlin · Jetpack Compose (Material 3) · Navigation-Compose
- **Networking:** OkHttp + kotlinx.serialization (no chat/websocket SDKs)
- **State:** ViewModel-less lightweight composables (`rememberAsync` / `ActionState`)
  over a single repository; session persisted so a valid token survives restart
- **DI:** a small manual `AppContainer` (no Hilt) provided via a CompositionLocal
- **Backend:** talks to `../backend` (Node/Express, TypeScript) over its `/api` REST

---

## Roles & screens (client-side RBAC)

The backend enforces RBAC on every route; the app mirrors it by only registering
the destinations each role may reach (see `ui/AppNavHost.kt`).

| Role | Screens |
| --- | --- |
| **patient** | Find Care (browse/filter doctors) → open slots → **book** · My Appointments → appointment detail (join-consult seam) |
| **doctor** | My Schedule (own appointments) → appointment detail → **write consult note** · start/complete consult |
| **staff** | All appointments → **reassign/reschedule**, cancel · Slot manager (create / open / close slots) — no clinical notes |
| **admin** | Clinics CRUD · Users directory + create (role-mapped) · Audit log (read-only) |

---

## Backend REST contract (expected)

Base URL: **`{API_BASE_URL}`** (default `http://10.0.2.2:4000/api/` — the emulator's
alias for the host machine). All routes except login require
`Authorization: Bearer <token>`; errors use `{ "error": { code, message } }`.

| Method & path | Used by |
| --- | --- |
| `POST /auth/login` | Login → `{ token, user }` |
| `GET  /users/me` | Current identity + role profile |
| `GET  /doctors?specialty=&clinicId=` | Browse doctors |
| `GET  /doctors/:id/slots?status=open` | A doctor's slots |
| `POST /doctors/:id/slots` | Staff/admin create a slot |
| `PATCH /slots/:id` | Staff/admin open/close a slot |
| `POST /appointments` | Patient books an open slot |
| `GET  /appointments?status=` | Role-scoped list |
| `GET  /appointments/:id` | Appointment detail |
| `PATCH /appointments/:id` | Status change / reassign / reschedule |
| `POST /appointments/:id/notes` | Treating doctor writes a note |
| `GET  /appointments/:id/notes` | Participants + staff/admin (read-only) |
| `GET  /clinics` · `POST/PATCH/DELETE /clinics/:id` | Admin clinic CRUD |
| `GET  /admin/users?role=` · `POST /admin/users` | Admin user directory + create |
| `GET  /admin/audit?limit=` | Admin audit trail |

DTOs in `data/model/Models.kt` mirror the backend response "views" one-to-one;
unknown JSON keys are ignored, so additive backend changes won't break decoding.

---

## Configuration

The API base URL is the only knob. It is compiled into `BuildConfig.API_BASE_URL`
and is overridable **without editing source** — no secrets are hardcoded:

```bash
# Gradle property (per invocation or in ~/.gradle/gradle.properties):
./gradlew assembleDebug -PtelehealthApiBaseUrl=http://10.0.2.2:4000/api/

# or environment variable:
export TELEHEALTH_API_BASE_URL=http://192.168.1.20:4000/api/
```

| Target | Base URL |
| --- | --- |
| Android **emulator** (default) | `http://10.0.2.2:4000/api/` |
| **Physical device** | `http://<your-machine-LAN-IP>:4000/api/` |

Cleartext HTTP is permitted **only** for `10.0.2.2` / `localhost` / `127.0.0.1`
(see `res/xml/network_security_config.xml`) so local dev works while production
traffic stays HTTPS-only.

---

## Build & run

Prerequisites: JDK 17, `ANDROID_HOME` with SDK platform 35/36 + build-tools. The
Gradle wrapper pins Gradle/AGP/Kotlin — no local Gradle install needed.

```bash
# 1. Start the backend first (separate component):
cd ../backend && npm install && npm run dev      # http://localhost:4000

# 2. Build the debug APK (this is also the verify gate):
cd ../android
./gradlew :app:assembleDebug
#   → app/build/outputs/apk/debug/app-debug.apk

# 3. Install & launch on a running emulator/device:
./gradlew installDebug
adb shell am start -n com.telehealth.consult/.MainActivity
```

> On the emulator the default `10.0.2.2` reaches the backend on your host. On a
> physical device, pass your machine's LAN IP via `-PtelehealthApiBaseUrl`.

### Demo accounts (seeded by the backend)

All use password **`Passw0rd!`** (tap a row on the login screen to auto-fill):

| Role | Email |
| --- | --- |
| admin | `admin@telehealth.test` |
| staff | `staff@telehealth.test` |
| doctor | `house@telehealth.test`, `grey@telehealth.test` |
| patient | `patient@telehealth.test`, `robin@telehealth.test` |

---

## Verify (build gate)

```bash
./verify.sh      # runs ./gradlew :app:assembleDebug; exits non-zero on failure
```

---

## Project layout

```
app/src/main/java/com/telehealth/consult/
  TelehealthApp.kt          Application → builds AppContainer
  MainActivity.kt           Compose host
  di/AppContainer.kt        Manual DI (session, ApiClient, repository)
  data/
    model/Models.kt         Serializable DTOs mirroring the backend views
    ApiClient.kt            OkHttp + kotlinx.serialization transport
    ApiException.kt         Normalised error type (maps the error envelope)
    SessionStore.kt         Persistent {token, user} + observable session
    TelehealthRepository.kt Typed suspend fn per REST endpoint
  ui/
    AppRoot.kt              Auth gate: login vs role shell
    MainScaffold.kt         Role-based bottom nav + top bar (logout)
    AppNavHost.kt           Registers only role-permitted destinations
    Routes.kt               Route table
    theme/                  Material 3 theme
    common/                 Async loaders, LocalContainer, shared components
    auth/                   LoginScreen
    patient/ doctor/ staff/ admin/   role screens
    appointment/            shared detail + list + card (Phase B seam here)
```

---

## Phase B seam (CometChat — not implemented here)

The spec puts 1:1 **video + chat** on the **appointment detail** screen, scoped to
that appointment's **patient and doctor**. This baseline leaves it unbuilt but ready:

- Every `PublicUser` already carries a stable server-side `id` + `role` to map to a
  CometChat user.
- `AppointmentView.participants` is exactly `[patientId, doctorId]` — the 1:1
  conversation scope — surfaced on the detail screen.
- The detail screen shows a disabled **"Join consult (Phase B)"** affordance for
  participants; **staff** see a "coordination only" note and **admin** a "read-only
  audit" note (never chat participants).
- Secrets (CometChat app id / region / auth key) will live in **backend env**; the
  app will log in with a **backend-issued CometChat auth token** — no chat secrets
  in the client.

**No chat SDKs, websockets, or CometChat code are present in Phase A.**
