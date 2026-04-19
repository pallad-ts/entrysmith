import type { ResolvedEntrypoint } from "./model/resolved-entrypoint";
type EntrypointOutputMode = "commonjs" | "module";
export type PackageJsonFile = {
    content: PackageJsonContent;
    update(values: Record<string, unknown>): void;
    save(): Promise<void>;
};
type PackageJsonContent = {
    files?: unknown;
    exports?: unknown;
    dependencies?: Record<string, string>;
    [name: string]: unknown;
};
type PackageJsonUpdateResult = {
    updated: boolean;
};
export declare function loadPackageJson(projectDirectory: string): Promise<PackageJsonFile>;
export declare function getPackageDependencies(packageJson: PackageJsonFile): string[];
export declare function applyEntrypointsToPackageJson(packageJson: PackageJsonFile, options: {
    entrypoints: ResolvedEntrypoint[];
    entrypointOutputMode: EntrypointOutputMode;
    packageOutputDirectory: string;
}): Promise<PackageJsonUpdateResult>;
export {};
//# sourceMappingURL=package-json.d.ts.map