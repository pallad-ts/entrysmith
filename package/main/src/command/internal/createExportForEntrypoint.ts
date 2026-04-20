import { DependencyEntrypointOutputMode } from "../../model/DependencyConfig";
import { Entrypoint } from "../../model/Entrypoint";

export function createExportForEntrypoint(
	entrypoint: Entrypoint,
	destinationDirectory: string,
	outputMode: DependencyEntrypointOutputMode
): [key: string, value: { import: string } | { default: string }] {
	const key = toPackageExportKey(entrypoint);
	const path = `./${entrypoint.destinationPath(destinationDirectory)}`;

	if (outputMode === "commonjs") {
		return [key, { default: path }];
	}

	return [key, { import: path }];
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
