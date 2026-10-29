import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { test } from "node:test";

// Exercise the Android CSS compiler, rather than the browser's CSS renderer.
process.env.NATIVEWIND_OS = "android";
const require = createRequire(import.meta.url);
const postcss = require("postcss");
const tailwind = require("tailwindcss");
const { cssToReactNativeRuntime } = require("react-native-css-interop/css-to-rn");
const config = require("../tailwind.config.js");
const files = [
  "../src/features/navigation/components/motion-pressable.tsx",
  "../src/features/navigation/components/bottom-navigation.tsx",
  "../src/features/navigation/components/number-switcher.tsx",
  "../src/features/messaging/screens/inbox-screen.tsx",
];
const content = files.map((file) => ({
  raw: readFileSync(new URL(file, import.meta.url), "utf8"),
  extension: "tsx",
}));
const css = await postcss([tailwind({ ...config, content })]).process("@tailwind utilities;", {
  from: undefined,
});
const compiled = cssToReactNativeRuntime(Buffer.from(css.css), { inlineRem: 16 });
const rules = new Map(
  Array.isArray(compiled.rules) ? compiled.rules : Object.entries(compiled.rules),
);

test("Android emits layout rules for full-width navigation and the floating chat button", () => {
  for (const name of [
    "flex-1",
    "flex-row",
    "min-h-14",
    "min-h-11",
    "shrink-0",
    "absolute",
    "bottom-5",
    "right-5",
    "px-5",
    "rounded-2xl",
  ]) {
    assert.ok(rules.has(name), `${name} must exist in native styles`);
    assert.ok(
      rules.get(name).n?.some((rule) => rule.d?.length),
      `${name} must produce native declarations`,
    );
  }
});

test("touch feedback is a pressed state, never a transition that would keep the pressed look on", () => {
  const motion = readFileSync(
    new URL("../src/features/navigation/components/motion-pressable.tsx", import.meta.url),
    "utf8",
  );
  assert.ok(motion.includes("active:scale-[0.98]"), "rows still scale while pressed");
  assert.ok(
    !/["'`][^"'`]*\b(transition-|duration-|animate-)/.test(motion),
    "no transition classes on pressables",
  );
});

test("pressed looks become inline styles from the theme, so a press never changes NativeWind classes", async () => {
  const { pressedStyle } = await import("../src/lib/pressed-style.ts");
  const colors = { accent: "#f3f6f4", "brand-700": "#0c6149" };
  assert.deepEqual(pressedStyle(["bg-accent", "scale-[0.98]"], colors), {
    backgroundColor: "#f3f6f4",
    transform: [{ scale: 0.98 }],
  });
  assert.deepEqual(pressedStyle(["bg-white/10", "border-brand-700", "opacity-80"], colors), {
    backgroundColor: "rgba(255, 255, 255, 0.1)",
    borderColor: "#0c6149",
    opacity: 0.8,
  });
  assert.deepEqual(
    pressedStyle(["bg-unknown", "rounded-xl"], colors),
    {},
    "unknown colours and other utilities are ignored",
  );
});
