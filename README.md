# Call Analyzer - ETH

An Android-first (Capacitor) and web companion for analyzing call history, dual-SIM airtime usage, ETB spend, contact milestones, and follow-ups with built-in Ethiopian calendar support.

## Privacy-First Local Storage Architecture

- **All call logs, contacts (including Telegram/Instagram usernames), scheduled callbacks, favorites, alerts, custom wish templates, sent wish history, quiet-contact snoozes, weekly reconnect progress, streaks, score, badges, and contact milestones stay strictly on your device** in per-user IndexedDB (`${uid}::*`).
- **No call data, contact phone numbers, usernames, wish text, or contact names are ever sent to Firestore.**
- Signing out and signing back in preserves your local IndexedDB data for your account while keeping data isolated between accounts.
- You can erase all local data on a device anytime via **Settings → Data & Backup → Delete all my data on this device**.
- Cloud Firestore is used only for:
  - `/users/{uid}` — private non-call account settings (theme, tariffs, SIM labels, calendar/reminder preferences, voice bundles)
  - `/userRegistry/{uid}` — basic registered account summaries for admin total user counts
  - `/dailyActive/{yyyy-MM-dd}_{uid}` — once-per-day active client ping (`uid`, `date` in East Africa Time, `openedAt`) readable only by verified admins
  - `/admins/{uid}` — console-managed admin allowlist (no hardcoded emails)

## Features

- **Automatic Android Call Sync & Versioned Backups**
  - Reads Android call history (incoming, outgoing, missed, rejected, blocked, voicemail) via the native Capacitor `CallLogSync` plugin (or imports `.csv`, `.json`, and `.txt` records with preview and duplicate-safe merging) grouped by day with search, direction filters, SIM filters, tag filters, and date range filtering.
  - Export and import versioned JSON backups covering calls, contacts, scheduled calls, settings, streaks, score, badges, contact milestones, wish templates, sent wishes, snoozed quiet contacts, and weekly reconnect progress — importing the same backup twice creates zero duplicates.
- **Dual-SIM Usage & Carrier Tools**
  - Track call minutes, call counts, and estimated ETB spend across **SIM 1 (Ethio Telecom)** and **SIM 2 (Safaricom)** with per-second or per-minute billing presets, monthly budget tracking, voice minute bundles, and one-tap Ethiopian USSD codes.
- **Wish Composer, Ethiopian Calendar & Smarter Quiet Contacts**
  - Dual Ethiopian & Gregorian calendar views (powered by `kenat`) with optional Ge'ez numerals, Ethiopian holidays, saved contact birthdays, and scheduled callbacks.
  - Write and customize wishes in Amharic or English with live GSM-7/Unicode SMS part counting, save personal templates per occasion, and send via SMS, WhatsApp, Telegram, Instagram, or Copy (auto-detecting installed messaging apps on Android).
  - Rhythm-based **Quiet contacts** with Family/Friends/Business filters, Dormant separation, swipe-to-call/swipe-to-snooze, and a configurable weekly reconnect goal (East Africa Time).
  - Heads-up native Android notifications for missed calls (5, 7, or 10 min delay, optional saved-contacts-only filter, circular initials avatar, and group summaries) and wishes/birthdays.
- **Streaks, Score, Badges & Shareable Milestone Cards**
  - Track your general daily usage streak (East Africa Time), score, and unlockable badges alongside per-contact connection streaks (`3`, `7`, `14`, `30`, `60`, `100`, `200`, `365` days).
  - Share milestone celebration cards as PNG images using the native Android share sheet (`@capacitor/share` + `@capacitor/filesystem`) or Web Share API — with phone numbers always omitted and contact names hidden by default unless opted in.
- **Interactive Analytics & Exports**
  - Explore call frequency, airtime spend trends, peak hours, top callers, and carrier/direction breakdowns, and export formatted **PDF**, **HTML**, **CSV**, and **JSON** statements.
- **Collapsible Settings, Android Back Stack, Themes & Screen Lock**
  - Collapsible Settings sections with live summaries and search, full hardware/browser Back button stack with unsaved-draft prompts, **System** / **Bright** / **Dark Gray** themes, and an optional 4-digit screen lock PIN backed by salted Web Crypto PBKDF2-SHA256 with persisted exponential lockout.
- **Update Notices**
  - Checks a fixed HTTPS `version.json` manifest on app start and once every 24 hours (failing silently offline), showing release notes and a manual browser download link when a newer APK is available (never downloading or installing automatically).

## Tech Stack

- **Frontend:** React 19, TypeScript, Vite, Tailwind CSS v4
- **Mobile Runtime:** Capacitor Android (`com.callanalyzer.eth`) with native `CallLogSync`, `AppNotifications`, `FileExport`, `@capacitor/app`, `@capacitor/filesystem`, and `@capacitor/share`
- **Charts & Animation:** Recharts, Motion (`motion/react`), Lucide Icons
- **Calendar & Exports:** `kenat` (Ethiopian calendar), `jspdf` & `jspdf-autotable`
- **Auth & Storage:** Firebase Authentication, per-user IndexedDB (with `navigator.storage.persist()`), and minimal Cloud Firestore rules

## Getting Started

### Prerequisites

- Node.js 20+
- npm
- Firebase project configured in `firebase-applet-config.json`

### Installation & Development

```bash
npm install
npm run dev
```

### Verification & Build

```bash
# TypeScript check
npm run lint

# Firestore security rules lint
npm run lint:rules

# Production build
npm run build

# Sync web build into Capacitor Android project
npx cap sync android
```

### Hosting Update Manifest (`version.json`)

The app checks `UPDATE_VERSION_URL` (`https://youthful-limiter-kjk7s.web.app/version.json`, optionally overridden via `VITE_UPDATE_VERSION_URL`) against the installed `APP_VERSION_CODE` (`src/lib/appInfo.ts`, matching `android/app/build.gradle`). A template lives at `public/version.json`:

```json
{
  "versionCode": 8,
  "versionName": "1.0.0",
  "apkUrl": "https://your-https-host/call-analyzer-eth-1.0.0.apk",
  "notes": "Summary of changes in this release.",
  "mandatory": false
}
```

Set `"mandatory": true` only when an update must block dismissal until updated.

### Admin Setup (Firestore Console)

Admin access is controlled strictly through `/admins/{uid}` and is never writable from client code:

1. Open your Firestore database (`ai-studio-callanalyzereth-8a53901f-21ac-4a27-a39b-67c161032787`) in the Firebase Console.
2. Create a top-level collection named `admins` (if it does not exist yet).
3. Add a document whose **Document ID** is the verified admin user's Firebase Auth `uid` (e.g., `{ "role": "admin" }`).
4. Sign in with that verified account to access the **Admin** tab (shows active clients for today, last 7 days, and last 30 days from `/dailyActive` plus total registered users from `/userRegistry`).

### Android APK & Physical Phone Checklist

The Capacitor Android project lives in `/android` with fixed application ID `com.callanalyzer.eth` and release signing docs in `android/SIGNING.md`.

1. **In-place upgrade:** Install APK v1.0.0 (`versionCode 8`, same signing key) over an earlier install and confirm calls, tags, contacts, wishes, streaks, and settings remain intact.
2. **Missed-call reminders (app swiped away):** Confirm notifications fire after the configured 5/7/10-minute delay with contact initials and group summaries, cancel when returned by an outgoing or answered incoming call (`0911...` / `+251911...` / `251911...` / `07...`), honor "Only remind for saved contacts", ignore rejected/blocked/voicemail calls, and reschedule after device reboot.
3. **Wish Composer & channel detection:** Open Wish Composer from a birthday/holiday notification or contact detail, verify live GSM-7/Unicode SMS counts, save a custom template, and verify WhatsApp/Telegram/Instagram buttons match installed apps.
4. **Quiet contacts & weekly goal:** Verify rhythm text only appears for contacts with 4+ answered calls across 3+ days, swipe right to call / left to snooze, and confirm quiet contacts never increment the main bell badge.
5. **Sign out & double-import:** Sign out and back in to confirm local data persists; export a backup JSON and import it twice to confirm zero duplicates.
6. **Screen lock & Back button:** Test 5 wrong PIN attempts for lockout countdown, and confirm hardware Back minimizes the app while locked and prompts before discarding unsaved edits.
7. **Update notice & milestone share:** Point `version.json` to a higher `versionCode` to verify the update dialog, and share a contact milestone card via Android's native share sheet.

## Project Structure

```text
├── android/                   # Capacitor Android native project & Kotlin CallLogSync plugin
├── capacitor.config.ts        # Capacitor configuration (com.callanalyzer.eth)
├── firestore.rules            # Firestore security rules (/users, /userRegistry, /dailyActive, /admins)
├── firebase-blueprint.json    # Firestore data schema blueprint
├── security_spec.md           # Security invariants & adversarial test scenarios
├── public/                    # Static assets & version.json update manifest template
└── src/
    ├── App.tsx                # App shell, navigation, update check, auth gate, and modals
    ├── store/CallsContext.tsx # Local IndexedDB state, Firebase Auth, /dailyActive & settings sync
    ├── components/            # Feature tabs, charts, modals, milestone & update dialogs
    ├── lib/                   # Ethiopian calendar, gamification, import/export, updateChecker, IndexedDB
    └── types/                 # TypeScript data models
```
