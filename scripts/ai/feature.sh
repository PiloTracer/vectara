#!/bin/bash
# feature.sh: Unified Feature Lifecycle Management
# Usage: ./feature.sh [new|update]
# Convention: ID-slug-UPDATED-CREATED.md

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
ROOT_DIR="$(dirname "$(dirname "$SCRIPT_DIR")")"
FEATURES_DIR="$ROOT_DIR/.ai.original/features"

mkdir -p "$FEATURES_DIR"
cd "$FEATURES_DIR" || exit 1

function show_usage() {
    echo "Usage: ./scripts/ai/feature.sh [command]"
    echo "Commands:"
    echo "  new     Create a new feature (Auto-ID)"
    echo "  update  Update an existing feature (Timestamp Rotation)"
    exit 1
}

function new_feature() {
    LATEST_ID=$(ls | grep -E '^[0-9]{4}-' | cut -d'-' -f1 | sort -rn | head -n 1)
    if [[ -z "$LATEST_ID" ]]; then
        NEXT_ID="0001"
    else
        NEXT_ID=$(printf "%04d" $((10#$LATEST_ID + 1)))
    fi

    echo "🆕 Creating Feature ID: $NEXT_ID"
    read -p "Enter feature name (slug): " FEATURE_NAME
    SLUG=$(echo "$FEATURE_NAME" | tr '[:upper:]' '[:lower:]' | sed 's/ /-/g' | sed 's/[^a-z0-9-]//g')
    DATE_CODE=$(date +%y%m%d)
    FILENAME="${NEXT_ID}-${SLUG}-${DATE_CODE}-${DATE_CODE}.md"
    FULL_PATH="$FEATURES_DIR/$FILENAME"

    cat > "$FULL_PATH" << EOF
# Feature: $FEATURE_NAME
**ID**: $NEXT_ID
**Created**: $(date +%Y-%m-%d)
**Last Updated**: $(date +%Y-%m-%d)
**Status**: DRAFT

## 1. Objective
[Describe what this feature achieves]

## 2. Requirements
- [ ] Requirement A

## 3. Implementation Plan
- [ ] Step 1

## 4. Changelog
- $(date +%Y-%m-%d): Initial Draft
EOF
    echo "✅ Created: $FILENAME"
}

function update_feature() {
    echo "🔍 Select feature to update:"
    OPTIONS=($(ls *.md))
    if [ ${#OPTIONS[@]} -eq 0 ]; then echo "No features found."; exit 1; fi

    select FILE in "${OPTIONS[@]}"; do
        [[ -n "$FILE" ]] && break || echo "Invalid selection."
    done

    if [[ "$FILE" =~ ^([0-9]{4}-.+)-([0-9]{6})-([0-9]{6})\.md$ ]]; then
        BASE="${BASH_REMATCH[1]}"
        OLD_UPDATED="${BASH_REMATCH[2]}"
        CREATED="${BASH_REMATCH[3]}"
    else
        echo "⚠️  Filename format not recognized."
        exit 1
    fi

    TODAY=$(date +%y%m%d)
    if [[ "$OLD_UPDATED" == "$TODAY" ]]; then
        NEW_FILENAME="$FILE"
    else
        NEW_FILENAME="${BASE}-${TODAY}-${CREATED}.md"
        mv "$FILE" "$NEW_FILENAME"
        echo "🔄 Renamed to: $NEW_FILENAME"
    fi

    sed -i.bak "s/^\*\*Last Updated\*\*: .*/\*\*Last Updated\*\*: $(date +%Y-%m-%d)/" "$NEW_FILENAME"
    rm "${NEW_FILENAME}.bak" 2>/dev/null
    echo "✅ Metadata updated."
}

case "$1" in
    new)
        new_feature
        ;;
    update)
        update_feature
        ;;
    *)
        show_usage
        ;;
esac
