# Call Analyzer ETH: AI Studio Instructions

Prepared for Tesfish. Paste one step at a time into AI Studio, check the result, then move to the next step.

## How to use this document

- Send **one step per prompt**. Do not combine steps.
- After every step, ask AI Studio to run `npm run lint` (the TypeScript check) and `npm run build`, and fix every error before stopping.
- Start every step with this line: *"Do not change or remove any feature that this step does not mention. Keep the current design and styling."*
- Steps 3 and 11 contain **native Android code**. AI Studio cannot build or test that part well, so do Steps 3 and 11 in Android Studio (or with a coding tool such as Claude Code) and keep the web steps in AI Studio.

### Decisions already made

- Distribution is an **Android APK now**, Play Store later.
- Data moves to **IndexedDB**. Firebase is kept for **Authentication** and a small **Firestore** part for admin statistics only.
- The **manual call logging feature is removed**. Calls are fetched from the phone automatically.
- **CSV/JSON import stays**, and app updates must never lose tags, call logs, status or user information.
- Rewards are **points and badges only**, never airtime or money.

### Assumptions to confirm (change them in the prompts if wrong)

- A "day" means a calendar day in East Africa Time (UTC+3).
- A contact-streak day counts when there is at least one call with duration above 0 seconds with that contact, incoming or outgoing.
- Missed-call reminder delay is user-selectable: 5, 7 or 10 minutes, default 7.

## Step 0: Fix the build and clean the project

```
Do not change or remove any feature that this step does not mention. Keep the current design and styling.

1. npm install currently fails with an ERESOLVE error because esbuild is pinned to ^0.25 while vite 8 expects ^0.27 or ^0.28. Update or remove the esbuild entry so that `npm install`, `npm run lint` and `npm run build` all pass.
2. Remove dependencies that are not imported anywhere in src: express, dotenv, @google/genai, tsx, @types/express, and eslint plus @firebase/eslint-plugin-security-rules unless an eslint script is actually used. Remove GEMINI_API_KEY and the matching text from .env.example and metadata.json.
3. Rename the package in package.json from "react-example" to "call-analyzer-eth".
4. Delete every file in public/assets/aistudio/ that the app does not reference, and remove the folder if it ends up empty. Remove the unused copy-unbundled-src-assets plugin from vite.config.ts if src/assets does not exist.
5. Wrap every localStorage and sessionStorage read and write (CallsContext.tsx, haptics.ts, App.tsx, CallsTab.tsx) in try/catch so the app still works when storage is blocked or full.
6. Update README.md so it matches the real app: no PWA claims, no Gemini, correct scripts, and the new Android and IndexedDB direction.
7. Run lint and build and fix all errors.
```

## Step 1: Security fixes

```
Do not change or remove any feature that this step does not mention. Keep the current design and styling.

1. Remove the password hint feature completely: the field in AuthForm and ProfileEditModal, the display in SettingsTab, the passwordHint state and writes in CallsContext, and the passwordHint key in firestore.rules. Also delete the existing passwordHint field from each user's document the next time that user signs in.
2. Rework the App Lock PIN in src/lib/security.ts:
   - Generate a random 16-byte salt per install and store it with the hash.
   - Use PBKDF2 (Web Crypto, SHA-256, at least 150,000 iterations) instead of a single SHA-256.
   - Delete the FNV fallback. If Web Crypto is unavailable, refuse to enable the PIN and show a message.
   - verifyPin must return false, not true, when a hash is expected but missing or corrupted.
   - Add attempt limiting in unlockWithPin: after 5 wrong attempts, lock for 30 seconds, then 1, 5 and 15 minutes on further failures. Persist the counter and the lock-until time so restarting the app does not reset it. Show the countdown in AppLockOverlay.
   - Change wording in the UI to "screen lock" and do not promise strong security.
3. Remove privacy mode completely, since it is not needed now: its toggle in Settings and anywhere else, the maskPhoneNumber function and every place that calls it, its state and stored setting, and any text in the guide or What's New that mentions it. Phone numbers are always shown in full.
4. Remove the hardcoded admin email from firestore.rules, CallsContext.tsx and security_spec.md. Use an admin check based on a custom claim (request.auth.token.admin == true) or a document at /admins/{uid} that can only be written from the Firebase console. Document how to set it in README.
5. Run lint and build and fix all errors.
```

## Step 2: Move data to IndexedDB

```
Do not change or remove any feature that this step does not mention. Keep the current design and styling.

Goal: IndexedDB becomes the main store for all user data. Firebase Auth stays. Firestore is kept only for /userRegistry and a daily-activity collection added in a later step.

1. Add Dexie. Create src/lib/db.ts with one database per signed-in user, named callanalyzer-<uid>. Tables: calls, contacts, scheduledCalls, settings, favorites, dismissedMissed, streaks, badges, activity, meta.
2. Use Dexie's versioned schema (db.version(n).stores(...).upgrade(...)). Every future schema change must be a new version with an upgrade function that keeps existing rows. Never delete and recreate tables.
3. Move all reads and writes in CallsContext.tsx to the new db layer. Split the 4,000-line context into smaller modules (auth, calls, contacts, settings, reminders, appLock) while doing this, without changing behavior.
4. First-launch migration: if old localStorage data or Firestore data exists for the user and meta.migratedV1 is not set, then (a) automatically download a JSON safety snapshot, (b) copy everything into IndexedDB, (c) compare record counts, (d) only if counts match set meta.migratedV1 and remove the old copies. If anything fails, keep the old data and show a retry button.
5. Do NOT wipe user data on sign-out. Only clear in-memory state. Data stays under the callanalyzer-<uid> database so the user finds everything when signing back in. Add a clear "Delete all my data on this device" button in Settings with confirmation.
6. Call navigator.storage.persist() after sign-in so the browser is less likely to evict the data.
7. Stop syncing calls, contacts and scheduled calls to Firestore. Update firestore.rules to keep only /users/{uid} (minimal profile and settings), /userRegistry/{uid}, and /admins. Update security_spec.md.
8. Run lint and build and fix all errors.
```

## Step 3: Automatic call-log fetching and missed-call alerts (native Android)

```
This step is native Android code (APK). Work in the Capacitor Android project, in Android Studio or with a coding tool. Add the android/ folder to the repository if it is missing.

Signing and package name: use one fixed package name and one release keystore for every APK. Back up the keystore safely. A different key or package name stops in-place updates and loses user data.

Goal: the app reads every fresh call from the phone's call log and makes decisions by itself while the app is closed. Build a Capacitor plugin called CallLogSync in Kotlin that contains a native decision engine. No decision below may depend on the web layer being open.

1. Permissions in AndroidManifest: READ_CALL_LOG, READ_PHONE_STATE, POST_NOTIFICATIONS, SCHEDULE_EXACT_ALARM and RECEIVE_BOOT_COMPLETED. Ask after a short explanation screen. If exact alarms are denied, fall back to setAndAllowWhileIdle.
2. Fresh calls only: keep a watermark (last processed call id and date) in native storage. Each sync reads the CallLog.Calls rows newer than the watermark (number, cached name, type, date, duration, and the subscription id mapped to SIM 1 or SIM 2), processes them in date order, then moves the watermark forward. On the first run, import the whole log once. Read every call type (incoming, outgoing, missed, rejected, blocked, voicemail) and keep the type on each call, so the app can show rejected calls as "Rejected".
3. When the engine runs: (a) a manifest-registered receiver for PHONE_STATE when a call ends (wait about 2 seconds, because the system writes the call log slightly after the call ends); (b) a WorkManager periodic job every 15 minutes as a catch-up; (c) after a reboot and after an app update; (d) whenever the app opens.
4. Native storage: a Room database with a queue of calls the web layer has not imported yet, and a decision state per call (reminder scheduled, reminded, returned, returnedAt). Also mirror the settings the engine needs and update them whenever the user changes them in the app: reminder delay (5, 7 or 10 minutes, default 7), reminders on or off, quiet hours, per-type switches, and muted and snoozed contacts. When the app opens it imports the queue into IndexedDB (deduplicated), clears the imported rows, and reads the decision state.
5. Decision rules, applied to every fresh call:
   - Normalize numbers first: 0911xxxxxx, +251911xxxxxx and 251911xxxxxx are the same number; handle 07xxxxxxxx the same way.
   - Missed incoming call: if reminders are on, the contact is not muted or snoozed, and it is not quiet hours, schedule one exact alarm for the chosen delay after the call time. If that number already has a pending reminder, update it (count and latest time) instead of creating another.
   - Answered incoming call (duration above 0) or any outgoing call to the same number: cancel the pending alarm for that number, remove its notification if it is showing, and mark the earlier missed calls as returned.
   - Rejected call: do not remind (the user chose to reject it), but still store it. Blocked and voicemail types: store, do not remind.
   - Unknown numbers: remind like the others, but add a setting "Only remind for saved contacts" (default off).
   - Never notify twice for the same missed call, even after a reboot or repeated syncs (use the decision state).
6. When an alarm fires, check the call log once more for a callback before showing the notification. Notifications use the channels, look and actions defined in Step 11.
7. Reschedule pending alarms after a reboot and after an app update.
8. Battery optimization: after the permissions, show a screen that explains the problem on Tecno, Infinix, itel, Xiaomi and Samsung phones and sends the user to the battery-optimization exemption and autostart settings.
9. Add Settings controls: reminder delay (5, 7 or 10 minutes), reminders on or off, "Only remind for saved contacts", and a "Last synced" line with a "Sync now" button.
10. Log every decision (call id, rule that fired, time) in a small native debug table that can be viewed on a hidden debug screen, so testing is easy.
11. Test on a real phone with the app swiped away: a missed call with no callback (notification arrives after the delay); a missed call with a callback inside the delay (nothing shown, marked returned); two missed calls from one number (one reminder); a rejected call (no reminder); a reboot with a pending reminder; both SIM slots; and the 09..., 07... and +251... number formats.
```

## Step 4: Remove manual logging, keep import and backup

```
Do not change or remove any feature that this step does not mention. Keep the current design and styling.

1. Remove these user-facing features: the quick-log button, the live call timer, the manual "add call" form and modal, and every guide, What's New and empty-state text that mentions logging calls manually. On platforms where call-log fetching is not available (web, iOS), show a clear notice that logging works on Android only.
2. Keep the internal addCall function. Native sync and import use it.
3. Keep editing notes and tags on fetched calls.
4. Keep CSV/JSON/TXT import and improve it:
   - Deduplicate by normalized number + timestamp + duration. Importing the same file twice must add nothing.
   - Merge, do not overwrite. If a call already exists, keep the local tag and note unless the local field is empty.
   - Show a preview before saving: how many calls are new, duplicate and invalid.
   - Validate every row (number length, timestamps, durations, direction, SIM) and ignore any id or owner field in the file.
5. Make the export a versioned backup with schemaVersion, containing calls, tags, contacts, settings, streaks, badges and scheduled-call status. Older backup versions must still import after future changes.
6. Run lint and build and fix all errors.
```

## Step 5: New-call badge, score and daily usage streak

```
Do not change or remove any feature that this step does not mention. Keep the current design and styling.

All values are computed locally from IndexedDB. Use East Africa Time (UTC+3) for the definition of a day. Rejected calls are shown in the call log with a "Rejected" label and never earn points or count toward any streak, milestone or rhythm. The same applies to blocked and voicemail calls.

1. NEW badge: calls fetched since the user last opened the Calls tab show a small "NEW" badge. Opening the tab clears it.
2. Daily usage streak: a day counts when the app is opened. Store the current streak, the longest streak and the last active date in the streaks table. Missing a day resets the current streak to 0 (a single grace day can be added later). Show the streak on the home screen.
3. Score (points, shown in a small card and in Settings):
   - +5 for the first app open each day
   - +10 for returning a missed call within the chosen reminder window
   - +3 for adding a tag or note to a call
   - +20 bonus at 7, 30 and 100 day usage streaks
   Keep these numbers in one constants file so they are easy to change. Store a points history so the score can be rebuilt.
4. Badges table with simple badges, for example First Open, 7-Day Streak, 30-Day Streak, 100-Day Streak, Quick Returner (5 quick callbacks). Show earned and locked badges on a Profile or Achievements screen.
5. Include streaks, score and badges in the versioned backup and import.
6. Run lint and build and fix all errors.
```

## Step 6: Contact milestones and sharing

```
Do not change or remove any feature that this step does not mention. Keep the current design and styling.

1. For each contact (identified by normalized number), compute a consecutive-day streak. A day counts when there is at least one call with duration above 0 seconds, incoming or outgoing, that day (East Africa Time). Rejected, blocked and voicemail calls never count. Make this rule a single constant so it can be changed to "both an incoming and an outgoing call that day".
2. Milestones at 3, 7, 14, 30, 60, 100, 200 and 365 days. Each milestone gives points and a badge. Show a celebration screen once per milestone. Never award the same milestone twice for the same streak.
3. Show the current and best streak in the contact detail screen.
4. Share button on the celebration screen: generate an image card on a canvas with the milestone, the number of days, the app name and a nickname or relationship tag. By default the card must NOT contain the phone number or the contact's real name. Add a toggle "Include name" that is off by default. Share with the Capacitor Share plugin or Web Share API.
5. Rewards are points and badges only. Do not add any airtime or money reward.
6. Store milestone state in IndexedDB and include it in the backup and import.
7. Run lint and build and fix all errors.
```

## Step 7: Update notice and daily active clients

```
Do not change or remove any feature that this step does not mention. Keep the current design and styling.

Part A: Update available
1. Add src/lib/appInfo.ts constants for versionName and versionCode. On app start and once every 24 hours, fetch a small version.json from a fixed HTTPS URL (host it on Firebase Hosting or GitHub Pages). Its format: { "versionCode": 12, "versionName": "1.2.0", "apkUrl": "https://...", "notes": "...", "mandatory": false }.
2. If versionCode is higher than the installed one, show a banner or dialog with the release notes and a button that opens apkUrl in the browser. If mandatory is true, the dialog cannot be dismissed. Fail silently when offline.
3. Never download or install anything without the user tapping the button. Show a note that Android will ask to allow installs from this source.

Part B: Active clients per day
1. When a signed-in user opens the app, write one document to Firestore at /dailyActive/{yyyy-MM-dd}_{uid} with: uid, date (East Africa Time), and openedAt (server time). Write it at most once per day per user, and skip it if the document already exists.
2. Update firestore.rules: only the signed-in owner can create their own document, with exactly those fields and a matching uid; nobody can update or delete; only the admin can read. Update security_spec.md.
3. In AdminTab, show active clients for today, the last 7 days and the last 30 days, using these documents. Keep /userRegistry for total registered users.
4. No call data, numbers or names may be sent to Firestore.
5. Run lint and build and fix all errors.
```

## Step 8: Final checks

```
Do a final review of the whole project and fix every problem you find:
1. npm install, npm run lint and npm run build succeed with no warnings about missing or unused dependencies.
2. Search the code for any remaining Firestore writes of calls, contacts or scheduled calls and remove them.
3. Confirm that signing out and signing back in keeps all local data.
4. Confirm that importing the same backup twice does not create duplicates.
5. Confirm that the Quiet contacts list follows the new rhythm rules and does not feed the main alert badge.
6. Update README.md and security_spec.md so they match the final behavior.
7. List anything that could not be completed and why.
```

## Testing checklist before sharing the APK

- Install the new APK **over** the old one (same signing key) and confirm calls, tags, contacts, streaks and settings are all still there.
- Missed call with no callback: notification arrives after the chosen delay while the app is closed.
- Missed call with callback inside the window: no notification, and the call shows as returned.
- Reboot the phone with a reminder pending: the reminder still fires.
- Test with both SIM slots and with number formats 09..., 07..., +251... and 251...
- Export a backup, clear app data, import the backup: everything returns with no duplicates.
- Sign out and back in; sign in with a second account on the same phone and confirm the data stays separate.
- Check the update banner by raising versionCode in version.json.

## Later: preparing for Google Play

Play restricts the call-log permission to specific use cases and requires a permissions declaration. Keep the native call-log code in its own plugin so it can be changed or limited if Google asks. Plan for a privacy policy page and a data-safety form before applying.

## Added later: Steps 9 to 15

These steps come from testing the app. Steps 9, 10, 12 and 13 are independent of each other and can run after Step 2. Step 11 is native Android work that builds on Step 3, so do it in Android Studio, not AI Studio. Step 14 needs Step 2 (IndexedDB).

## Step 9: Back button

```
Do not change or remove any feature that this step does not mention. Keep the current design and styling.

The app has no back handling. Add it:

1. Install @capacitor/app and register App.addListener('backButton', ...) once at startup. On the web, also use history.pushState and a popstate listener so the browser back button behaves the same way.
2. Keep a navigation stack. Every modal, full-screen overlay, contact detail, wish composer and settings sub-screen registers itself in the stack when it opens and removes itself when it closes.
3. When Back is pressed: (a) close the top item of the stack; (b) if the stack is empty, go to the previous tab (keep a short tab history); (c) if the user is on the first tab with nothing to go back to, show "Press back again to exit" and exit only if Back is pressed again within 2 seconds (App.exitApp()).
4. While the app lock is showing, Back must not bypass it: minimize the app instead.
5. Back must never lose typed text silently: if a form has unsaved changes, ask before closing.
6. Run lint and build and fix all errors.
```

## Step 10: Remove calls from the calendar

```
Do not change or remove any feature that this step does not mention. Keep the current design and styling.

In EthiopianCalendarView.tsx:
1. Remove the calls-per-day index (callsByDay), the call counts shown on each day (for example "3c"), the list of calls for the selected date, and the legend text that mentions calls.
2. Keep the Ethiopian and Gregorian dates, holidays, birthdays and scheduled calls exactly as they are.
3. Remove the onSelectCall prop and anything else that becomes unused, and update the component description text so it no longer mentions daily calls.
4. Run lint and build and fix all errors.
```

## Step 11: Real phone notifications (heads-up, like Telegram)

```
This step is native Android code (Capacitor). Build it in Android Studio or with a coding tool, on top of the CallLogSync plugin from Step 3.

Goal: notifications must appear on the phone like Telegram's: a small heads-up pop-up that shows who it is about and what it says, even when the app is closed. Today they only appear after the user opens the app. Replace the in-app-only banner with real system notifications.

1. Use @capacitor/local-notifications for scheduled notifications and the native Kotlin code from Step 3 for missed-call reminders. Ask for the POST_NOTIFICATIONS permission (Android 13 and above) after a short explanation screen.
2. Channels: "Missed calls" (importance HIGH, so it pops up on screen with sound), "Wishes and birthdays" (importance HIGH) and "General" (default importance). The user can change sound and vibration in Android settings.
3. Look and content, like a messaging app:
   - Title = the contact's name (the number if there is no name). Body = what happened in plain words, for example "Missed call, 7 minutes ago. Tap to call back.", "Birthday today. Send a wish?" or "Enkutatash today. Send a greeting to Abebe?"
   - Use NotificationCompat.MessagingStyle or a large icon with the contact's initials so each notification is easy to recognize, and show the time. Group several missed calls under one summary, for example "3 missed calls".
   - Actions: missed call = "Call back" and "Dismiss"; birthday or holiday = "Send wish" and "Dismiss".
4. Tapping a notification or an action opens the right screen straight away: the contact detail for a missed call, the WishComposer (Step 14) for a wish. Use a deep link that carries the contact's number and the occasion. "Call back" starts the call directly.
5. Missed-call reminders: the delay options are 5, 7 or 10 minutes, default 7. This single setting replaces the "5 or 10 minutes" option in Step 3. The notification fires on time with the app closed. Cancel it if the user calls back first, and never notify twice for the same missed call (use the logic from Step 3).
6. Birthday and holiday notifications: schedule them ahead of time for 8:00 AM East Africa Time on the day (the time is a setting). Every time the app opens, and in the daily WorkManager job, schedule the next 30 days so they appear even if the user does not open the app for weeks. Cancel and reschedule when a birthday changes or a contact is deleted. Respect the per-type switches (Step 13) and quiet hours.
7. Reschedule everything after a reboot and after the app is updated.
8. Keep it calm: at most one notification per event, none for dormant contacts, and none for quiet contacts unless that switch is on.
9. When the app is open, show the same system notification and do not build a separate in-app banner. Only on the web fallback, show a simple in-app banner with a View button that opens the contact detail (set selectedContactNumber).
10. Show the battery-optimization and autostart prompt for Tecno, Infinix, itel, Xiaomi and Samsung phones (same screen as Step 3). Add a "Test notification" button in Settings that fires a missed-call style notification after 10 seconds so the user can check it with the app closed.
11. Test with the app swiped away: a missed-call reminder, a birthday notification at the scheduled time, a reboot with pending notifications, tapping each action, and Do Not Disturb mode.
```

## Step 12: Settings sections that expand and collapse

```
Do not change or remove any feature that this step does not mention. Keep the current design and styling.

In SettingsTab.tsx:
1. Keep the profile card and the Score and Badges section at the top, always visible.
2. Turn every other section into a collapsible accordion: Appearance, Privacy and App Lock, Reminders and Alerts, Calendar, Data and Backup, Language, About, and any others. Each header shows its title, a one-line summary of the current state (for example "Dark mode, large text") and an arrow.
3. Sections are collapsed by default. Open and close with a smooth height animation. Remember which sections the user left open in the settings table in IndexedDB.
4. Add a small search field or "Collapse all" button at the top of the list if it fits the design.
5. Run lint and build and fix all errors.
```

## Step 13: Calmer alerts

```
Do not change or remove any feature that this step does not mention. Keep the current design and styling.

In App.tsx, pendingFollowUps adds missed calls, scheduled calls, quiet contacts, birthdays and holidays into one count, so the app always looks busy. Change it:

1. Compute a separate count per type.
2. The main badge counts only missed calls and scheduled calls.
3. Show quiet contacts, birthdays and holidays in their own "Reminders" list without adding to the main badge.
4. Add per-type switches in Settings under Reminders and Alerts: missed calls, scheduled calls, quiet contacts, birthdays, holidays. Defaults: missed and scheduled on, birthdays on, holidays on, quiet contacts off.
5. Add "Mark all as read" and "Snooze for today". Keep the existing mute-per-alert behavior.
6. Keep the existing guide and What's New popups showing only once per app version, and store the seen flags in the IndexedDB settings table so they survive updates.
7. Run lint and build and fix all errors.
```

## Step 14: Write your own wish, then send it

```
Do not change or remove any feature that this step does not mention. Keep the current design and styling.

Add a WishComposer screen, opened from birthday and holiday alerts and from the contact detail screen:

1. Editable text box prefilled with the holiday or birthday template in Amharic or English (follow the calendar language). Placeholders {name} and {occasion} are filled in automatically, and the user can edit everything.
2. "Save as my template" stores the edited text per occasion in a new wishTemplates table in IndexedDB. Next time that occasion opens with the saved text. Add the table to the versioned backup and import.
3. SMS length counter: if every character fits the GSM-7 alphabet, 160 characters per message (153 when joined); otherwise 70 per message (67 when joined). Show "X characters, Y SMS". Amharic text is Unicode, so warn when the message needs more than one SMS.
4. Send buttons:
   - SMS: open sms:<number>?body=<encoded text> so the messaging app opens with the number and text filled in.
   - WhatsApp: open https://wa.me/<number in international format without +>?text=<encoded text>. Normalize 09... and 07... numbers to 251... first.
   - Telegram: if the contact has a Telegram username, copy the text to the clipboard and open https://t.me/<username>; otherwise open the Android share sheet (@capacitor/share) with the text so the user picks the chat.
   - Instagram: if the contact has an Instagram username, copy the text and open https://ig.me/m/<username>; otherwise open the share sheet. Instagram cannot prefill a message, so show "Text copied, paste it in the chat".
   - Copy: copy to the clipboard with a "Copied" confirmation.
5. Add optional Telegram username and Instagram username fields to the contact edit screen. Strip a leading @, allow only letters, digits, underscore and dot, and always pass values through encodeURIComponent when building links.
6. Add <queries> entries in AndroidManifest for sms, WhatsApp, Telegram and Instagram so the app can check which apps are installed, and hide buttons for apps that are not installed (SMS and Copy always show).
7. When the user taps a send button, record it in a sentWishes table (contact key, occasion key, year, channel, time) and label it "Opened", not "Sent", because the app cannot confirm delivery. Award points once per contact, occasion and year (see Step 5). Include the table in the backup.
8. Wish text and usernames stay on the device. Nothing goes to Firestore. Register the screen in the back-button stack from Step 9.
9. Run lint and build and fix all errors.
```

## Step 15: Reconnect suggestions (Quiet contacts)

Runs after Steps 5, 13 and 14. The "usually call every N days" text must be based on real rhythm, and the list must stay short and useful.

```
Do not change or remove any feature that this step does not mention. Keep the current design and styling. Privacy mode no longer exists, so do not add any number masking.

In the Wishes and Alerts screen, rework the Quiet tab:

1. Rhythm: a contact has a call rhythm only after at least 4 calls on at least 3 different days. Count only answered incoming and outgoing calls with duration above 0; ignore missed, rejected, blocked and voicemail calls. The rhythm is the median gap in days between consecutive call days, rounded to a whole number (minimum 1). If a contact does not meet this rule, never show "you usually call every N days".
2. Quiet: a contact is quiet when the days since the last call are more than max(2 x rhythm, 7) and at most DORMANT_DAYS (a constant, default 90). Contacts beyond DORMANT_DAYS go to a collapsed "Dormant" section and are not counted anywhere.
3. Priority: rank quiet contacts by a score built from the number of calls (log scale), favorite status, tag (Family and Friends above Business) and how overdue they are. Show the top 5 by default with a "Show more" button.
4. Row design: initials avatar, name (the number only when there is no name), tag chips, one line like "Last call 12 days ago, usually every 5 days" (leave out the second part when there is no rhythm), and a thin bar that goes green, amber, then red as the contact becomes more overdue.
5. Actions on each row: Call; Message (opens the WishComposer from Step 14 with a follow-up template; for Business tags use "Hello, just checking in. Do you need anything?"); Snooze (1 day, 1 week, 1 month); and "Do not remind me about this contact" with an Undo toast. Swipe right to call and swipe left to snooze. Give the mute icon a text label.
6. Filter chips at the top: All, Family, Friends, Business, based on the existing tags.
7. Weekly reconnect goal: default 3 people per week (changeable in Settings). Show progress such as "1 of 3". A contact counts when the user calls them after they were listed as quiet. Award points once per contact per week (see Step 5). The week starts on Monday 00:00 East Africa Time.
8. Show one summary line at the top, for example "3 people to reconnect today".
9. Quiet contacts must never add to the main alert badge (Step 13).
10. Store snooze, mute and goal progress in IndexedDB and include them in the versioned backup and import.
11. Run lint and build and fix all errors.
```
