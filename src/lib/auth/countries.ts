import { countries } from "country-data-list";
import { getCountryCallingCode, isSupportedCountry, type CountryCode } from "libphonenumber-js";

export interface Country {
  /** ISO 3166-1 alpha-2, lowercase (also the flag file name). */
  code: string;
  name: string;
  dial: string;
  alpha3: string;
  callingCodes: string[];
}

export const DEFAULT_COUNTRY_CODE = "in";

// Same data package and active-country rules as Roklo-v2. Only offer regions
// whose national numbers can also be validated by libphonenumber-js.
export const COUNTRIES: Country[] = countries.all
  .filter(
    (country) =>
      country.emoji &&
      country.status !== "deleted" &&
      country.ioc !== "PRK" &&
      country.countryCallingCodes.length > 0 &&
      isSupportedCountry(country.alpha2),
  )
  .map((country) => ({
    code: country.alpha2.toLowerCase(),
    alpha3: country.alpha3,
    name: country.name,
    // Regional prefixes such as +1268 include national-number digits; use the
    // E.164 country prefix (+1) so a pasted national number is not duplicated.
    dial: `+${getCountryCallingCode(country.alpha2 as CountryCode)}`,
    callingCodes: country.countryCallingCodes.map((dial) => dial.replace(/\s/g, "")),
  }))
  .sort((left, right) => left.name.localeCompare(right.name));

export const getCountry = (code: string): Country =>
  COUNTRIES.find(
    (country) => country.code === code.toLowerCase() || country.alpha3 === code.toUpperCase(),
  ) ?? COUNTRIES.find((country) => country.code === DEFAULT_COUNTRY_CODE)!;

/** Matches the query against the country name or its dial code ("91" or "+91"). */
export function filterCountries(query: string): Country[] {
  const q = query.trim().toLowerCase();
  if (!q) return COUNTRIES;

  const dialQuery = q.replace(/^\+?/, "+");
  return COUNTRIES.filter(
    (country) =>
      country.name.toLowerCase().includes(q) ||
      country.code === q ||
      country.alpha3.toLowerCase() === q ||
      country.dial.includes(dialQuery) ||
      country.callingCodes.some((dial) => dial.includes(dialQuery)),
  );
}
