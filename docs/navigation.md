# App navigation and page layout

The navigation is based on the v2 web app's `sidebar.view.tsx`,
`sidebar.controller.tsx`, `top-bar.tsx`, and workspace API/model. The mobile
app keeps the current Roklo custom components, theme tokens, Geist, and
Newsreader. No dependency was added for navigation.

## Layout

- Phones: Chats, Broadcast, Contacts and More along the bottom. The WhatsApp
  Numbers control sits in the header beside the active number and opens a
  full account-selection screen. More (`/menu`) is a tab root, not a pushed
  screen: it keeps the bottom bar, has no Back header, and lists the
  remaining destinations in Messaging (Templates, Groups, Tags, Message
  activity), Workspace (WhatsApp numbers, Team, AI connections, Overview) and
  Account (Settings, account, workspaces) sections. More stays enabled in a
  disabled workspace; its workspace-scoped rows are disabled instead.
  `PRIMARY_DESTINATIONS` in `config/navigation.ts` decides which modules get a
  tab — keep it at four or fewer so More remains the fifth slot.
- Tab screens draw their own large title, number line and bottom tabs (`components/tab-screen.tsx`), so they slide in with the screen when you come back from a chat instead of popping in above the stack after the transition and pushing the content down. Each screen names its tab; nothing reads the URL for it. The shell keeps one safe area for every screen, so the stack never resizes while navigating.
- Chat keyboard handling leaves Android's status and navigation bars translucent, matching the shell's edge-to-edge layout. The shell alone supplies system-bar padding; the keyboard observer must not add root margins or switch window fitting when a chat mounts or unmounts, which makes the Chats heading jump during back navigation.
- Windows at least 900 pixels wide: a persistent labelled sidebar.
- Compact module header with active number, Alerts and Menu. Detail screens
  have their own Back header and use the full available height.
- Page titles, descriptions, and navigation labels use white text in dark
  mode while retaining the existing green backgrounds and icon accents.
- Native keyboard events hide the bottom bar while editing. The signed-in
  flow uses full routes and inline forms; it has no sheets or popovers.
- Expo Router Stack keeps navigation history between sections.
  Authentication and onboarding guards remain at the root navigator.

The routes are `/dashboard`, `/connections`, `/inbox`, `/contacts`, `/groups`,
`/broadcasts`, `/templates`, `/activity`, and `/settings`. Each route is a
small screen entry under `src/app/(app)/`. Layout and navigation code lives
under `src/features/navigation/`, outside the route directory.

Chats and WhatsApp numbers now have working API-backed screens, including
number linking by phone code, number selection, paginated chats, conversation
threads and text replies. See [Mobile inbox](mobile-inbox.md) for the scope,
motion contract and remaining module work. Other business routes retain
their page entry frames and links. Domain counts are never fabricated.
Settings uses the V1 account/workspace section layout with local form and
inline form previews; see [Settings UI](settings.md). Appearance changes use the
existing theme controller for this session. Settings API integration is
outside the current UI work.

## Workspace data and actions

| Method | Endpoint | Purpose |
| --- | --- | --- |
| GET | `/workspaces` | Fetch the signed-in user's memberships. |
| GET | `/workspaces/:id` | Refresh the selected workspace's details/status. |
| PUT | `/workspaces/:id/set-default` | Switch the default workspace after a user selection. |

These authenticated APIs follow the v2 frontend. Switching preserves the
current section and updates the auth default only after the PUT succeeds.
Failure keeps the previous workspace selected and offers retry. The list is
reused across page navigation; Refresh explicitly reloads it.

`src/features/workspaces/` contains typed API services, the Redux slice,
selectors, and an injectable thunk factory. It prefers a valid existing
selection, the user's default workspace, the user's original workspace,
then a list default or available membership. Deleted workspaces are filtered
out. Disabled workspaces cannot be selected, and a selected workspace that
becomes disabled blocks business content while keeping account/settings and
workspace switching available.

Responses are checked against the captured account, token, and request IDs.
Logout and account changes reset workspace state. Late detail replies cannot
overwrite a subsequent selection. Future domain caches must be keyed by
account and active workspace; v2 workspace APIs use `/w/:workspaceId/...`
for scoped business requests. The messaging provider uses the selected
workspace for its scoped requests and keys number preferences by user and
workspace.

The account screen uses the existing SessionProvider sign-out behavior, which
clears local state/session and revokes the token. Logout is confirmed on its
own full screen; cancelling keeps the session.

## Checks

`npm test` covers API paths, malformed/deleted records, workspace preference,
duplicate loads/switches, disabled membership, failed-switch recovery, stale
responses, account changes, and nested navigation matching. Lint, typecheck,
platform exports, and browser checks cover the shared layout. Browser API
requests are intercepted; no real account/default workspace is changed.
