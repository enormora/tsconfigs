import type { IConfiguration } from 'dependency-cruiser';

const configuration: IConfiguration = {
    forbidden: [
        { name: 'no-circular-dependencies', severity: 'error', from: {}, to: { circular: true } },
        { name: 'no-unresolved-dependencies', severity: 'error', from: {}, to: { couldNotResolve: true } },
        {
            name: 'no-integration-code-in-packages',
            severity: 'error',
            from: { path: '^(source/|packtory\\.config\\.js$)' },
            to: { path: '^integration-test/' }
        },
        {
            name: 'no-undeclared-dependencies',
            severity: 'error',
            from: {},
            to: { dependencyTypes: [ 'npm-no-pkg', 'npm-unknown' ] }
        }
    ],
    options: {
        enhancedResolveOptions: {
            exportsFields: [ 'exports' ],
            conditionNames: [ 'import', 'require', 'node', 'default', 'types' ]
        },
        doNotFollow: { path: 'node_modules' },
        tsPreCompilationDeps: true,
        tsConfig: { fileName: 'integration-test/tsconfig.json' }
    }
};

export default configuration;
