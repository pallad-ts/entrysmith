import { readPackageJSON } from "pkg-types";

export async function loadPackageJson(packageDirectory: string): Promise<unknown> {
	return readPackageJSON(packageDirectory);
}
