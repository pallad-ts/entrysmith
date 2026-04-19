import { z } from "zod";
export declare const resolvedEntrypointSchema: z.ZodObject<{
    sourcePath: z.ZodString;
    entryPointPath: z.ZodString;
    entryPointName: z.ZodString;
}, "strip", z.ZodTypeAny, {
    sourcePath: string;
    entryPointPath: string;
    entryPointName: string;
}, {
    sourcePath: string;
    entryPointPath: string;
    entryPointName: string;
}>;
export type ResolvedEntrypointData = z.infer<typeof resolvedEntrypointSchema>;
export declare class ResolvedEntrypoint {
    readonly sourcePath: string;
    readonly entryPointPath: string;
    readonly entryPointName: string;
    constructor(data: ResolvedEntrypointData);
    static create(data: ResolvedEntrypointData): ResolvedEntrypoint;
}
//# sourceMappingURL=resolved-entrypoint.d.ts.map