import * as path from "node:path";

import { applyPackageJsonChanges } from "./internal/applyPackageJsonChanges";
import { applyTsConfigChanges } from "./internal/applyTsConfigChanges";
import { loadProjectAndDependency } from "./internal/loadProjectAndDependency";

export async function apply(packagePath: string): Promise<void> {
	const absolutePackagePath = path.resolve(packagePath);
	const { dependency, project } = await loadProjectAndDependency(absolutePackagePath);

	await applyPackageJsonChanges(dependency);
	await applyTsConfigChanges(dependency, project);
}
