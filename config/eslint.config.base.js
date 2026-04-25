module.exports = [
  ...require("@pallad/eslint-config"),
  {
    ignores: ["package/main/src/__tests__/example-monorepo/**"],
  },
  {
    rules: {
      "@typescript-eslint/no-useless-constructor": ["off"],
      "no-console": ["error", { allow: ["warn", "error"] }],
      "no-restricted-syntax": ["off"],
    },
  },
];
