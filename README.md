# Entrysmith

Entrysmith is a CLI tool for keeping package entrypoints in sync across a TypeScript workspace.

It lets a package expose imports such as `@scope/package/model` or `@scope/package/test/another` from files under `src`, then updates the package metadata and TypeScript project references needed for other workspace packages to consume those entrypoints.

## What It Does

Running `entrysmith fix` in a configured workspace package:

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
    "entrypointOutputMode": "esm"
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
- `entrypointOutputMode`: `"esm"` or `"cjs"`
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
    "entrypointOutputMode": "esm",
    "packageOutputDirectory": "dist",
    "typescript": {
      "tsConfigReferenceTargetPath": "tsconfig.json",
      "referenceTsConfigPaths": ["tsconfig.json"]
    }
  }
}
```

## Package Exports

For `entrypointOutputMode: "esm"`, Entrysmith writes exports like:

```json
{
  "exports": {
    "./model": {
      "import": "./dist/model/index.js"
    },
    "./test/another": {
      "import": "./dist/test/another.js"
    },
    "./package.json": "./package.json"
  }
}
```

For `entrypointOutputMode: "cjs"`, Entrysmith uses `default` instead of `import`.

## TypeScript Workspace Support

Entrysmith discovers packages in the current workspace.

When the current package depends on another workspace package that has Entrysmith configuration, `entrysmith fix` updates the configured tsconfig files with:

- `references` pointing to the dependency package or its configured `tsConfigReferenceTargetPath`
- `compilerOptions.paths` entries such as `@scope/dependency/model` pointing at the dependency source entrypoint

If multiple configured tsconfig files extend a common parent that is also configured, Entrysmith stores path mappings in the common parent.

## Usage

Run from a workspace package directory that contains Entrysmith configuration:

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
