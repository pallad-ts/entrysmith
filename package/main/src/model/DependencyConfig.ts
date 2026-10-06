import { z } from "zod";

import { loadEntrysmithConfig } from "./EntrysmithConfig";

const TS_CONFIG_REFERENCE_TARGET_PATH_DESCRIPTION =
	"Path to tsconfig target used when other workspace packages create TypeScript project references to this package. Defaults to the package root.";
const REFERENCE_TS_CONFIG_PATHS_DESCRIPTION =
	"Paths to tsconfig files in this package that receive TypeScript project references. Path mappings are stored in the common extended tsconfig when possible.";
const PACKAGE_OUTPUT_DIRECTORY_DESCRIPTION = "Directory where built package files are emitted and referenced from package.json exports.";

export const DependencyEntrypointOutputModeSchema = z.enum(["cjs", "esm"]);
export type DependencyEntrypointOutputMode = z.infer<typeof DependencyEntrypointOutputModeSchema>;
export const DependencyConfigSchema = z.object({
	entrypoints: z.array(z.string().min(1, "Entrypoint path cannot be empty")),
	entrypointOutputMode: z
		.union([DependencyEntrypointOutputModeSchema, DependencyEntrypointOutputModeSchema.array().nonempty()])
		.transform(x => {
			return Array.isArray(x) ? x : [x];
		})
		.default(["cjs", "esm"]),
	typescript: z
		.object({
			tsConfigReferenceTargetPath: z.string().min(1).default("tsconfig.json").describe(TS_CONFIG_REFERENCE_TARGET_PATH_DESCRIPTION),
			referenceTsConfigPaths: z.array(z.string().min(1)).default(["tsconfig.json"]).describe(REFERENCE_TS_CONFIG_PATHS_DESCRIPTION),
		})
		.prefault({}),
	packageOutputDirectory: z.string().min(1).default("dist").describe(PACKAGE_OUTPUT_DIRECTORY_DESCRIPTION),
});

export type DependencyConfig = z.infer<typeof DependencyConfigSchema>;

export async function loadDependencyConfig(packageDirectory: string): Promise<DependencyConfig> {
	return DependencyConfigSchema.parse(await loadEntrysmithConfig(packageDirectory));
}
