#!/bin/bash

# a script that maintains both jsr and npm package versions to be aligned with git tags
set -e

tmp=__tmp.json
version_tag=$(git describe --tags --abbrev=0)
echo $version_tag | grep '^v'
version="${version_tag#v}"

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
