import { NotFoundError } from "@pallad/common-errors";
import { z } from "zod";

import { loadEntrysmithConfig } from "./EntrysmithConfig";

export const WorkspaceConfigSchema = z.object({
	workspaces: z.array(z.string().min(1, "Workspace glob pattern cannot be empty")).nonempty(),
});

export type WorkspaceConfig = z.infer<typeof WorkspaceConfigSchema>;

export async function loadWorkspaceConfig(directory: string): Promise<WorkspaceConfig | undefined> {
	let config: unknown;
	try {
		config = await loadEntrysmithConfig(directory);
	} catch (error) {
		if (error instanceof NotFoundError) {
			return undefined;
		}

		throw error;
	}

	if (!hasWorkspaceConfig(config)) {
		return undefined;
	}

	return WorkspaceConfigSchema.parse(config);
}

function hasWorkspaceConfig(config: unknown): config is { workspaces: unknown } {
	return typeof config === "object" && config !== null && "workspaces" in config;
}
