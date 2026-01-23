#!/bin/bash
# session.sh: Unified Session Management with AI Handoff
# Usage: ./session.sh [start|end]

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
ROOT_DIR="$(dirname "$(dirname "$SCRIPT_DIR")")"
cd "$ROOT_DIR"

FOCUS_FILE=".ai/context/CURRENT_FOCUS.md"
HANDOFF_FILE=".ai/context/HANDOFF.md"
FEATURES_DIR=".ai/features"

function show_usage() {
    echo "Usage: ./scripts/ai/session.sh [command]"
    echo "Commands:"
    echo "  start   Start a new AI session (display full handoff context)"
    echo "  end     End current session (capture working memory to HANDOFF.md)"
    exit 1
}

function get_active_feature() {
    # Find the most recently modified feature file
    local latest_feature=$(find "$FEATURES_DIR" -name "*.md" -type f -printf '%T@ %p\n' 2>/dev/null | sort -rn | head -1 | cut -d' ' -f2-)
    if [[ -n "$latest_feature" && -f "$latest_feature" ]]; then
        echo "$latest_feature"
    fi
}

function start_session() {
    echo "🤖 Starting AI Session in $ROOT_DIR"
    echo ""
    
    # Update timestamp
    sed -i.bak "s/Last updated:.*/Last updated: $(date +%Y-%m-%d)/" "$FOCUS_FILE" 2>/dev/null
    rm "${FOCUS_FILE}.bak" 2>/dev/null
    
    echo "=============================================="
    echo "📋 AI SESSION CONTEXT - LOAD THIS INTO YOUR AI"
    echo "=============================================="
    echo ""
    
    # Display HANDOFF.md (the critical working memory)
    if [[ -f "$HANDOFF_FILE" ]]; then
        echo "--- HANDOFF.md (Working Memory) ---"
        cat "$HANDOFF_FILE"
        echo ""
        echo "------------------------------------"
    else
        echo "⚠️  No HANDOFF.md found. Run 'session.sh end' to create one."
    fi
    
    echo ""
    
    # Show active feature spec if referenced in handoff
    local active_feature=$(get_active_feature)
    if [[ -n "$active_feature" && -f "$active_feature" ]]; then
        echo "--- Active Feature Spec ---"
        echo "File: $active_feature"
        echo ""
        cat "$active_feature"
        echo ""
        echo "----------------------------"
    fi
    
    echo ""
    echo "✅ Context ready. Paste the above into your AI agent."
    echo ""
    echo "Quick command for AI tools:"
    echo "   read .ai/context/HANDOFF.md"
    echo ""
}

function end_session() {
    echo "🔄 Ending AI Session..."
    echo ""
    
    # 1. Get recent git activity for CURRENT_FOCUS.md
    echo "   - Reading recent git activity..."
    GIT_SUMMARY=$(git log --since="24 hours ago" --pretty=format:"%s; " | tr '\n' ' ' | sed 's/; $//')
    if [[ -z "$GIT_SUMMARY" ]]; then
        GIT_SUMMARY=$(git log -n 3 --pretty=format:"%s; " | tr '\n' ' ' | sed 's/; $//')
    fi
    RECENT_CHANGES=$(git log --since="24 hours ago" --oneline --pretty=format:"- %ad: %s" --date=short)
    
    # 2. Get recently modified files (smart default for Active Files)
    echo "   - Detecting recently modified files..."
    RECENT_FILES=$(git diff --name-only HEAD~3 2>/dev/null | head -10)
    
    # 3. Identify active feature
    local active_feature=$(get_active_feature)
    local feature_name=""
    local feature_id=""
    local feature_path=""
    if [[ -n "$active_feature" && -f "$active_feature" ]]; then
        feature_path="$active_feature"
        feature_name=$(grep "^# Feature:" "$active_feature" | head -1 | sed 's/# Feature: //')
        feature_id=$(grep "^\*\*ID\*\*:" "$active_feature" | head -1 | sed 's/\*\*ID\*\*: //')
    fi
    
    echo ""
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "📝 HANDOFF CAPTURE - Answer these prompts:"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo ""
    
    # 4. Prompt: Session Summary
    echo "Enter a brief summary of this session (Press Enter for git log):"
    read -e -p "> " USER_SUMMARY
    SESSION_SUMMARY="${USER_SUMMARY:-$GIT_SUMMARY}"
    
    # 5. Prompt: Active Files
    echo ""
    echo "Active files you were working on (one per line, empty line to finish):"
    if [[ -n "$RECENT_FILES" ]]; then
        echo "(Detected from git: press Enter to use these)"
        echo "$RECENT_FILES" | head -5
    fi
    echo ""
    
    ACTIVE_FILES=""
    while true; do
        read -e -p "File: " file_input
        if [[ -z "$file_input" ]]; then
            if [[ -z "$ACTIVE_FILES" && -n "$RECENT_FILES" ]]; then
                ACTIVE_FILES="$RECENT_FILES"
            fi
            break
        fi
        ACTIVE_FILES+="$file_input"$'\n'
    done
    
    # 6. Prompt: Blockers
    echo ""
    echo "Current blockers or issues (one per line, empty line to finish):"
    BLOCKERS=""
    while true; do
        read -e -p "Blocker: " blocker_input
        if [[ -z "$blocker_input" ]]; then
            break
        fi
        BLOCKERS+="- $blocker_input"$'\n'
    done
    
    # 7. Prompt: Next Steps
    echo ""
    echo "Immediate next steps (one per line, empty line to finish):"
    NEXT_STEPS=""
    step_num=1
    while true; do
        read -e -p "Step $step_num: " step_input
        if [[ -z "$step_input" ]]; then
            break
        fi
        NEXT_STEPS+="$step_num. $step_input"$'\n'
        ((step_num++))
    done
    
    # 8. Prompt: Notes for AI
    echo ""
    echo "Any notes for the AI assistant? (single line, optional):"
    read -e -p "> " AI_NOTES
    
    echo ""
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo ""
    
    # 9. Write HANDOFF.md
    cat > "$HANDOFF_FILE" << EOF
# AI Session Handoff
Last Session: $(date +%Y-%m-%d\ %H:%M)

## 🎯 Active Feature
EOF

    if [[ -n "$feature_name" ]]; then
        echo "**$feature_name** ($feature_id)" >> "$HANDOFF_FILE"
        echo "Spec: \`$feature_path\`" >> "$HANDOFF_FILE"
    else
        echo "(No active feature detected)" >> "$HANDOFF_FILE"
    fi

    cat >> "$HANDOFF_FILE" << EOF

## 📂 Active Files (Last Edited)
EOF

    if [[ -n "$ACTIVE_FILES" ]]; then
        echo "$ACTIVE_FILES" | while read -r f; do
            [[ -n "$f" ]] && echo "- \`$f\`" >> "$HANDOFF_FILE"
        done
    else
        echo "(No files tracked)" >> "$HANDOFF_FILE"
    fi

    cat >> "$HANDOFF_FILE" << EOF

## ⚠️ Current Blockers
EOF

    if [[ -n "$BLOCKERS" ]]; then
        echo "$BLOCKERS" >> "$HANDOFF_FILE"
    else
        echo "(None recorded)" >> "$HANDOFF_FILE"
    fi

    cat >> "$HANDOFF_FILE" << EOF

## ➡️ Immediate Next Steps
EOF

    if [[ -n "$NEXT_STEPS" ]]; then
        echo "$NEXT_STEPS" >> "$HANDOFF_FILE"
    else
        echo "1. (Not specified)" >> "$HANDOFF_FILE"
    fi

    cat >> "$HANDOFF_FILE" << EOF

## 📝 Notes for AI
EOF

    if [[ -n "$AI_NOTES" ]]; then
        echo "- $AI_NOTES" >> "$HANDOFF_FILE"
    else
        echo "- See linked feature spec for implementation details" >> "$HANDOFF_FILE"
    fi

    if [[ -n "$feature_path" ]]; then
        echo "- Read \`$feature_path\` for full context" >> "$HANDOFF_FILE"
    fi
    
    echo "" >> "$HANDOFF_FILE"
    
    echo "✅ HANDOFF.md updated."
    
    # 10. Update CURRENT_FOCUS.md (existing behavior)
    if [[ -f "$FOCUS_FILE" ]]; then
        # Scan active features
        ACTIVE_FEATURES=""
        while IFS= read -r file; do
            if [[ -f "$file" ]]; then
                BASENAME=$(basename "$file")
                TITLE=$(grep "^# Feature:" "$file" | head -n 1 | sed 's/# Feature: //')
                ACTIVE_FEATURES+="- **$TITLE** (Ref: \`.ai/features/$BASENAME\`)"$'\n'
            fi
        done < <(find .ai/features -name "*.md" -mtime -1 2>/dev/null)
        
        TEMP_FILE=$(mktemp)
        echo "# Current Development Focus" > "$TEMP_FILE"
        echo "" >> "$TEMP_FILE"
        
        if [[ -n "$ACTIVE_FEATURES" ]]; then
            echo "## 🚀 Active Features (Work in Progress)" >> "$TEMP_FILE"
            echo "$ACTIVE_FEATURES" >> "$TEMP_FILE"
            echo "" >> "$TEMP_FILE"
        fi
        
        echo "## 📅 Recent Session: $(date +%Y-%m-%d\ %H:%M)" >> "$TEMP_FILE"
        echo "**Summary**: $SESSION_SUMMARY" >> "$TEMP_FILE"
        echo "" >> "$TEMP_FILE"
        echo "### Git Activity" >> "$TEMP_FILE"
        echo "$RECENT_CHANGES" >> "$TEMP_FILE"
        echo "" >> "$TEMP_FILE"
        
        echo "## Context for AI Assistant" >> "$TEMP_FILE"
        echo "- Read \`.ai/context/HANDOFF.md\` for working memory" >> "$TEMP_FILE"
        echo "- Focus on the active feature and immediate next steps" >> "$TEMP_FILE"
        echo "" >> "$TEMP_FILE"
        echo "Last updated: $(date +%Y-%m-%d)" >> "$TEMP_FILE"
        
        mv "$TEMP_FILE" "$FOCUS_FILE"
        echo "✅ CURRENT_FOCUS.md updated."
    fi
    
    echo ""
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "🎉 Session ended. Next time, run:"
    echo "   ./scripts/ai/session.sh start"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
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
