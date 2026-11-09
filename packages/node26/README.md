# Node.js 26 TypeScript configurations

```sh
npm install --save-dev typescript @enormora/tsconfig-node26
```

| Preset             | Purpose                                                |
| ------------------ | ------------------------------------------------------ |
| `tsconfig.json`    | Strict Node.js 26 environment, without choosing output |
| `app.json`         | Composite application build with declarations and maps |
| `library.json`     | Library build with explicit public export annotations  |
| `strip-types.json` | Check erasable TypeScript executed directly by Node    |

```json
{
    "extends": "@enormora/tsconfig-node26/library.json",
    "compilerOptions": {
        "rootDir": ".",
        "outDir": "target/build",
        "tsBuildInfoFile": "target/buildcache/sources.tsbuildinfo"
    },
    "include": ["source/**/*.ts"],
    "exclude": ["source/**/*.test.ts"]
}
```

Requires TypeScript 6.0 or 7.0. Bundles the shared configuration and installs Node.js 26 declarations automatically.
The declaration entry point loads Node types even when dependencies are nested. No runtime JavaScript is shipped.

Choose `"type": "module"` in the consuming package for ESM. The preset uses ECMAScript 2025 standard libraries and adds no DOM library.
Node supplies some web-compatible globals, including `fetch`; DOM document and window globals remain unavailable.

Set consumer paths, files, and project references explicitly. When overriding `types`, retain `"@enormora/tsconfig-node26"`.
Node ignores compiler configuration at runtime; JSX, aliases, and syntax transformations require another tool.
