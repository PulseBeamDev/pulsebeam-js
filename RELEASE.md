Release process for this monorepo

Quick steps (developer):

- Install dev deps: `pnpm install`
- Create a changeset after making package changes: `pnpm changeset`
- Commit the changeset and open a PR
- On merge to `main`, CI will publish packages (requires `NPM_TOKEN` secret)

Local publish (optional):

- `pnpm version` — bumps versions and writes changelogs
- `pnpm publish` — publishes packages (or run `pnpm publish` per package)
