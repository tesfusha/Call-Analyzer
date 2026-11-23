# Call Analyzer - ETH

An Android-first (Capacitor) and web companion for analyzing call history, dual-SIM airtime usage, ETB spend, and contact follow-ups with built-in Ethiopian calendar support.

## Features

- **Automatic Android Call Sync & File Import**
  - Reads Android call history via the native Capacitor `CallLog` bridge (or imports `.csv`, `.json`, and `.txt` records) grouped by day with search, direction filters (`Incoming`, `Outgoing`, `Missed`, `Unreturned`), SIM filters, tag filters, date range filtering, and sorting.
  - Manage per-call notes, relationship tags, and scheduled follow-up reminders.
- **Dual-SIM Usage & Carrier Tools**
  - Track call minutes, call counts, and estimated ETB spend across **SIM 1 (Ethio Telecom)** and **SIM 2 (Safaricom)** with per-second or per-minute billing presets and monthly budget tracking.
  - Manage active voice minute bundles with expiry tracking and launch Ethiopian carrier USSD codes.
- **Interactive Analytics & Exports**
  - Explore call frequency, airtime spend trends, peak hours, top callers, and carrier/direction breakdowns with interactive tooltips.
  - Export formatted **PDF**, **HTML**, **CSV**, and **JSON** statements.
- **Saved Contacts Directory**
  - Import contacts from `.vcf` / `.csv` files or the browser Contact Picker API.
  - Filter by relationship tag, sort by `A–Z`, `Most Calls`, or `Recent`, and manage birthdays, custom events, notes, and per-contact call timelines.
- **Ethiopian Calendar, Wishes & Follow-Up Alerts**
  - Dual Ethiopian & Gregorian calendar views (powered by `kenat`) with optional Ge'ez numerals and Ethiopian holiday tracking.
  - Quiet-contact reminders, unreturned missed call alerts, scheduled callback reminders, and quick wish message templates.
- **Themes & Privacy**
  - Follows your device/OS dark mode preference (`prefers-color-scheme`) with **System**, **Bright**, and **Dark Gray** theme options.
  - Optional 4-digit screen lock PIN, privacy mode (number & note masking), and haptic feedback toggle.

## Tech Stack

- **Frontend:** React 19, TypeScript, Vite, Tailwind CSS v4
- **Mobile Runtime:** Capacitor Android (`com.callanalyzer.eth`)
- **Charts & Animation:** Recharts, Motion (`motion/react`), Lucide Icons
- **Calendar & Exports:** `kenat` (Ethiopian calendar), `jspdf` & `jspdf-autotable`
- **Auth & Storage:** Firebase Authentication & Cloud Firestore (migrating local call/contact storage to IndexedDB)

## Getting Started

### Prerequisites

- Node.js 20+
- npm (or compatible package manager)
- Firebase project configured in `firebase-applet-config.json`

### Installation

```bash
npm install
```

### Run Locally

Starts the Vite development server on port `3000`:

```bash
npm run dev
```

### Type Check, Rules Lint & Build

```bash
# Run TypeScript type checking
npm run lint

# Lint Firestore security rules
npm run lint:rules

# Build production bundle
npm run build

# Preview production build
npm run preview
```

### Environment Variables

See `.env.example` for optional environment variables (`APP_URL`). Do not commit real secrets or `.env` files.

### Admin Setup (Firestore Console)

Admin access is controlled through the Firestore `/admins/{uid}` collection and is never writable from client code:

1. Open your project's Firestore database in the Firebase Console (`ai-studio-callanalyzereth-8a53901f-21ac-4a27-a39b-67c161032787`).
2. Create a top-level collection named `admins` (if it does not exist yet).
3. Add a document whose **Document ID** is the verified user's Firebase Authentication `uid` (for example, `{ "role": "admin" }`).
4. Sign in with that verified account to unlock the **Admin** tab (`userRegistry` statistics only; customer call logs and contacts remain strictly private to each owner).

## Project Structure

```text
├── index.html                 # HTML entry and pre-paint theme/font-scale script
├── vite.config.ts             # Vite build configuration
├── firestore.rules            # Firestore security rules
├── firebase-blueprint.json    # Firestore data schema blueprint
├── eslint.config.js           # ESLint configuration for Firestore security rules
├── public/                    # Static assets (logo)
└── src/
    ├── App.tsx                # App shell, navigation, auth gate, and modals
    ├── index.css              # Tailwind CSS v4 imports and theme CSS variables
    ├── store/CallsContext.tsx # App state, Firebase sync, and theme state
    ├── components/            # Feature tabs, charts, modals, and UI controls
    ├── lib/                   # Ethiopian calendar, tariffs, import/export, haptics, Firebase
    └── types/                 # TypeScript data models
```
