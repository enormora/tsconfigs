import { readFile } from 'node:fs/promises';
import path from 'node:path';

const corePresets = [ 'base', 'browser', 'worker' ];

export async function buildConfiguration() {
    const projectFolder = process.cwd();
    const manifest = JSON.parse(await readFile(path.join(projectFolder, 'package.json'), 'utf8'));
    const sharedFiles = [ 'LICENSE', 'source/base.json' ].map(function sharedFile(file) {
        return path.join(projectFolder, file);
    });
    return {
        registrySettings: {
            authentication: {
                publish: { type: 'npm-open-identity-connect', provider: 'automatic' },
                metadata: 'automatic'
            }
        },
        checks: {
            typeScriptIntegrity: { enabled: true, declarations: 'all' },
            noDuplicatedFiles: { enabled: true, allowList: sharedFiles },
            requiredFiles: { enabled: true, files: [ 'LICENSE', 'readme.md' ] },
            maximumBundleSize: { enabled: true, bytes: 50_000 },
            noUnusedBundleDependencies: { enabled: true },
            noDevelopmentDependencyImports: { enabled: true },
            uniqueTargetPaths: { enabled: true },
            noSideEffects: { enabled: true },
            noUnexposedExecutables: { enabled: true },
            nodeEngineCompatibility: { enabled: true }
        },
        commonPackageSettings: {
            mainPackageManifest: manifest,
            sourcesFolder: path.join(projectFolder, 'source'),
            publishSettings: { access: 'public', provenance: { type: 'automatic' } },
            additionalFiles: [ { inputFilePath: sharedFiles[0], targetFilePath: 'LICENSE' } ],
            additionalPackageManifestAttributes: {
                repository: manifest.repository,
                license: manifest.license,
                author: manifest.author,
                keywords: [ 'typescript', 'tsconfig', 'strict', 'project-references' ]
            }
        },
        packages: [
            {
                name: '@enormora/tsconfig',
                roots: Object.fromEntries(corePresets.map(function presetRoot(preset) {
                    return [ preset, { json: `${preset}.json` } ];
                })),
                packageInterface: {
                    modules: corePresets.map(function exposePreset(preset) {
                        return { root: preset, export: `./${preset}.json` };
                    })
                },
                additionalFiles: [ {
                    inputFilePath: path.join(projectFolder, 'readme.md'),
                    targetFilePath: 'readme.md'
                } ],
                additionalPackageManifestAttributes: { description: 'Strict TypeScript project-reference presets' }
            },
            {
                name: '@enormora/tsconfig-node',
                roots: {
                    globals: { declarationFile: 'node/globals.d.ts' },
                    configuration: { json: 'node/tsconfig.json' },
                    base: { json: 'base.json' }
                },
                packageInterface: {
                    modules: [
                        { root: 'globals', export: '.' },
                        { root: 'configuration', export: './tsconfig.json' }
                    ],
                    privateRoots: [ 'base' ]
                },
                additionalFiles: [ {
                    inputFilePath: path.join(projectFolder, 'source/node/readme.md'),
                    targetFilePath: 'readme.md'
                } ],
                additionalPackageManifestAttributes: {
                    description: 'Strict Node.js project-reference preset with Node declarations'
                }
            }
        ]
    };
}
