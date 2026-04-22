import * as path from "node:path";

import { Dependency } from "../../model/Dependency";
import { Project } from "../../model/Project";

export async function loadProjectAndDependency(absolutePackagePath: string): Promise<{ dependency: Dependency; project: Project }> {
	const project = await Project.load(absolutePackagePath);
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
