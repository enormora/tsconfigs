set dotenv-load := false
set export
export PATH := justfile_directory() + "/node_modules/.bin:" + env_var("PATH")
version := `node --print "require('./package.json').version"`

lint:
    eslint . .github --config configs/eslint.config.js --max-warnings 0
    ls-lint -config configs/ls-lint.yml
    knip --config configs/knip.json
    depcruise integration-test configs packtory.config.js --config configs/dependency-cruiser.config.ts

compile:
    node node_modules/typescript/bin/tsc --build --stopBuildOnErrors

integration-test: pack
    node integration-test/prepare-consumers.entry-point.ts
    overkill run --config configs/overkill.config.ts --profile integration

pack:
    packtory pack @enormora/tsconfig --format tar --out target/tsconfig.tgz --version {{version}}
    packtory pack @enormora/tsconfig-node --format tar --out target/tsconfig-node.tgz --version {{version}}

publish-dry-run:
    packtory publish

check: lint compile integration-test publish-dry-run
