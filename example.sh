#!/usr/bin/env bash

set -e

SUBMODULE="example"
REPO="https://github.com/code-hemu/codehemu.git"

echo "Replacing $SUBMODULE with CodeHemu submodule"

git submodule deinit -f "$SUBMODULE" 2>/dev/null || true
git rm -r --cached -f "$SUBMODULE" 2>/dev/null || true
rm -rf "$SUBMODULE" ".git/modules/$SUBMODULE"

if [ -f .gitmodules ]; then
  git config -f .gitmodules --remove-section "submodule.$SUBMODULE" 2>/dev/null || true
  if [ ! -s .gitmodules ]; then
    rm -f .gitmodules
  fi
fi

git submodule add -b main "$REPO" "$SUBMODULE"

PACKAGE_JSON="$SUBMODULE/package.json"
sed \
  -e '/^[[:space:]]*\/\/[[:space:]]*"@guchho\/blogger"/d' \
  -e 's/"@guchho\/blogger"[[:space:]]*:[[:space:]]*"[^"]*"/"@guchho\/blogger": "file:.."/' \
  "$PACKAGE_JSON" > "$PACKAGE_JSON.tmp"
mv "$PACKAGE_JSON.tmp" "$PACKAGE_JSON"

echo "Submodule reset completed"
