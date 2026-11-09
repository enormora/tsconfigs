import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir as temporaryDirectory } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { runCommand } from './run-command.ts';

const repositoryFolder = process.cwd();
const artifacts = {
    '@enormora/tsconfig': 'tsconfig.tgz',
    '@enormora/tsconfig-node26': 'tsconfig-node26.tgz'
};

export type Consumer = {
    readonly folder: string;
    readonly packageManager: 'npm' | 'pnpm';
};

function isManifest(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export async function readManifest(filePath: string): Promise<Record<string, unknown>> {
    const content: unknown = JSON.parse(await readFile(filePath, 'utf8'));
    assert.ok(isManifest(content));
    return content;
}

export async function installConsumer(
    packageManager: 'npm' | 'pnpm',
    packages: readonly (keyof typeof artifacts)[]
): Promise<Consumer> {
    const folder = await mkdtemp(path.join(temporaryDirectory(), `enormora-tsconfigs-${packageManager}-`));
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
    const command = packageManager === 'npm' ? 'npm' : fileURLToPath(import.meta.resolve('pnpm/bin/pnpm.mjs'));
    const argumentsList = packageManager === 'npm'
        ? [ 'install', '--ignore-scripts', '--no-audit', '--no-fund', '--omit=peer', '--install-strategy=nested' ]
        : [ 'install', '--ignore-scripts', '--config.auto-install-peers=false' ];
    const result = await runCommand(
        packageManager === 'npm' ? command : process.execPath,
        packageManager === 'npm' ? argumentsList : [ command, ...argumentsList ],
        folder
    );
    assert.equal(result.exitCode, 0, result.output);
    return { folder, packageManager };
}

async function createConsumerInstallations(): Promise<readonly Consumer[]> {
    const packages: readonly (keyof typeof artifacts)[] = [ '@enormora/tsconfig', '@enormora/tsconfig-node26' ];
    return Promise.all([ installConsumer('npm', packages), installConsumer('pnpm', packages) ]);
}

export async function readConsumerInstallations(): Promise<readonly Consumer[]> {
    const packageManagers: readonly Consumer['packageManager'][] = [ 'npm', 'pnpm' ];
    return Promise.all(packageManagers.map(async function readConsumer(packageManager) {
        const folder = await readFile(path.join(repositoryFolder, 'target', `${packageManager}-consumer-path`), 'utf8');
        return { folder, packageManager };
    }));
}

export async function prepareConsumerInstallations(): Promise<void> {
    const consumers = await createConsumerInstallations();
    await Promise.all(consumers.map(async function recordConsumer(consumer) {
        await writeFile(
            path.join(repositoryFolder, 'target', `${consumer.packageManager}-consumer-path`),
            consumer.folder
        );
    }));
}
