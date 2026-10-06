import { afterEach, describe, expect, it } from "vitest";

import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";

import { Project } from "../Project";

const temporaryDirectoryList: string[] = [];

describe("Project.loadFromWorkspaceConfig", () => {
	afterEach(async () => {
		await Promise.all(temporaryDirectoryList.map(directory => rm(directory, { force: true, recursive: true })));
		temporaryDirectoryList.length = 0;
	});

	it("discovers configured packages from overlapping globs and orders dependencies first", async () => {
		const rootPath = await createWorkspace();
		await writePackage(rootPath, "base", "@example/z-base");
		await writePackage(rootPath, "dependencies", "@example/a-dependencies", dependencyField("dependencies", "@example/z-base"));
		await writePackage(rootPath, "dev", "@example/a-dev", dependencyField("devDependencies", "@example/z-base"));
		await writePackage(rootPath, "optional", "@example/a-optional", dependencyField("optionalDependencies", "@example/z-base"));
		await writePackage(rootPath, "peer", "@example/a-peer", dependencyField("peerDependencies", "@example/z-base"));
		await mkdir(path.resolve(rootPath, "packages/not-configured"), { recursive: true });

		const project = await Project.loadFromWorkspaceConfig(rootPath, {
			workspaces: ["packages/*", "packages/base"],
		});

		expect(project.dependencyList.map(dependency => dependency.name)).toEqual([
			"@example/z-base",
			"@example/a-dependencies",
			"@example/a-dev",
			"@example/a-optional",
			"@example/a-peer",
		]);
	});

	it("fails when workspace discovery finds no configured packages", async () => {
		const rootPath = await createWorkspace();
		await mkdir(path.resolve(rootPath, "packages/not-configured"), { recursive: true });

		await expect(Project.loadFromWorkspaceConfig(rootPath, { workspaces: ["packages/*"] })).rejects.toThrow(
			"Unable to find configured workspace packages"
		);
	});

	it("fails when configured packages have duplicate names", async () => {
		const rootPath = await createWorkspace();
		await writePackage(rootPath, "first", "@example/duplicate");
		await writePackage(rootPath, "second", "@example/duplicate");

		await expect(Project.loadFromWorkspaceConfig(rootPath, { workspaces: ["packages/*"] })).rejects.toThrow(
			"Duplicate workspace package name: @example/duplicate"
		);
	});

	it("fails with every package name in a dependency cycle", async () => {
		const rootPath = await createWorkspace();
		await writePackage(rootPath, "first", "@example/first", dependencyField("dependencies", "@example/second"));
		await writePackage(rootPath, "second", "@example/second", dependencyField("dependencies", "@example/first"));

		await expect(Project.loadFromWorkspaceConfig(rootPath, { workspaces: ["packages/*"] })).rejects.toThrow(
			"Workspace dependency cycle: @example/first, @example/second"
		);
	});

	it("fails when a configured package depends on itself", async () => {
		const rootPath = await createWorkspace();
		await writePackage(rootPath, "self", "@example/self", dependencyField("dependencies", "@example/self"));

		await expect(Project.loadFromWorkspaceConfig(rootPath, { workspaces: ["packages/*"] })).rejects.toThrow(
			"Workspace dependency cycle: @example/self"
		);
	});
});

async function createWorkspace(): Promise<string> {
	const rootPath = await mkdtemp(path.join(os.tmpdir(), "entrysmith-workspace-"));
	temporaryDirectoryList.push(rootPath);
	return rootPath;
}

async function writePackage(
	rootPath: string,
	directory: string,
	name: string,
	dependencyFields: Record<string, Record<string, string>> = {}
): Promise<void> {
	const packagePath = path.resolve(rootPath, "packages", directory);
	await mkdir(packagePath, { recursive: true });
	await writeFile(
		path.resolve(packagePath, "package.json"),
		JSON.stringify({
			name,
			...dependencyFields,
			entrysmith: {
				entrypoints: ["index.ts"],
				exportConditions: ["types", "import"],
			},
		})
	);
	await writeFile(path.resolve(packagePath, "tsconfig.json"), "{}");
}

function dependencyField(field: string, dependencyName: string): Record<string, Record<string, string>> {
	return {
		[field]: {
			[dependencyName]: "*",
		},
	};
}
