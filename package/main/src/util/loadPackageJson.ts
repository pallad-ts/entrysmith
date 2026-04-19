import { readPackage } from "@npmcli/package-json/lib/read-package";

import * as path from "node:path";

export async function loadPackageJson(packageDirectory: string): Promise<unknown> {
	const packageJsonPath = path.resolve(packageDirectory, "package.json");
	return readPackage(packageJsonPath);
}
