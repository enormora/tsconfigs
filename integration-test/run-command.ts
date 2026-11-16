import { spawn } from 'node:child_process';

export type CommandResult = {
    readonly exitCode: number;
    readonly output: string;
};

export async function runCommand(
    command: string,
    argumentsList: readonly string[],
    folder: string
): Promise<CommandResult> {
    return new Promise(function executeCommand(resolve, reject) {
        const child = spawn(command, argumentsList, {
            cwd: folder,
            timeout: 300_000,
            stdio: [ 'ignore', 'pipe', 'pipe' ]
        });
        const output: string[] = [];
        function collectOutput(chunk: string): void {
            output.push(chunk);
        }
        child.stdout.setEncoding('utf8').on('data', collectOutput);
        child.stderr.setEncoding('utf8').on('data', collectOutput);
        child.once('error', reject);
        child.once('close', function finishCommand(code) {
            resolve({ exitCode: code ?? 1, output: output.join('') });
        });
    });
}
