import { PackageJsonExports } from "pkg-types";

import { Dependency } from "../../model/Dependency";
import { Entrypoint } from "../../model/Entrypoint";
import { createExportForEntrypoint } from "./createExportForEntrypoint";

type PackageJsonExportsMap = Record<string, PackageJsonExports | undefined>;

export async function applyPackageJsonChanges(dependency: Dependency): Promise<void> {
	const files = dependency.packageJson.content.files ?? [];
	if (!files.includes(dependency.config.packageOutputDirectory)) {
		files.push(dependency.config.packageOutputDirectory);
	}
	dependency.packageJson.content.files = files;

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
	dependency.packageJson.exports = exportsField as PackageJsonExports;

	await dependency.packageJson.save();
}

function compareEntrypointsByName(left: Entrypoint, right: Entrypoint): number {
	return left.fullName.localeCompare(right.fullName);
}
