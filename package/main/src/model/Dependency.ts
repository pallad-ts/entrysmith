
import { ResolvedEntrypoint, resolvedEntrypointSchema } from "./resolved-entrypoint";

export class Dependency {
	readonly name: string;
	readonly dependencyPath: string;
	readonly entrypointList: ResolvedEntrypoint[];

	constructor(readonly name: string, readonly path: string, readonly entrypointList: ResolvedEntrypoint) {
		// TODO
	}


}
