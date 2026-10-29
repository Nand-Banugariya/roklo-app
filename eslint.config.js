// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require("eslint/config");
const expoConfig = require("eslint-config-expo/flat");
const eslintPluginPrettierRecommended = require("eslint-plugin-prettier/recommended");

module.exports = defineConfig([
  expoConfig,
  // Formatting is Prettier's (.prettierrc.json): `expo lint` reports anything not formatted.
  eslintPluginPrettierRecommended,
  {
    ignores: ["dist/*"],
  },
]);
