import { z } from "zod";

import { loadEntrysmithConfig } from "./EntrysmithConfig";

const TS_CONFIG_REFERENCE_TARGET_PATH_DESCRIPTION =
	"Path to tsconfig target used when other workspace packages create TypeScript project references to this package. Defaults to the package root.";
const REFERENCE_TS_CONFIG_PATHS_DESCRIPTION =
	"Paths to tsconfig files in this package that receive TypeScript project references. Path mappings are stored in the common extended tsconfig when possible.";
const PACKAGE_OUTPUT_DIRECTORY_DESCRIPTION = "Directory where built package files are emitted and referenced from package.json exports.";
const BARREL_FILE_EXTENSIONS_DESCRIPTION =
	"File extensions included when Entrysmith generates configured index.ts barrel files. An empty list disables barrel generation.";

export const DependencyExportConditionSchema = z.enum(["types", "import", "require", "default"]);
export type DependencyExportCondition = z.infer<typeof DependencyExportConditionSchema>;
const DEPENDENCY_EXPORT_CONDITION_LIST_SCHEMA = DependencyExportConditionSchema.array().refine(conditionList => {
	return new Set(conditionList).size === conditionList.length;
}, "Export conditions cannot repeat");

export const DependencyConfigSchema = z
	.object({
		entrypoints: z.array(z.string().min(1, "Entrypoint path cannot be empty")),
		exportConditions: DEPENDENCY_EXPORT_CONDITION_LIST_SCHEMA.optional(),
		typescript: z
			.object({
				tsConfigReferenceTargetPath: z
					.string()
					.min(1)
					.default("tsconfig.json")
					.describe(TS_CONFIG_REFERENCE_TARGET_PATH_DESCRIPTION),
				referenceTsConfigPaths: z
					.array(z.string().min(1))
					.default(["tsconfig.json"])
					.describe(REFERENCE_TS_CONFIG_PATHS_DESCRIPTION),
			})
			.prefault({}),
		packageOutputDirectory: z.string().min(1).default("dist").describe(PACKAGE_OUTPUT_DIRECTORY_DESCRIPTION),
		barrelFileExtensions: z.array(z.string().min(1)).default(["ts", "js"]).describe(BARREL_FILE_EXTENSIONS_DESCRIPTION),
	})
	.superRefine((config, context) => {
		if (config.entrypoints.length === 0) {
			return;
		}

		if (config.exportConditions === undefined || config.exportConditions.length === 0) {
			context.addIssue({
				code: "custom",
				message: "At least one export condition is required when entrypoints are configured",
				path: ["exportConditions"],
			});
			return;
		}

		if (!config.exportConditions.some(condition => condition !== "types")) {
			context.addIssue({
				code: "custom",
				message: "At least one runtime export condition is required",
				path: ["exportConditions"],
			});
		}
	})
	.transform(config => {
		return {
			...config,
			exportConditions: config.exportConditions ?? [],
		};
	});

export type DependencyConfig = z.infer<typeof DependencyConfigSchema>;

export async function loadDependencyConfig(packageDirectory: string): Promise<DependencyConfig> {
	const loadedConfig = await loadEntrysmithConfig(packageDirectory);
	return parseDependencyConfig(loadedConfig.config, loadedConfig.path);
}

function parseDependencyConfig(config: unknown, configPath: string): DependencyConfig {
	try {
		return DependencyConfigSchema.parse(config);
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		throw new Error(`Invalid entrysmith configuration in ${configPath}: ${message}`);
	}
}
