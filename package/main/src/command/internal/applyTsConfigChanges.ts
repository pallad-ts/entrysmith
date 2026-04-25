import * as path from "node:path";

import { Dependency } from "../../model/Dependency";
import { Entrypoint } from "../../model/Entrypoint";
import { Project } from "../../model/Project";
import { TsConfigFile } from "../../model/TsConfigFile";
import { findTsConfigCommonExtends } from "../../model/findTsConfigCommonExtends";
import { normalizePath } from "../../util/normalizePath";

export async function applyTsConfigChanges(dependency: Dependency, project: Project): Promise<void> {
	const workspaceDependencyList = findWorkspaceDependenciesForPackage(dependency, project);
	const commonTsConfigPathSet = new Set(
		findTsConfigCommonExtends(dependency.tsConfigFiles).map(tsConfigFile => tsConfigFile.path)
	);

	for (const tsConfigFile of dependency.tsConfigFiles) {
		applyReferencesToTsConfig(tsConfigFile, workspaceDependencyList, tsConfigFile.path, project.path);

		if (commonTsConfigPathSet.has(tsConfigFile.path)) {
			applyPathsToTsConfig(tsConfigFile, workspaceDependencyList, tsConfigFile.path, project.path);
		}

		if (tsConfigFile.content !== undefined) {
			await tsConfigFile.save();
		}
	}
}

function compareEntrypointsByName(left: Entrypoint, right: Entrypoint): number {
	return left.fullName.localeCompare(right.fullName);
}

function findWorkspaceDependenciesForPackage(dependency: Dependency, project: Project): Dependency[] {
	const dependencyNameSet = new Set<string>();

	for (const dependencyField of [
		dependency.packageJson.content.dependencies,
		dependency.packageJson.content.devDependencies,
		dependency.packageJson.content.peerDependencies,
		dependency.packageJson.content.optionalDependencies,
	]) {
		for (const dependencyName of Object.keys(dependencyField ?? {})) {
			dependencyNameSet.add(dependencyName);
		}
	}

	return project.dependencyList
		.filter(candidate => {
			return candidate.name !== dependency.name && dependencyNameSet.has(candidate.name);
		})
		.sort((left, right) => {
			return left.name.localeCompare(right.name);
		});
}

function applyReferencesToTsConfig(
	tsConfig: TsConfigFile,
	workspaceDependencyList: Dependency[],
	absTsConfigPath: string,
	projectPath: string
): void {
	const nextReferenceList = new Map<string, { path: string }>();

	for (const reference of tsConfig.references ?? []) {
		nextReferenceList.set(reference.path, reference);
	}

	for (const workspaceDependency of workspaceDependencyList) {
		const referenceTargetPath = omitTsConfigJsonFilename(
			workspaceDependency.config.typescript.tsConfigReferenceTargetPath ?? "."
		);
		const absoluteReferenceTargetPath = path.resolve(projectPath, workspaceDependency.path, referenceTargetPath);
		const relativeReferenceTargetPath = normalizePath(path.relative(path.dirname(absTsConfigPath), absoluteReferenceTargetPath));

		nextReferenceList.set(relativeReferenceTargetPath, {
			path: relativeReferenceTargetPath,
		});
	}

	if (nextReferenceList.size === 0 && tsConfig.references === undefined) {
		return;
	}

	tsConfig.references = [...nextReferenceList.values()].sort((left, right) => {
		return left.path.localeCompare(right.path);
	});
}

function omitTsConfigJsonFilename(referenceTargetPath: string): string {
	if (path.posix.basename(referenceTargetPath) !== "tsconfig.json") {
		return referenceTargetPath;
	}

	return path.posix.dirname(referenceTargetPath);
}

function applyPathsToTsConfig(
	tsConfig: TsConfigFile,
	workspaceDependencyList: Dependency[],
	absTsConfigPath: string,
	projectPath: string
): void {
	const nextPathMap = {
		...(tsConfig.compilerOptionsPaths ?? {}),
	};

	for (const workspaceDependency of workspaceDependencyList) {
		for (const entrypoint of [...workspaceDependency.entrypointList].sort(compareEntrypointsByName)) {
			const entrypointImportPath = createEntrypointImportPath(workspaceDependency, entrypoint);
			const absoluteSourcePath = path.resolve(projectPath, workspaceDependency.path, removeExtension(entrypoint.sourcePath("src")));
			const relativeSourcePath = normalizePath(path.relative(path.dirname(absTsConfigPath), absoluteSourcePath));

			nextPathMap[entrypointImportPath] = [relativeSourcePath];
		}
	}

	if (Object.keys(nextPathMap).length === 0 && tsConfig.compilerOptionsPaths === undefined) {
		return;
	}

	tsConfig.compilerOptionsPaths = Object.fromEntries(
		Object.entries(nextPathMap).sort(([leftKey], [rightKey]) => {
			return leftKey.localeCompare(rightKey);
		})
	);
}

function createEntrypointImportPath(dependency: Dependency, entrypoint: Entrypoint): string {
	if (entrypoint.name === "index") {
		return entrypoint.directory === undefined ? dependency.name : `${dependency.name}/${entrypoint.directory}`;
	}

	return `${dependency.name}/${entrypoint.fullName}`;
}

function removeExtension(value: string): string {
	const extension = path.posix.extname(value);
	if (extension.length === 0) {
		return value;
	}

	return value.slice(0, -extension.length);
}
