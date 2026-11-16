import { readFile, realpath } from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';
import { suite, test } from '@overkill-dev/test';
import sourceManifest from '../package.json' with { type: 'json' };
import { compilers, runCompiler, writeProject } from './compiler-project.ts';
import { readConsumerInstallation, installConsumer, readManifest } from './consumer-installation.ts';

const consumer = await readConsumerInstallation();

export const testNode = suite('published packages', [
    test('ships declarations and inferred dependencies without JavaScript', async function (scope) {
        const nodeFolder = path.join(consumer.folder, 'node_modules/@enormora/tsconfig-node');
        const manifest = await readManifest(path.join(nodeFolder, 'package.json'));
        scope.assert.deepEqual(manifest.dependencies, sourceManifest.dependencies);
        scope.assert.deepEqual(manifest.exports, {
            '.': { types: './node/globals.d.ts' },
            './tsconfig.json': './node/tsconfig.json'
        });
        scope.assert.equal(manifest.main, undefined);
        scope.assert.equal(await readFile(path.join(nodeFolder, 'node/globals.d.ts'), 'utf8'), "import 'node';\n");
        const coreManifest = await readManifest(
            path.join(consumer.folder, 'node_modules/@enormora/tsconfig/package.json')
        );
        scope.assert.equal(coreManifest.dependencies, undefined);
        scope.assert.deepEqual(coreManifest.exports, {
            './base.json': './base.json',
            './browser.json': './browser.json',
            './worker.json': './worker.json'
        });
        return scope.assert.collect();
    }),
    test('resolves Node declarations inside the installed dependency tree', async function (scope) {
        const nodeFolder = await realpath(path.join(consumer.folder, 'node_modules/@enormora/tsconfig-node'));
        const resolveFromPreset = createRequire(path.join(nodeFolder, 'node/globals.d.ts'));
        const typesPath = resolveFromPreset.resolve('@types/node/package.json');
        const nodeTypes = await readManifest(typesPath);
        scope.assert.equal(nodeTypes.version, sourceManifest.dependencies['@types/node']);
        scope.assert.false(path.relative(await realpath(consumer.folder), typesPath).startsWith('..'));
        await scope.assert.rejects(
            async function () {
                return readFile(path.join(consumer.folder, 'node_modules/@types/node/package.json'));
            },
            { code: 'ENOENT' }
        );
        return scope.assert.collect();
    }),
    test('runs Node code with only the Node preset package installed', async function (scope) {
        const nodeConsumer = await installConsumer([ '@enormora/tsconfig-node' ]);
        await scope.assert.rejects(
            async function () {
                return readFile(path.join(nodeConsumer.folder, 'node_modules/@enormora/tsconfig/package.json'));
            },
            { code: 'ENOENT' }
        );
        const folder = await writeProject(nodeConsumer, {
            extends: '@enormora/tsconfig-node/tsconfig.json',
            files: [ 'index.ts' ]
        }, {
            'index.ts':
                "import { readFile } from 'node:fs/promises';\nexport const load = () => readFile(process.execPath);"
        });
        const [ compiler ] = compilers;
        const result = await runCompiler(compiler.command, folder, [ '--project', 'tsconfig.json' ]);
        scope.assert.annotated(result.output).equal(result.exitCode, 0);
        return scope.assert.collect();
    })
]);
