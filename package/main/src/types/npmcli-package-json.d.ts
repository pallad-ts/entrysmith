declare module "@npmcli/package-json" {
	export type PackageJsonFile = {
		content: Record<string, unknown>;
		update(values: Record<string, unknown>): void;
		save(): Promise<void>;
	};

	const packageJson: {
		load(projectDirectory: string): Promise<PackageJsonFile>;
	};

	export default packageJson;
}

declare module "@npmcli/package-json/lib/read-package" {
	export function readPackage(filename: string): Promise<unknown>;
}
