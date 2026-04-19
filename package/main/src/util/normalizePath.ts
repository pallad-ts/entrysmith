import path from "node:path";

export function normalizePath(value: string): string {
	return path.posix.normalize(value.replace(/\\/g, "/"));
}
