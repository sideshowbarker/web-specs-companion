#!/bin/bash
# Usage: attach-amo-xpi.sh TAG MINUTES
# Waits up to MINUTES for Firefox Add-ons (AMO) to approve the tag's version, then attaches the signed .xpi that AMO
# serves for it to the tag's GitHub release. AMO's public API answers 404 for a version until it's approved.
set -euo pipefail
tag=$1
minutes=${2:-0}
version=${tag#v}
guid=$(node -p "require('./static/manifest.json').browser_specific_settings.gecko.id")
api="https://addons.mozilla.org/api/v5/addons/addon/$guid/versions/v$version/"
for ((waited = 0; ; waited++)); do
  url=$(curl -sf "$api" | node -e '
    let s = "";
    process.stdin.on("data", (d) => (s += d)).on("end", () => {
      const v = JSON.parse(s);
      if (v.file?.status === "public") console.log(v.file.url);
    });' || true)
  [ -n "$url" ] && break
  if ((waited >= minutes)); then
    echo "::notice::AMO hasn't approved $version yet. Once it has, run the Attach Firefox build workflow for $tag."
    exit 0
  fi
  sleep 60
done
curl -sfL -o "w3c-companion-$version.xpi" "$url"
gh release upload "$tag" ${GITHUB_REPOSITORY:+--repo "$GITHUB_REPOSITORY"} --clobber \
  "w3c-companion-$version.xpi#W3C Companion $version for Firefox"
