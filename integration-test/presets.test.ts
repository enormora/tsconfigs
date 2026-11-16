import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { suite, test } from '@overkill-dev/test';
import { compilers, diagnosticCodes, runCompiler, writeProject } from './compiler-project.ts';
import { readConsumerInstallation } from './consumer-installation.ts';
import { runCommand } from './run-command.ts';

const consumer = await readConsumerInstallation();
const environments = [
    { preset: 'base', source: 'export const total: number = [1, 2].reduce((sum, value) => sum + value, 0);' },
    {
        preset: 'browser',
        source: "export const links: string[] = Array.from(document.querySelectorAll('a'), link => link.href);"
    },
    { preset: 'worker', source: 'export const address: string = self.location.href;' }
];

export const testNode = suite(
    'compiler presets',
    compilers.map(function compilerTests(compiler) {
        return suite(compiler.name, [
            ...environments.map(function environmentTest(environment) {
                return test(`${environment.preset} exposes only its environment`, async function (scope) {
                    const folder = await writeProject(consumer, {
                        extends: `@enormora/tsconfig/${environment.preset}.json`,
                        files: [ 'index.ts' ]
                    }, { 'index.ts': environment.source });
                    const checked = await runCompiler(compiler.command, folder, [ '--project', 'tsconfig.json' ]);
                    scope.assert.annotated(checked.output).equal(checked.exitCode, 0);
                    await writeFile(path.join(folder, 'index.ts'), 'export const environment = process;');
                    const rejected = await runCompiler(compiler.command, folder, [ '--project', 'tsconfig.json' ]);
                    scope.assert.notEqual(rejected.exitCode, 0);
                    scope.assert.match(rejected.output, /Cannot find name 'process'/v);
                    return scope.assert.collect();
                });
            }),
            test('loads nested Node declarations and built-in modules', async function (scope) {
                const folder = await writeProject(consumer, {
                    extends: '@enormora/tsconfig-node/tsconfig.json',
                    files: [ 'index.ts' ]
                }, {
                    'index.ts':
                        "import { readFile } from 'node:fs/promises';\nexport const load = () => readFile(process.execPath);"
                });
                const result = await runCompiler(compiler.command, folder, [ '--project', 'tsconfig.json' ]);
                scope.assert.annotated(result.output).equal(result.exitCode, 0);
                return scope.assert.collect();
            }),
            test('rejects DOM globals in Node and worker code', async function (scope) {
                for (const preset of [ '@enormora/tsconfig-node/tsconfig.json', '@enormora/tsconfig/worker.json' ]) {
                    const folder = await writeProject(consumer, { extends: preset, files: [ 'index.ts' ] }, {
                        'index.ts': 'export const root = document.documentElement;'
                    });
                    const result = await runCompiler(compiler.command, folder, [ '--project', 'tsconfig.json' ]);
                    scope.assert.notEqual(result.exitCode, 0);
                    scope.assert.match(result.output, /Cannot find name 'document'/v);
                }
                return scope.assert.collect();
            }),
            test('rejects extensionless ESM imports in every environment', async function (scope) {
                for (
                    const preset of [
                        '@enormora/tsconfig/base.json',
                        '@enormora/tsconfig/browser.json',
                        '@enormora/tsconfig/worker.json',
                        '@enormora/tsconfig-node/tsconfig.json'
                    ]
                ) {
                    const folder = await writeProject(
                        consumer,
                        { extends: preset, files: [ 'index.ts', 'answer.ts' ] },
                        {
                            'answer.ts': 'export const answer: number = 42;',
                            'index.ts': "import { answer } from './answer';\nexport const result: number = answer;"
                        }
                    );
                    const result = await runCompiler(compiler.command, folder, [ '--project', 'tsconfig.json' ]);
                    scope.assert.notEqual(result.exitCode, 0);
                    scope.assert.annotated(result.output).true(diagnosticCodes(result).includes(2835));
                }
                return scope.assert.collect();
            }),
            test('allows dot access to index signatures', async function (scope) {
                const folder = await writeProject(consumer, {
                    extends: '@enormora/tsconfig/base.json',
                    files: [ 'index.ts' ]
                }, {
                    'index.ts': [
                        'export const entries: Record<string, number> = {};',
                        'export const value: number | undefined = entries.missing;'
                    ]
                        .join('\n')
                });
                const result = await runCompiler(compiler.command, folder, [ '--project', 'tsconfig.json' ]);
                scope.assert.annotated(result.output).equal(result.exitCode, 0);
                return scope.assert.collect();
            }),
            test('enforces strictness beyond strict mode', async function (scope) {
                const folder = await writeProject(consumer, {
                    extends: '@enormora/tsconfig/base.json',
                    files: [ 'index.ts' ]
                }, {
                    'index.ts': [
                        'export const entries: Record<string, number> = {};',
                        'export const value: number = entries.missing;',
                        'export const options: { name?: string } = { name: undefined };',
                        'export function choose(flag: boolean) { if (flag) { return 1; } }',
                        'export function unused(parameter: string): number { const local = 1; return 2; }',
                        'export class Parent { value(): number { return 1; } }',
                        'export class Child extends Parent { value(): number { return 2; } }',
                        'export function unreachable(): number { return 1; return 2; }',
                        'export function fallThrough(value: number): number { switch (value) { case 1: value++; case 2: return value; default: return 0; } }',
                        'unusedLabel: { }',
                        "import './missing.ts';",
                        'export enum Status { Ready }'
                    ]
                        .join('\n')
                });
                const result = await runCompiler(compiler.command, folder, [ '--project', 'tsconfig.json' ]);
                const codes = diagnosticCodes(result);
                for (const code of [ 2322, 2375, 7030, 6133, 4114, 7027, 7028, 7029, 2882, 1294 ]) {
                    scope.assert.annotated(`Missing TS${code}: ${result.output}`).true(codes.includes(code));
                }
                await scope.assert.rejects(async function () {
                    return readFile(path.join(folder, 'index.js'));
                }, { code: 'ENOENT' });
                return scope.assert.collect();
            }),
            test('builds references and preserves output when a dependent project fails', async function (scope) {
                const folder = await writeProject(consumer, {
                    files: [],
                    references: [ { path: './library' }, { path: './application' } ]
                }, {
                    'library/tsconfig.json': JSON.stringify({
                        extends: '@enormora/tsconfig/base.json',
                        compilerOptions: {
                            outDir: '../output/library',
                            tsBuildInfoFile: '../cache/library.tsbuildinfo'
                        },
                        files: [ 'index.ts' ]
                    }),
                    'library/index.ts': 'export const answer: number = 42;',
                    'application/tsconfig.json': JSON.stringify({
                        extends: '@enormora/tsconfig-node/tsconfig.json',
                        compilerOptions: {
                            outDir: '../output/application',
                            tsBuildInfoFile: '../cache/application.tsbuildinfo'
                        },
                        references: [ { path: '../library' } ],
                        files: [ 'index.ts' ]
                    }),
                    'application/index.ts':
                        "import { answer } from '../library/index.ts';\nexport const result: number = answer;"
                });
                scope.assert.deepEqual(
                    await runCompiler(compiler.command, folder, [ '--build', '--stopBuildOnErrors' ]),
                    { exitCode: 0, output: '' }
                );
                scope.assert.match(
                    await readFile(path.join(folder, 'output/library/index.d.ts'), 'utf8'),
                    /answer: number/v
                );
                const originalOutput = await readFile(path.join(folder, 'output/application/index.js'), 'utf8');
                await Promise.all([
                    writeFile(path.join(folder, 'library/index.ts'), "export const answer: string = 'changed';"),
                    writeFile(
                        path.join(folder, 'application/index.ts'),
                        "import { answer } from '../library/index.ts';\nexport const result: number = answer + '!';"
                    )
                ]);
                const rebuilt = await runCompiler(compiler.command, folder, [ '--build', '--stopBuildOnErrors' ]);
                scope.assert.annotated(rebuilt.output).deepEqual({
                    exitCode: rebuilt.exitCode,
                    codes: diagnosticCodes(rebuilt)
                }, { exitCode: compiler.name === 'typescript' ? 2 : 1, codes: [ 2322 ] });
                scope.assert.match(
                    await readFile(path.join(folder, 'output/library/index.d.ts'), 'utf8'),
                    /answer: string/v
                );
                scope.assert.equal(
                    await readFile(path.join(folder, 'output/application/index.js'), 'utf8'),
                    originalOutput
                );
                return scope.assert.collect();
            }),
            test('emits executable JavaScript while preserving direct TypeScript execution', async function (scope) {
                const folder = await writeProject(consumer, {
                    extends: '@enormora/tsconfig-node/tsconfig.json',
                    files: [ 'index.ts', 'answer.ts' ]
                }, {
                    'answer.ts': 'export const answer: number = 42;',
                    'index.ts': "import { answer } from './answer.ts';\nprocess.stdout.write(String(answer));"
                });
                const built = await runCompiler(compiler.command, folder, [ '--project', 'tsconfig.json' ]);
                scope.assert.annotated(built.output).equal(built.exitCode, 0);
                scope.assert.match(await readFile(path.join(folder, 'index.js'), 'utf8'), /\.\/answer\.js/v);
                const executions = await Promise.all([ 'index.ts', 'index.js' ].map(async function executeSource(file) {
                    return runCommand(process.execPath, [ file ], folder);
                }));
                scope.assert.deepEqual(executions, [ { exitCode: 0, output: '42' }, { exitCode: 0, output: '42' } ]);
                scope.assert.match(await readFile(path.join(folder, 'index.d.ts'), 'utf8'), /sourceMappingURL/v);
                return scope.assert.collect();
            })
        ]);
    })
);
