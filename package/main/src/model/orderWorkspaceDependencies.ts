import { Dependency } from "./Dependency";

export function orderWorkspaceDependencies(dependencyList: Dependency[]): Dependency[] {
	const dependencyByName = new Map<string, Dependency>();
	for (const dependency of dependencyList) {
		if (dependencyByName.has(dependency.name)) {
			throw new Error(`Duplicate workspace package name: ${dependency.name}`);
		}
		dependencyByName.set(dependency.name, dependency);
	}

	const dependencyNameListByPackageName = new Map<string, string[]>();
	for (const dependency of dependencyList) {
		const dependencyNameSet = new Set<string>();
		for (const { name } of dependency.packageJson.dependencyList()) {
			if (dependencyByName.has(name)) {
				dependencyNameSet.add(name);
			}
		}
		dependencyNameListByPackageName.set(dependency.name, [...dependencyNameSet].sort(compareNames));
	}

	const cycle = findDependencyCycle(dependencyNameListByPackageName);
	if (cycle) {
		throw new Error(`Workspace dependency cycle: ${cycle.join(", ")}`);
	}

	const remainingDependencyCountByPackageName = new Map<string, number>();
	const dependentNameListByDependencyName = new Map<string, string[]>();
	for (const [packageName, dependencyNameList] of dependencyNameListByPackageName) {
		remainingDependencyCountByPackageName.set(packageName, dependencyNameList.length);
		for (const dependencyName of dependencyNameList) {
			const dependentNameList = dependentNameListByDependencyName.get(dependencyName) ?? [];
			dependentNameList.push(packageName);
			dependentNameListByDependencyName.set(dependencyName, dependentNameList);
		}
	}

	const readyPackageNameList = [...dependencyByName.keys()]
		.filter(packageName => remainingDependencyCountByPackageName.get(packageName) === 0)
		.sort(compareNames);
	const orderedDependencyList: Dependency[] = [];

	while (readyPackageNameList.length > 0) {
		const packageName = readyPackageNameList.shift();
		if (!packageName) {
			break;
		}

		orderedDependencyList.push(dependencyByName.get(packageName)!);
		for (const dependentName of (dependentNameListByDependencyName.get(packageName) ?? []).sort(compareNames)) {
			const remainingDependencyCount = remainingDependencyCountByPackageName.get(dependentName)! - 1;
			remainingDependencyCountByPackageName.set(dependentName, remainingDependencyCount);
			if (remainingDependencyCount === 0) {
				readyPackageNameList.push(dependentName);
				readyPackageNameList.sort(compareNames);
			}
		}
	}

	return orderedDependencyList;
}

function findDependencyCycle(dependencyNameListByPackageName: Map<string, string[]>): string[] | undefined {
	const stateByPackageName = new Map<string, "visiting" | "visited">();
	const path: string[] = [];

	for (const packageName of [...dependencyNameListByPackageName.keys()].sort(compareNames)) {
		const cycle = visit(packageName);
		if (cycle) {
			return cycle;
		}
	}

	return undefined;

	function visit(packageName: string): string[] | undefined {
		const state = stateByPackageName.get(packageName);
		if (state === "visited") {
			return undefined;
		}
		if (state === "visiting") {
			return path.slice(path.indexOf(packageName));
		}

		stateByPackageName.set(packageName, "visiting");
		path.push(packageName);
		for (const dependencyName of dependencyNameListByPackageName.get(packageName) ?? []) {
			const cycle = visit(dependencyName);
			if (cycle) {
				return cycle;
			}
		}
		path.pop();
		stateByPackageName.set(packageName, "visited");
		return undefined;
	}
}

function compareNames(left: string, right: string): number {
	return left.localeCompare(right);
}
