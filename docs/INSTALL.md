# Install and update

Saddle Portable requires Node.js 20 or newer.

## Install a release tarball

```sh
npm install --global ./saddle-portable-0.1.0.tgz
saddle help
```

The release gate installs the same tarball in a clean temporary project with lifecycle scripts disabled.

## Install from GitHub

After the public repository and `v0.1.0` tag exist, run:

```sh
npm install --global github:<owner>/saddle-portable#v0.1.0
saddle help
```

Pin a tag or commit for repeatable installation. An unqualified GitHub reference installs the repository default branch.

npm supports GitHub shorthand, full Git URLs, commit references, and semantic-version references. Git installs can trigger package scripts when a repository defines build or lifecycle scripts. Saddle does not define those scripts. See the current [npm package specification](https://docs.npmjs.com/package-spec) and [`npm install` documentation](https://docs.npmjs.com/cli/install/).

Release CI verifies the exact GitHub commit before a tag is created. Maintainers can run the same packed-consumer check with:

```sh
npm run verify:git-install -- "github:<owner>/saddle-portable#<commit>"
```

## Update

Install the new tag with the same command. An npm package update changes the `saddle` executable. It does not modify a profile or runtime projection until you run setup or import and accept a new plan.

## Uninstall

```sh
npm uninstall --global saddle-portable
```

Uninstall removes the npm package. It does not delete neutral profiles, generated runtime blocks, capability projections, or `.saddle` transaction journals. Use rollback before uninstall when you want to restore a prior transaction.
