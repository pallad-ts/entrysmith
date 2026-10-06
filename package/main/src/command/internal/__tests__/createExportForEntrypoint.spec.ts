import { Entrypoint } from "../../../model/Entrypoint";
import { createExportForEntrypoint } from "../createExportForEntrypoint";

describe("createExportForEntrypoint", () => {
	it.each([
		{
			entrypoint: new Entrypoint("index", undefined),
			destinationDirectory: "dist",
			exportConditions: ["types", "default"] as const,
			expected: [".", { types: "./dist/index.d.ts", default: "./dist/index.js" }],
		},
		{
			entrypoint: new Entrypoint("index", "main"),
			destinationDirectory: "dist",
			exportConditions: ["types", "import"] as const,
			expected: ["./main", { types: "./dist/main/index.d.ts", import: "./dist/main/index.js" }],
		},
		{
			entrypoint: new Entrypoint("index", undefined),
			destinationDirectory: "dist",
			exportConditions: ["default"] as const,
			expected: [".", { default: "./dist/index.js" }],
		},
		{
			entrypoint: new Entrypoint("another", "main"),
			destinationDirectory: "build/esm",
			exportConditions: ["import"] as const,
			expected: ["./main/another", { import: "./build/esm/main/another.js" }],
		},
		{
			entrypoint: new Entrypoint("feature", undefined),
			destinationDirectory: ".\\dist\\esm",
			exportConditions: ["require"] as const,
			expected: ["./feature", { require: "./dist/esm/feature.js" }],
		},
		{
			entrypoint: new Entrypoint("index", undefined),
			destinationDirectory: "dist",
			exportConditions: ["default", "require", "types", "import"] as const,
			expected: [
				".",
				{ types: "./dist/index.d.ts", import: "./dist/index.js", require: "./dist/index.js", default: "./dist/index.js" },
			],
		},
	])("creates exports entry for $expected[0]", ({ entrypoint, destinationDirectory, exportConditions, expected }) => {
		expect(createExportForEntrypoint(entrypoint, destinationDirectory, [...exportConditions])).toEqual(expected);
	});
});
