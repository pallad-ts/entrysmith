import { NotFoundError } from "@pallad/common-errors";
import { cosmiconfig } from "cosmiconfig";
import { TypeScriptLoader } from "cosmiconfig-typescript-loader";
import { z } from "zod";

export const DependencyEntrypointOutputModeSchema = z.enum(["cjs", "esm"]);
export type DependencyEntrypointOutputMode = z.infer<typeof DependencyEntrypointOutputModeSchema>;
export const DependencyConfigSchema = z.object({
	entrypoints: z.array(z.string().min(1, "Entrypoint path cannot be empty")),
	entrypointOutputMode: DependencyEntrypointOutputModeSchema,
	typescript: z
		.object({
			tsConfigTargetPath: z.string().min(1).optional(),
			referenceTsConfigPaths: z.array(z.string().min(1)).default(["tsconfig.json"]),
		})
		.default({}),
	packageOutputDirectory: z.string().min(1).default("dist"),
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
