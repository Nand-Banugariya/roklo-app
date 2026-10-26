# Mobile authentication

The login, email verification, and SMS verification screens use the shared
Roklo custom components, colors, and bundled fonts. Their requests follow the
reference `roklo-api` authentication contract. No reference project was changed.

## Structure

- `src/app`: Expo Router route entries and navigator guards only.
- `src/features/auth/screens`: login, email, verification, and signed-in handoff.
- `src/features/auth/components`: shared auth layout, background, and heading.
  The login screen passes `AuthCarousel` as the layout's `hero`. It is a
  swipeable strip of four simple, flat illustrations (Welcome, Inbox,
  Broadcast, Private note) drawn as SVG in `auth-art.tsx`: UI cards, placeholder
  bars, and small avatars. They use theme tokens, so they adapt to dark mode.
  Each has a title, description, and tappable dot. The carousel fills all the
  space between the wordmark and the login card and sizes the art to fit, so no
  empty band is left in the middle of the screen. It advances every 4.5 s,
  pauses while dragged, stops when another auth screen is on top or reduced
  motion is on. With the keyboard open it drops the title and dots and shows
  only the top of the art above the login card, which covers the rest.
- `src/features/auth/providers`: transient sign-in flow and session lifecycle.
- `src/features/auth/services`: typed auth API mapping and instantiated service.
- `src/features/auth/store`: Redux user and authentication status.
- `src/services/api`: common request client, timeouts, and unauthorized handling.
- `src/services/storage`: native SecureStore, web cookie adapter, and serialized
  session persistence.
- `src/components/shadcn-custom`: reusable controls used by the screens.

OTP values, CAPTCHA tokens, and access tokens are excluded from Redux. An
in-memory sign-in provider owns the active form and OTP challenge; leaving or
restarting the app requires requesting another code. There is no refresh-token
endpoint in the reference backend. Startup restores the saved access token and
validates it with `/auth/me` before opening protected screens.

## API flow

1. `POST /auth/login` with `mobileNumber`, ISO `country`, and optional `email`
   and `captchaToken`. The mobile number includes its country dial code.
2. A response with `emailRequired` opens the email screen. Resubmitting login
   with email can return an email OTP challenge.
3. `POST /auth/verify-otp` with `mobileNumber`, `otp`, and the current `otpRef`.
   Email verification can return `mobileVerificationRequired` and a replacement
   reference; the user must complete that SMS challenge before signing in.
4. `POST /auth/resend-otp` with `mobileNumber` and email for an email challenge.
   Replace the challenge reference after every resend. The 60-second countdown
   uses an absolute deadline and respects server retry delays.
5. Persist the issued access token, set the Redux user, and route by
   `isOnboarded`. Authenticated requests use a bearer header. A 401 invalidates
   only the token used for that request, protecting a newly issued session from
   stale responses.
6. Logout clears local state and storage and attempts `POST /auth/logout`.

`/setup` now runs the onboarding screens, API services, Redux state and draft
recovery described in [onboarding.md](onboarding.md). Successful setup shows a
confirmation before opening `/inbox`. Authenticated pages now use the mobile
navigation/sidebar and shared layout described in [navigation.md](navigation.md).

## Configuration

Copy the keys in `.env.example` into `.env` when setting up another checkout.
The existing `.env` is preserved and ignored by Git. It currently selects
`https://dev-api.roklo.ai`; tests use intercepted responses and send no real OTP.

- `EXPO_PUBLIC_API_BASE_URL`: backend origin, without an `/auth` suffix.
- `EXPO_PUBLIC_WEB_URL`: website origin used by help and legal links.
- `EXPO_PUBLIC_TURNSTILE_SITE_KEY`: optional public Cloudflare site key.
- `EXPO_PUBLIC_TURNSTILE_URL`: hosted HTTPS URL of the CAPTCHA bridge below.

Without an explicit API URL, development uses the Metro host on port 8000 for
native devices and localhost:8000 for web. An Android emulator without a Metro
host falls back to 10.0.2.2:8000. Physical devices must be able to reach the API;
localhost on a phone refers to the phone itself. Production requires an API URL.
Browser testing also requires the backend to allow the web app's CORS origin.

When backend CAPTCHA enforcement is enabled, host
`public/auth/turnstile.html` on a domain allowed by the Cloudflare widget and
set both public CAPTCHA variables. Native displays that page in a WebView;
web uses an iframe and validates message origin and source. A configured site
key blocks submission until a challenge token arrives. Keep the Cloudflare
secret in the backend. The bridge is supplied but has not been deployed.

## Keyboard behavior

The auth layout measures the safe-area container against the keyboard's top
edge and reserves only the overlap as bottom padding around the ScrollView.
This reduces the actual scroll viewport when the keyboard overlays the app,
including in Expo Go. Android uses `softwareKeyboardLayoutMode: resize`; an
already resized window produces no additional keyboard inset. The form grows
to its content height instead of using `flex: 1`, which can constrain the native
scroll content and leave overflowing controls unreachable.

Focusing OTP, keyboard appearance/frame changes, and layout/content changes
measure and reveal the OTP fields, resend controls, and Verify button. Reading
`Keyboard.metrics()` also handles mounting or Fast Refresh with the keyboard
already visible. Compact spacing leaves more room while it is open. If a
section exceeds the available height, its top is revealed and the remaining
controls can be scrolled to.

Native keyboard behavior should be checked on an Android phone and iPhone,
including large text sizes and error messages. The automated browser check
validates a 390x420 viewport but cannot reproduce an OS keyboard animation.

The country dropdown is portalled outside the form. It uses its own
`useKeyboardViewport` bounds: native keyboard events/current metrics and web
visual-viewport updates set the popover's collision insets and maximum list
height. This also handles overlay keyboards where the app window stays full
height. The search stays above the results; selecting a country works on the
first tap with the keyboard open and dismisses it.

## Validation

Run `npm test`, `npx tsc --noEmit`, `npx expo lint`, and `npx expo-doctor`.
The tests cover the backend DTOs, both OTP flows, resend references, expiry and
cooldowns, error mapping, unauthorized handling, session persistence races,
and keyboard visibility calculations. Node 24 can run the TypeScript service
tests directly with the package's test script.

The development browser check exercised phone validation, wrong code, resend,
SMS login, international email followed by SMS, session restoration, logout,
and routing with intercepted API responses. Live SMS/email delivery and a real
device keyboard are separate manual checks.

Expo SDK 57 documentation used for the implementation:
[SDK reference](https://docs.expo.dev/versions/v57.0.0/),
[keyboard handling](https://docs.expo.dev/guides/keyboard-handling/),
[SecureStore](https://docs.expo.dev/versions/v57.0.0/sdk/securestore/), and
[protected routes](https://docs.expo.dev/router/advanced/protected/).
