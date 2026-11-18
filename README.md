# Call Analyzer - ETH

A mobile-first Progressive Web App (PWA) for analyzing call history, dual-SIM airtime usage, ETB spend, and contact follow-ups with built-in Ethiopian calendar support.

## Features

- **Call Log & Quick Logging**
  - View call history grouped by day with search, direction filters (`Incoming`, `Outgoing`, `Missed`, `Unreturned`), SIM filters, tag filters, date range filtering, and sorting.
  - Log calls manually or with a live call timer, with searchable saved-contact selection.
  - Import call records from `.csv`, `.json`, or `.txt` files and manage per-call notes and tags.
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
- **Themes, Privacy & Offline PWA**
  - Automatically follows your device/OS dark mode preference (`prefers-color-scheme`) with live updates, plus a quick light/dark toggle and **Auto**, **Bright**, **Dark Gray**, and **Dark Navy** theme options.
  - Optional 4-digit App Lock PIN, privacy mode to mask phone numbers and hide private notes, haptic feedback toggle, and offline PWA caching.

## Tech Stack

- **Frontend:** React 19, TypeScript, Vite, Tailwind CSS v4
- **Charts & Animation:** Recharts, Motion (`motion/react`), Lucide Icons
- **Calendar & Exports:** `kenat` (Ethiopian calendar), `jspdf` & `jspdf-autotable`
- **Backend / Sync:** Firebase Authentication & Cloud Firestore
- **PWA:** `vite-plugin-pwa` (Workbox service worker & Web App Manifest)

## Getting Started

### Prerequisites

- Node.js 20+
- npm (or compatible package manager)
- Firebase project configured in `firebase-applet-config.json` (Authentication + Firestore)

### Installation

```bash
npm install
```

### Run Locally

Starts the Vite development server on port `3000`:

```bash
npm run dev
```

### Type Check & Build

```bash
# Run TypeScript type checking
npm run lint

# Build production bundle & service worker
npm run build

# Preview production build
npm run preview
```

### Environment Variables

See `.env.example` for optional runtime environment variables (`GEMINI_API_KEY`, `APP_URL`). Do not commit real secrets or `.env` files.

## Project Structure

```text
├── index.html                 # HTML entry, PWA meta tags, and pre-paint theme script
├── vite.config.ts             # Vite & VitePWA manifest/service-worker configuration
├── firestore.rules            # Firestore security rules
├── firebase-blueprint.json    # Firestore data schema blueprint
├── public/                    # PWA icons and static assets
└── src/
    ├── App.tsx                # App shell, navigation, auth gate, and modals
    ├── index.css              # Tailwind CSS v4 imports and dark theme CSS variables
    ├── store/CallsContext.tsx # App state, Firebase sync, and system/manual theme state
    ├── components/            # Feature tabs, charts, modals, and UI controls
    ├── lib/                   # Ethiopian calendar, tariffs, import/export, haptics, Firebase
    └── types/                 # TypeScript data models
```
