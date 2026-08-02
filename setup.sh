#!/usr/bin/env bash
# Frontend app-setup. Run from anywhere: ./new/setup.sh
# Deposits the frontend's deploy fragments into the parent ("root") dir.
# Environment-agnostic — the environment is chosen later by root setup.sh.
# (The Dockerfile.prod stays in-repo; compose points at it via `context: ./new`.)
set -euo pipefail
cd "$(dirname "$0")"          # -> new/
ROOT=".."

cp deploy/compose.new.yml deploy/compose.new.dev.yml deploy/compose.new.prod.yml "$ROOT"/

echo "✓ frontend deploy assets deposited in $(cd "$ROOT" && pwd)"
echo "  next: run server/setup.sh (if not yet), then ./setup.sh in the root dir"
