#!/bin/bash
# Resolves root directory safely
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
ROOT_DIR="$(dirname "$(dirname "$SCRIPT_DIR")")"
cd "$ROOT_DIR"

echo "🤖 Starting AI Session in $ROOT_DIR"
echo "   - Updating timestamp in CURRENT_FOCUS.md"
sed -i.bak "s/Last updated:.*/Last updated: $(date +%Y-%m-%d)/" .ai/context/CURRENT_FOCUS.md
echo "✅ Context refreshed."
