# Node.js TypeScript configuration

```sh
npm install --save-dev typescript @enormora/tsconfig-node
```

Extend `@enormora/tsconfig-node/tsconfig.json` in each source or test project:

```json
{
    "extends": "@enormora/tsconfig-node/tsconfig.json",
    "compilerOptions": {
        "rootDir": ".",
        "outDir": "target/build",
        "tsBuildInfoFile": "target/buildcache/sources.tsbuildinfo"
    },
    "include": ["source/**/*.ts"],
    "exclude": ["source/**/*.test.ts"]
}
```

Use the same preset for Node libraries, applications, tools, and Node-based tests.
It enables strict checking, `NodeNext` modules and resolution, composite builds, declarations, and source maps.
This release targets Node.js 26 and installs its declarations automatically. The shared configuration is included in this package.
Changing the supported Node major is a breaking package change; the package uses ordinary semantic versioning.

Set `"type": "module"` in your package for ESM. Relative TypeScript import extensions are allowed and rewritten during emission.
Choose project paths, file selection, and references locally. Referenced projects need declaration output.
If another tool emits JavaScript, `emitDeclarationOnly: true` retains the declarations needed by references.

Requires TypeScript 6.0 or 7.0. Targets ECMAScript 2025 and adds no DOM library.
Node supplies some web APIs, including `fetch`; browser document and window globals remain unavailable.
When overriding `types`, retain `"@enormora/tsconfig-node"` to load Node globals.
