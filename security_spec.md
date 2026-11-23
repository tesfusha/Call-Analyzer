# Security Specification — Call Analyzer - ETH

## 1. Data Invariants
1. **Local-Only Call & Contact Storage**: All call logs, saved contacts, scheduled callbacks, favorites, dismissed missed call IDs, muted alert keys, streaks, scores, badges, contact milestones, and PIN hashes stay strictly on-device in UID-partitioned IndexedDB (`${uid}::*`). Zero call data, contact phone numbers, or contact names are ever sent to Firestore. Subcollections `/users/{userId}/calls`, `/users/{userId}/contacts`, and `/users/{userId}/scheduledCalls` are denied by the global default-deny rule.
2. **Strict Account Ownership**: Private account preferences in `/users/{userId}` belong strictly to an authenticated, email-verified user (`request.auth != null && request.auth.token.email_verified == true && request.auth.uid == userId`). No other user and no admin can read or write `/users/{userId}`.
3. **Minimal Daily Active Client Pings (`/dailyActive/{yyyy-MM-dd}_{uid}`)**:
   - Only a signed-in, email-verified user may `create` their own document with exact keys `['uid', 'date', 'openedAt']`.
   - `uid` must equal `request.auth.uid`, `date` must be a 10-character `YYYY-MM-DD` string, the document ID must equal `{date}_{uid}`, and `openedAt` must equal `request.time`.
   - Nobody can `update` or `delete` any `/dailyActive` document (append-only, once per day per user).
   - Only console-provisioned verified admins (`/admins/{uid}`) can `get` or `list` `/dailyActive` documents to compute daily, 7-day, and 30-day active client totals.
4. **Admin Customer-PII Isolation**: Console-provisioned admins (documented in `/admins/{uid}`, verified email required) can ONLY read `/userRegistry/{userId}` (registered user totals & basic account directory) and `/dailyActive/{activityId}` (`uid`, `date`, `openedAt`). Admins have ZERO read/write access to `/users/{userId}` or any call/contact data.
5. **Email Integrity & Immutable Registration Time**: Both `/users/{userId}` and `/userRegistry/{userId}` validate that `email` matches `request.auth.token.email` when present on the auth token. `uid` is immutable after creation; `userRegistry.registeredAt` equals `request.time` on creation and is immutable on update, while `lastActiveAt == request.time`.
6. **Client Persistence & Explicit Erasure**: Local IndexedDB data is strictly isolated per `uid` (`${uid}::*`), persists across sign-out and sign-back-in for the same user, requests persistent storage (`navigator.storage.persist()`), and is erased only when the user explicitly confirms **Delete all my data on this device** in Settings.
7. **Path & Size Bounds**: All document IDs (`userId`, `activityId`, `adminUid`) match `^[a-zA-Z0-9_-]+$` (`1..128` chars). All strings, maps, numbers, and enums obey strict bounds and `hasOnly` allowlists.

## 2. Adversarial Payloads ("Dirty Dozen")
1. **Unauthenticated read/write**: Unauthenticated client requests `get`, `list`, or `create` on `/users/userA`, `/admins/adminA`, `/userRegistry`, or `/dailyActive`. Expected: `PERMISSION_DENIED`.
2. **Non-admin reading `/dailyActive` or `/userRegistry`**: Verified non-admin user requests `get` or `list` on `/dailyActive` or `/userRegistry`, or attempts `create` on `/admins/userA`. Expected: `PERMISSION_DENIED`.
3. **Writing call/contact/schedule data to Firestore**: Verified user or admin attempts `create`/`get`/`list` on `/users/userA/calls/c1`, `/users/userA/contacts/k1`, or `/users/userA/scheduledCalls/s1`. Expected: `PERMISSION_DENIED` (blocked by global default-deny).
4. **Admin reading private user workspace**: Verified admin in `/admins/{uid}` attempts `get` on `/users/userA`. Expected: `PERMISSION_DENIED`.
5. **Unverified admin account**: User exists in `/admins/{uid}` with `email_verified: false` and tries `list` on `/dailyActive` or `/userRegistry`. Expected: `PERMISSION_DENIED`.
6. **Daily active UID/ID mismatch**: User A attempts `create` on `/dailyActive/2026-05-01_userB` with `uid: "userB"` or `uid: "userA"`. Expected: `PERMISSION_DENIED`.
7. **Daily active update/delete or extra fields**: User A attempts `update` or `delete` on `/dailyActive/2026-05-01_userA`, or `create` with an extra field (`phone`, `callsCount`, or `notes`) or backdated `openedAt`. Expected: `PERMISSION_DENIED`.
8. **Cross-user read on `/users`**: Authenticated user B attempts `get` on `/users/userA`. Expected: `PERMISSION_DENIED`.
9. **Email spoofing**: User A writes `/userRegistry/userA` or `/users/userA` with `email: "other@example.com"`. Expected: `PERMISSION_DENIED`.
10. **Ghost / Shadow field**: User A writes `/users/userA` with `favorites: ["+251911000000"]` or `/userRegistry/userA` with `role: "admin"`. Expected: `PERMISSION_DENIED`.
11. **Oversized ID poisoning**: User A creates `/dailyActive/<150-char-id>` or `/userRegistry/<150-char-id>`. Expected: `PERMISSION_DENIED`.
12. **Registration timestamp forgery**: User A creates `/userRegistry/userA` with a backdated `registeredAt` instead of `request.time`, or modifies `registeredAt` on update. Expected: `PERMISSION_DENIED`.
