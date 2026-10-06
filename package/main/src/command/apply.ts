import * as path from "node:path";

import { Dependency } from "../model/Dependency";
import { Project } from "../model/Project";
import { loadWorkspaceConfig } from "../model/WorkspaceConfig";
import { applyPackageJsonChanges } from "./internal/applyPackageJsonChanges";
import { applyTsConfigChanges } from "./internal/applyTsConfigChanges";
import { loadProjectAndDependency } from "./internal/loadProjectAndDependency";

export interface ApplyResult {
	changedFilePathList: string[];
	packageCount: number;
}

export async function apply(packagePath: string): Promise<ApplyResult> {
	const absolutePackagePath = path.resolve(packagePath);
	const workspaceConfig = await loadWorkspaceConfig(absolutePackagePath);
	if (workspaceConfig) {
		const project = await Project.loadFromWorkspaceConfig(absolutePackagePath, workspaceConfig);
		return applyProject(project);
	}

	const packageManagerWorkspace = await Project.loadFromPackageManagerWorkspace(absolutePackagePath);
	if (packageManagerWorkspace) {
		return applyProject(packageManagerWorkspace);
	}

	const { dependency, project } = await loadProjectAndDependency(absolutePackagePath);
	return {
		changedFilePathList: await applyDependencies([dependency], project),
		packageCount: 1,
	};
}

async function applyProject(project: Project): Promise<ApplyResult> {
	return {
		changedFilePathList: await applyDependencies(project.dependencyList, project),
		packageCount: project.dependencyList.length,
	};
}

async function applyDependencies(dependencyList: Dependency[], project: Project): Promise<string[]> {
	const changedFilePathSet = new Set<string>();
	for (const dependency of dependencyList) {
		const changedPackageJsonPath = await applyPackageJsonChanges(dependency);
		if (changedPackageJsonPath) {
			changedFilePathSet.add(changedPackageJsonPath);
		}
		for (const changedTsConfigPath of await applyTsConfigChanges(dependency, project)) {
			changedFilePathSet.add(changedTsConfigPath);
		}
	}
	return [...changedFilePathSet];
}

export function formatApplySummary(result: ApplyResult): string {
	if (result.changedFilePathList.length === 0) {
		return "Entrysmith is up to date.";
	}

	return [
		`Entrysmith updated ${result.changedFilePathList.length} ${pluralize("file", result.changedFilePathList.length)}`,
		`across ${result.packageCount} ${pluralize("package", result.packageCount)}.`,
	].join(" ");
}

function pluralize(noun: string, count: number): string {
	return count === 1 ? noun : `${noun}s`;
}
