# Security Specification — Call Analyzer - ETH

## 1. Data Invariants
1. **Strict Account Ownership**: All personal information, call history, contacts, scheduled callbacks, favorites, and workspace settings belong strictly to an authenticated, email-verified user (`request.auth != null && request.auth.token.email_verified == true && request.auth.uid == userId`).
2. **Admin Customer-PII Isolation**: Console-provisioned admins (documented in `/admins/{uid}`, verified email required) can ONLY read `/userRegistry/{userId}` (basic registered account info: `uid`, `displayName`, `email`, `phone`, `authProvider`, `photoURL`, `registeredAt`, `lastActiveAt`) for daily, weekly, and monthly registration/activity analytics. Admin has ZERO read/write access to `/users/{userId}` or any user's `/calls`, `/contacts`, or `/scheduledCalls`. Terms consent (`termsAccepted`, `termsAcceptedAt`) lives exclusively inside private `/users/{userId}` documents; passwords and password hints are never stored.
3. **Email Integrity**: Both `/users/{userId}` and `/userRegistry/{userId}` validate that `email` matches `request.auth.token.email` when present on the auth token.
4. **Immutable Owner Identity & Registration Time**: `ownerUid` / `uid` is immutable after creation; `userRegistry.registeredAt` is set to `request.time` on creation and immutable on update, while `lastActiveAt == request.time`.
5. **Client Session & Cache Isolation**: Client state and offline cache keys are strictly partitioned by `auth.currentUser.uid` (`callanalyzer.u.{uid}.*`), wiped on sign-out, and cleared on account switches.
6. **Path & Size Bounds**: All document IDs (`userId`, `callId`, `contactId`, `scheduleId`, `adminUid`) match `^[a-zA-Z0-9_-]+$` (`1..128` chars). All strings, arrays, maps, numbers, and enums obey strict bounds and `hasOnly` allowlists.

## 2. Adversarial Payloads ("Dirty Dozen")
1. **Unauthenticated read/write**: Unauthenticated client requests `get` or `list` on `/users/userA`, `/admins/adminA`, or `/userRegistry`. Expected: `PERMISSION_DENIED`.
2. **Non-admin user listing userRegistry or self-promoting admin**: Verified non-admin user requests `list` on `/userRegistry`, `get` on `/userRegistry/otherUser`, or `create` on `/admins/userA`. Expected: `PERMISSION_DENIED`.
3. **Admin reading user customer data**: Verified admin in `/admins/{uid}` attempts `get` or `list` on `/users/userA/calls` or `/users/userA/contacts`. Expected: `PERMISSION_DENIED`.
4. **Unverified admin account**: User exists in `/admins/{uid}` with `email_verified: false` and tries `list` on `/userRegistry`. Expected: `PERMISSION_DENIED`.
5. **Cross-user read**: Authenticated user B attempts `get` on `/users/userA` or `/users/userA/contacts/c1`. Expected: `PERMISSION_DENIED`.
6. **UID spoofing**: User A creates `/userRegistry/userB` or `/users/userA/calls/c1` with `ownerUid: "userB"`. Expected: `PERMISSION_DENIED`.
7. **Email spoofing**: User A writes `/userRegistry/userA` with `email: "other@example.com"`. Expected: `PERMISSION_DENIED`.
8. **Ghost / Shadow field**: User A writes `/userRegistry/userA` with an extra field `role: "admin"`. Expected: `PERMISSION_DENIED`.
9. **Oversized ID poisoning**: User A creates `/userRegistry/<150-char-id>`. Expected: `PERMISSION_DENIED`.
10. **Registration timestamp forgery**: User A creates `/userRegistry/userA` with a backdated `registeredAt` instead of `request.time`, or modifies `registeredAt` on update. Expected: `PERMISSION_DENIED`.
11. **Owner transfer on update**: User A attempts to change `ownerUid` during an update on `/users/userA/contacts/k1`. Expected: `PERMISSION_DENIED`.
12. **Type-poisoned event year / oversized note**: User A injects `events[0].year = "hacked"` or a 5,000-char `note` (`maxLength: 500`). Expected: `PERMISSION_DENIED`.
