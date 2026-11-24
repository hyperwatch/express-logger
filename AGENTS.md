# Agents

Notes for AI coding agents working on this repository.

## Same log as Hyperwatch

The middleware sends the log Hyperwatch's own Express input creates (`createLog` in `src/lib/util.js` of [@hyperwatch/hyperwatch](https://github.com/hyperwatch/hyperwatch)), as plain JSON. A field added there is added to `createLog` in `index.js` too: `test/index.js` compares both, with Hyperwatch as a development dependency.

## Types

`index.js` is JavaScript with JSDoc types, checked by TypeScript (`checkJs`, `strict`): `npm run type:check` must pass, as in CI.

- `npm run types` generates the declarations the package publishes (`types/`, not committed; `prepack` runs it). `npm run types:test` packs the package, installs it in a temporary project with its dependencies only, and type-checks `test/types/consumer.ts` and the published declarations, strict and without `skipLibCheck`: add a line to `consumer.ts` when the public API changes, and an `@ts-expect-error` for what must be rejected.
- The declarations may only refer to Node's modules: no `@types` package is needed to use the middleware, with Express or without. syslog-client ships no types: what the middleware uses of it is declared in JSDoc.

## Release management

Follow [RELEASING.md](RELEASING.md). Only `origin/main` ships, through the release workflows: never run `npm publish`, tag or create a GitHub release by hand. Never merge the version pull request: the maintainer does. Agree on the version and the notes with the maintainer.
