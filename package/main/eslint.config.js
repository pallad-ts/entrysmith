module.exports = [
	...require("../../config/eslint.config.base"),
	{
		ignores: ["src/__tests__/example-monorepo/**"],
	},
];
