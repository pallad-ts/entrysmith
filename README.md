# Entrysmith

Entrysmith is a CLI tool for keeping package entrypoints in sync across a TypeScript workspace.

It lets a package expose imports such as `@scope/package/model` or `@scope/package/test/another` from files under `src`, then updates the package metadata and TypeScript project references needed for other workspace packages to consume those entrypoints.

## What It Does

Running `entrysmith fix` in a configured package:

- ensures the configured build output directory is listed in `package.json` `files`
- rewrites `package.json` `exports` for every configured entrypoint
- keeps `./package.json` exported
- adds TypeScript project references for workspace dependencies
- adds `compilerOptions.paths` mappings for entrypoints exposed by workspace dependencies

Running `entrysmith` without arguments runs `entrysmith fix`.

## Entrypoints

Entrypoints are files in the package `src` directory. Each entrypoint becomes an importable package subpath.

```json
{
  "entrysmith": {
    "entrypoints": [
      "model/index.ts",
      "test/index.ts",
      "test/another.ts"
    ],
    "exportConditions": ["types", "import"]
  }
}
```

These entrypoints expose imports like:

```ts
import { Model } from "@scope/package/model";
import { testHelper } from "@scope/package/test";
import { anotherHelper } from "@scope/package/test/another";
```

`index.ts` maps to its containing directory. Other file names map to their full path without extension.

## Configuration

Entrysmith loads configuration from one of:

- `package.json` under the `entrysmith` key
- `entrysmith.config.js`
- `entrysmith.config.ts`
- `entrysmith.config.json`

Configuration fields:

- `entrypoints`: list of entrypoint files under `src`
- `exportConditions`: non-empty list of package export conditions. Use `"types"`, `"import"`, `"require"`, or `"default"`. At least one runtime condition (`"import"`, `"require"`, or `"default"`) is required.
- `packageOutputDirectory`: build output directory used in package exports, defaults to `"dist"`
- `typescript.tsConfigReferenceTargetPath`: target path used when other workspace packages reference this package, defaults to the package root
- `typescript.referenceTsConfigPaths`: tsconfig files that receive references and path mappings, defaults to `["tsconfig.json"]`

Example:

```json
{
  "entrysmith": {
    "entrypoints": [
      "model/index.ts",
      "test/another.ts"
    ],
    "exportConditions": ["types", "import"],
    "packageOutputDirectory": "dist",
    "typescript": {
      "tsConfigReferenceTargetPath": "tsconfig.json",
      "referenceTsConfigPaths": ["tsconfig.json"]
    }
  }
}
```

### Version 0.4 Migration

Version 0.4 removes `entrypointOutputMode`. Replace it with explicit `exportConditions`:

```json
{
  "entrysmith": {
    "entrypoints": ["index.ts"],
    "exportConditions": ["default"]
  }
}
```

### Workspace Configuration

Configure Entrysmith workspaces at the workspace root:

```json
{
	"entrysmith": {
		"workspaces": ["packages/*", "tools/*"]
	}
}
```

`workspaces` must be a non-empty list of glob patterns. Entrysmith resolves patterns from the workspace root. It deduplicates overlapping matches. It skips matched directories without Entrysmith package configuration.

Run `entrysmith fix` at this root to update every configured package. Entrysmith loads and validates every configured package before it writes files. It applies packages in dependency-first order. Dependencies in `dependencies`, `devDependencies`, `peerDependencies`, and `optionalDependencies` set this order. Dependency cycles and duplicate package names fail the command.

When root Entrysmith workspace configuration is absent, Entrysmith uses package-manager `workspaces`. Set `entrysmith.workspaces` to apply a narrower package set. Entrysmith does not run package scripts or compile TypeScript.

## Package Exports

For `exportConditions: ["types", "import"]`, Entrysmith writes exports like:

```json
{
  "exports": {
    "./model": {
      "types": "./dist/model/index.d.ts",
      "import": "./dist/model/index.js"
    },
    "./test/another": {
      "types": "./dist/test/another.d.ts",
      "import": "./dist/test/another.js"
    },
    "./package.json": "./package.json"
  }
}
```

Entrysmith emits only configured conditions. It emits `types` first and `default` last. Use `exportConditions: ["default"]` for a legacy default export without an explicit types condition.

## TypeScript Workspace Support

When invoked inside one configured package, Entrysmith discovers packages in the current package-manager workspace.

When the current package depends on another workspace package that has Entrysmith configuration, `entrysmith fix` updates the configured tsconfig files with:

- `references` pointing to the dependency package or its configured `tsConfigReferenceTargetPath`
- `compilerOptions.paths` entries such as `@scope/dependency/model` pointing at the dependency source entrypoint

If multiple configured tsconfig files extend a common parent that is also configured, Entrysmith stores path mappings in the common parent.

## Usage

Run from a configured package directory:

```sh
entrysmith fix
```

Run from a package-manager workspace root to update each configured package. Add `entrysmith.workspaces` only when you need a narrower package set:

```sh
entrysmith fix
```

To keep entrypoints synchronized automatically, add `entrysmith fix` to the package `prepare` script:

```json
{
  "scripts": {
    "prepare": "entrysmith fix"
  }
}
```
