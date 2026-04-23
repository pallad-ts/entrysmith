module.exports = [
  ...require("@pallad/eslint-config"),
  {
    files: ["package/main/src/__tests__/example-monorepo/**/*.ts"],
    rules: {
      "@typescript-eslint/no-unnecessary-boolean-literal-compare": ["off"],
    },
  },
  {
    rules: {
      "@typescript-eslint/no-useless-constructor": ["off"],
      "no-console": ["error", { allow: ["warn", "error"] }],
      "no-restricted-syntax": ["off"],
    },
  },
];
