import { DependencyExportCondition } from "../../model/DependencyConfig";
import { Entrypoint } from "../../model/Entrypoint";

const EXPORT_CONDITION_ORDER: DependencyExportCondition[] = ["types", "import", "require", "default"];

export function createExportForEntrypoint(
	entrypoint: Entrypoint,
	destinationDirectory: string,
	exportConditions: DependencyExportCondition[]
): [key: string, value: Partial<Record<DependencyExportCondition, string>>] {
	const key = toPackageExportKey(entrypoint);
	const outputPath = `./${entrypoint.destinationPath(destinationDirectory)}`;
	const value: Partial<Record<DependencyExportCondition, string>> = {};
	for (const condition of EXPORT_CONDITION_ORDER) {
		if (exportConditions.includes(condition)) {
			value[condition] = condition === "types" ? outputPath.replace(/\.js$/, ".d.ts") : outputPath;
		}
	}

	return [key, value];
}

function toPackageExportKey(entrypoint: Entrypoint): string {
	if (entrypoint.name === "index") {
		return entrypoint.directory === undefined ? "." : `./${entrypoint.directory}`;
	}

	if (entrypoint.directory === undefined) {
		return `./${entrypoint.name}`;
	}

	return `./${entrypoint.directory}/${entrypoint.name}`;
}
