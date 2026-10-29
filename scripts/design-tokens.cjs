const fs = require("node:fs");
const path = require("node:path");

// global.css is the source of truth for both NativeWind and navigator colors.
const css = fs.readFileSync(path.join(__dirname, "../src/global.css"), "utf8");
function readVariables(selector) {
  const block = css.match(selector)?.[1];
  if (!block) throw new Error("Missing Roklo theme in src/global.css");
  return Object.fromEntries(
    [...block.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)].map(([, key, value]) => [key, value.trim()]),
  );
}
const light = readVariables(/(?<![\w.:]):root\s*\{([\s\S]*?)\}/);
const dark = { ...light, ...readVariables(/\.dark:root\s*\{([\s\S]*?)\}/) };
function resolve(value, variables, visited = new Set()) {
  return value.replace(/var\((--[\w-]+)\)/g, (_, key) => {
    if (!variables[key] || visited.has(key)) throw new Error(`Invalid theme variable: ${key}`);
    return resolve(variables[key], variables, new Set([...visited, key]));
  });
}
const aliases = require("../src/lib/color-aliases.json");
const colors = Object.fromEntries(
  Object.entries(aliases).map(([name, variable]) => [name, `var(${variable})`]),
);
const themes = Object.fromEntries(
  Object.entries({ light, dark }).map(([mode, variables]) => [
    mode,
    Object.fromEntries(
      Object.entries(aliases).map(([name, variable]) => [
        name,
        resolve(variables[variable], variables),
      ]),
    ),
  ]),
);

if (require.main === module) {
  fs.writeFileSync(
    path.join(__dirname, "../src/lib/theme-tokens.ts"),
    `// Generated from src/global.css by yarn theme:generate. Do not edit manually.\nexport const themeTokens = ${JSON.stringify(themes, null, 2)} as const;\n`,
  );
}
module.exports = { colors, themes };
