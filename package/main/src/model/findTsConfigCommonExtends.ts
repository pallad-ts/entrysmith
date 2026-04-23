import { TsConfigFile } from "./TsConfigFile";

/**
 * Returns tsconfig files that are not extended by another tsconfig from same list.
 *
 * Useful for finding root tsconfig files within provided subset.
 *
 * @example
 * ```ts
 * const tsConfig = new TsConfigFile("/project/package/tsconfig.json", {
 * 	extends: "../../tsconfig.base.json",
 * });
 * const tsConfigBuild = new TsConfigFile("/project/package/tsconfig.build.json", {
 * 	extends: "./tsconfig.json",
 * });
 * const tsConfigUnrelated = new TsConfigFile("/project/package/tsconfig.unrelated.json", {
 * 	extends: "../../tsconfig.other-base.json",
 * });
 *
 * findTsConfigCommonExtends([tsConfig, tsConfigBuild, tsConfigUnrelated]);
 * // => [tsConfig, tsConfigUnrelated]
 * ```
 */
export function findTsConfigCommonExtends(tsConfigFileList: TsConfigFile[]): TsConfigFile[] {
	if (tsConfigFileList.length <= 1) {
		return tsConfigFileList;
	}

	const commonTsConfigFileList = tsConfigFileList.filter(tsConfigFile => {
		return !tsConfigFileList.some(candidate => {
			return candidate !== tsConfigFile && candidate.isExtendedBy(tsConfigFile);
		});
	});

	return commonTsConfigFileList.length === 0 ? tsConfigFileList : commonTsConfigFileList;
}
