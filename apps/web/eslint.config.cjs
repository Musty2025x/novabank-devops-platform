const tsParser = require("@typescript-eslint/parser");
module.exports = [{
  files: ["src/**/*.ts", "src/**/*.tsx"],
  languageOptions: { parser: tsParser, parserOptions: { ecmaVersion: "latest", sourceType: "module", ecmaFeatures: { jsx: true } } },
  rules: { "no-console": ["error", { allow: ["warn", "error"] }] }
}];
