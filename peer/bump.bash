#!/bin/bash

# a script that maintains both jsr and npm package versions to be aligned with git tags
set -e

tmp=__tmp.json
version=${1}
version_tag="v${version}"

if ! echo ${version} | grep -Eo '[0-9]{1,}.[0-9]{1,}.[0-9]{1,}'; then
  echo "VERSION must be in semver format"
  exit 1
fi

if ! git diff-index --quiet HEAD --; then
  echo "Error: Git working directory is dirty. Please commit or stash your changes before proceeding."
  exit 1
fi

jq ".version = \"${version}\"" package.json >${tmp}
mv ${tmp} package.json

jq ".version = \"${version}\"" jsr.json >${tmp}
mv ${tmp} jsr.json

git add .
git commit -m "[peer] bump to ${version}"
git tag ${version_tag}

echo "version bump has been commited and tagged, use these commands to upload them:"
echo "git push origin main"
echo "git push origin --tags"
