import { getPackages } from "@manypkg/get-packages";
import { NotFoundError } from "@pallad/common-errors";
import type { Either } from "@sweet-monads/either";
import path from "node:path";

import { loadConfig } from "../config";
import { resolveEntrypoints } from "../entrypoints";
import { Dependency } from "../model/dependency";
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
	const config = getRightValueOrThrow(await loadConfig(projectDirectory));

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

		const dependencyConfigResult = await loadConfig(workspaceDependency.absolutePath);
		if (dependencyConfigResult.isLeft()) {
			const dependencyError = getLeftValueOrThrow(dependencyConfigResult);

			if (dependencyError instanceof NotFoundError) {
				continue;
			}

			throw dependencyError;
		}

		const dependencyConfig = getRightValueOrThrow(dependencyConfigResult);
		const dependencyEntrypoints = resolveEntrypoints(dependencyConfig.entrypoints);

		resolvedDependencies.push(
			Dependency.create({
				name: dependencyName,
				absolutePath: workspaceDependency.absolutePath,
				entrypointList: dependencyEntrypoints,
			})
		);
	}

	return resolvedDependencies;
}

function getLeftValueOrThrow<L, R>(value: Either<L, R>): L {
	return value.fold(
		error => error,
		() => {
			throw new Error("Unexpected right Either state.");
		}
	);
}

function getRightValueOrThrow<L extends Error, R>(value: Either<L, R>): R {
	return value.fold(
		error => {
			throw error;
		},
		result => result
	);
}
