# Telehealth Consult Platform — iOS App

Native **SwiftUI** client for the telehealth consult platform: patients book video
consults with doctors, clinic **staff** coordinate scheduling, and **admins** oversee
clinics. Full domain + role-based access control (RBAC). **Phase B** adds **CometChat
1:1 chat + voice/video calling** on the appointment detail screen, scoped to that
appointment's patient ↔ doctor pair.

- **Stack:** Swift 5 / SwiftUI, iOS 17+
- **Chat/calling:** CometChat iOS UI Kit (`CometChatUIKitSwift ~> 5.1`) + Calls SDK,
  via **CocoaPods** (see [Dependencies](#dependencies-cocoapods))
- **Networking:** `async/await` `URLSession` against the Express backend (`../backend`)
- **Auth:** email/password → JWT; the token is attached as a Bearer header on every
  authenticated request and persisted so a warm launch skips login. CometChat login
  uses a **backend-minted auth token** — no CometChat secret ships in the app
- **Build gate:** `./verify.sh` → `xcodebuild -workspace Telehealth.xcworkspace
  -sdk iphonesimulator build` (simulator, no code-signing)

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
| `POST /cometchat/token` | any | Provision caller's CometChat user + mint auth token |
| `GET  /cometchat/appointments/:id/chat` | patient/doctor (403 staff) | RBAC-scoped consult chat/call access |

**CometChat endpoints (Phase B).** The iOS client never holds a CometChat secret.

- `POST /cometchat/token` → `{ uid, authToken, appId, region }`. The UID is derived
  server-side from the session (a caller can only mint a token for themselves); the
  backend provisions/syncs the CometChat user carrying the app role, then mints a
  short-lived auth token. `appId`/`region` are non-secret client bootstrap values.
- `GET /cometchat/appointments/:id/chat` → for the appointment's **patient**/**doctor**:
  `{ appointmentId, self:{uid,role}, peer:{uid,role,name,appointmentId}, canChat:true,
  canCall:true }`; for **admin**: `{ audit:true, canChat:false, canCall:false,
  participants:[…] }` (metadata only, not a participant); **staff** → `403`. The client
  points a 1:1 conversation/call at `peer.uid` only when `canChat`/`canCall`.

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
2. **Install pods and open the workspace** (first checkout only for `pod install`):
   ```bash
   pod install
   open Telehealth.xcworkspace   # NOT the .xcodeproj
   ```
   Then press ⌘R. Or build from the command line:
   ```bash
   xcodebuild -workspace Telehealth.xcworkspace -scheme Telehealth \
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
any failure — the native gate for the `ios/` component. It runs `pod install` if the
Pods aren't present, then builds the workspace:

```bash
xcodebuild -workspace Telehealth.xcworkspace -scheme Telehealth \
  -sdk iphonesimulator -configuration Debug \
  -destination 'generic/platform=iOS Simulator' \
  CODE_SIGNING_ALLOWED=NO build
```

---

## Dependencies (CocoaPods)

Phase B introduces the CometChat SDKs via **CocoaPods**, so the build gate now builds
`Telehealth.xcworkspace`. `Pods/` and the generated workspace are gitignored; `Podfile`
+ `Podfile.lock` are committed and `verify.sh` runs `pod install` on demand.

```ruby
pod 'CometChatUIKitSwift', '~> 5.1'   # chat UI kit (pulls CometChatSDK ~> 4.1)
pod 'CometChatStarscream', :podspec => 'CometChatStarscream.podspec'  # see below
pod 'CometChatCardsSwift', '~> 1.1'   # see below
pod 'CometChatCallsSDK',   '~> 5.0'   # voice/video (pulls CometChatWebRTC)
```

> **Why CocoaPods and not SwiftPM, and why the two extra pods:** the 5.1.16 UI Kit's
> binary hard-imports `CometChatCardsSwift`, and `CometChatSDK 4.1.6` hard-imports
> `CometChatStarscream` — but **neither the SwiftPM package nor the pods declare/ship
> those transitive modules**. The SwiftPM `cometchat-uikit-ios` package is a single
> binary target with no dependency on either, so a SwiftPM install fails to compile;
> and `CometChatCardsSwift` has no SwiftPM package at all. CocoaPods gets us closest,
> but still needs `CometChatCardsSwift` added explicitly and `CometChatStarscream`
> vendored from a local podspec (its framework is absent from the CometChatSDK pod
> download). With those two additions the workspace builds green.

## Chat & calling (CometChat — implemented)

Phase B adds **1:1 chat + voice/video** on the **appointment detail** screen, scoped to
that appointment's **patient ↔ doctor** pair. Flow:

1. `AppointmentDetailView` → **Consult Room** section (shown only to patient/doctor
   participants) hosts `ConsultRoomView`.
2. `ConsultRoomView` → `ConsultRoomLiveView` fetches `GET /cometchat/appointments/:id/chat`
   for the RBAC-scoped `peer` + `canChat`/`canCall` flags.
3. `CometChatService` (`Chat/CometChatService.swift`) fetches `POST /cometchat/token`,
   initializes the UI Kit once with the backend-provided App ID + Region (**no auth key
   shipped**), and logs in with `login(authToken:)`.
4. The peer `User` is resolved via `CometChat.getUser(UID: peer.uid)`, then:
   - **Chat** — `ConsultChatView` presents a `MessagesVC` composing
     `CometChatMessageHeader` + `CometChatMessageList` + `CometChatMessageComposer`.
   - **Call** — `ConsultCallBar` hosts `CometChatCallButtons` (voice + video) for the
     peer; `enable(inAppIncomingCall: true)` turns on the kit's foreground incoming-call
     UI. `Info.plist` carries camera/mic usage strings + `audio`/`voip`/`remote-notification`
     background modes.

RBAC → CometChat mapping (enforced server-side; the client only reflects it):

- **patient/doctor** — may converse/call **only** with the appointment counterpart.
- **staff** — no clinical chat (backend returns `403`; the section is hidden for them).
- **admin** — audit-only metadata, not a participant (no consult room shown).

All CometChat-touching code is under `Telehealth/Chat/` and guarded by
`#if canImport(CometChatUIKitSwift)`, so the sources still compile if the pods are
absent (chat degrades to a build hint). Sign-out tears the CometChat session down via
`CometChatService.disconnect()`.
