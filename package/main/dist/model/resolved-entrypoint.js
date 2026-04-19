"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ResolvedEntrypoint = exports.resolvedEntrypointSchema = void 0;
const zod_1 = require("zod");
exports.resolvedEntrypointSchema = zod_1.z.object({
    sourcePath: zod_1.z.string().min(1),
    entryPointPath: zod_1.z.string().min(1),
    entryPointName: zod_1.z.string().min(1),
});
class ResolvedEntrypoint {
    sourcePath;
    entryPointPath;
    entryPointName;
    constructor(data) {
        const parsed = exports.resolvedEntrypointSchema.parse(data);
        this.sourcePath = parsed.sourcePath;
        this.entryPointPath = parsed.entryPointPath;
        this.entryPointName = parsed.entryPointName;
    }
    static create(data) {
        return new ResolvedEntrypoint(data);
    }
}
exports.ResolvedEntrypoint = ResolvedEntrypoint;
