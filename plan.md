# Workspace Configuration Plan

## Configuration

Entrysmith supports workspace configuration in the workspace root.

```json
{
  "entrysmith": {
    "workspaces": ["packages/*", "tools/*"]
  }
}
```

Each matched package keeps its existing Entrysmith configuration.

```json
{
  "entrysmith": {
    "entrypoints": ["index.ts"],
    "entrypointOutputMode": "esm"
  }
}
```

`workspaces` paths are glob patterns resolved from workspace root.

## Behavior

Running `entrysmith fix` from workspace root will:

1. Load root Entrysmith workspace configuration.
2. Expand `workspaces` globs.
3. Skip matched directories without Entrysmith package configuration.
4. Load every configured package before writing files.
5. Build dependency graph from `dependencies`, `devDependencies`, `peerDependencies`, and `optionalDependencies`.
6. Sort packages in dependency-first topological order.
7. Apply existing package and TypeScript changes to each package.
8. Report dependency cycles as errors.

Per-package changes are:

- Rewrite `package.json` exports.
- Add output directory to `package.json` `files`.
- Update TypeScript project references.
- Update TypeScript path mappings.

This command will not run package build scripts.

Running `entrysmith fix` inside one package keeps current behavior.

## Implementation

### 1. Add workspace config model

Add workspace schema beside `DependencyConfigSchema`.

```ts
{
  workspaces: string[]
}
```

Require a non-empty list of non-empty glob strings.

Keep package config and workspace config as separate types.

### 2. Add exact-directory config loading

Refactor configuration loading to support root workspace config and package config.

Support existing search places:

- `package.json`
- `entrysmith.config.js`
- `entrysmith.config.ts`
- `entrysmith.config.json`

Package loading must not inherit root configuration.

### 3. Add glob discovery

Add `tinyglobby` as a direct dependency.

Workspace discovery will:

- Resolve patterns relative to workspace root.
- Return matched directories.
- Deduplicate overlapping matches.
- Sort paths deterministically.
- Skip directories without package configuration.
- Fail when no configured package remains.

### 4. Extend `Project`

Add explicit loading APIs:

```ts
Project.loadFromPackage(packagePath)
Project.loadFromWorkspaceConfig(rootPath, workspaceConfig)
```

`Project.loadFromPackage` retains legacy package discovery.

`Project.loadFromWorkspaceConfig` uses Entrysmith `workspaces` globs.

Discovery explicitly skips packages without configuration. Other package and configuration errors remain fatal.

### 5. Add dependency ordering

Add focused topological sort.

Rules:

- Configured workspace packages are graph nodes.
- Dependencies outside configured packages do not create graph edges.
- Lexical package-name order resolves ties.
- Duplicate package names fail validation.
- Cycles fail with involved package names.

### 6. Add workspace apply path

Update `apply()` dispatch:

- Current directory has `workspaces` config: workspace mode.
- Otherwise: package mode.

Workspace mode loads and validates all packages before writes. It then applies package and TypeScript changes in topological order.

### 7. Add tests

Cover:

- Workspace schema validation.
- Multiple glob patterns.
- Overlapping glob deduplication.
- Matched directory without package config gets skipped.
- One root command updates every configured package.
- Entrysmith globs work without package-manager `workspaces`.
- Dependencies process before dependents.
- All four dependency fields create graph edges.
- Duplicate package names fail.
- Dependency cycles fail.
- Empty discovery fails.
- Existing package-local command still works.

### 8. Update documentation

Document:

- Root workspace configuration.
- Glob base directory.
- Skip behavior.
- Dependency-first order.
- Root and package invocation.
- No package scripts or TypeScript compilation run.

## Main Files

- `package/main/src/model/DependencyConfig.ts`
- `package/main/src/model/Project.ts`
- New workspace config and discovery model files
- New topological ordering utility
- `package/main/src/command/apply.ts`
- `package/main/src/command/internal/loadProjectAndDependency.ts`
- `package/main/src/command/__tests__/Apply.spec.ts`
- `package/main/package.json`
- `README.md`
