import { describe, expect, it } from "vitest";

import { WorkspaceConfigSchema } from "../WorkspaceConfig";

describe("WorkspaceConfigSchema", () => {
	it("accepts a non-empty list of non-empty workspace glob patterns", () => {
		expect(WorkspaceConfigSchema.parse({ workspaces: ["packages/*", "tools/*"] })).toEqual({
			workspaces: ["packages/*", "tools/*"],
		});
	});

	it.each([{ workspaces: [] }, { workspaces: [""] }])("rejects invalid workspace glob patterns: %o", config => {
		expect(() => WorkspaceConfigSchema.parse(config)).toThrow();
	});
});
