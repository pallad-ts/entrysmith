import * as path from "node:path";

import { loadDependencyConfig, type DependencyConfig } from "./DependencyConfig";
import { Entrypoint } from "./Entrypoint";
import { PackageJsonFile } from "./PackageJsonFile";
import { TsConfigFile } from "./TsConfigFile";

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

	static async load(projectPath: string, dependencyPath: string): Promise<Dependency> {
		const dependencyAbsolutePath = path.resolve(projectPath, dependencyPath);
		const [packageJson, config] = await Promise.all([
			loadDependencyPackageJson(dependencyAbsolutePath),
			loadDependencyConfig(dependencyAbsolutePath),
		]);
		if (typeof packageJson.name !== "string" || packageJson.name.length === 0) {
			throw new Error("Package name cannot be empty");
		}

		const entrypointList = config.entrypoints.map(entrypoint => Entrypoint.fromString(entrypoint));
		const tsConfigFiles = await loadDependencyTsConfigFiles(dependencyAbsolutePath, config);

		return new Dependency(packageJson.name, dependencyPath, packageJson, entrypointList, tsConfigFiles, config);
	}
}

async function loadDependencyTsConfigFiles(packagePath: string, config: DependencyConfig): Promise<TsConfigFile[]> {
	const tsConfigPathSet = new Set(config.typescript.referenceTsConfigPaths);
	if (config.typescript.tsConfigTargetPath) {
		tsConfigPathSet.add(config.typescript.tsConfigTargetPath);
	}

	return Promise.all(
		[...tsConfigPathSet].sort().map(tsConfigPath => {
			return TsConfigFile.load(path.resolve(packagePath, tsConfigPath));
		})
	);
}
async function loadDependencyPackageJson(packagePath: string): Promise<PackageJsonFile> {
	try {
		return await PackageJsonFile.load(path.resolve(packagePath, "package.json"));
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		throw new Error(`Failed to load package.json for dependency at ${packagePath}: ${message}`);
	}
}
