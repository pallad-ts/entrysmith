import { getPackages } from "@manypkg/get-packages";
import { NotFoundError } from "@pallad/common-errors";
import { type Either, left, right } from "@sweet-monads/either";

import * as path from "node:path";

import { Dependency } from "./Dependency";

export class Project {
	constructor(
		readonly projectPath: string,
		readonly dependencyList: Dependency[]
	) {}

	static async load(projectPath: string): Promise<Either<Error, Project>> {
		const packageCollection = await getPackages(projectPath);

		const dependenciesResult = await loadDependencies(projectPath, packageCollection.packages);
		if (dependenciesResult.isLeft()) {
			return left(dependenciesResult.value);
		}

		return right(new Project(projectPath, dependenciesResult.value));
	}
}

async function loadDependencies(
	projectPath: string,
	workspacePackages: Awaited<ReturnType<typeof getPackages>>["packages"]
): Promise<Either<Error, Dependency[]>> {
	const dependencyList: Dependency[] = [];

	for (const workspacePackage of workspacePackages) {
		const dependencyPath = path.relative(projectPath, path.resolve(workspacePackage.dir));
		const dependencyResult = await Dependency.load(projectPath, dependencyPath);

		if (dependencyResult.isLeft()) {
			if (dependencyResult.value instanceof NotFoundError) {
				continue;
			}

			return left(dependencyResult.value);
		}

		dependencyList.push(dependencyResult.value);
	}

	return right(dependencyList);
}
