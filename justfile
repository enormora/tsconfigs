set dotenv-load := false
set export
export PATH := justfile_directory() + "/node_modules/.bin:" + env_var("PATH")
core_version := `node --print "require('./packages/tsconfig/package.json').version"`
node_version := `node --print "require('./packages/node26/package.json').version"`

lint:
    eslint . .github --max-warnings 0
    knip

compile:
    node node_modules/typescript/bin/tsc --project tsconfig.json

test *OPTIONS: pack
    node test/prepare-consumers.entry-point.ts
    mocha --config mocha.config.json {{OPTIONS}}

pack:
    packtory pack @enormora/tsconfig --format tar --out target/tsconfig.tgz --version {{core_version}}
    packtory pack @enormora/tsconfig-node26 --format tar --out target/tsconfig-node26.tgz --version {{node_version}}

publish-dry-run:
    packtory publish

check: lint compile test publish-dry-run
