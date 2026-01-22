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
    
    # 1. capture Git
    echo "   - Reading recent git activity..."
    GIT_SUMMARY=$(git log --since="24 hours ago" --pretty=format:"%s; " | tr '\n' ' ' | sed 's/; $//')
    if [[ -z "$GIT_SUMMARY" ]]; then
        GIT_SUMMARY=$(git log -n 3 --pretty=format:"%s; " | tr '\n' ' ' | sed 's/; $//')
    fi
    RECENT_CHANGES=$(git log --since="24 hours ago" --oneline --pretty=format:"- %ad: %s" --date=short)

    # 2. Interactive
    echo "Enter a brief summary of what you accomplished in this session:"
    echo "\`Default: $GIT_SUMMARY\`"
    read -e -p "> " USER_INPUT
    SESSION_SUMMARY="${USER_INPUT:-$GIT_SUMMARY}"

    echo ""
    echo "Did you make any ARCHITECTURAL or STRUCTURE changes? (y/n)"
    read -n 1 -r ARCH_CHANGED
    echo ""
    ARCH_NOTE=""
    if [[ $ARCH_CHANGED =~ ^[Yy]$ ]]; then
        echo "Describe the change:"
        read -e -p "> " ARCH_DESC
        ARCH_NOTE="> [!IMPORTANT]
> **Architectural Update Required**: $ARCH_DESC
> *Action for Next Session*: Update ARCHITECTURE.md and PROJECT_OVERVIEW.md immediately."
    fi

    echo ""
    echo "What are the priority tasks for the NEXT session?"
    echo "(Type 'done' on a new line to finish)"
    NEXT_STEPS=""
    while true; do
        read -p "- " line
        [[ "$line" == "done" || -z "$line" ]] && break
        NEXT_STEPS+="- [ ] $line"$'\n'
    done

    # 3. Update File
    if [[ -f "$FOCUS_FILE" ]]; then
        TEMP_FILE=$(mktemp)
        echo "# Current Development Focus" > "$TEMP_FILE"
        echo "" >> "$TEMP_FILE"
        
        if [[ -n "$ARCH_NOTE" ]]; then
            echo "$ARCH_NOTE" >> "$TEMP_FILE"
            echo "" >> "$TEMP_FILE"
        fi
        
        echo "## Active Tasks" >> "$TEMP_FILE"
        if [[ -n "$NEXT_STEPS" ]]; then
            echo -n "$NEXT_STEPS" >> "$TEMP_FILE"
        else
            echo "- [ ] (No next steps defined)" >> "$TEMP_FILE"
        fi
        echo "" >> "$TEMP_FILE"
        
        echo "## Recent Session: $(date +%Y-%m-%d\ %H:%M)" >> "$TEMP_FILE"
        echo "**Summary**: $SESSION_SUMMARY" >> "$TEMP_FILE"
        echo "" >> "$TEMP_FILE"
        echo "### Git Activity" >> "$TEMP_FILE"
        echo "$RECENT_CHANGES" >> "$TEMP_FILE"
        echo "" >> "$TEMP_FILE"
        
        echo "## Blockers" >> "$TEMP_FILE"
        echo "None" >> "$TEMP_FILE"
        echo "" >> "$TEMP_FILE"
        
        echo "## Context for AI Assistant" >> "$TEMP_FILE"
        EXISTING_CONTEXT=$(grep -A 5 "## Context for AI Assistant" "$FOCUS_FILE" | tail -n +2 | grep -v "Last updated" | grep -v "> \[!IMPORTANT\]")
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
