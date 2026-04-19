import { ResolvedEntrypoint } from "./resolved-entrypoint";
export declare class Dependency {
    readonly name: string;
    readonly path: string;
    readonly entrypointList: ResolvedEntrypoint;
    readonly name: string;
    readonly dependencyPath: string;
    readonly entrypointList: ResolvedEntrypoint[];
    constructor(name: string, path: string, entrypointList: ResolvedEntrypoint);
    static loadFromPath(projectRootPath: string, dependencyPath: string): Dependency;
}
//# sourceMappingURL=dependency.d.ts.map