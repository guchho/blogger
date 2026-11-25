#!/usr/bin/env bash

set -e

SUBMODULE="example"
REPO="https://github.com/code-hemu/codehemu.git"

echo "Replacing $SUBMODULE with CodeHemu submodule"

git submodule deinit -f "$SUBMODULE" 2>/dev/null || true
git rm -f "$SUBMODULE" || true
rm -rf "$SUBMODULE" ".git/modules/$SUBMODULE"

# Commit removal if needed
if ! git diff --cached --quiet; then
  git commit -m "Remove $SUBMODULE submodule"
  git push
fi

echo "Adding submodule again..."

git submodule add -b main "$REPO" "$SUBMODULE"

# PACKAGE_JSON="$SUBMODULE/package.json"
# sed \
#   -e '/^[[:space:]]*\/\/[[:space:]]*"@guchho\/blogger"/d' \
#   -e 's/"@guchho\/blogger"[[:space:]]*:[[:space:]]*"[^"]*"/"@guchho\/blogger": "file:.."/' \
#   "$PACKAGE_JSON" > "$PACKAGE_JSON.tmp"
# mv "$PACKAGE_JSON.tmp" "$PACKAGE_JSON"

if ! git diff --cached --quiet; then
  git commit -m "Add $SUBMODULE submodule"
  git push
fi

echo "Submodule reset completed"
