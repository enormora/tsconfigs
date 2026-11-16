# Enormora TypeScript configurations

Strict presets for TypeScript 6.0 and 7.0 projects using project references.
Every preset builds JavaScript, declarations, and source maps. Every preset uses `NodeNext` module resolution.

## Choose an environment

| Preset                                  | Use it for                                    | Available globals              |
| --------------------------------------- | --------------------------------------------- | ------------------------------ |
| `@enormora/tsconfig/base.json`          | Code shared between environments              | Standard ECMAScript APIs       |
| `@enormora/tsconfig/browser.json`       | Browser application code                      | ECMAScript and DOM APIs        |
| `@enormora/tsconfig/worker.json`        | Browser worker code                           | ECMAScript and worker APIs     |
| `@enormora/tsconfig-node/tsconfig.json` | Node.js libraries, services, tools, and tests | ECMAScript and Node.js 26 APIs |

Install `typescript` and the package containing your chosen preset as development dependencies.
The Node package installs its Node declarations automatically and includes its shared base configuration.
Its current release targets Node.js 26. Changing the supported Node major is a breaking package change.

Set `"type": "module"` in the consuming package for ESM. Use explicit relative import extensions, such as `./answer.ts`.
The compiler rewrites relative TypeScript extensions to JavaScript extensions when emitting output.
Aliases and package specifiers are not rewritten.

Browser and worker presets change the available APIs, not module resolution. JSX and framework settings remain consumer-owned.
All presets target ECMAScript 2025. They do not provide polyfills.

## Source and test projects

Use an empty root `tsconfig.json` to list the projects:

```json
{
    "files": [],
    "references": [{ "path": "./source/tsconfig.sources.json" }, { "path": "./source/tsconfig.unit-tests.json" }]
}
```

For a Node project, `source/tsconfig.sources.json` can contain:

```json
{
    "extends": "@enormora/tsconfig-node/tsconfig.json",
    "compilerOptions": {
        "rootDir": "..",
        "outDir": "../target/build",
        "tsBuildInfoFile": "../target/buildcache/sources.tsbuildinfo"
    },
    "include": ["./**/*.ts"],
    "exclude": ["./**/*.test.ts"]
}
```

The test project selects the tests and references the source project:

```json
{
    "extends": "@enormora/tsconfig-node/tsconfig.json",
    "compilerOptions": {
        "rootDir": "..",
        "outDir": "../target/build",
        "tsBuildInfoFile": "../target/buildcache/unit-tests.tsbuildinfo"
    },
    "references": [{ "path": "./tsconfig.sources.json" }],
    "include": ["./**/*.test.ts"]
}
```

Build the graph with `tsc --build --stopBuildOnErrors`. Each leaf project inherits `composite: true`.
The empty solution config needs no compiler options. Give each leaf a unique build-cache path.
Only exclude files that overlap your includes, such as colocated tests in the source project above.

For a browser/server application, choose the browser preset for client code, the Node preset for server code and Node-based tests,
and the base preset for shared modules. Reference the shared project from the client and server projects.

## Build behavior

The same preset works for applications and libraries. There are no separate app, library, or checking presets.
Declarations support project references; declaration maps support navigation across project boundaries.
`isolatedDeclarations` is not required for ordinary declaration generation.

If another tool emits JavaScript, set `emitDeclarationOnly: true` locally to retain declaration output for downstream references.
Use `noEmit: true` only for standalone checks, not projects consumed by other projects in the graph.
Node can also execute erasable TypeScript source directly; it ignores compiler settings at runtime.

Strict checking includes exact optional properties, checked indexed access, explicit index-signature access,
override checks, checked side-effect imports, unused-code checks, and declaration checking.
Enums and parameter properties are rejected. Unreachable code, unused labels, switch fallthrough, and incomplete returns are errors.

`types` and `lib` arrays replace inherited arrays. When overriding Node types, retain `"@enormora/tsconfig-node"`.
Imported packages may introduce additional global declarations.
