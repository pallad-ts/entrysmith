import { NotFoundError } from "@pallad/common-errors";
import { z } from "zod";

import { loadEntrysmithConfig } from "./EntrysmithConfig";

export const WorkspaceConfigSchema = z.object({
	workspaces: z.array(z.string().min(1, "Workspace glob pattern cannot be empty")).nonempty(),
});

export type WorkspaceConfig = z.infer<typeof WorkspaceConfigSchema>;

export async function loadWorkspaceConfig(directory: string): Promise<WorkspaceConfig | undefined> {
	let loadedConfig;
	try {
		loadedConfig = await loadEntrysmithConfig(directory);
	} catch (error) {
		if (error instanceof NotFoundError) {
			return undefined;
		}

		throw error;
	}

	if (!hasWorkspaceConfig(loadedConfig.config)) {
		return undefined;
	}

	try {
		return WorkspaceConfigSchema.parse(loadedConfig.config);
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		throw new Error(`Invalid entrysmith configuration in ${loadedConfig.path}: ${message}`);
	}
}

function hasWorkspaceConfig(config: unknown): config is { workspaces: unknown } {
	return typeof config === "object" && config !== null && "workspaces" in config;
}
