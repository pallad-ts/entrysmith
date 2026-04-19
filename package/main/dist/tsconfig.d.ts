import type { Dependency } from "./model/dependency";
type UpdateTsConfigReferencesOptions = {
    projectDirectory: string;
    tsConfigPaths: string[];
    dependencies: Dependency[];
    tsConfigTargetPath?: string;
};
type UpdateTsConfigPathMappingsOptions = {
    projectDirectory: string;
    tsConfigPaths: string[];
    dependencies: Dependency[];
};
export declare function updateTsConfigReferences(options: UpdateTsConfigReferencesOptions): Promise<number>;
export declare function updateTsConfigPathMappings(options: UpdateTsConfigPathMappingsOptions): Promise<number>;
export {};
//# sourceMappingURL=tsconfig.d.ts.map