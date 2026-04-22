import { getPackages } from "@manypkg/get-packages";
import { NotFoundError } from "@pallad/common-errors";

import * as path from "node:path";

import { Dependency } from "./Dependency";

export class Project {
	constructor(
		readonly path: string,
		readonly dependencyList: Dependency[]
	) {}

	static async load(projectPath: string): Promise<Project> {
		const packageCollection = await getPackages(projectPath);
		const dependencyList = await loadDependencies(packageCollection.rootDir, packageCollection.packages);

		return new Project(packageCollection.rootDir, dependencyList);
	}
}

async function loadDependencies(
	projectPath: string,
	workspacePackages: Awaited<ReturnType<typeof getPackages>>["packages"]
): Promise<Dependency[]> {
	const dependencyList: Dependency[] = [];

	for (const workspacePackage of workspacePackages) {
		const dependencyPath = path.relative(projectPath, path.resolve(workspacePackage.dir));

		try {
			dependencyList.push(await Dependency.load(projectPath, dependencyPath));
		} catch (error) {
			if (error instanceof NotFoundError) {
				continue;
			}

			throw error;
		}
	}

	return dependencyList;
}
