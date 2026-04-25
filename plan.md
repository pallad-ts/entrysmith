I've created already a package `main`. Implement everything there.

Entrysmith is a cli tool responsible for managing entrypoints of a package for loading them via node modules and typescript references

## Configuration
Use `cosmiconfig` to load configuration for this package under key `entrysmith`.

Support loading configuration from `package.json` or `entrysmith.config.{js,ts,json}` file in the root of the project.

Use zod to define its schema.
- `entrypoints` - array of filenames pointing in `src` directory
- `entrypointOutputMode` - `commonjs`, `module`
- `typescript`
  - `tsConfigReferenceTargetPath` - path to tsconfig target used when other workspace packages create TypeScript project references to this package. Optional; defaults to package root.
  - `referenceTsConfigPaths` - array of paths to tsconfig files in this package that should receive TypeScript project references for workspace dependencies. By default `tsconfig.json`
- `packageOutputDirectory` - directory where built package files are emitted and referenced from package.json exports. By default `dist`

## What is entrypoint

Usually you're importing packages like this `import {Something} from "some-package"` which in reality you're hitting barrel file from `some-package`.

I want to be able to import part of the package by creating entrypoints in it like
`some-package/model` -- entrypoint for models
`some-package/test` -- entrypoint for tests

## Defining entrypoint

Entrypoint is defined at `entrysmith.entrypoints` configuration as a path to file in `src` directory. 

For example
```
entrypoints:
  - model/index.ts # resolves to some-package/model
  - test/index.ts # resolves to some-package/test
  - test/another.ts # resolves to some-package/test/another
```

## Applying entrypoints

1) Ensure `entrysmith.packageOutputDirectory` is defined in `files` section of `package.json`
2) Ensure `exports` object is defined in `package.json` with following entrypoint (for each of entrypoints) - See "entrypoint export"
3) Ensure `exports` for "package.json" is defined `"./package.json": "./package.json"`
4) Ensure typescript references are setup for each entrypoin - See "entrypoint typescript reference"

### Entrypoint export

Define entrypoint that looks like this for `entrypointOutputMode` set to `commonjs`
```
"./[entryPointName]": {
  "default": "./[packageOutputDirectory]/[entryPointPath].js"
}
```

Or for `module`
```
"./[entryPointName]": {
  "import": "./[packageOutputDirectory]/[entryPointPath].js"
}
```

Variables used in templates:
`[entryPointName]` - name of the entrypoint, for example `model`, `model/another`
`[packageOutputDirectory]` - value of `entrysmith.packageOutputDirectory`
`[entryPointPath]` - path to entrypoint file in `src` directory, for example `model/index`


### Entrypoints in typescript

1) Find all packages in the project using `@manypkg/get-packages`
2) Iterate over each dependency of current package.json and check whether given dependency is on the list from point 1. If not, skip it.
3) Follow `Typescript reference` section for each dependency that is on the list from point 2
4) Follow `Typescript path mapping` section for each dependency that is on the list from point 2

#### Typescript reference
Create entry in `references` for each dependency from workspaces

```
"references": [
  {
    "path": "../[pathToDependencyPackage](/[tsConfigReferenceTargetPath])?"
  }
]
```
Note that `tsConfigReferenceTargetPath` is optional, if not provided, it will reference package root.


#### Typescript path mapping

Resolve common tsconfig path if multiple `referenceTsConfigPaths` are provided. That being said if one tsconfig.json extends another, then use parent tsconfig for storing paths.

Note that parent `tsconfig.json` must be defined in `referenceTsConfigPaths`, If not then apply this section for all `referenceTsConfigPaths`.

Add `compilerOptions.paths` entry for each entrypoint of the dependency in following format
```
"compilerOptions": {
  "paths": {
    "[dependencyName]/[entryPointName]": ["../[pathToDependencyPackage]/src/[entryPointPath]"]
  }
}
```

## CLI commands

### `fix` (called as well when running `entrysmith` without arguments)

Applies changes to the package. See section "Applying entrypoints" for details.
