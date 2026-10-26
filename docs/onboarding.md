# After OTP: onboarding

The v1 frontend sends a newly verified user to `/setup`. A user whose
`isOnboarded` flag is already true goes to `/inbox`. An invited user with
`hasOwnWorkspace: false` skips the workspace question and starts with About
you. The mobile app already has these route guards.

The mobile `/setup` route now runs the complete five-step flow, connected to
the API services, Redux state, persistence, and controller hook. It uses the
existing custom shadcn components, Geist/Newsreader fonts, and shared theme.
No live onboarding requests were sent during development.

## Reference flow and APIs

The setup steps are workspace, about you, business, usage, and source. The
last three steps are optional; skipping clears those step's answers. The
source frontend keeps use-case choices locally and omits them from the API
payload; mobile follows that behavior.

| Method | Endpoint | Purpose |
| --- | --- | --- |
| GET | `/auth/me` | Load profile, ownership, onboarding flag, and prefill values; refresh after completion. |
| POST | `/settings/profile/email-verification/request` | Request a code for the optional work email; body `{ email }`. |
| POST | `/settings/profile/email-verification/verify` | Confirm work email; body `{ otpRef, otp }`. |
| POST | `/auth/onboarding` | Submit all setup answers and an optional workspace logo as multipart. |

All four endpoints use the saved bearer token. The client sets JSON content
type for plain objects; multipart is passed through so the native/browser
fetch implementation sets its own boundary.

Multipart fields follow the v1 frontend:

- `onboardingDto`: a JSON string with `name`, verified `email`, `occupation`,
  `companySize`, `whatsappMessageVolume`, and `referralSource`. Unanswered
  strings are omitted. Email aliases are stripped as on web.
- `workspaceName`: included for workspace owners.
- `workspaceLogo`: optional PNG/JPG, up to the reference UI's 2 MB limit.
  Native uses a `{ uri, name, type }` form part; web uses a Blob/File.
- `inviteToken`: optional; when provided, workspace fields are omitted.

The service also exposes the reference's `finishInviteeSetup` API helper. It
does not accept workspace invitations; that remains a separate feature.

## Code layout

- `src/features/onboarding/services/onboarding-api.ts`: typed API factory and
  backend error mapping, including already onboarded and email conflicts.
- `services/onboarding-service.ts`: app API, auth, storage, and clock dependencies.
- `services/draft-persistence.ts`: serialized, user-scoped draft storage.
- `store/onboarding-slice.ts`: answers, step, ownership, statuses, errors, request
  IDs, email challenge, retry deadline, and completion result.
- `store/onboarding-thunks.ts`: profile load, email request/verify, and submit.
- `store/draft-listener.ts`: saves drafts and clears them on completion, logout,
  account switch, or explicit reset.
- `hooks/use-onboarding.ts`: shared controller for the setup screens.
- `screens/setup-screen.tsx`: initialization, step navigation, submit/retry, and
  the success-to-inbox handoff.
- `components/steps/`: workspace, About you, business, usage, and source UI.
- `components/setup-layout.tsx`: safe-area layout, progress, scrolling, and
  keyboard avoidance. OTP input and confirm share a focus target.
- `hooks/use-workspace-logo.ts`: Expo document picker, preview lifetime, and
  local-only file state. PNG/JPG files are limited to 2 MB.
- `utils/validation.ts` and `constants.ts`: reference rules and option values.
- `src/services/storage/onboarding-storage(.web).ts`: SecureStore on native;
  tab-scoped sessionStorage on web.

These paths beneath `services`, `store`, `hooks`, and `utils` are relative to
`src/features/onboarding/` unless the full `src/` prefix is given.

## State and persistence

Drafts include only answers and current step, scoped to the authenticated
user. Logo files, access tokens, OTP references, and OTP values are not saved
in the draft. The email code itself stays in the verification thunk's closure
and never enters Redux actions or state. On restore, an email is considered
verified only if it matches the verified email in `/auth/me`.

Request IDs and the captured account/token prevent late replies from changing
a new account's state. Editing email invalidates its challenge. Redux statuses
prevent duplicate requests; resend uses an absolute server-aware deadline.

After successful onboarding, the draft is cleared and the auth user is marked
onboarded. A subsequent profile-refresh failure is recorded separately and
does not cause another onboarding POST. A late pre-onboarding profile response
cannot undo that flag. An already-onboarded response also completes the flow.
An email conflict returns state to About you while preserving other answers.

## Screen integration

`SetupScreen` initializes the data layer when it opens. Fields and option cards
write to `answers`; Back, Continue, and Skip use the existing reducers. Skip is
shown on Business and Usage; Source uses Finish setup. The work-email code stays
local to its component, supports autofill/paste, confirms on six digits, and can
also be confirmed with a button. Resend observes the shared deadline.

The industry select is searchable and constrained to the visible viewport.
Forms scroll above the keyboard; the native header compacts while it is open.
Changing steps starts at the top. Logo selection survives Back/Continue within
the mounted flow; it must be reselected after an app/page restart.

The protected-route selector keeps a freshly completed setup mounted for the
success screen even after auth becomes onboarded. Go to inbox dismisses that
completion state and replaces the route with `/inbox`. Already-onboarded users
go straight to the inbox. This prevents a second onboarding submission.

The service and state layer do not start WhatsApp polling or build the Inbox.
The mobile success screen leads into the inbox entry page inside the shared
[app navigation](navigation.md). WhatsApp connection and the full inbox remain
separate feature modules.

## Checks

`npm test` covers API payloads, multipart boundaries and file parts, step rules,
email verification and cooldown, account changes, duplicate submission, profile
refresh failure, draft write/delete races, file selection metadata, completion
route guards, and submitting after skipping the final step. Use `npx tsc --noEmit`
and `npx expo lint` for the screen integration.

The exported web app was also checked in a browser using intercepted API
responses: all owner steps, optional email OTP success/error, keyboard-sized
viewport visibility, industry search, saved-step recovery after reload, logo
multipart submission, Back/Skip, retry after failure, success-screen routing,
already-onboarded access, and the four-step invitee flow. No live account was
modified. Device keyboard animations and live email delivery require a device
and real account check.
