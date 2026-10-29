import { env } from "@/config/env";

export function captchaUrl(theme: "light" | "dark"): string | null {
  if (!env.turnstileSiteKey) return null;
  try {
    const url = new URL(env.turnstileUrl);
    if (url.protocol !== "https:" && !(__DEV__ && url.protocol === "http:")) return null;
    url.searchParams.set("sitekey", env.turnstileSiteKey);
    url.searchParams.set("theme", theme);
    return url.toString();
  } catch {
    return null;
  }
}
export function parseCaptchaMessage(data: string): string | null | undefined {
  try {
    const value: unknown = JSON.parse(data);
    if (
      !value ||
      typeof value !== "object" ||
      !("type" in value) ||
      value.type !== "roklo-turnstile"
    )
      return undefined;
    if (
      "status" in value &&
      value.status === "success" &&
      "token" in value &&
      typeof value.token === "string" &&
      value.token.length > 0 &&
      value.token.length < 4096
    )
      return value.token;
    return null;
  } catch {
    return undefined;
  }
}
