#!/bin/bash
# Update AI context based on git changes + User Input
# Usage: ./scripts/ai/update-context.sh

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
ROOT_DIR="$(dirname "$(dirname "$SCRIPT_DIR")")"
cd "$ROOT_DIR"

FOCUS_FILE=".ai/context/CURRENT_FOCUS.md"

echo "🔄 Updating AI context in $ROOT_DIR..."

# 1. Capture Git History
echo "   - Reading recent git activity..."
RECENT_CHANGES=$(git log --since="24 hours ago" --oneline --pretty=format:"- %ad: %s" --date=short)
if [[ -z "$RECENT_CHANGES" ]]; then
    RECENT_CHANGES=$(git log -n 5 --oneline --pretty=format:"- %ad: %s" --date=short)
fi

# 2. Interactive Input
echo "----------------------------------------------------------------"
echo "🤖 Session Reflection"
echo "----------------------------------------------------------------"
echo "Enter a brief summary of what you accomplished in this session:"
read -e -p "> " SESSION_SUMMARY

echo ""
echo "What are the priority tasks for the NEXT session?"
echo "(Type 'done' on a new line to finish)"
NEXT_STEPS=""
while true; do
    read -p "- " line
    [[ "$line" == "done" ]] && break
    [[ -z "$line" ]] && break
    NEXT_STEPS+="- [ ] $line"$'\n'
done

# 3. Update CURRENT_FOCUS.md
if [[ -f "$FOCUS_FILE" ]]; then
    TEMP_FILE=$(mktemp)
    
    # Header
    echo "# Current Development Focus" > "$TEMP_FILE"
    echo "" >> "$TEMP_FILE"
    
    # New Active Tasks (User Input)
    echo "## Active Tasks" >> "$TEMP_FILE"
    if [[ -n "$NEXT_STEPS" ]]; then
        echo -n "$NEXT_STEPS" >> "$TEMP_FILE"
    else
        echo "- [ ] (No next steps defined)" >> "$TEMP_FILE"
    fi
    echo "" >> "$TEMP_FILE"

    # Session Log
    echo "## Recent Session: $(date +%Y-%m-%d\ %H:%M)" >> "$TEMP_FILE"
    echo "**Summary**: $SESSION_SUMMARY" >> "$TEMP_FILE"
    echo "" >> "$TEMP_FILE"
    echo "### Git Activity" >> "$TEMP_FILE"
    echo "$RECENT_CHANGES" >> "$TEMP_FILE"
    echo "" >> "$TEMP_FILE"

    # Restore Context
    echo "## Blockers" >> "$TEMP_FILE"
    echo "None" >> "$TEMP_FILE"
    echo "" >> "$TEMP_FILE"
    
    echo "## Context for AI Assistant" >> "$TEMP_FILE"
    EXISTING_CONTEXT=$(grep -A 5 "## Context for AI Assistant" "$FOCUS_FILE" | tail -n +2 | grep -v "Last updated")
    if [[ -n "$EXISTING_CONTEXT" ]]; then
        echo "$EXISTING_CONTEXT" >> "$TEMP_FILE"
    else
        echo "- Focus on detecting latest changes." >> "$TEMP_FILE"
    fi
    
    echo "" >> "$TEMP_FILE"
    echo "Last updated: $(date +%Y-%m-%d)" >> "$TEMP_FILE"
    
    mv "$TEMP_FILE" "$FOCUS_FILE"
    echo "✅ $FOCUS_FILE updated."
else
    echo "⚠️ $FOCUS_FILE not found."
fi

echo "✅ Context Updated. Ready for next session."
