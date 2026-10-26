# Settings UI

The reference is `Roklo-v1/roklo-ai-app/components/settings/SettingsNav.tsx`,
`AccountScreen.tsx`, `PreferencesSection.tsx`, `SecuritySection.tsx`,
`WorkspaceSettingsScreen.tsx`, `NumbersSection.tsx`, `AlertsSection.tsx`,
and the Team screen. V1's billing and opt-out navigation remains hidden.

The native implementation lives in `src/features/settings/`. Account contains
Profile, Preferences and Security. Workspace contains General, WhatsApp
numbers, Team and Alerts. Members see account sections and Team, matching V1.
Phones use a horizontally scrollable section menu. Wide screens use a grouped
208px menu. Sections use the existing `/settings` route with an Expo Router
`section` parameter. Each section has a mobile-sized card layout with the
existing Roklo colors, fonts and custom components, including white titles
and descriptions in dark mode.

This is a UI implementation only. Existing auth/workspace selectors supply
the visible name, email, phone, photo and workspace. There are no settings,
members, device-session or billing API requests. The shared messaging
provider loads WhatsApp numbers separately. Unavailable counts
and plan data are shown as dashes; no team or WhatsApp records are fabricated.
Fields, switches, inline selections, image previews, tabs, search fields and form
opening/closing work locally. Server action buttons stay disabled and a
preview note explains that changes are not saved. Profile photos and logos
can be selected for preview with the already installed DocumentPicker.
Reset/removal affects only that preview. Existing appearance controls,
navigation to WhatsApp numbers, and the full-screen sign-out flow remain usable.

The reusable `CustomSwitch` has a 44px touch target and a screen-reader
checked state. Settings use `SettingsSelect`, which expands in the document
flow, and `SettingsInlineForm` for confirmations and edits. Onboarding keeps
its existing controls. No settings action opens a popup.
