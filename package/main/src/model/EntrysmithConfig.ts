import { NotFoundError } from "@pallad/common-errors";
import { cosmiconfig } from "cosmiconfig";
import { TypeScriptLoader } from "cosmiconfig-typescript-loader";

const CONFIG_NAME = "entrysmith";
const SEARCH_PLACES = ["package.json", "entrysmith.config.js", "entrysmith.config.ts", "entrysmith.config.json"];
const TYPESCRIPT_EXTENSION = ".ts";

export interface LoadedEntrysmithConfig {
	config: unknown;
	path: string;
}

export async function loadEntrysmithConfig(directory: string): Promise<LoadedEntrysmithConfig> {
	const explorer = cosmiconfig(CONFIG_NAME, {
		searchPlaces: SEARCH_PLACES,
		stopDir: directory,
		loaders: {
			[TYPESCRIPT_EXTENSION]: TypeScriptLoader(),
		},
	});

	const searchResult = await explorer.search(directory);
	if (!searchResult || searchResult.isEmpty) {
		throw new NotFoundError(`Unable to find entrysmith configuration in ${directory}. Expected one of: ${SEARCH_PLACES.join(", ")}`);
	}

	return {
		config: searchResult.config,
		path: searchResult.filepath,
	};
}
