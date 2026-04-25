import { expect } from "vitest";

import * as path from "node:path";

import { Project } from "../Project";

describe("Project", () => {
	it("loads dependencies from fixture workspace", async () => {
		const projectPath = path.resolve(__dirname, "../../__tests__/example-monorepo");

		const project = await Project.load(projectPath);

		expect({
			path: project.path,
			dependencyList: project.dependencyList.map(dependency => {
				return {
					config: dependency.config,
					entrypointList: dependency.entrypointList.map(entrypoint => {
						return {
							directory: entrypoint.directory,
							name: entrypoint.name,
						};
					}),
					name: dependency.name,
					packageJson: {
						content: dependency.packageJson.content,
						path: path.relative(projectPath, dependency.packageJson.path),
					},
					path: dependency.path,
					tsConfigFiles: dependency.tsConfigFiles.map(tsConfigFile => {
						return {
							content: tsConfigFile.content,
							path: path.relative(projectPath, tsConfigFile.path),
						};
					}),
				};
			}),
		}).toMatchInlineSnapshot(
			{
				path: expect.stringMatching(/example-monorepo$/),
			}, `
			{
			  "dependencyList": [
			    {
			      "config": {
			        "entrypointOutputMode": "esm",
			        "entrypoints": [
			          "index.ts",
			        ],
			        "packageOutputDirectory": "dist",
			        "typescript": {
			          "referenceTsConfigPaths": [
			            "tsconfig.json",
			            "tsconfig.build.json",
			          ],
			        },
			      },
			      "entrypointList": [
			        {
			          "directory": undefined,
			          "name": "index",
			        },
			      ],
			      "name": "@example/app",
			      "packageJson": {
			        "content": {
			          "dependencies": {
			            "@example/lib": "workspace:*",
			          },
			          "entrysmith": {
			            "entrypointOutputMode": "esm",
			            "entrypoints": [
			              "index.ts",
			            ],
			            "packageOutputDirectory": "dist",
			            "typescript": {
			              "referenceTsConfigPaths": [
			                "tsconfig.json",
			                "tsconfig.build.json",
			              ],
			            },
			          },
			          "name": "@example/app",
			          "private": true,
			        },
			        "path": "packages/app/package.json",
			      },
			      "path": "packages/app",
			      "tsConfigFiles": [
			        {
			          "content": {
			            "exclude": [
			              "__tests__/**/*.test.ts",
			              "__tests__/**/*.spec.ts",
			            ],
			            "extends": "./tsconfig.json",
			          },
			          "path": "packages/app/tsconfig.build.json",
			        },
			        {
			          "content": {
			            "compilerOptions": {
			              "composite": true,
			              "paths": {},
			            },
			            "references": [],
			          },
			          "path": "packages/app/tsconfig.json",
			        },
			      ],
			    },
			    {
			      "config": {
			        "entrypointOutputMode": "esm",
			        "entrypoints": [
			          "model/index.ts",
			          "test/another.ts",
			        ],
			        "packageOutputDirectory": "build",
			        "typescript": {
			          "referenceTsConfigPaths": [
			            "tsconfig.json",
			          ],
			          "tsConfigReferenceTargetPath": "tsconfig.json",
			        },
			      },
			      "entrypointList": [
			        {
			          "directory": "model",
			          "name": "index",
			        },
			        {
			          "directory": "test",
			          "name": "another",
			        },
			      ],
			      "name": "@example/lib",
			      "packageJson": {
			        "content": {
			          "entrysmith": {
			            "entrypointOutputMode": "esm",
			            "entrypoints": [
			              "model/index.ts",
			              "test/another.ts",
			            ],
			            "packageOutputDirectory": "build",
			            "typescript": {
			              "referenceTsConfigPaths": [
			                "tsconfig.json",
			              ],
			              "tsConfigReferenceTargetPath": "tsconfig.json",
			            },
			          },
			          "name": "@example/lib",
			          "private": true,
			        },
			        "path": "packages/lib/package.json",
			      },
			      "path": "packages/lib",
			      "tsConfigFiles": [
			        {
			          "content": {
			            "compilerOptions": {
			              "composite": true,
			            },
			          },
			          "path": "packages/lib/tsconfig.json",
			        },
			      ],
			    },
			    {
			      "config": {
			        "entrypointOutputMode": "esm",
			        "entrypoints": [
			          "index.ts",
			        ],
			        "packageOutputDirectory": "dist",
			        "typescript": {
			          "referenceTsConfigPaths": [
			            "tsconfig.json",
			          ],
			        },
			      },
			      "entrypointList": [
			        {
			          "directory": undefined,
			          "name": "index",
			        },
			      ],
			      "name": "@example/unrelated",
			      "packageJson": {
			        "content": {
			          "entrysmith": {
			            "entrypointOutputMode": "esm",
			            "entrypoints": [
			              "index.ts",
			            ],
			          },
			          "name": "@example/unrelated",
			          "private": true,
			        },
			        "path": "packages/unrelated/package.json",
			      },
			      "path": "packages/unrelated",
			      "tsConfigFiles": [
			        {
			          "content": {
			            "compilerOptions": {
			              "composite": true,
			            },
			          },
			          "path": "packages/unrelated/tsconfig.json",
			        },
			      ],
			    },
			  ],
			  "path": StringMatching /example-monorepo\\$/,
			}
		`);
	});
});
