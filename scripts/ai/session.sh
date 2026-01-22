#!/bin/bash
# session.sh: Unified Session Management
# Usage: ./session.sh [start|end]

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
ROOT_DIR="$(dirname "$(dirname "$SCRIPT_DIR")")"
cd "$ROOT_DIR"

FOCUS_FILE=".ai/context/CURRENT_FOCUS.md"

function show_usage() {
    echo "Usage: ./scripts/ai/session.sh [command]"
    echo "Commands:"
    echo "  start   Start a new AI session (refresh context timestamp, show load instructions)"
    echo "  end     End current session (log git activity, update status)"
    exit 1
}

function start_session() {
    echo "🤖 Starting AI Session in $ROOT_DIR"
    echo "   - Updating timestamp in CURRENT_FOCUS.md"
    sed -i.bak "s/Last updated:.*/Last updated: $(date +%Y-%m-%d)/" "$FOCUS_FILE"
    rm "${FOCUS_FILE}.bak" 2>/dev/null
    echo "✅ Context refreshed."
    
    echo ""
    echo "🚀 LOAD THIS CONTEXT INTO YOUR AI AGENT:"
    echo "----------------------------------------"
    echo "File List (Copy & Paste):"
    echo ".ai/context/PROJECT_OVERVIEW.md"
    echo ".ai/context/ARCHITECTURE.md"
    echo ".ai/context/CURRENT_FOCUS.md"
    echo "----------------------------------------"
    echo "For advanced tools:"
    echo "   [Claude Code]: claude-code .ai/context/*.md"
    echo "   [Aider]: aider --read .ai/context/*.md"
    echo ""
}

function end_session() {
    echo "🔄 Ending AI Session..."
    
    # 1. Capture Git
    echo "   - Reading recent git activity..."
    GIT_SUMMARY=$(git log --since="24 hours ago" --pretty=format:"%s; " | tr '\n' ' ' | sed 's/; $//')
    if [[ -z "$GIT_SUMMARY" ]]; then
        GIT_SUMMARY=$(git log -n 3 --pretty=format:"%s; " | tr '\n' ' ' | sed 's/; $//')
    fi
    RECENT_CHANGES=$(git log --since="24 hours ago" --oneline --pretty=format:"- %ad: %s" --date=short)

    # 2. Capture Active Features (INTEGRATION)
    echo "   - Scanning active features..."
    ACTIVE_FEATURES=""
    while IFS= read -r file; do
        if [[ -f "$file" ]]; then
            BASENAME=$(basename "$file")
            TITLE=$(grep "^# Feature:" "$file" | head -n 1 | sed 's/# Feature: //')
            ACTIVE_FEATURES+="- **$TITLE** (Ref: \`.ai/features/$BASENAME\`)"$'\n'
        fi
    done < <(find .ai/features -name "*.md" -mtime -1 2>/dev/null)

    # 3. Smart defaults
    if [[ -n "$ACTIVE_FEATURES" ]]; then
        echo "     Found active features: "
        echo "$ACTIVE_FEATURES"
    fi

    echo "Enter a brief summary (Press Enter to use Git Log):"
    read -e -p "> " USER_INPUT
    SESSION_SUMMARY="${USER_INPUT:-$GIT_SUMMARY}"

    # 4. Update File
    if [[ -f "$FOCUS_FILE" ]]; then
        TEMP_FILE=$(mktemp)
        echo "# Current Development Focus" > "$TEMP_FILE"
        echo "" >> "$TEMP_FILE"
        
        # ACTIVE FEATURES SECTION
        if [[ -n "$ACTIVE_FEATURES" ]]; then
            echo "## 🚀 Active Features (Work in Progress)" >> "$TEMP_FILE"
            echo "$ACTIVE_FEATURES" >> "$TEMP_FILE"
            echo "" >> "$TEMP_FILE"
        fi
        
        # Git Activity
        echo "## 📅 Recent Session: $(date +%Y-%m-%d\ %H:%M)" >> "$TEMP_FILE"
        echo "**Summary**: $SESSION_SUMMARY" >> "$TEMP_FILE"
        echo "" >> "$TEMP_FILE"
        echo "### Git Activity" >> "$TEMP_FILE"
        echo "$RECENT_CHANGES" >> "$TEMP_FILE"
        echo "" >> "$TEMP_FILE"
        
        # Restore Context
        EXISTING_CONTEXT=$(grep -A 5 "## Context for AI Assistant" "$FOCUS_FILE" | tail -n +2 | grep -v "Last updated" | grep -v "> \[!IMPORTANT\]")
        echo "## Context for AI Assistant" >> "$TEMP_FILE"
        echo "${EXISTING_CONTEXT:-- Focus on detecting latest changes.}" >> "$TEMP_FILE"
        
        echo "" >> "$TEMP_FILE"
        echo "Last updated: $(date +%Y-%m-%d)" >> "$TEMP_FILE"
        
        mv "$TEMP_FILE" "$FOCUS_FILE"
        echo "✅ $FOCUS_FILE updated."
    else
        echo "⚠️ $FOCUS_FILE not found."
    fi
}

case "$1" in
    start)
        start_session
        ;;
    end)
        end_session
        ;;
    *)
        show_usage
        ;;
esac
