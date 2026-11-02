# Production build

Use Node **24.19.0**, npm **11.9.0**, and Hugo **Extended 0.158.0**. The version files `.node-version` and `.hugo-version` are the build's source of truth. The build rejects other Node or Hugo versions. CI reads the same files.

Install Node with your version manager. Download the matching Extended archive and checksum manifest from the [Hugo 0.158.0 release](https://github.com/gohugoio/hugo/releases/tag/v0.158.0), verify the archive's SHA-256 against that manifest, and put its `hugo` executable on PATH. CI uses the pinned Hugo setup action to install this release.

Install the supported npm version with `npm install --global npm@11.9.0`. CI installs that version explicitly for the build. From the repository root:

```sh
ONNXRUNTIME_NODE_INSTALL_CUDA=skip PUPPETEER_SKIP_DOWNLOAD=1 npm ci
npm run build
```

The install flags skip optional native CUDA binaries and Puppeteer’s bundled browser. Neither is needed to build this browser application. CI uses the same flags. Browser verification installs or selects its own browser.

The command deletes the repository's generated `public/` directory, builds the production site with a fresh temporary Hugo cache/resource directory, validates its worker assets, and removes the temporary cache. Do not keep hand-written files in `public/`. A failed build or asset check returns a failing exit code.

For a deployment under a path, use an absolute base URL ending with a slash:

```sh
npm run build -- --base-url https://example.test/demo/
```

The default base is `/`. The build checks both root and subpath deployments in CI. These checks do not deploy the site.

Hugo bundles the current worker entry points and emits a production manifest at `public/data/workers.json` from the same worker map used by application configuration. Validation compares the manifest with worker sources, checks each SHA-256 fingerprint and emitted URL, requires the worker URL in a JavaScript bundle, and checks local literal module imports and script URLs. Broken entries, changed content, missing files and incorrect base paths fail validation. Computed dynamic imports, external URLs, WASM fetches and model execution need browser verification.

The build requires locked npm dependencies and tracked site sources. It does not download models, generate retrieval indices or require existing model caches. Browser-generated retrieval data and downloaded models are ignored and are not required to build; a working assistant journey still needs its runtime assets. Generated site output is ignored. Existing taxonomy/term layout warnings are reported without being treated as successful runtime verification.

The build CI job also runs the isolated asset-check regression tests. They exercise valid output plus missing map entries/files, bad deployment paths, changed fingerprints, broken module imports and worker URLs absent from application bundles:

```sh
node --test tests/production-assets.spec.js
```

When the runtime refactor introduces three SharedWorkers, its ticket must update worker sources, generated mappings and checks together, remove obsolete entries, and pass these same build commands. This build change does not introduce those future workers.
