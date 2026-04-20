import { PackageJson, PackageJsonExports, readPackageJSON, writePackageJSON } from "pkg-types";

import * as path from "node:path";

import { Dependency } from "../model/Dependency";
import { Project } from "../model/Project";

const SOURCE_DIRECTORY_PREFIX = "src/";

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

	const exportsField = normalizePackageJsonExports(packageJson.exports);
	for (const entrypoint of dependency.entrypointList) {
		const key = entrypoint.name === undefined ? "." : `./${entrypoint.name}`;
		exportsField[key] = createEntrypointExport(dependency, entrypoint.path);
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

function normalizePackageJsonExports(exportsField: PackageJson["exports"]): PackageJsonExportsMap {
	if (exportsField === undefined) {
		return {};
	}

	if (typeof exportsField === "string" || Array.isArray(exportsField)) {
		return {
			".": exportsField,
		};
	}

	return {
		...exportsField,
	};
}

function createEntrypointExport(dependency: Dependency, entrypointPath: string): { import: string } | { default: string } {
	const sourceRelativePath = entrypointPath.startsWith(SOURCE_DIRECTORY_PREFIX)
		? entrypointPath.slice(SOURCE_DIRECTORY_PREFIX.length)
		: entrypointPath;
	const extension = path.posix.extname(sourceRelativePath);
	const pathWithoutExtension = extension.length === 0 ? sourceRelativePath : sourceRelativePath.slice(0, -extension.length);
	const outputPath = `./${path.posix.join(dependency.config.packageOutputDirectory, `${pathWithoutExtension}.js`)}`;

	if (dependency.config.entrypointOutputMode === "commonjs") {
		return {
			default: outputPath,
		};
	}

	return {
		import: outputPath,
	};
}

async function loadProjectAndDependency(absolutePackagePath: string): Promise<{ dependency: Dependency; project: Project }> {
	const projectResult = await Project.load(absolutePackagePath);
	if (projectResult.isLeft()) {
		throw projectResult.value;
	}

	const project = projectResult.value;
	const dependency = project.dependencyList.find(candidate => {
		return path.resolve(project.path, candidate.path) === absolutePackagePath;
	});

	if (dependency) {
		return {
			dependency,
			project,
		};
	}

	throw new Error(`Unable to resolve entrysmith package for path ${absolutePackagePath}`);
}
