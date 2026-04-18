module.exports = {
	printWidth: 140,
	trailingComma: "es5",
	bracketSpacing: true,
	arrowParens: "avoid",
	semi: true,
	plugins: ["@trivago/prettier-plugin-sort-imports"],
	importOrderParserPlugins: ["typescript", "jsx", "decorators-legacy"],
	importOrder: ["<THIRD_PARTY_MODULES>", "^node:(.*)$", "^[./]"],
	importOrderSeparation: true,
};
