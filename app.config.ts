import type { ConfigContext, ExpoConfig } from "expo/config";

// `APP_VARIANT=local` (the "local-server" EAS profile): a separate app for a backend on the local network.
// Its own name and app ID install it beside the other builds, and it may call a plain http:// server,
// which Android blocks in release builds otherwise.
const LOCAL = process.env.APP_VARIANT === "local";
const LOCAL_ID = "com.nand05.rokloapp.local";

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: LOCAL ? "Roklo Local" : (config.name ?? "roklo-app"),
  slug: config.slug ?? "roklo-app",
  ios: {
    ...config.ios,
    ...(LOCAL && { bundleIdentifier: LOCAL_ID }),
  },
  android: {
    ...config.android,
    ...(LOCAL && { package: LOCAL_ID }),
    // EAS file variable, or a local path provided in .env before building. The local app's must be the
    // google-services.json of its own Firebase Android app (com.nand05.rokloapp.local).
    googleServicesFile:
      process.env.GOOGLE_SERVICES_JSON?.trim() || config.android?.googleServicesFile,
  },
  plugins: [
    ...(config.plugins ?? []),
    ["expo-build-properties", { android: { usesCleartextTraffic: LOCAL } }],
  ],
});
