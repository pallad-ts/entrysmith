import { NotFoundError } from "@pallad/common-errors";
import { left, right, type Either } from "@sweet-monads/either";
import { cosmiconfig } from "cosmiconfig";
import { TypeScriptLoader } from "cosmiconfig-typescript-loader";
import { z } from "zod";

const entrysmithConfigSchema = z.object({
	entrypoints: z.array(z.string().min(1, "Entrypoint path cannot be empty")),
	entrypointOutputMode: z.enum(["commonjs", "module"]),
	typescript: z
		.object({
			tsConfigTargetPath: z.string().min(1).optional(),
			referenceTsConfigPaths: z.array(z.string().min(1)).default(["tsconfig.json"]),
		})
		.default({}),
	packageOutputDirectory: z.string().min(1).default("dist"),
});

export type EntrysmithConfig = z.infer<typeof entrysmithConfigSchema>;

export type EntrysmithConfigLoadError = Error | z.ZodError;

const CONFIG_NAME = "entrysmith";

const SEARCH_PLACES = ["package.json", "entrysmith.config.js", "entrysmith.config.ts", "entrysmith.config.json"];

export async function loadConfig(
	packageDirectory: string
): Promise<Either<EntrysmithConfigLoadError, EntrysmithConfig>> {
	const explorer = cosmiconfig(CONFIG_NAME, {
		searchPlaces: SEARCH_PLACES,
		stopDir: packageDirectory,
		loaders: {
			".ts": TypeScriptLoader(),
		},
	});

	const searchResult = await explorer.search(packageDirectory);
	if (!searchResult || searchResult.isEmpty) {
		return left(
			new NotFoundError(
				`Unable to find entrysmith configuration in ${packageDirectory}. Expected one of: ${SEARCH_PLACES.join(", ")}`
			)
		);
	}

	const result = searchResult;

	const parsedConfig = entrysmithConfigSchema.safeParse(result.config);

	if (!parsedConfig.success) {
		return left(parsedConfig.error);
	}

	return right(parsedConfig.data);
}
