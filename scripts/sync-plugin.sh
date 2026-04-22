#!/usr/bin/env bash
# Mirror root-level skill files into plugins/language-learner/skills/language-learner/.
#
# Run this after editing any of: SKILL.md, pipeline/, examples/, docs/.
# The plugin-path copy is what the Claude Code plugin marketplace serves;
# the root copy is the source of truth (also used by manual `git clone` install).
set -euo pipefail

cd "$(dirname "$0")/.."

rsync -a --delete \
  SKILL.md pipeline examples docs \
  plugins/language-learner/skills/language-learner/

echo "✅ synced plugin copy from root"
