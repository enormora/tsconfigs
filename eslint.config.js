import { baseConfig } from '@enormora/eslint-config-base';
import { mochaNodeAssertConfig } from '@enormora/eslint-config-mocha-node-assert';
import { nodeConfig, nodeConfigFileConfig } from '@enormora/eslint-config-node';
import { typescriptConfig } from '@enormora/eslint-config-typescript';

export default [
    { ignores: [ 'target/**', 'node_modules/**' ] },
    ...baseConfig,
    { ...nodeConfig, files: [ '**/*.{js,ts}' ] },
    { ...typescriptConfig, files: [ '**/*.ts' ] },
    { ...mochaNodeAssertConfig, files: [ 'test/**/*.test.ts' ] },
    { ...nodeConfigFileConfig, files: [ 'eslint.config.js', 'packtory.config.js' ] },
    {
        files: [ 'packages/node26/globals.d.ts' ],
        rules: {
            'import/no-unassigned-import': [ 'error', { allow: [ 'node' ] } ]
        }
    }
];
