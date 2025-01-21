# PulseBeam-JS Client SDK

used to generate @pulsebeam/peer js package

## Init project
```sh
git clone git@github.com:PulseBeamDev/pulsebeam-proto.git
git submodule update --init
npm install
npm run gen
```

## Update docs

1. Update the contents using jsdoc
2. `deno doc index.ts` to render the changes
3. `deno doc --lint index.ts` to see missing docs / errors
4. `deno test --doc` to see errors in code examples
5. commit and push to jsr

## Bump version

`make bump`: will create a bump commit and tag
`git push origin main && git push origin --tags`: push the commit and tag

After this, the CI will take over to release everywhere. Use the manual commands as the manual approval.
