import assert from 'node:assert';
import { readFile, realpath, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';
import { suite, test } from 'mocha';
import nodeSourceManifest from '../packages/node26/package.json' with { type: 'json' };
import { runCommand } from './run-command.ts';
import { compilers, diagnosticCodes, runCompiler, writeProject } from './compiler-project.ts';
import { readConsumerInstallations, installConsumer, readManifest } from './consumer-installation.ts';

const consumers = await readConsumerInstallations();
for (const consumer of consumers) {
    suite(`${consumer.packageManager} package installation`, function () {
        test('ships declarations and Node dependencies without runtime JavaScript', async function () {
            const nodeFolder = path.join(consumer.folder, 'node_modules/@enormora/tsconfig-node26');
            const nodeManifest = await readManifest(path.join(nodeFolder, 'package.json'));
            assert.deepStrictEqual(nodeManifest['dependencies'], nodeSourceManifest.dependencies);
            assert.deepStrictEqual(nodeManifest['exports'], {
                '.': { types: './node26/globals.d.ts' },
                './app.json': './node26/app.json',
                './library.json': './node26/library.json',
                './strip-types.json': './node26/strip-types.json',
                './tsconfig.json': './node26/tsconfig.json'
            });
            assert.strictEqual(nodeManifest['main'], undefined);
            assert.strictEqual(
                await readFile(path.join(nodeFolder, 'node26/globals.d.ts'), 'utf8'),
                "import 'node';\n"
            );
            const coreManifest = await readManifest(
                path.join(consumer.folder, 'node_modules/@enormora/tsconfig/package.json')
            );
            assert.strictEqual(coreManifest['peerDependencies'], undefined);
            assert.strictEqual(coreManifest['dependencies'], undefined);
        });

        test('keeps Node declarations private to the preset dependency tree', async function () {
            const nodeFolder = await realpath(path.join(consumer.folder, 'node_modules/@enormora/tsconfig-node26'));
            const resolveFromPreset = createRequire(path.join(nodeFolder, 'node26/globals.d.ts'));
            const nodeTypes = await readManifest(resolveFromPreset.resolve('@types/node/package.json'));
            assert.strictEqual(nodeTypes['version'], nodeSourceManifest.dependencies['@types/node']);
            await assert.rejects(readFile(path.join(consumer.folder, 'node_modules/@types/node/package.json')), {
                code: 'ENOENT'
            });
        });

        test('runs the Node preset without installing the core package', async function () {
            const nodeConsumer = await installConsumer(consumer.packageManager, [ '@enormora/tsconfig-node26' ]);
            await assert.rejects(
                readFile(path.join(nodeConsumer.folder, 'node_modules/@enormora/tsconfig/package.json')),
                { code: 'ENOENT' }
            );
            const folder = await writeProject(nodeConsumer, {
                extends: '@enormora/tsconfig-node26/strip-types.json',
                files: [ 'index.ts' ]
            }, {
                'index.ts':
                    "import { readFile } from 'node:fs/promises';\nexport const load = () => readFile(process.execPath);"
            });
            const [ compiler ] = compilers;
            const checked = await runCompiler(compiler.command, folder, [ '--project', 'tsconfig.json' ]);
            assert.strictEqual(checked.exitCode, 0, checked.output);
        });
    });

    for (const compiler of compilers) {
        suite(`${consumer.packageManager} with ${compiler.name}`, function () {
            test('loads nested Node declarations and built-in modules', async function () {
                const folder = await writeProject(consumer, {
                    extends: '@enormora/tsconfig-node26/strip-types.json',
                    files: [ 'index.ts' ]
                }, {
                    'index.ts':
                        "import { readFile } from 'node:fs/promises';\nexport const load = () => readFile(process.execPath);\n"
                });
                const compilation = await runCompiler(compiler.command, folder, [ '--project', 'tsconfig.json' ]);
                assert.strictEqual(compilation.exitCode, 0, compilation.output);
            });

            for (const preset of [ 'portable', 'browser', 'worker' ]) {
                test(`${preset} exposes only its environment`, async function () {
                    const sources = {
                        portable: 'export const total: number = [1, 2].reduce((sum, value) => sum + value, 0);',
                        browser:
                            "export const links: string[] = Array.from(document.querySelectorAll('a'), link => link.href);",
                        worker: 'export const address: string = self.location.href;'
                    };
                    const source = sources[preset as keyof typeof sources];
                    const folder = await writeProject(consumer, {
                        extends: [ `@enormora/tsconfig/${preset}.json`, '@enormora/tsconfig/check.json' ],
                        files: [ 'index.ts' ]
                    }, { 'index.ts': source });
                    const checked = await runCompiler(compiler.command, folder, [ '--project', 'tsconfig.json' ]);
                    assert.strictEqual(checked.exitCode, 0, checked.output);
                    await writeFile(path.join(folder, 'index.ts'), 'export const environment = process;');
                    const rejected = await runCompiler(compiler.command, folder, [ '--project', 'tsconfig.json' ]);
                    assert.notStrictEqual(rejected.exitCode, 0);
                    assert.match(rejected.output, /Cannot find name 'process'/v);
                });
            }

            test('rejects DOM globals in Node and worker code', async function () {
                for (
                    const preset of [
                        '@enormora/tsconfig-node26/strip-types.json',
                        '@enormora/tsconfig/worker/app.json'
                    ]
                ) {
                    const folder = await writeProject(consumer, { extends: preset, files: [ 'index.ts' ] }, {
                        'index.ts': 'export const root = document.documentElement;'
                    });
                    const compilation = await runCompiler(compiler.command, folder, [ '--project', 'tsconfig.json' ]);
                    assert.notStrictEqual(compilation.exitCode, 0);
                    assert.match(compilation.output, /Cannot find name 'document'/v);
                }
            });

            test('enforces strictness beyond strict mode', async function () {
                const folder = await writeProject(consumer, {
                    extends: [ '@enormora/tsconfig/portable.json', '@enormora/tsconfig/check.json' ],
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
                const compilation = await runCompiler(compiler.command, folder, [ '--project', 'tsconfig.json' ]);
                const codes = diagnosticCodes(compilation);
                for (const code of [ 2322, 4111, 2375, 7030, 6133, 4114, 7027, 7028, 7029, 2882, 1294 ]) {
                    assert.ok(codes.includes(code), `Missing TS${code}: ${compilation.output}`);
                }
            });

            test('builds referenced libraries, rebuilds dependencies, and blocks erroneous emit', async function () {
                const folder = await writeProject(consumer, {
                    files: [],
                    references: [ { path: './library' }, { path: './application' } ]
                }, {
                    'library/tsconfig.json': JSON.stringify({
                        extends: '@enormora/tsconfig/portable/library.json',
                        compilerOptions: {
                            outDir: '../output/library',
                            tsBuildInfoFile: '../cache/library.tsbuildinfo'
                        },
                        files: [ 'index.ts' ]
                    }),
                    'library/index.ts': 'export const answer: number = 42;',
                    'application/tsconfig.json': JSON.stringify({
                        extends: '@enormora/tsconfig-node26/app.json',
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
                const built = await runCompiler(compiler.command, folder, [ '--build', '--stopBuildOnErrors' ]);
                assert.strictEqual(built.exitCode, 0, built.output);
                assert.match(await readFile(path.join(folder, 'output/library/index.d.ts'), 'utf8'), /answer: number/v);
                const originalOutput = await readFile(path.join(folder, 'output/application/index.js'), 'utf8');
                await Promise.all([
                    writeFile(path.join(folder, 'library/index.ts'), "export const answer: string = 'changed';"),
                    writeFile(
                        path.join(folder, 'application/index.ts'),
                        "import { answer } from '../library/index.ts';\nexport const result: number = answer + '!';"
                    )
                ]);
                const rebuilt = await runCompiler(compiler.command, folder, [ '--build', '--stopBuildOnErrors' ]);
                assert.deepStrictEqual({ exitCode: rebuilt.exitCode, codes: diagnosticCodes(rebuilt) }, {
                    exitCode: compiler.name === 'typescript' ? 2 : 1,
                    codes: [ 2322 ]
                }, rebuilt.output);
                assert.match(await readFile(path.join(folder, 'output/library/index.d.ts'), 'utf8'), /answer: string/v);
                assert.strictEqual(
                    await readFile(path.join(folder, 'output/application/index.js'), 'utf8'),
                    originalOutput
                );
            });

            test('emits declarations alone and enforces public annotations', async function () {
                const folder = await writeProject(consumer, {
                    extends: [ '@enormora/tsconfig/portable/library.json', '@enormora/tsconfig/declarations.json' ],
                    compilerOptions: { outDir: './output', tsBuildInfoFile: './cache.tsbuildinfo' },
                    files: [ 'index.ts' ]
                }, { 'index.ts': 'export function answer(): number { return 42; }' });
                const compilation = await runCompiler(compiler.command, folder, [ '--project', 'tsconfig.json' ]);
                assert.strictEqual(compilation.exitCode, 0, compilation.output);
                assert.match(await readFile(path.join(folder, 'output/index.d.ts'), 'utf8'), /answer\(\): number/v);
                await assert.rejects(readFile(path.join(folder, 'output/index.js')), { code: 'ENOENT' });
                await writeFile(path.join(folder, 'index.ts'), "export const answer = Number('42');");
                const rejected = await runCompiler(compiler.command, folder, [ '--project', 'tsconfig.json' ]);
                assert.ok(diagnosticCodes(rejected).includes(9010), rejected.output);
            });

            test('composes the React JSX layer with browser application checking', async function () {
                const folder = await writeProject(consumer, {
                    extends: [ '@enormora/tsconfig/browser/app.json', '@enormora/tsconfig/react.json' ],
                    files: [ 'index.tsx', 'react-runtime.d.ts' ]
                }, {
                    'react-runtime.d.ts':
                        "declare module 'react/jsx-runtime' { export namespace JSX { interface Element {} interface IntrinsicElements { button: { disabled: boolean }; } } }",
                    'index.tsx': 'export const button = <button disabled={true} />;'
                });
                const compilation = await runCompiler(compiler.command, folder, [ '--project', 'tsconfig.json' ]);
                assert.strictEqual(compilation.exitCode, 0, compilation.output);
                await writeFile(path.join(folder, 'index.tsx'), 'export const button = <button disabled="invalid" />;');
                const rejected = await runCompiler(compiler.command, folder, [ '--project', 'tsconfig.json' ]);
                assert.ok(diagnosticCodes(rejected).includes(2322), rejected.output);
                await assert.rejects(readFile(path.join(folder, 'index.js')), { code: 'ENOENT' });
            });

            test('checks and executes erasable TypeScript without emitting files', async function () {
                const folder = await writeProject(consumer, {
                    extends: '@enormora/tsconfig-node26/strip-types.json',
                    files: [ 'index.ts', 'answer.ts' ]
                }, {
                    'answer.ts': 'export const answer: number = 42;',
                    'index.ts': "import { answer } from './answer.ts';\nprocess.stdout.write(String(answer));"
                });
                const compilation = await runCompiler(compiler.command, folder, [ '--project', 'tsconfig.json' ]);
                assert.strictEqual(compilation.exitCode, 0, compilation.output);
                const execution = await runCommand(process.execPath, [ 'index.ts' ], folder);
                assert.strictEqual(execution.exitCode, 0, execution.output);
                assert.strictEqual(execution.output, '42');
                await assert.rejects(readFile(path.join(folder, 'index.js')), { code: 'ENOENT' });
            });
        });
    }
}
