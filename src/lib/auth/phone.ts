import {
  getCountryCallingCode,
  isSupportedCountry,
  parsePhoneNumberFromString,
  type CountryCode,
} from "libphonenumber-js";

export const OTP_LENGTH = 6;
/** Seconds before a new code can be requested (the API refuses sooner). */
export const RESEND_SECONDS = 60;

const INDIA = "in";

function phoneCountry(code: string): CountryCode | undefined {
  const iso = code.toUpperCase();
  return isSupportedCountry(iso) ? (iso as CountryCode) : undefined;
}

/**
 * Digits only, without a pasted country code or trunk "0", capped at the
 * country's maximum length:
 *   "+91 99250 08598" / "919925008598" / "099250 08598"  ->  "9925008598" (India)
 */
export function sanitizePhone(raw: string, countryCode: string): string {
  const country = phoneCountry(countryCode);
  if (!country) return raw.replace(/\D/g, "").slice(0, 15);
  const dial = getCountryCallingCode(country);
  const max = country === "IN" ? 10 : 15 - dial.length;
  let digits = raw.replace(/\D/g, "");

  // A "+" prefix, or a full Indian number with its "91", is a pasted country
  // code. Typed digits are never stripped: a real number can start with "91".
  const pastedWithPlus = raw.trim().startsWith("+");
  const pastedInFull = country === "IN" && digits.length === dial.length + max;
  if (digits.startsWith(dial) && (pastedWithPlus || pastedInFull)) {
    digits = digits.slice(dial.length);
  }

  if (country === "IN") return digits.replace(/^0+/, "").slice(0, max);
  // The parser removes domestic trunk prefixes where appropriate, while
  // retaining significant leading zeros (for example Italian landlines).
  const parsed = parsePhoneNumberFromString(digits, country);
  return String(parsed?.nationalNumber ?? digits).slice(0, max);
}

// UX validation only: the server must validate independently.
export function isValidPhone(phone: string, countryCode: string): boolean {
  const country = phoneCountry(countryCode);
  if (!country || !/^\d+$/.test(phone)) return false;
  if (country === "IN" && !/^[6-9][0-9]{9}$/.test(phone)) return false;
  const parsed = parsePhoneNumberFromString(
    `+${getCountryCallingCode(country)}${phone}`,
    country,
  );
  return !!parsed?.isValid() && parsed.country === country;
}

export const invalidPhoneMessage = (countryCode: string): string =>
  countryCode === INDIA
    ? "Enter a valid 10-digit mobile number."
    : "Enter a valid mobile number for the selected country.";

/** India groups as "99250 08598"; other countries are shown as typed. */
export function formatPhone(phone: string, countryCode: string): string {
  return countryCode === INDIA && phone.length > 5
    ? `${phone.slice(0, 5)} ${phone.slice(5)}`
    : phone;
}

/** 7 -> "0:07", 125 -> "2:05" */
export const formatCountdown = (seconds: number): string =>
  `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
