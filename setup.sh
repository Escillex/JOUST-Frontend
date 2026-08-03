#!/usr/bin/env bash
# Frontend app-setup. Run from anywhere: ./new/setup.sh (or: npm run setup)
# Nothing to deposit anymore — the root orchestrator references this repo's
# deploy/ fragments in place by absolute path (folder-name-agnostic), so this
# step is optional. It just sanity-checks the fragments and points you onward.
set -euo pipefail
cd "$(dirname "$0")"          # -> new/ (repo root, whatever it's named)
ROOT=".."

for f in deploy/compose.new.yml deploy/compose.new.dev.yml deploy/compose.new.prod.yml deploy/Dockerfile.prod; do
	[ -f "$f" ] || { echo "✗ missing $f — frontend repo looks incomplete." >&2; exit 1; }
done

echo "✓ frontend deploy fragments present (referenced in place — nothing copied)."
echo "  next: from the BACKEND repo run 'npm run setup' (deposits the root"
echo "        orchestrator), then run ./setup.sh in the parent dir."
