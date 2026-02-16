Use Changesets to manage releases for workspace packages.

- Create a changeset when you make changes that should be released: `pnpm changeset`
- Commit the generated changeset file
- Push the branch and open a PR. On merge to `main`, the release workflow will run.

For local release flows, use:

- `pnpm version` to update package versions and changelogs
- `pnpm publish` to publish packages (or let CI handle publishing)
