import { NotFoundError } from "@pallad/common-errors";
import { cosmiconfig } from "cosmiconfig";
import { TypeScriptLoader } from "cosmiconfig-typescript-loader";
import { z } from "zod";

const TS_CONFIG_REFERENCE_TARGET_PATH_DESCRIPTION =
	"Path to tsconfig target used when other workspace packages create TypeScript project references to this package. Defaults to the package root.";
const REFERENCE_TS_CONFIG_PATHS_DESCRIPTION =
	"Paths to tsconfig files in this package that receive TypeScript project references. Path mappings are stored in the common extended tsconfig when possible.";
const PACKAGE_OUTPUT_DIRECTORY_DESCRIPTION = "Directory where built package files are emitted and referenced from package.json exports.";

export const DependencyEntrypointOutputModeSchema = z.enum(["cjs", "esm"]);
export type DependencyEntrypointOutputMode = z.infer<typeof DependencyEntrypointOutputModeSchema>;
export const DependencyConfigSchema = z.object({
	entrypoints: z.array(z.string().min(1, "Entrypoint path cannot be empty")),
	entrypointOutputMode: DependencyEntrypointOutputModeSchema.default("esm"),
	typescript: z
		.object({
			tsConfigReferenceTargetPath: z.string().min(1).default("tsconfig.json").describe(TS_CONFIG_REFERENCE_TARGET_PATH_DESCRIPTION),
			referenceTsConfigPaths: z.array(z.string().min(1)).default(["tsconfig.json"]).describe(REFERENCE_TS_CONFIG_PATHS_DESCRIPTION),
		})
		.prefault({}),
	packageOutputDirectory: z.string().min(1).default("dist").describe(PACKAGE_OUTPUT_DIRECTORY_DESCRIPTION),
});

export type DependencyConfig = z.infer<typeof DependencyConfigSchema>;

const CONFIG_NAME = "entrysmith";
const SEARCH_PLACES = ["package.json", "entrysmith.config.js", "entrysmith.config.ts", "entrysmith.config.json"];
const TYPESCRIPT_EXTENSION = ".ts";

export async function loadDependencyConfig(packageDirectory: string): Promise<DependencyConfig> {
	const explorer = cosmiconfig(CONFIG_NAME, {
		searchPlaces: SEARCH_PLACES,
		stopDir: packageDirectory,
		loaders: {
			[TYPESCRIPT_EXTENSION]: TypeScriptLoader(),
		},
	});

	const searchResult = await explorer.search(packageDirectory);
	if (!searchResult || searchResult.isEmpty) {
		throw new NotFoundError(
			`Unable to find entrysmith configuration in ${packageDirectory}. Expected one of: ${SEARCH_PLACES.join(", ")}`
		);
	}

	const parsedConfig = DependencyConfigSchema.safeParse(searchResult.config);
	if (!parsedConfig.success) {
		throw parsedConfig.error;
	}

	return parsedConfig.data;
}
