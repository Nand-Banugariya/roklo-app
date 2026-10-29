import Constants from "expo-constants";
import { Platform } from "react-native";

function developmentApiUrl() {
  if (Platform.OS === "web") return "http://localhost:8000";
  const host = Constants.expoConfig?.hostUri;
  if (!host) return Platform.OS === "android" ? "http://10.0.2.2:8000" : "http://localhost:8000";
  try {
    const url = new URL(host.includes("://") ? host : `http://${host}`);
    url.port = "8000";
    url.pathname = "";
    return url.origin;
  } catch {
    return "";
  }
}

function websiteUrl(): `https://${string}` | `http://${string}` {
  try {
    const value = new URL(process.env.EXPO_PUBLIC_WEB_URL?.trim() || "https://app.roklo.ai");
    if (value.protocol === "https:" || value.protocol === "http:")
      return value.toString().replace(/\/+$/, "") as `https://${string}` | `http://${string}`;
  } catch {
    /* Use the public Roklo website when the optional URL is invalid. */
  }
  return "https://app.roklo.ai";
}

// Expo requires direct EXPO_PUBLIC_* access for build-time substitution.
export const env = {
  apiBaseUrl: (
    process.env.EXPO_PUBLIC_API_BASE_URL?.trim() || (__DEV__ ? developmentApiUrl() : "")
  ).replace(/\/+$/, ""),
  webUrl: websiteUrl(),
  turnstileSiteKey: process.env.EXPO_PUBLIC_TURNSTILE_SITE_KEY?.trim() || "",
  turnstileUrl: process.env.EXPO_PUBLIC_TURNSTILE_URL?.trim() || "",
};
