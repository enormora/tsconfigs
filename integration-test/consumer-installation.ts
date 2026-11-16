import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { runCommand } from './run-command.ts';

const repositoryFolder = process.cwd();
const artifacts = {
    '@enormora/tsconfig': 'tsconfig.tgz',
    '@enormora/tsconfig-node': 'tsconfig-node.tgz'
};

export type Consumer = { readonly folder: string; };

function isManifest(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export async function readManifest(filePath: string): Promise<Record<string, unknown>> {
    const content: unknown = JSON.parse(await readFile(filePath, 'utf8'));
    assert.ok(isManifest(content));
    return content;
}

export async function installConsumer(packages: readonly (keyof typeof artifacts)[]): Promise<Consumer> {
    const consumersFolder = path.join(tmpdir(), 'enormora-tsconfig-consumers');
    await mkdir(consumersFolder, { recursive: true });
    const folder = await mkdtemp(path.join(consumersFolder, 'consumer-'));
    await writeFile(
        path.join(folder, 'package.json'),
        JSON.stringify({
            name: 'tsconfig-consumer',
            private: true,
            type: 'module',
            dependencies: Object.fromEntries(packages.map(function packageArtifact(name) {
                return [ name, `file:${path.join(repositoryFolder, 'target', artifacts[name])}` ];
            }))
        })
    );
    const result = await runCommand('npm', [
        'install',
        '--ignore-scripts',
        '--no-audit',
        '--no-fund',
        '--install-strategy=nested'
    ], folder);
    assert.equal(result.exitCode, 0, result.output);
    return { folder };
}

export async function readConsumerInstallation(): Promise<Consumer> {
    const folder = await readFile(path.join(repositoryFolder, 'target/consumer-path'), 'utf8');
    return { folder };
}

export async function prepareConsumerInstallation(): Promise<void> {
    const consumer = await installConsumer([ '@enormora/tsconfig', '@enormora/tsconfig-node' ]);
    await writeFile(path.join(repositoryFolder, 'target/consumer-path'), consumer.folder);
}
