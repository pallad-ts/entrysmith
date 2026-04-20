import { expect } from "vitest";

import * as path from "node:path";

import { Project } from "../Project";

describe("Project", () => {
	it("loads dependencies from fixture workspace", async () => {
		const projectPath = path.resolve(__dirname, "../../__tests__/example-monorepo");

		const projectResult = await Project.load(projectPath);

		expect(projectResult.unwrap()).toMatchInlineSnapshot(
			{
				path: expect.stringMatching(/example-monorepo$/),
			},
			`
			{
			  "dependencyList": [
			    Dependency {
			      "config": {
			        "entrypointOutputMode": "commonjs",
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
			        Entrypoint {
			          "directory": undefined,
			          "name": "index",
			        },
			      ],
			      "name": "@example/app",
			      "path": "packages/app",
			    },
			    Dependency {
			      "config": {
			        "entrypointOutputMode": "module",
			        "entrypoints": [
			          "model/index.ts",
			          "test/another.ts",
			        ],
			        "packageOutputDirectory": "build",
			        "typescript": {
			          "referenceTsConfigPaths": [
			            "tsconfig.json",
			          ],
			          "tsConfigTargetPath": "tsconfig.json",
			        },
			      },
			      "entrypointList": [
			        Entrypoint {
			          "directory": "model",
			          "name": "index",
			        },
			        Entrypoint {
			          "directory": "test",
			          "name": "another",
			        },
			      ],
			      "name": "@example/lib",
			      "path": "packages/lib",
			    },
			  ],
			  "path": StringMatching /example-monorepo\\$/,
			}
		`
		);
	});
});
