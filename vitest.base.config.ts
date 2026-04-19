import { defineConfig } from "vitest/config";

export default defineConfig({
	test: {
		globals: true,
		environment: "node",
		testTimeout: 30000,
		projects: [
			{
				extends: true,
				test: {
					name: "unit",
					include: ["src/**/__tests__/*.spec.ts"],
				},
			},
		],
	},
});
