import { DependencyEntrypointOutputMode } from "../../model/DependencyConfig";
import { Entrypoint } from "../../model/Entrypoint";

export function createExportForEntrypoint(
	entrypoint: Entrypoint,
	destinationDirectory: string,
	outputModeList: DependencyEntrypointOutputMode[]
): [key: string, value: Record<"types", string> & Partial<Record<"import" | "require", string>>] {
	const key = toPackageExportKey(entrypoint);
	const outputPath = `./${entrypoint.destinationPath(destinationDirectory)}`;
	const value: Record<"types", string> & Partial<Record<"import" | "require", string>> = {
		types: outputPath.replace(/\.js$/, ".d.ts"),
	};

	if (outputModeList.includes("esm")) {
		value.import = outputPath;
	}

	if (outputModeList.includes("cjs")) {
		value.require = outputPath;
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
