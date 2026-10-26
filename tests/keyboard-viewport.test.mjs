import assert from "node:assert/strict";
import { test } from "node:test";

import { keyboardViewport } from "../src/lib/keyboard-viewport.ts";
import { COUNTRIES, filterCountries } from "../src/lib/auth/countries.ts";

const screen = {
  screenHeight: 844,
  windowHeight: 844,
  safeTop: 24,
  safeBottom: 24,
};

test("country popover excludes an overlay keyboard even if the window never resizes", () => {
  const bounds = keyboardViewport({ ...screen, keyboardTop: 420 });
  assert.equal(844 - bounds.bottom, 408);
  assert.equal(bounds.top, 36);
  assert.equal(bounds.maxHeight, 372);
  // The primitive clamps a bottom dropdown to screenHeight - inset - contentHeight.
  const contentHeight = 318;
  const top = Math.min(500, 844 - bounds.bottom - contentHeight);
  assert.ok(top >= bounds.top);
  assert.ok(top + contentHeight <= 420 - 12);
});

test("an already resized Android window has the same usable bounds, without double counting", () => {
  const overlay = keyboardViewport({ ...screen, keyboardTop: 420 });
  assert.deepEqual(
    keyboardViewport({ ...screen, windowHeight: 420, keyboardTop: 420 }),
    overlay,
  );
  assert.deepEqual(keyboardViewport({ ...screen, windowHeight: 420 }), overlay);
});

test("a tall keyboard constrains the list as well as moving the dropdown", () => {
  const bounds = keyboardViewport({ ...screen, keyboardTop: 250 });
  const searchHeight = 56;
  const listHeight = Math.max(
    0,
    Math.min(260, bounds.maxHeight - searchHeight - 2),
  );
  assert.ok(
    listHeight >= 44,
    "at least one selectable country remains visible",
  );
  assert.ok(searchHeight + listHeight + 2 <= bounds.maxHeight);
  assert.ok(bounds.top + searchHeight + listHeight + 2 <= 250 - 12);
});

test("mobile browser viewport offset and dismissal restore usable bounds", () => {
  const active = keyboardViewport({
    ...screen,
    viewportTop: 100,
    viewportBottom: 480,
  });
  assert.equal(active.top, 112);
  assert.equal(844 - active.bottom, 468);
  const hidden = keyboardViewport(screen);
  assert.equal(hidden.top, 36);
  assert.equal(hidden.bottom, 36);
  assert.equal(hidden.maxHeight, 772);
});

test("country search keeps the reference data and supports names and calling codes", () => {
  assert.ok(COUNTRIES.length > 200);
  assert.ok(
    COUNTRIES.some(
      (country) => country.code === "in" && country.dial === "+91",
    ),
  );
  assert.deepEqual(
    filterCountries("+971").map((country) => country.code),
    ["ae"],
  );
  assert.deepEqual(
    filterCountries("united").map((country) => country.code),
    ["tz", "ae", "gb", "us"],
  );
  assert.equal(filterCountries("no such country").length, 0);
});
