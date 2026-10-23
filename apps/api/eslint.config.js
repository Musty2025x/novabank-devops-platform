const tsParser = require("@typescript-eslint/parser");
module.exports = [{files:["src/**/*.ts","tests/**/*.ts"],languageOptions:{parser:tsParser,parserOptions:{ecmaVersion:"latest",sourceType:"module"}},rules:{"no-console":["error",{allow:["warn","error"]}]}}];
