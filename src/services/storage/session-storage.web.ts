// Match the reference web app's first-party cookie. Native uses SecureStore.
const KEY = "rk_mobile_access_token";
export const sessionStorage = {
  async read(): Promise<string | null> {
    if (typeof document === "undefined") return null;
    const part = document.cookie
      .split("; ")
      .find((value) => value.startsWith(`${KEY}=`));
    return part ? decodeURIComponent(part.slice(KEY.length + 1)) : null;
  },
  async write(token: string) {
    if (typeof document === "undefined")
      throw new Error("Session storage is unavailable.");
    // The API enforces JWT expiry. Cookies are host-scoped and never sent as ambient API auth.
    document.cookie = `${KEY}=${encodeURIComponent(token)}; path=/; SameSite=Lax; max-age=2592000${location.protocol === "https:" ? "; Secure" : ""}`;
    if (
      !document.cookie.split("; ").some((value) => value.startsWith(`${KEY}=`))
    )
      throw new Error("Session storage is unavailable.");
  },
  async remove() {
    if (typeof document !== "undefined")
      document.cookie = `${KEY}=; path=/; SameSite=Lax; max-age=0`;
  },
};
