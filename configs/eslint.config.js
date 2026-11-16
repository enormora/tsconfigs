import { baseConfig } from '@enormora/eslint-config-base';
import { cspellSpellcheckerOptions } from '@enormora/eslint-config-base/presets/base/base-shared.js';
import { testSupportConfig } from '@enormora/eslint-config-test-base';
import { nodeConfig, nodeConfigFileConfig } from '@enormora/eslint-config-node';
import { typescriptConfig } from '@enormora/eslint-config-typescript';

const spellingConfiguration = new URL('./cspell.json', import.meta.url);

export default [
    { ignores: [ 'target/**', 'node_modules/**' ] },
    ...baseConfig,
    { ...nodeConfig, files: [ '**/*.{js,ts}' ] },
    { ...typescriptConfig, files: [ '**/*.ts' ] },
    { ...testSupportConfig, files: [ 'integration-test/**/*.test.ts' ] },
    { ...nodeConfigFileConfig, files: [ 'configs/*.{js,ts}', 'packtory.config.js' ] },
    {
        files: [ '**/*.{js,ts}' ],
        rules: {
            '@cspell/spellchecker': [ 'error', {
                ...cspellSpellcheckerOptions,
                configFile: spellingConfiguration.href
            } ]
        }
    },
    {
        files: [ 'source/node/globals.d.ts' ],
        rules: { 'import/no-unassigned-import': [ 'error', { allow: [ 'node' ] } ] }
    }
];
