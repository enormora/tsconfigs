import { readFile } from 'node:fs/promises';
import path from 'node:path';
import coreManifest from './packages/tsconfig/package.json' with { type: 'json' };
import nodeManifest from './packages/node26/package.json' with { type: 'json' };

const corePresets = [
    'base',
    'portable',
    'browser',
    'worker',
    'build',
    'check',
    'declarations',
    'library',
    'react',
    'portable/library',
    'browser/app',
    'worker/app'
];
const nodePresets = [ 'tsconfig', 'app', 'library', 'strip-types' ];

function exposePresets(presets) {
    return presets.map(function exposePreset(preset) {
        return { root: preset, export: `./${preset}.json` };
    });
}

function presetRoots(presets) {
    return Object.fromEntries(presets.map(function presetRoot(preset) {
        return [ preset, { json: `${preset}.json` } ];
    }));
}

export async function buildConfiguration() {
    const projectFolder = process.cwd();
    const manifest = JSON.parse(await readFile(path.join(projectFolder, 'package.json'), 'utf8'));
    return {
        registrySettings: {
            authentication: {
                publish: { type: 'npm-open-identity-connect', provider: 'automatic' },
                metadata: 'automatic'
            }
        },
        checks: {
            requiredFiles: { enabled: true, files: [ 'LICENSE', 'README.md' ] },
            uniqueTargetPaths: { enabled: true },
            maximumBundleSize: { enabled: true, bytes: 50_000 },
            noDevelopmentDependencyImports: { enabled: true },
            noUnexposedExecutables: { enabled: true },
            typeScriptIntegrity: { enabled: true, declarations: 'all' }
        },
        commonPackageSettings: {
            publishSettings: { access: 'public', provenance: { type: 'automatic' } },
            additionalFiles: [
                { inputFilePath: path.join(projectFolder, 'LICENSE'), targetFilePath: 'LICENSE' }
            ],
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
                mainPackageManifest: coreManifest,
                versioning: { automatic: false, version: coreManifest.version },
                sourcesFolder: path.join(projectFolder, 'packages/tsconfig'),
                roots: presetRoots(corePresets),
                packageInterface: { modules: exposePresets(corePresets) },
                additionalFiles: [
                    { inputFilePath: path.join(projectFolder, 'README.md'), targetFilePath: 'README.md' }
                ],
                additionalPackageManifestAttributes: {
                    description: 'Strict, composable TypeScript configurations'
                }
            },
            {
                name: '@enormora/tsconfig-node26',
                mainPackageManifest: nodeManifest,
                versioning: { automatic: false, version: nodeManifest.version },
                sourcesFolder: path.join(projectFolder, 'packages'),
                roots: {
                    globals: { declarationFile: 'node26/globals.d.ts' },
                    ...Object.fromEntries(nodePresets.map(function nodeRoot(preset) {
                        return [ preset, { json: `node26/${preset}.json` } ];
                    })),
                    ...Object.fromEntries(corePresets.map(function sharedRoot(preset) {
                        return [ `shared/${preset}`, { json: `tsconfig/${preset}.json` } ];
                    }))
                },
                packageInterface: {
                    modules: [ { root: 'globals', export: '.' }, ...exposePresets(nodePresets) ],
                    privateRoots: corePresets.map(function sharedRoot(preset) {
                        return `shared/${preset}`;
                    })
                },
                additionalFiles: [
                    {
                        inputFilePath: path.join(projectFolder, 'packages/node26/README.md'),
                        targetFilePath: 'README.md'
                    }
                ],
                additionalPackageManifestAttributes: {
                    description: 'Strict TypeScript configurations and declarations for Node.js 26'
                }
            }
        ]
    };
}
