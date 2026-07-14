# Telehealth — CometChat integration

The [baseline telehealth app](../../tree/main) with **CometChat** chat + voice/video calling integrated across **web (React UIKit v6)**, **Android (Kotlin UIKit v6)**, and **iOS (UIKitSwift)** — the integration under review for CometChat's skills/docs.

## What CometChat adds
- **In-consultation chat + voice + video** between a patient and their doctor.
- CometChat UIKit chat surface (message header + list + composer) with call buttons.
- Backend-minted **per-user auth tokens** (`POST /cometchat/token`); the CometChat REST key never touches the client.

## Stack
| Platform | Tech |
|---|---|
| Web | React + `@cometchat/chat-uikit-react` v6 |
| Android | Kotlin + `chatuikit-kotlin` v6 |
| iOS | Swift + `CometChatUIKitSwift` |
| Backend | Node.js — token minting |

## Compare
- **vs baseline (`main`):** see the comparison PR for the full integration diff.

## Review outcome
**28 findings** (skills 22 · agent 4 · SDK 2) · build 4/4 · completeness 89.2% · ease 3.8/5 · 0 hallucinations.
Full deliverable → **ArnavKataria-CometChat/cc-review-reports** (`telehealth/report.md`).
