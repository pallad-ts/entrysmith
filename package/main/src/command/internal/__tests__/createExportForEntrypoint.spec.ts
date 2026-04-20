import { Entrypoint } from "../../../model/Entrypoint";
import { createExportForEntrypoint } from "../createExportForEntrypoint";

describe("createExportForEntrypoint", () => {
	it.each([
		{
			entrypoint: new Entrypoint("index", undefined),
			destinationDirectory: "dist",
			outputMode: "commonjs" as const,
			expected: [".", { default: "./dist/index.js" }],
		},
		{
			entrypoint: new Entrypoint("index", "main"),
			destinationDirectory: "dist",
			outputMode: "module" as const,
			expected: ["./main", { import: "./dist/main/index.js" }],
		},
		{
			entrypoint: new Entrypoint("another", "main"),
			destinationDirectory: "build/esm",
			outputMode: "module" as const,
			expected: ["./main/another", { import: "./build/esm/main/another.js" }],
		},
		{
			entrypoint: new Entrypoint("feature", undefined),
			destinationDirectory: ".\\dist\\esm",
			outputMode: "commonjs" as const,
			expected: ["./feature", { default: "./dist/esm/feature.js" }],
		},
	])("creates exports entry for $expected[0]", ({ entrypoint, destinationDirectory, outputMode, expected }) => {
		expect(createExportForEntrypoint(entrypoint, destinationDirectory, outputMode)).toEqual(expected);
	});
});
