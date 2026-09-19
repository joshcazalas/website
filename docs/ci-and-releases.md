# CI and releases

The website source is public. Game assets remain in a separate private repository.
Publishing releases requires the Actions variable `RELEASES_ENABLED` to be exactly
`true` and the source repository to be public. Leave that variable unset until
public distribution of the built site is approved. No workflow changes visibility.

## Asset storage

Runtime assets live in immutable releases of the private
[`joshcazalas/website-assets`](https://github.com/joshcazalas/website-assets) repository.
Binary assets are not committed to either repository's Git history. The website
tracks `assets.lock.json`: release identity, archive digest and size, individual
file hashes, Factorio version, and hashes of the import inputs.

Configure an expiring fine-grained token granting **Contents: Read** only to
`website-assets`, then put it in the website repository's Actions secret
`ASSETS_READ_TOKEN`. Metadata access is automatic. Do not use a broad account
token. Set the same named secret under Dependabot secrets if dependency PRs
should run full browser checks automatically. Rotate the credential before its
expiration. The website's normal `GITHUB_TOKEN` cannot read this other private
repository.

On a developer machine, an existing authorized `gh` login can download the pack:

```bash
npm ci
npm run assets:fetch
npm run build
```

CI downloads the exact release, requires it to be immutable, verifies the archive
against the committed digest, rejects unsafe archive members, and verifies every
file before installation. A local installation still supports `assets:import`.
Production builds verify the lock and stage only the 20 required runtime assets
plus the custom nameplate. Extra original sprites, local PDFs, and other files in
`public/` are not copied to the production build.

To change assets:

1. Update the catalog/importer/sample list and import from the intended game version.
2. Run `node scripts/assets.ts pack --game-version VERSION --tag UNIQUE-TAG`.
3. Upload `.local/asset-packs/factorio-runtime.tar.gz` and its `assets.lock.json`
   to a **draft** release in the private asset repo, then publish the complete release.
4. Submit the updated website lock and source changes in a PR.

Never overwrite an existing asset version. The original game files, their
licensing, and any permissions to distribute the finished website are separate
from the code's build provenance. Public website releases contain the runtime
assets even though this input repository remains private.

## Pull requests

`CI` calls the reusable `Validate site` workflow. Source checks run TypeScript,
simulation tests, archive security tests, Actionlint, and Gitleaks across the
complete checkout history and tracked tree. Tool downloads are checksum-pinned;
Actions use full commit pins. Dependabot proposes npm and Actions updates.

Source checks and the production build run in parallel. While public releases are
disabled, the build job runs all five browser suites concurrently against one local
build, verifies it, and exercises release packaging on that same temporary runner.
It uploads no builds, screenshots, or game assets. The manual CI input
`private-media` exercises this path even when the repository is private.

When releases are enabled (or the repository is private), the build job fetches the
pinned assets and uploads one production build with its original dependency
inventories. Five browser jobs test that same build concurrently: home/trains,
menu/loading, AWS Foundation, Auxide/audio, and caz.nix/rollback. Each verifies the
source commit, dependency lock, and file hashes before and after testing. A final
job packages the tested build, including on PRs. `Validate` requires all jobs to
succeed in the selected mode; skipped, canceled, and failed required work does not
satisfy it. The asset token
is present only in the retrieval step, never in npm or browser-test steps.

All repository scripts are TypeScript, run directly by Node 24 with no script
transpilation step. `npm run check` separately checks the application and scripts
in strict mode. Script checks enforce erasable syntax and explicit type imports
to match Node's native type stripping, which does not perform type checking.

Fork PRs receive no asset secret. They can run source checks, but cannot pass the
full browser gate. Review an external contribution before copying it to a
maintainer branch for full CI. Never use `pull_request_target` to execute a fork's
code with the asset credential. A checksum guarantees the pack's bytes; any job
given access to private assets must still be trusted with those assets.

The desired main ruleset is recorded in `.github/main-ruleset.json`:

- PRs required; no mandatory second reviewer.
- `Validate` required from GitHub Actions.
- Branches do **not** need to be up to date to merge after another PR lands.
- Repository admins may bypass rules **only when merging a PR**.
- Direct pushes, force pushes, and branch deletion remain blocked under the ruleset.
- Review conversations must be resolved unless deliberately bypassed.

GitHub Free supports these protections for this public repository. The ruleset
is installed separately from the workflow; to recreate it if absent:

```bash
gh api --method POST repos/joshcazalas/website/rulesets --input .github/main-ruleset.json
```

Read the created ruleset back and confirm the final check-run name is `Validate`.
Do not apply classic admin bypass protection alongside this ruleset: the PR-only
ruleset bypass is what permits CI overrides while blocking direct pushes.

## Release builds

Pull requests run the complete validation suite. In a public repository with
`RELEASES_ENABLED` unset, the post-merge release workflow skips its jobs. Once
enabled, it builds and packages main, then attests and publishes. It
does not repeat the simulation, browser, lint, or secret checks. This deliberately
trusts the maintainer's review of PR results; non-strict checks do not test the
combined result of independently passing PRs, and a bypass does not trigger a
second test gate. Normal build type checks and artifact integrity checks remain.

Both workflows share the same build and packaging jobs. PR browser jobs consume
that build before packaging; main packages its fresh build directly. The release identity is `website-YYYY.MM.DD-g<12-character-commit>`, using
the commit's UTC date. An archive round trip verifies its contents match the
tested output. Packaging requires a clean tracked worktree.

Release files:

| File | Contents |
| --- | --- |
| `website.tar.gz` | Complete static website; no runtime Node or Factorio installation needed |
| `site-inventory.json` | Every deployed file and its SHA-256 digest and size |
| `asset-inventory.json` | Exact asset pack and import-input identity |
| `sbom-runtime.cdx.json` | CycloneDX inventory of production npm dependencies |
| `sbom-build.cdx.json` | CycloneDX inventory including build and test dependencies |
| `manifest.json` | Source identity, toolchain, dependency lock digest, and hashes of the files above |
| `SHA256SUMS` | Checksums including the manifest |
| `provenance.sigstore.json` | Offline provenance verification bundle for all seven files above; added at publication |
| `sbom.sigstore.json` | Offline runtime SBOM attestation bound to the website archive; added at publication |

The SBOMs describe installed dependency graphs; they do not claim every file from
every dependency survived Vite's tree shaking. Media is inventoried separately.

While private, release candidates are retained as Actions artifacts for 3 days on
PRs and 14 days on main. The intermediate shared build is retained for 3 days.
This is a test of the release build, not an attested deployable GitHub Release.
Native GitHub build attestations are not available for this private repo's plan.
In a public repository before release publication is enabled, CI validates without
uploading media and the release workflow stays idle. Before changing a private
repository to public, remove any existing Actions artifacts containing media;
changing visibility would make those old downloads public too. Do not rerun old
private-repository workflows that retained media artifacts.

Once publication is explicitly enabled, a separate job with write/signing
permissions downloads the packaged artifact, verifies its full file set and hashes,
attests every release file, and binds the runtime SBOM to the website archive's
digest. It creates a draft release, uploads everything, publishes, and verifies
the resulting immutable release. No npm install or application tests run in the
privileged publishing job. Failed reruns never overwrite an existing release;
inspect an incomplete draft before deleting it and retrying.

Before enabling `RELEASES_ENABLED`, confirm repository release immutability is
enabled and the public-repository and asset publication decisions are complete:

```bash
gh api repos/joshcazalas/website/immutable-releases
```

## Server deployment

The server integration lives in the [caz.nix website module](https://github.com/joshcazalas/caz.nix/blob/main/modules/nixos/website.nix).
Its [operations guide](https://github.com/joshcazalas/caz.nix/blob/main/docs/website.md)
covers private LAN previews, verified public releases, retention, and rollback.
GitHub Actions receives no credential capable of reaching the server.

Release manifest schema 2 records an asset prefix of
`/releases/<full-commit>/`. Scripts, fonts, sprites, and audio all use that
prefix, and `release.json` identifies the build for HTTP health checks. The server
retains older release directories so existing tabs can fetch their original
assets after activation. Root HTML is served without caching.

Private candidates may be imported manually into a separate LAN preview. Signed
release mode checks the exact repository, workflow, main ref, commit, and artifact
digests using the attached bundles before extraction and atomic activation. The
first real signing and verification run awaits explicitly approved public release
publication; local tests use synthetic signing-policy fixtures.

Attestations establish origin and integrity. They do not prove that code is free
of bugs, that dependencies are safe, or that asset distribution is permitted.
