import { type Either, mergeInOne, fromPromise } from "@sweet-monads/either";
import { z } from "zod";

import * as path from "node:path";

import { loadPackageJson } from "../util/loadPackageJson";
import { loadDependencyConfig, type DependencyConfig, type DependencyConfigLoadError } from "./DependencyConfig";
import { Entrypoint } from "./Entrypoint";

export type DependencyLoadError = DependencyConfigLoadError | Error;

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
		readonly entrypointList: Entrypoint[],
		readonly config: DependencyConfig
	) {
		if (name.length === 0) {
			throw new Error("Dependency name cannot be empty.");
		}

		if (path.length === 0) {
			throw new Error("Dependency absolutePath cannot be empty.");
		}
	}

	static async load(projectPath: string, dependencyPath: string): Promise<Either<DependencyLoadError, Dependency>> {
		const absolutePath = path.resolve(projectPath, dependencyPath);

		return mergeInOne(
			await Promise.all([await loadDependencyNameFromPackageJson(absolutePath), await loadDependencyConfig(absolutePath)])
		).chain(([name, config]) => {
			return mergeInOne(config.entrypoints.map(entrypoint => Entrypoint.fromString(entrypoint))).map(entrypointList => {
				return new Dependency(name, dependencyPath, entrypointList, config);
			});
		});
	}
}

const packageSchema = z.object({
	name: z.string().min(1, "Package name cannot be empty"),
});
async function loadDependencyNameFromPackageJson(absolutePath: string): Promise<Either<Error, string>> {
	return (await fromPromise(loadPackageJson(absolutePath)))
		.mapLeft(error => {
			return new Error(
				`Failed to load package.json for dependency at ${absolutePath}: ${error instanceof Error ? error.message : String(error)}`
			);
		})
		.map(x => {
			return packageSchema.parse(x).name;
		});
}
