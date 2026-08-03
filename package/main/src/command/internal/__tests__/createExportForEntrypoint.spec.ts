import { Entrypoint } from "../../../model/Entrypoint";
import { createExportForEntrypoint } from "../createExportForEntrypoint";

describe("createExportForEntrypoint", () => {
	it.each([
		{
			entrypoint: new Entrypoint("index", undefined),
			destinationDirectory: "dist",
			outputModeList: ["cjs"] as const,
			expected: [".", { types: "./dist/index.d.ts", require: "./dist/index.js" }],
		},
		{
			entrypoint: new Entrypoint("index", "main"),
			destinationDirectory: "dist",
			outputModeList: ["esm"] as const,
			expected: ["./main", { types: "./dist/main/index.d.ts", import: "./dist/main/index.js" }],
		},
		{
			entrypoint: new Entrypoint("another", "main"),
			destinationDirectory: "build/esm",
			outputModeList: ["esm"] as const,
			expected: ["./main/another", { types: "./build/esm/main/another.d.ts", import: "./build/esm/main/another.js" }],
		},
		{
			entrypoint: new Entrypoint("feature", undefined),
			destinationDirectory: ".\\dist\\esm",
			outputModeList: ["cjs"] as const,
			expected: ["./feature", { types: "./dist/esm/feature.d.ts", require: "./dist/esm/feature.js" }],
		},
		{
			entrypoint: new Entrypoint("index", undefined),
			destinationDirectory: "dist",
			outputModeList: ["cjs", "esm"] as const,
			expected: [".", { types: "./dist/index.d.ts", import: "./dist/index.js", require: "./dist/index.js" }],
		},
	])("creates exports entry for $expected[0]", ({ entrypoint, destinationDirectory, outputModeList, expected }) => {
		expect(createExportForEntrypoint(entrypoint, destinationDirectory, [...outputModeList])).toEqual(expected);
	});
});
