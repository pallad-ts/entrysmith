import { NotFoundError } from "@pallad/common-errors";
import { type Either, left, mergeInOne } from "@sweet-monads/either";

import * as path from "node:path";

import { loadDependencyConfig, type DependencyConfig, type DependencyConfigLoadError } from "./DependencyConfig";
import { Entrypoint } from "./Entrypoint";
import { PackageJsonFile } from "./PackageJsonFile";
import { TsConfigFile } from "./TsConfigFile";

export type DependencyLoadError = DependencyConfigLoadError | Error | NotFoundError;

export class Dependency {
	constructor(
		/**
		 * Name of dependency
		 *
		 * @example `@lib/main`
		 * @example `@package/name`
		 */
		readonly name: string,

		/**
		 * Absolute path to dependency package directory.
		 *
		 * @example `package/main`
		 */
		readonly path: string,
		readonly packageJson: PackageJsonFile,
		readonly entrypointList: Entrypoint[],
		readonly tsConfigFiles: TsConfigFile[],
		readonly config: DependencyConfig
	) {
		if (name.length === 0) {
			throw new Error("Dependency name cannot be empty.");
		}

		if (path.length === 0) {
			throw new Error("Dependency absolutePath cannot be empty.");
		}
	}

	get packageJsonPath() {
		return path.join(this.path, "package.json");
	}

	static async load(projectPath: string, dependencyPath: string): Promise<Either<DependencyLoadError, Dependency>> {
		const dependencyAbsolutePath = path.resolve(projectPath, dependencyPath);
		const [packageJsonResult, configResult] = await Promise.all([
			loadDependencyPackageJson(dependencyAbsolutePath),
			loadDependencyConfig(dependencyAbsolutePath),
		]);
		const dependencyMetadataResult = mergeInOne([packageJsonResult, configResult]);
		if (dependencyMetadataResult.isLeft()) {
			return left(dependencyMetadataResult.value);
		}

		const [packageJson, config] = dependencyMetadataResult.value;
		if (typeof packageJson.name !== "string" || packageJson.name.length === 0) {
			return left(new Error("Package name cannot be empty"));
		}

		const entrypointListResult = mergeInOne(config.entrypoints.map(entrypoint => Entrypoint.fromString(entrypoint)));
		const tsConfigFilesResult = await loadDependencyTsConfigFiles(dependencyAbsolutePath, config);

		return mergeInOne([entrypointListResult, tsConfigFilesResult]).map(([entrypointList, tsConfigFiles]) => {
			return new Dependency(packageJson.name!, dependencyPath, packageJson, entrypointList, tsConfigFiles, config);
		});
	}
}

async function loadDependencyTsConfigFiles(packagePath: string, config: DependencyConfig): Promise<Either<Error, TsConfigFile[]>> {
	const tsConfigPathSet = new Set(config.typescript.referenceTsConfigPaths);
	if (config.typescript.tsConfigTargetPath) {
		tsConfigPathSet.add(config.typescript.tsConfigTargetPath);
	}

	return mergeInOne(
		await Promise.all(
			[...tsConfigPathSet].sort().map(tsConfigPath => {
				return TsConfigFile.load(path.resolve(packagePath, tsConfigPath));
			})
		)
	);
}
async function loadDependencyPackageJson(packagePath: string): Promise<Either<Error, PackageJsonFile>> {
	return (await PackageJsonFile.load(path.resolve(packagePath, "package.json"))).mapLeft(error => {
		return new Error(`Failed to load package.json for dependency at ${packagePath}: ${error.message}`);
	});
}
