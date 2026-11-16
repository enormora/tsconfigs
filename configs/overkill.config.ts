import { defineConfig } from '@overkill-dev/test/config';

export const config = defineConfig({
    runtimeStateDir: 'target/.overkill',
    profiles: {
        integration: {
            testFamily: 'integration',
            execution: { processModel: 'supervised-process', scheduling: 'serial' },
            files: { include: [ 'integration-test/**/*.test.ts' ] },
            timeouts: { collectionMilliseconds: 30_000, hardMilliseconds: 180_000, softMilliseconds: 120_000 }
        }
    }
});
