# Telehealth — baseline app

A **telehealth** platform (patients, doctors, appointments/consultations, support), built as a **baseline** for the CometChat skills/docs review. This `main` branch is the app **before** any CometChat integration — the comparison base for `feature/cometchat-integration`.

## Roles
`patient` · `doctor` · `support` · `admin` — each role sees only its own surfaces (UI RBAC mirrors backend route guards). Seeded with demo users and consultations.

## Stack
| Platform | Tech |
|---|---|
| Web | React |
| Android | Kotlin |
| iOS | Swift / SwiftUI |
| Backend | Node.js |

## Branches
- **`main`** — baseline (this branch): telehealth only, no chat/calling.
- **`feature/cometchat-integration`** — adds CometChat chat + voice/video calling for patient↔doctor consultations.

## About this review
This repo is part of an automated **CometChat skills review**: an agent integrates CometChat into the baseline using CometChat's published skills/docs, and the review records every skill/docs/SDK gap that surfaced.
Findings deliverable → **ArnavKataria-CometChat/cc-review-reports** (`telehealth/`).
