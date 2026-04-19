"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.loadConfig = loadConfig;
const common_errors_1 = require("@pallad/common-errors");
const either_1 = require("@sweet-monads/either");
const cosmiconfig_1 = require("cosmiconfig");
const cosmiconfig_typescript_loader_1 = require("cosmiconfig-typescript-loader");
const zod_1 = require("zod");
const entrysmithConfigSchema = zod_1.z.object({
    entrypoints: zod_1.z.array(zod_1.z.string().min(1, "Entrypoint path cannot be empty")),
    entrypointOutputMode: zod_1.z.enum(["commonjs", "module"]),
    typescript: zod_1.z
        .object({
        tsConfigTargetPath: zod_1.z.string().min(1).optional(),
        referenceTsConfigPaths: zod_1.z.array(zod_1.z.string().min(1)).default(["tsconfig.json"]),
    })
        .default({}),
    packageOutputDirectory: zod_1.z.string().min(1).default("dist"),
});
const CONFIG_NAME = "entrysmith";
const SEARCH_PLACES = ["package.json", "entrysmith.config.js", "entrysmith.config.ts", "entrysmith.config.json"];
async function loadConfig(packageDirectory) {
    const explorer = (0, cosmiconfig_1.cosmiconfig)(CONFIG_NAME, {
        searchPlaces: SEARCH_PLACES,
        stopDir: packageDirectory,
        loaders: {
            ".ts": (0, cosmiconfig_typescript_loader_1.TypeScriptLoader)(),
        },
    });
    const searchResult = await explorer.search(packageDirectory);
    if (!searchResult || searchResult.isEmpty) {
        return (0, either_1.left)(new common_errors_1.NotFoundError(`Unable to find entrysmith configuration in ${packageDirectory}. Expected one of: ${SEARCH_PLACES.join(", ")}`));
    }
    const result = searchResult;
    const parsedConfig = entrysmithConfigSchema.safeParse(result.config);
    if (!parsedConfig.success) {
        return (0, either_1.left)(parsedConfig.error);
    }
    return (0, either_1.right)(parsedConfig.data);
}
