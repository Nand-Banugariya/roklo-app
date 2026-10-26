# Roklo mobile design system

The mobile UI uses React Native Reusables (the native shadcn approach) and
NativeWind 4.2.7, compatible with Expo SDK 57. The source components are owned
in `src/components/ui`; Roklo's public wrappers are in
`src/components/shadcn-custom`, mirroring the web app's naming.

## Shared styles

`src/global.css` contains the exact light and dark color values from the
reference web application's `app/globals.css`. Brand colors keep the `brand-*`
aliases for `--green-*`; ink, semantic, status, chat, and navigation tokens keep
their names. The web app uses Tailwind 4; this app uses the stable Tailwind 3
configuration required by NativeWind 4. `tailwind.config.js` provides the
equivalent of the web stylesheet's `@theme inline` aliases.

Desktop sidebar rules, DOM selectors, browser animations, and wallpaper URLs
are not part of the native stylesheet. Use native layout and Reanimated when
those features are implemented. Do not import the browser shadcn components.

After changing colors in `src/global.css` or aliases in
`src/lib/color-aliases.json`, run `yarn theme:generate`. This updates
`src/lib/theme-tokens.ts` for navigation and native properties that need literal
colors. NativeWind reads the CSS values directly.

## Typography

The same families used by the web app are bundled locally through Expo Google
Fonts and loaded before the splash screen closes:

- Geist regular, medium, semibold, and bold: interface text.
- Geist Mono regular: code and monospaced text.
- Newsreader regular and italic: display headings.

Use `Text` from `@/components/ui/text` so text honors container variants.
Use `font-sans-medium`, `font-sans-semibold`, and `font-sans-bold` to select the
actual bundled weight consistently on Android and iOS. Use `font-display` and
`font-display-italic` for Newsreader headings.

## Components

Base components: Button, Input, Text, Label, Icon, Card, Badge, Checkbox,
Textarea, Separator, Alert, Dialog, and Popover. Floating components use the
root `PortalHost`.

Roklo wrappers: `CustomButton`, `CustomBackButton`, `CustomInput`,
`CustomFormField`, `CustomOTPInput`, `CustomCountryPicker`, `CustomPhoneInput`,
and `CustomAlert`. Inputs and buttons use the web app's 48px auth size and 10px
corners. Country data and phone validation use the same package versions as
Roklo-v2: `country-data-list@1.6.0`, `libphonenumber-js@1.12.40`, and
`react-circle-flags@0.0.27`. The picker offers 244 active, callable countries
supported by the phone library. Shared calling codes use the E.164 country
prefix so regional prefixes are not duplicated in submitted phone numbers.
India remains the default and retains the design's five/five digit grouping.

Web flags use the package's `CircleFlag` component. Android and iOS display
the same package's circular SVG assets using Expo Image because `CircleFlag`
renders an HTML image. The country picker is a searchable dropdown anchored
to the country-code button. Its portal uses keyboard-aware bounds and limits
the results list to the space above the keyboard, independently of the form.
OTP
uses a single accessible native input behind six visual cells for paste,
backspace, and OS one-time-code autofill.

The development-only `/components` route is an interactive preview for
light/dark themes, loading, validation, country search, OTP, and dialogs. It
sends no authentication requests. The app opens the integrated login flow;
see [authentication.md](authentication.md) for its structure and setup.

## Upstream

Components were installed from the official NativeWind registry at
https://reactnativereusables.com/r/nativewind/ and customized to Roklo.
The upstream MIT license is in `docs/licenses/react-native-reusables.txt`.

Use `npx expo install` for dependencies to preserve Expo SDK compatibility.
Restart Metro with `npx expo start --clear` after changing Babel, Metro, or
Tailwind configuration.
