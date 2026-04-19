import { z } from "zod";

export const resolvedEntrypointSchema = z.object({
	sourcePath: z.string().min(1),
	entryPointPath: z.string().min(1),
	entryPointName: z.string().min(1),
});

export type ResolvedEntrypointData = z.infer<typeof resolvedEntrypointSchema>;

export class ResolvedEntrypoint {
	readonly sourcePath: string;
	readonly entryPointPath: string;
	readonly entryPointName: string;

	constructor(data: ResolvedEntrypointData) {
		const parsed = resolvedEntrypointSchema.parse(data);
		this.sourcePath = parsed.sourcePath;
		this.entryPointPath = parsed.entryPointPath;
		this.entryPointName = parsed.entryPointName;
	}

	static create(data: ResolvedEntrypointData): ResolvedEntrypoint {
		return new ResolvedEntrypoint(data);
	}
}
