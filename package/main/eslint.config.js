module.exports = [
	...require("../../eslint.config"),
	{
		files: ["src/__tests__/example-monorepo/**/*.ts"],
		rules: {
			"@typescript-eslint/no-unnecessary-boolean-literal-compare": ["off"],
		},
	},
];
