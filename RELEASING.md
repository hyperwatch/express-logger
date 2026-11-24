# Releasing

How to release a new version of `@hyperwatch/express-logger`, as [Hyperwatch](https://github.com/hyperwatch/hyperwatch/blob/main/RELEASING.md) does.

Releases are made by GitHub Actions workflows, from `main` only: anything not merged into `main` doesn't ship.

- [**Prepare a release**](.github/workflows/release-prepare.yml) (run by hand) opens the pull request `version X.Y.Z`: `package.json` and `package-lock.json` bumped, and the release notes drafted in `CHANGELOG.md`.
- [**Release**](.github/workflows/release.yml) (on each push to `main`) releases `package.json`'s version when it isn't released yet: the checks, `npm publish`, an annotated tag `vX.Y.Z` on the last commit of the version pull request, and a GitHub release with its notes.

`node scripts/release.js` holds what they share (`changes`, `prepare`, `verify`, `pack`, `notes`: see its header). It never commits, tags, pushes or publishes.

## 1. Prepare the pull request

Pick the version with [semver](https://semver.org/): raising the required Node.js version is a major bump. `node scripts/release.js changes` lists what changed since the last release, on npm and as a tag, to decide (releases before 4.0.0 weren't tagged: it starts from the commit that set the current version). Then run the workflow:

```bash
gh workflow run release-prepare.yml -f version=X.Y.Z
```

It pushes the branch `release-vX.Y.Z` and opens the draft pull request `version X.Y.Z`. If the repository doesn't allow GitHub Actions to create pull requests (Settings → Actions → General), the run's summary gives the link to open it.

## 2. Rewrite the release notes

The notes are drafted in `CHANGELOG.md`, under `## X.Y.Z (YYYY-MM-DD)`: PR links in full, dependabot bumps in one line under **Dependencies & tooling**, the rest under **To sort**. Rewrite them in these sections, with `###` headings (skip the empty ones):

- **Breaking changes**
- **Features**
- **Fixes**
- **Dependencies & tooling**, with the dependabot bumps summarized in one line

Write for the package's users: what changed for them, not how; leave out what they can't see (CI, tests, refactors), or fold it into Dependencies & tooling. Link PR numbers in full, as `([#NNN](https://github.com/hyperwatch/express-logger/pull/NNN))`: GitHub doesn't turn a bare `#NNN` into a link in a Markdown file.

Push the notes to the branch, mark the pull request ready, and merge it once CI passes. The `release-notes` check (and the release) refuses notes that still have a "To sort" section.

## 3. The release

Merging starts the Release workflow (`gh run watch`). From the last commit the version pull request put on `main`, it:

1. checks the notes (`release.js verify`), then runs `npm test`, `lint`, `prettier:check`, `type:check`, `depcheck` and `lockfile:lint`;
2. packs the package once, checks the tarball's contents (`release.js pack`: only what the `files` whitelist of `package.json` allows, plus what npm always adds) and type-tests its declarations (`types:test`);
3. publishes that tarball to npm, with [trusted publishing](https://docs.npmjs.com/trusted-publishers) (no token);
4. tags the commit `vX.Y.Z`;
5. creates the GitHub release `X.Y.Z`, with the version's section of `CHANGELOG.md` and a link to npm.

Each step is skipped when already done: if one fails, fix the cause and rerun the workflow on `main` (`gh workflow run release.yml`), it finishes what's missing. Check the result with `npm view @hyperwatch/express-logger dist-tags`.

### Setup, once

- npm trusted publishing: on npmjs.com, in the package's settings, add a trusted publisher: GitHub Actions, `hyperwatch/express-logger`, workflow `release.yml`.
- Optionally, in the repository's settings (Actions → General), "Allow GitHub Actions to create and approve pull requests", so that the prepare workflow opens its pull request itself.

The prepare workflow pushes with the workflow's token, which starts no workflow: it runs CI on its branch itself (`ci.yml` accepts `workflow_dispatch`).
