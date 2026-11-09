# Enormora TypeScript configurations

Strict, composable presets for TypeScript 6.0 and 7.0. JSON presets and declaration entry points ship without JavaScript.

## Packages

| Package                     | Purpose                                                                         |
| --------------------------- | ------------------------------------------------------------------------------- |
| `@enormora/tsconfig`        | Environment-independent checking, browser and worker environments, build layers |
| `@enormora/tsconfig-node26` | Node.js 26 presets with Node declarations included                              |

## Node.js 26

```sh
npm install --save-dev typescript @enormora/tsconfig-node26
```

```json
{
    "extends": "@enormora/tsconfig-node26/library.json",
    "compilerOptions": {
        "rootDir": ".",
        "outDir": "./target/build",
        "tsBuildInfoFile": "./target/buildcache/sources.tsbuildinfo"
    },
    "include": ["source/**/*.ts"],
    "exclude": ["source/**/*.test.ts"]
}
```

The Node package bundles its base configuration and installs Node declarations. No separate core package or `@types/node` installation is needed.
Use `app.json` for emitted applications, `library.json` for libraries, or `strip-types.json` to check code executed directly by Node.

Node ignores `tsconfig.json` when stripping types. Aliases, downlevel transformations, and JSX require a separate tool.

## Core presets

```sh
npm install --save-dev typescript @enormora/tsconfig
```

| Preset                  | Behavior                                                                     |
| ----------------------- | ---------------------------------------------------------------------------- |
| `base.json`             | Strict checking and erasable syntax, without runtime or output choices       |
| `portable.json`         | ECMAScript 2023 APIs, Node-compatible ESM resolution, no environment globals |
| `browser.json`          | ECMAScript 2025, DOM and iterable APIs, bundler resolution                   |
| `worker.json`           | ECMAScript 2025, worker and iterable APIs, bundler resolution                |
| `build.json`            | Composite builds, JavaScript, declarations and maps; no emit on errors       |
| `check.json`            | Checking without output; TypeScript import extensions allowed                |
| `declarations.json`     | Composite declaration-only builds                                            |
| `library.json`          | Build settings with explicit public export annotations                       |
| `react.json`            | Automatic React JSX transform                                                |
| `portable/library.json` | Portable library build                                                       |
| `browser/app.json`      | Browser application checking without output                                  |
| `worker/app.json`       | Worker application checking without output                                   |

Compose environment presets before workflow and JSX layers:

```json
{
    "extends": ["@enormora/tsconfig/browser/app.json", "@enormora/tsconfig/react.json"],
    "include": ["source/**/*.ts", "source/**/*.tsx"]
}
```

Install React and its declarations in the consuming application. Browser and worker presets assume a bundler owns execution.
Choose an explicit older `target` and matching `lib` if supporting older environments; these presets provide no polyfills.

## Project references and tests

Keep solution configs empty except for explicit references:

```json
{
    "files": [],
    "references": [{ "path": "./source/tsconfig.sources.json" }, { "path": "./source/tsconfig.unit-tests.json" }]
}
```

Each source and test project selects its own files, references, root directory, output directory, and unique build-cache path.
Tests reference the source project. Use an emitting preset for projects consumed by downstream references; declaration-only output is sufficient when a bundler emits JavaScript.
Build with `tsc --build --stopBuildOnErrors` to avoid building downstream projects after a failure.

Import Mocha functions explicitly. Install Mocha and its declarations in the consumer; the presets add no test globals.

`types`, `lib`, and file-selection arrays replace inherited arrays. When overriding `types` in a Node project, retain
`"@enormora/tsconfig-node26"` to preserve Node globals. Imported dependencies can also introduce global declarations.
Avoid loading incompatible Node declaration versions through other dependencies.

## Strictness and compatibility

The base enables strict mode, exact optional properties, checked indexed access, bracket access for index signatures,
override checks, checked side-effect imports, unused-code checks, and declaration checking.
Unreachable code, unused labels, fallthrough, and incomplete returns are errors. Enums and parameter properties are rejected.
Library presets additionally require sufficient export annotations for independent declaration generation.

Presets do not choose consumer paths, aliases, file selection, or references. Standard libraries and targets use explicit annual versions.
Base and JSX layers must be combined with an environment preset.
Compiler versions are documented and tested rather than installed through a peer dependency. Use a supported local, global, or aliased compiler.

Shared JSON files have one source in `packages/tsconfig` and are included in both artifacts. Relative inheritance stays inside each package.
Packtory infers the Node declaration dependency from `globals.d.ts`; there are no separate published-dependency lists.

## Development and releases

Use Node.js 26 and run:

```sh
npm ci --ignore-scripts
npx just check
```

Tests pack both packages and install their tarballs with npm and pnpm. Consumer fixtures run against TypeScript 6.0 and 7.0.
Beta and nightly compiler snapshots are locked and run separately in CI. Linting uses Enormora presets; Renovate maintains pinned dependencies and Actions.

Versions are explicit in each workspace's `package.json`. New diagnostics, changed resolution or output, and raised compiler or runtime requirements
require a major version. New compatible presets require a minor version. Documentation-only corrections use a patch version.
Assess declaration dependency updates by their observable effect, regardless of their upstream version number.
Shared configuration changes affect both artifacts; update both package versions when their contents change.

The publish workflow is manual and uses Packtory with npm Trusted Publishing and provenance.
Before the first publication, claim both package names and configure each npm Trusted Publisher for this repository, `publish.yml`, and the `npm` environment.
Successful publication creates package-specific Git tags. Publishing is separate from creating this repository.
