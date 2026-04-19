import { getPackages } from "@manypkg/get-packages";
import { NotFoundError } from "@pallad/common-errors";
import * as path from "node:path";

import { loadConfig } from "../config";
import { resolveEntrypoints } from "../entrypoints";
import { Dependency } from "../model/Dependency";
import {
	applyEntrypointsToPackageJson,
	getPackageDependencies,
	loadPackageJson,
	type PackageJsonFile,
} from "../package-json";
import { updateTsConfigPathMappings, updateTsConfigReferences } from "../tsconfig";

export type FixResult = {
	packageJsonUpdated: boolean;
	tsConfigReferenceUpdates: number;
	tsConfigPathUpdates: number;
	workspaceDependencyCount: number;
};

export async function runFix(projectDirectory: string): Promise<FixResult> {
	const configResult = await loadConfig(projectDirectory);
	if (configResult.isLeft()) {
		throw configResult.value;
	}

	const config = configResult.value;

	const entrypoints = resolveEntrypoints(config.entrypoints);
	const packageJson = await loadPackageJson(projectDirectory);

	const packageJsonResult = await applyEntrypointsToPackageJson(packageJson, {
		entrypoints,
		entrypointOutputMode: config.entrypointOutputMode,
		packageOutputDirectory: config.packageOutputDirectory,
	});

	const workspaceDependencies = await resolveWorkspaceDependencies(projectDirectory, packageJson);

	const tsConfigReferenceUpdates = await updateTsConfigReferences({
		projectDirectory,
		tsConfigPaths: config.typescript.referenceTsConfigPaths,
		dependencies: workspaceDependencies,
		tsConfigTargetPath: config.typescript.tsConfigTargetPath,
	});

	const tsConfigPathUpdates = await updateTsConfigPathMappings({
		projectDirectory,
		tsConfigPaths: config.typescript.referenceTsConfigPaths,
		dependencies: workspaceDependencies,
	});

	return {
		packageJsonUpdated: packageJsonResult.updated,
		tsConfigReferenceUpdates,
		tsConfigPathUpdates,
		workspaceDependencyCount: workspaceDependencies.length,
	};
}

async function resolveWorkspaceDependencies(projectDirectory: string, packageJson: PackageJsonFile): Promise<Dependency[]> {
	let packageCollection: Awaited<ReturnType<typeof getPackages>>;

	try {
		packageCollection = await getPackages(projectDirectory);
	} catch {
		return [];
	}

	const workspacePackagesByName = new Map<string, { absolutePath: string }>();

	for (const workspacePackage of packageCollection.packages) {
		if (typeof workspacePackage.packageJson.name !== "string") {
			continue;
		}

		workspacePackagesByName.set(workspacePackage.packageJson.name, {
			absolutePath: path.resolve(workspacePackage.dir),
		});
	}

	const dependencies = getPackageDependencies(packageJson);
	const resolvedDependencies: Dependency[] = [];

	for (const dependencyName of dependencies) {
		const workspaceDependency = workspacePackagesByName.get(dependencyName);
		if (!workspaceDependency) {
			continue;
		}

		const dependencyPath = path.relative(projectDirectory, workspaceDependency.absolutePath);
		const dependencyResult = await Dependency.load(projectDirectory, dependencyPath);
		if (dependencyResult.isLeft()) {
			const dependencyError = dependencyResult.value;

			if (dependencyError instanceof NotFoundError) {
				continue;
			}

			throw dependencyError;
		}

		resolvedDependencies.push(dependencyResult.value);
	}

	return resolvedDependencies;
}
