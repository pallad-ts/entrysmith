import { describe, expect, it } from "vitest";

import { DependencyConfigSchema } from "../DependencyConfig";

describe("DependencyConfigSchema", () => {
	it("loads explicit export conditions", () => {
		expect(
			DependencyConfigSchema.parse({
				entrypoints: ["index.ts"],
				exportConditions: ["types", "default"],
			})
		).toMatchObject({
			exportConditions: ["types", "default"],
		});
	});

	it.each([
		{ entrypoints: ["index.ts"], exportConditions: [] },
		{ entrypoints: ["index.ts"], exportConditions: ["types"] },
		{ entrypoints: ["index.ts"], exportConditions: ["import", "import"] },
		{ entrypoints: ["index.ts"], entrypointOutputMode: "esm" },
	])("rejects invalid export conditions: %o", config => {
		expect(() => DependencyConfigSchema.parse(config)).toThrow();
	});
});
