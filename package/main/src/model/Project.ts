import { getPackages } from "@manypkg/get-packages";
import { NotFoundError } from "@pallad/common-errors";
import { glob } from "tinyglobby";

import * as path from "node:path";

import { Dependency } from "./Dependency";
import { loadDependencyConfig } from "./DependencyConfig";
import { WorkspaceConfig } from "./WorkspaceConfig";
import { orderWorkspaceDependencies } from "./orderWorkspaceDependencies";

export class Project {
	constructor(
		readonly path: string,
		readonly dependencyList: Dependency[]
	) {}

	static async load(projectPath: string): Promise<Project> {
		return Project.loadFromPackage(projectPath);
	}

	static async loadFromPackage(packagePath: string): Promise<Project> {
		const packageCollection = await getPackages(packagePath);
		const dependencyList = await loadDependencies(packageCollection.rootDir, packageCollection.packages);

		return new Project(packageCollection.rootDir, dependencyList);
	}

	static async loadFromPackageManagerWorkspace(workspaceRootPath: string): Promise<Project | undefined> {
		const packageCollection = await getPackages(workspaceRootPath);
		const absoluteWorkspaceRootPath = path.resolve(workspaceRootPath);
		if (path.resolve(packageCollection.rootDir) !== absoluteWorkspaceRootPath || packageCollection.packages.length === 0) {
			return undefined;
		}

		const dependencyList = await loadDependencies(packageCollection.rootDir, packageCollection.packages);
		if (dependencyList.length === 0) {
			throw new Error(`Unable to find configured workspace packages in ${absoluteWorkspaceRootPath}`);
		}

		return new Project(absoluteWorkspaceRootPath, orderWorkspaceDependencies(dependencyList));
	}

	static async loadFromWorkspaceConfig(rootPath: string, workspaceConfig: WorkspaceConfig): Promise<Project> {
		const absoluteRootPath = path.resolve(rootPath);
		const packagePathList = await findWorkspacePackagePaths(absoluteRootPath, workspaceConfig);
		const dependencyList = await Promise.all(
			packagePathList.map(packagePath => {
				return loadConfiguredDependency(absoluteRootPath, packagePath);
			})
		);
		const configuredDependencyList = dependencyList.filter((dependency): dependency is Dependency => dependency !== undefined);
		if (configuredDependencyList.length === 0) {
			throw new Error(`Unable to find configured workspace packages in ${absoluteRootPath}`);
		}

		return new Project(absoluteRootPath, orderWorkspaceDependencies(configuredDependencyList));
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

async function findWorkspacePackagePaths(rootPath: string, workspaceConfig: WorkspaceConfig): Promise<string[]> {
	const pathList = await glob(workspaceConfig.workspaces, {
		absolute: true,
		cwd: rootPath,
		onlyDirectories: true,
		onlyFiles: false,
	});

	return [...new Set(pathList.map(packagePath => path.resolve(packagePath)))].sort();
}

async function loadConfiguredDependency(rootPath: string, packagePath: string): Promise<Dependency | undefined> {
	let config;
	try {
		config = await loadDependencyConfig(packagePath);
	} catch (error) {
		if (error instanceof NotFoundError) {
			return undefined;
		}

		throw error;
	}

	return Dependency.load(rootPath, path.relative(rootPath, packagePath), config);
}
