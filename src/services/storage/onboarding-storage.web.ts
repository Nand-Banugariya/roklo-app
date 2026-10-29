export const onboardingStorage = {
  async read(key: string) {
    return typeof window === "undefined" ? null : window.sessionStorage.getItem(key);
  },
  async write(key: string, value: string) {
    if (typeof window !== "undefined") window.sessionStorage.setItem(key, value);
  },
  async remove(key: string) {
    if (typeof window !== "undefined") window.sessionStorage.removeItem(key);
  },
};
