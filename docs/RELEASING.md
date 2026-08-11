# Release process

QiangQiang uses semantic versions and publishes preview releases while the major version is `0`.

## Maintainer checklist

1. Move completed entries from `Unreleased` into a dated version in `CHANGELOG.md`.
2. Set the same version in `package.json`.
3. Run the local release gates:

   ```bash
   bun install --frozen-lockfile
   bun run check
   bun run test
   bun run setup
   bun run package:single
   ```

4. Commit and push the release preparation.
5. Tag that exact commit and push the tag:

   ```bash
   git tag -a v0.1.0 -m "QiangQiang v0.1.0"
   git push origin v0.1.0
   ```

The Release workflow verifies that the tag matches `package.json`, rebuilds on a GitHub-hosted Windows runner, generates a SHA-256 checksum and provenance attestation, and publishes the assets with generated release notes. Tags below `v1.0.0` are marked as prereleases.

Do not upload locally built binaries as official release assets. The public assets should come from the tagged GitHub Actions build so their provenance is reproducible.
