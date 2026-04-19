export type FixResult = {
    packageJsonUpdated: boolean;
    tsConfigReferenceUpdates: number;
    tsConfigPathUpdates: number;
    workspaceDependencyCount: number;
};
export declare function runFix(projectDirectory: string): Promise<FixResult>;
//# sourceMappingURL=fix.d.ts.map