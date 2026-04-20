import { PackageJson, PackageJsonExports, readPackageJSON, writePackageJSON } from "pkg-types";

import * as path from "node:path";

import { Dependency } from "../model/Dependency";
import { Entrypoint } from "../model/Entrypoint";
import { Project } from "../model/Project";
import { createExportForEntrypoint } from "./internal/createExportForEntrypoint";
import { loadProjectAndDependency } from "./internal/loadProjectAndDependency";

type PackageJsonExportsMap = Record<string, PackageJsonExports | undefined>;

export async function apply(packagePath: string): Promise<void> {
	const absolutePackagePath = path.resolve(packagePath);
	const { dependency, project } = await loadProjectAndDependency(absolutePackagePath);

	await applyPackageJsonChanges(dependency, project);
	applyTsConfigChanges(dependency, project);
}

async function applyPackageJsonChanges(dependency: Dependency, project: Project): Promise<void> {
	const packageDirectory = path.resolve(project.path, dependency.path);
	const packageJsonPath = path.resolve(packageDirectory, "package.json");

	const packageJson = await readPackageJSON(packageDirectory);

	const files = packageJson.files ?? [];
	if (!files.includes(dependency.config.packageOutputDirectory)) {
		files.push(dependency.config.packageOutputDirectory);
	}

	const exportsField: PackageJsonExportsMap = {};
	for (const entrypoint of [...dependency.entrypointList].sort(compareEntrypointsByName)) {
		const [key, value] = createExportForEntrypoint(
			entrypoint,
			dependency.config.packageOutputDirectory,
			dependency.config.entrypointOutputMode
		);
		exportsField[key] = value;
	}

	exportsField["./package.json"] = "./package.json";

	const nextPackageJson: PackageJson = {
		...packageJson,
		files,
		exports: exportsField as PackageJsonExports,
	};

	await writePackageJSON(packageJsonPath, nextPackageJson);
}

function applyTsConfigChanges(dependency: Dependency, project: Project): void {
	void dependency;
	void project;
}

function compareEntrypointsByName(left: Entrypoint, right: Entrypoint): number {
	return left.fullName.localeCompare(right.fullName);
}
