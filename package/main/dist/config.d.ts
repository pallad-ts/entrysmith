import { type Either } from "@sweet-monads/either";
import { z } from "zod";
declare const entrysmithConfigSchema: z.ZodObject<{
    entrypoints: z.ZodArray<z.ZodString, "many">;
    entrypointOutputMode: z.ZodEnum<["commonjs", "module"]>;
    typescript: z.ZodDefault<z.ZodObject<{
        tsConfigTargetPath: z.ZodOptional<z.ZodString>;
        referenceTsConfigPaths: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
    }, "strip", z.ZodTypeAny, {
        referenceTsConfigPaths: string[];
        tsConfigTargetPath?: string | undefined;
    }, {
        tsConfigTargetPath?: string | undefined;
        referenceTsConfigPaths?: string[] | undefined;
    }>>;
    packageOutputDirectory: z.ZodDefault<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    entrypoints: string[];
    entrypointOutputMode: "commonjs" | "module";
    typescript: {
        referenceTsConfigPaths: string[];
        tsConfigTargetPath?: string | undefined;
    };
    packageOutputDirectory: string;
}, {
    entrypoints: string[];
    entrypointOutputMode: "commonjs" | "module";
    typescript?: {
        tsConfigTargetPath?: string | undefined;
        referenceTsConfigPaths?: string[] | undefined;
    } | undefined;
    packageOutputDirectory?: string | undefined;
}>;
export type EntrysmithConfig = z.infer<typeof entrysmithConfigSchema>;
export type EntrysmithConfigLoadError = Error | z.ZodError;
export declare function loadConfig(packageDirectory: string): Promise<Either<EntrysmithConfigLoadError, EntrysmithConfig>>;
export {};
//# sourceMappingURL=config.d.ts.map