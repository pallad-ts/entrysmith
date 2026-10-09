import { describe, expect, it } from "vitest";

import { mkdtemp, rm, writeFile } from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";

import { DependencyConfigSchema, loadDependencyConfig } from "../DependencyConfig";

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

	it("uses no export conditions when no entrypoints exist", () => {
		expect(DependencyConfigSchema.parse({ entrypoints: [] })).toMatchObject({
			exportConditions: [],
		});
	});

	it("uses TypeScript and JavaScript barrel file extensions by default", () => {
		expect(DependencyConfigSchema.parse({ entrypoints: [] })).toMatchObject({
			barrelFileExtensions: ["ts", "js"],
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

	it("reports the file containing invalid configuration", async () => {
		const directory = await mkdtemp(path.join(os.tmpdir(), "entrysmith-config-"));
		const configPath = path.resolve(directory, "entrysmith.config.js");
		await writeFile(path.resolve(directory, "package.json"), '{"name":"example"}\n');
		await writeFile(configPath, 'module.exports = { entrypoints: ["index.ts"] };\n');

		try {
			await expect(loadDependencyConfig(directory)).rejects.toThrow(configPath);
		} finally {
			await rm(directory, { force: true, recursive: true });
		}
	});
});
