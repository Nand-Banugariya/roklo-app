import assert from "node:assert/strict";
import { test } from "node:test";
import { countries } from "country-data-list";

import {
  COUNTRIES,
  filterCountries,
  getCountry,
} from "../src/lib/auth/countries.ts";
import { countryFlagUrl } from "../src/lib/auth/country-flags.ts";
import {
  isValidPhone,
  sanitizePhone,
  formatPhone,
} from "../src/lib/auth/phone.ts";

test("country picker uses active country-data-list entries supported for phone validation", () => {
  assert.ok(COUNTRIES.length > 200);
  assert.equal(
    new Set(COUNTRIES.map((country) => country.code)).size,
    COUNTRIES.length,
  );
  for (const country of COUNTRIES) {
    const data = countries.all.find(
      (entry) => entry.alpha2.toLowerCase() === country.code,
    );
    assert.equal(country.name, data?.name);
    assert.notEqual(data?.status, "deleted");
    assert.notEqual(data?.ioc, "PRK");
  }
  assert.equal(getCountry("IND").code, "in");
  assert.equal(getCountry("unknown").code, "in");
  assert.equal(getCountry("ag").dial, "+1");
  assert.equal(filterCountries("+1268")[0].code, "ag");
});

test("phone validation uses each country's numbering plan and shared-code region", () => {
  assert.equal(isValidPhone("9876543210", "in"), true);
  assert.equal(isValidPhone("1234567890", "in"), false);
  assert.equal(isValidPhone("4155550199", "us"), true);
  assert.equal(isValidPhone("4155550199", "ca"), false);
  assert.equal(isValidPhone("123456", "us"), false);
  assert.equal(isValidPhone("612345678", "fr"), true);
});

test("phone paste removes the selected calling code without losing significant national zeros", () => {
  assert.equal(sanitizePhone("+91 98765 43210", "in"), "9876543210");
  assert.equal(sanitizePhone("919876543210", "in"), "9876543210");
  assert.equal(sanitizePhone("+1 (415) 555-0199", "us"), "4155550199");
  assert.equal(sanitizePhone("020 7946 0018", "gb"), "2079460018");
  assert.equal(sanitizePhone("+39 02 3661 8300", "it"), "0236618300");
  assert.equal(formatPhone("9876543210", "in"), "98765 43210");
});

test("native flags use react-circle-flags assets and its supported-country fallback", () => {
  assert.equal(
    countryFlagUrl("IN"),
    "https://react-circle-flags.pages.dev/in.svg",
  );
  assert.equal(
    countryFlagUrl("unknown"),
    "https://react-circle-flags.pages.dev/xx.svg",
  );
});
