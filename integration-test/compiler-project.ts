import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { runCommand, type CommandResult } from './run-command.ts';
import type { Consumer } from './consumer-installation.ts';

export const compilers = [
    { name: 'typescript', command: fileURLToPath(import.meta.resolve('typescript/bin/tsc')) },
    {
        name: 'typescript-native',
        command: fileURLToPath(new URL('./bin/tsc', import.meta.resolve('typescript-native/package.json')))
    },
    {
        name: 'typescript-beta',
        command: fileURLToPath(new URL('./bin/tsc', import.meta.resolve('typescript-beta/package.json')))
    },
    {
        name: 'typescript-next',
        command: fileURLToPath(new URL('./bin/tsc', import.meta.resolve('typescript-next/package.json')))
    }
] as const;

export async function writeProject(
    consumer: Consumer,
    configuration: Readonly<Record<string, unknown>>,
    files: Readonly<Record<string, string>>
): Promise<string> {
    const folder = await mkdtemp(path.join(consumer.folder, 'project-'));
    await writeFile(path.join(folder, 'tsconfig.json'), JSON.stringify(configuration));
    for (const [ file, content ] of Object.entries(files)) {
        const destination = path.join(folder, file);
        await mkdir(path.dirname(destination), { recursive: true });
        await writeFile(destination, content);
    }
    return folder;
}

export async function runCompiler(
    command: string,
    folder: string,
    argumentsList: readonly string[]
): Promise<CommandResult> {
    return runCommand(command, [ ...argumentsList, '--pretty', 'false' ], folder);
}

export function diagnosticCodes(compilation: CommandResult): readonly number[] {
    return Array.from(compilation.output.matchAll(/error TS(?<code>\d+):/gv), function diagnosticCode(match) {
        return Number(match.groups?.['code']);
    });
}
