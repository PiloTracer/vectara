#!/bin/bash

# AI-Assisted Development Environment Setup
# Optimized for: Antigravity, Claude Code, Cursor, Aider, Codex
# Auto-detects: vectara, tools-iadata, tools-iam

set -e

# --- 1. Path Safety & Root Detection ---
# Resolve the directory where the script is located
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

# Start at script location and traverse up until we find 'vectara' or 'datalake' root marker
# or simply assume we are in .misc and need to go up one level if datalake is the parent.
# A more robust approach: Look for a known root marker like .git or specific folders.
ROOT_DIR="$SCRIPT_DIR"
while [[ "$ROOT_DIR" != "/" ]]; do
    if [[ -d "$ROOT_DIR/vectara" || -d "$ROOT_DIR/tools-iadata" || -d "$ROOT_DIR/tools-iam" ]]; then
        break
    fi
    ROOT_DIR="$(dirname "$ROOT_DIR")"
done

if [[ "$ROOT_DIR" == "/" ]]; then
    # Fallback: assume we are two levels deep (scripts/ai/script.sh)
    echo "⚠️ Could not auto-detect project root. Assuming grandparent of script directory..."
    ROOT_DIR="$(dirname "$(dirname "$SCRIPT_DIR")")"
fi

cd "$ROOT_DIR"
PROJECT_NAME=$(basename "$ROOT_DIR")
echo "🚀 Setting up AI development environment for: $PROJECT_NAME"
echo "📂 Project Root: $ROOT_DIR"

# --- 2. Component Auto-Detection ---
COMPONENTS=()
echo "🔍 Detecting components..."

if [[ -d "vectara" ]]; then
    echo "  ✅ Detected: vectara (Desktop Application)"
    COMPONENTS+=("vectara")
fi

if [[ -d "tools-iadata" ]]; then
    echo "  ✅ Detected: tools-iadata (Backend/AI Stack)"
    COMPONENTS+=("tools-iadata")
fi

if [[ -d "tools-iam" ]]; then
    echo "  ✅ Detected: tools-iam (Licensing & User Management - Internal)"
    COMPONENTS+=("tools-iam")
elif [[ -d "../tools-iam" ]]; then
    echo "  ✅ Detected: tools-iam (Licensing & User Management - External Sibling)"
    COMPONENTS+=("ext:tools-iam")
elif [[ -d "/mnt/work/Projects/tauri/tools-iam" ]]; then
    echo "  ✅ Detected: tools-iam (Licensing & User Management - External Path)"
    COMPONENTS+=("ext:tools-iam")
fi

# --- 3. Directory Structure ---
create_structure() {
    echo "📁 Creating directory structure..."
    
    # Core AI structure
    mkdir -p .ai/{context,prompts/{initialization,templates,system},agents,skills,sessions,features}
    
    # Project documentation
    mkdir -p docs/{development,architecture,ai-context/session-logs}
    
    # Workflow integration
    mkdir -p .github/{workflows,ISSUE_TEMPLATE}
    mkdir -p scripts/{dev,ai}
    mkdir -p .cursor/rules
    
    echo "✅ Directory structure created"
}

# --- 4. Context Generation ---
create_context_files() {
    echo "📝 Creating context files..."
    
    # Generate Component Section for Overview
    COMPONENT_TEXT=""
    for comp in "${COMPONENTS[@]}"; do
        if [[ "$comp" == "vectara" ]]; then
            COMPONENT_TEXT+="1. **vectara**: Desktop application (Tauri)"$'\n'
        elif [[ "$comp" == "tools-iadata" ]]; then
            COMPONENT_TEXT+="2. **tools-iadata**: Docker-based AI chatbot backend"$'\n'
        elif [[ "$comp" == "tools-iam" ]]; then
            COMPONENT_TEXT+="3. **tools-iam**: (Integration Target) Independent licensing service"$'\n'
        elif [[ "$comp" == "ext:tools-iam" ]]; then
            COMPONENT_TEXT+="3. **tools-iam** (External): (Integration Target) Independent licensing service"$'\n'
        else
            COMPONENT_TEXT+="- **$comp**: Detected component"$'\n'
        fi
    done

    # PROJECT_OVERVIEW.md
    cat > .ai/context/PROJECT_OVERVIEW.md << EOF
# Project Overview: $PROJECT_NAME

## Description
This is a multi-component AI ecosystem.

## Components
$COMPONENT_TEXT

## Tech Stack
- **Desktop**: Tauri (Rust/Frontend)
- **Backend AI**: Docker Compose (Python/FastAPI/Qdrant)
- **Licensing/IAM**: Independent service (tools-iam)

## Repository Structure
$(for comp in "${COMPONENTS[@]}"; do 
    if [[ "$comp" == "ext:"* ]]; then
        echo "- \`${comp#ext:}/\` (External Repository)"
    else
        echo "- \`$comp/\`"
    fi
done)

## Current Phase
[Setup/Development/Testing/Production]

## Last Updated
$(date +%Y-%m-%d)
EOF

    # ARCHITECTURE.md
    cat > .ai/context/ARCHITECTURE.md << EOF
# System Architecture

## High-Level Diagram
\`\`\`mermaid
graph TD
    User((User))
    
    subgraph Client Environment
        Vectara[Vectara Desktop App] -- IPC --> Core
    end
    
    subgraph AI Infrastructure
        IAD[tools-iadata] -- Docker Network --> Qdrant[(Vector DB)]
        IAD -- API --> LLM[LLM Provider]
    end
    
    subgraph Remote Services
        IAM[tools-iam] -- HTTPS --> Auth[Licensing & Auth]
    end
    
    User --> Vectara
    Vectara --> IAD
    Vectara --> IAM
    IAD --> IAM
\`\`\`

## Components

### 1. Vectara (Desktop)
- **Role**: Main user interface
- **Tech**: Tauri 2.x, Rust, React/Vue

### 2. tools-iadata (AI Backend)
- **Role**: Specialized AI tasks, chatbot orchestration
- **Tech**: Docker, Python, FastAPI, Qdrant
- **Deployment**: containerized stack

### 3. tools-iam (External Service)
- **Role**: Independent Licensing Provider
- **Tech**: [External Project]
- **Integration**: Accessed via secure API (HTTP/REST)

## Data Flow
1. **Auth**: Apps authenticate against \`tools-iam\`.
2. **Chat**: \`vectara\` sends prompts to \`tools-iadata\`.
3. **Storage**: vectors stored in \`tools-iadata\` volume.

EOF

    # CURRENT_FOCUS.md
    if [[ ! -f .ai/context/CURRENT_FOCUS.md ]]; then
        cat > .ai/context/CURRENT_FOCUS.md << EOF
# Current Development Focus

## Active Tasks
- [ ] Verify environment setup
- [ ] Connect \`vectara\` to \`tools-iam\`
- [ ] Configure \`tools-iadata\` container stack

## Blockers
None

## Context for AI Assistant
- Focus on integrating the 3 detected components.
- Ensure cross-component communication is secure.

Last updated: $(date +%Y-%m-%d)
EOF
    else
        echo "  - Keeping existing CURRENT_FOCUS.md"
    fi

    # DECISIONS.md
    if [[ ! -f .ai/context/DECISIONS.md ]]; then
        cat > .ai/context/DECISIONS.md << EOF
# Architectural Decision Records (ADR)

## ADR-001: Component Separation
**Status**: Accepted
**Context**: We need separate update cycles for desktop, AI engine, and auth.
**Decision**: Split into \`vectara\`, \`tools-iadata\`, and \`tools-iam\`.
EOF
    fi

    echo "✅ Context files created"
}

# --- 5. Prompt Templates ---
create_prompts() {
    echo "💬 Creating prompt templates..."
    
    # System Prompt suitable for generic LLMs or specific Agents
    cat > .ai/prompts/system/coding-assistant.md << EOF
# System Prompt

You are an expert full-stack engineer managing a complex 3-part system:
1. **vectara** (Tauri Desktop)
2. **tools-iadata** (Dockerized AI Backend)
3. **tools-iam** (Remote Licensing/Auth)

## Rules
- **tools-iam** is a separate project. Treat it as an external API dependency.
- Always identify which component you are modifying.
- Prefer Docker Compose for orchestrating \`tools-iadata\`.
EOF

    echo "✅ Prompt templates created"
}

create_additional_prompts() {
    # New feature prompt
    cat > .ai/prompts/initialization/new-feature.md << 'EOF'
# New Feature Implementation

## Pre-Implementation Checklist
- [ ] Read PROJECT_OVERVIEW.md
- [ ] Read ARCHITECTURE.md
- [ ] Read CURRENT_FOCUS.md

## Feature Details
**Feature Name**: [Name]
**Component**: [vectara/tools-iadata/tools-iam]
**Priority**: [High/Medium/Low]

## Requirements
[Describe what needs to be built]

## Implementation Plan
1. Step 1
2. Step 2

## Documentation Updates Needed
- [ ] Update ARCHITECTURE.md if structure changes
- [ ] Add to CURRENT_FOCUS.md
EOF

    # Debug session prompt
    cat > .ai/prompts/initialization/debug-session.md << 'EOF'
# Debug Session

## Issue Description
[What's the problem?]

## Component Affected
- [ ] Vectara
- [ ] tools-iadata
- [ ] tools-iam

## Steps to Reproduce
1. Step 1
2. Step 2

## Logs/Errors
\`\`\`
[Paste logs]
\`\`\`
EOF
}

create_skills() {
    echo "🎯 Creating skill definitions..."
    
    if [[ " ${COMPONENTS[*]} " =~ "vectara" ]]; then
        cat > .ai/skills/tauri-development.md << 'EOF'
# Skill: High-Performance Cross-Platform Desktop Architect (Tauri)

**Description**: Expertise in building tiny, fast, and secure desktop applications using the Tauri framework. This skill encompasses the bridge between a web-based frontend and a high-performance Rust backend.

## 1. Core Competencies & Instructions

### 🔒 Security First
- **Principle of Least Privilege**: When generating `tauri.conf.json` or capabilities, ONLY enable the specific APIs required for the task.
- **IPC Validation**: Never trust input from the frontend. Validate all payloads in Rust.

### 🦀 Rust Backend Logic
- **Heavy Lifting**: Move ALL heavy computations, file system access, and system-level integrations to the `src-tauri` layer.
- **Type Safety**: Provide corresponding TypeScript interfaces for all Rust structs to ensure safety across the bridge.
- **Commands**: Use strongly typed `#[tauri::command]` functions.

### 🌐 Frontend Agnostic with Shell Capabilities
- **Integration**: Capable of integrating with React, Vue, Svelte, or vanilla JS/TS.
- **The "Shell" Strategy**: For this project (`vectara`), the Tauri app acts as a **Shell** for the Dockerized backend (`tools-iadata`).
- **Embedding Strategy**:
    - **Recommended**: **Webview Redirection**. Point the main window (or a secondary window) directly to the Docker service URL (e.g., `http://localhost:8000`) once it is ready. This provides a focused, native feel.
    - **Fallback**: **Iframe Embedding**. Use an `<iframe>` only if strict DOM isolation is required or if you need to overlay native UI controls *on top* of the external content permanently.

### 💾 State Management
- **Managed State**: Use Tauri's `manage` (e.g., `app.manage(MyState { ... })`) to share state (db connections, config) across Rust commands.
- **Sync**: Use Events to keep Frontend state in sync with Backend truth.

### ⚡ Optimization
- **Binary Size**: Minimize the final binary size. Strip debug symbols in release.
- **Memory**: Leverage system native webviews (WebKit/WebView2) instead of bundling Chromium.

### 📡 Event Handling
- **Full-Duplex**: Implement full-duplex communication using `emit` and `listen` for asynchronous updates (e.g., "Docker Container Started" -> UI Update).

---

## 2. Project-Specific Workflows

### Feature 1: Initial Configuration Check ("The Gatekeeper")
Before showing the main UI, `vectara` must:
1.  **Verify**: Rust backend reads `/mnt/work/Projects/tauri/datalake/tools-iadata/.env.example` (or the actual `.env`).
2.  **Validate**: Check if keys are set (e.g., `OPENAI_API_KEY`).
3.  **Decide**:
    - **IF Valid**: Redirect Webview to the Docker App.
    - **IF Invalid**: Show a native Tauri reconfiguration screen.

## 3. System Prompt Behavior
> "When tasked with Tauri development, always look for opportunities to move performance-critical logic into Rust and provide the corresponding TypeScript interfaces for the frontend to ensure type safety across the bridge."
EOF
    fi

    if [[ " ${COMPONENTS[*]} " =~ "tools-iadata" ]]; then
        cat > .ai/skills/docker-ai-stack.md << 'EOF'
# Docker AI Stack Management
- Manage Qdrant and FastAPI containers.
- Ensure proper volume mapping for AI models/vectors.
EOF
    fi

    if [[ " ${COMPONENTS[*]} " =~ "tools-iam" ]]; then
        cat > .ai/skills/iam-management.md << 'EOF'
# IAM & Licensing Service
- Management of user roles and license keys.
- Ensure secure API token validation.
- Database: [TBD]
EOF
    fi

    echo "✅ Skill definitions created"
}

# --- 6. Automation Scripts ---
create_automation() {
    echo "⚙️ Creating automation scripts..."
    
    # Smart Start Session
    cat > scripts/ai/start-session.sh << 'EOF'
#!/bin/bash
# Resolves root directory safely
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
ROOT_DIR="$(dirname "$(dirname "$SCRIPT_DIR")")"
cd "$ROOT_DIR"

echo "🤖 Starting AI Session in $ROOT_DIR"
echo "   - Updating timestamp in CURRENT_FOCUS.md"
sed -i.bak "s/Last updated:.*/Last updated: $(date +%Y-%m-%d)/" .ai/context/CURRENT_FOCUS.md
echo "✅ Context refreshed."
echo ""
echo "🚀 To load this context into your AI assistant, use one of the following:"
echo ""
echo "   [Claude Code]"
echo "   claude-code .ai/context/*.md"
echo ""
echo "   [Aider]"
echo "   aider --read .ai/context/PROJECT_OVERVIEW.md --read .ai/context/CURRENT_FOCUS.md --read .ai/context/ARCHITECTURE.md"
echo ""
echo "   [Cursor]"
echo "   (Context is automatically loaded via .cursor/rules.md)"
echo "" 
EOF
    chmod +x scripts/ai/start-session.sh

    # Context Updater
    cat > scripts/ai/update-context.sh << 'EOF'
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

GIT_SUMMARY=$(git log --since="24 hours ago" --pretty=format:"%s; " | tr '\n' ' ' | sed 's/; $//')
if [[ -z "$GIT_SUMMARY" ]]; then
    GIT_SUMMARY=$(git log -n 3 --pretty=format:"%s; " | tr '\n' ' ' | sed 's/; $//')
fi

# 2. Interactive Input
echo "----------------------------------------------------------------"
echo "🤖 Session Reflection"
echo "----------------------------------------------------------------"
echo "Enter a brief summary of what you accomplished in this session:"
echo "\`Default: $GIT_SUMMARY\`"
read -e -p "> " USER_INPUT

if [[ -z "$USER_INPUT" ]]; then
    SESSION_SUMMARY="$GIT_SUMMARY"
    echo "   Using default git summary."
else
    SESSION_SUMMARY="$USER_INPUT"
fi

echo ""
echo "Did you make any ARCHITECTURAL or STRUCTURE changes? (y/n)"
read -n 1 -r ARCH_CHANGED
echo ""
ARCH_NOTE=""
if [[ $ARCH_CHANGED =~ ^[Yy]$ ]]; then
    echo "Please briefly describe the change (e.g., 'Added new auth service', 'Changed DB schema'):"
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
    
    # Architecture Alert
    if [[ -n "$ARCH_NOTE" ]]; then
        echo "$ARCH_NOTE" >> "$TEMP_FILE"
        echo "" >> "$TEMP_FILE"
    fi
    
    # New Active Tasks
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
    EXISTING_CONTEXT=$(grep -A 5 "## Context for AI Assistant" "$FOCUS_FILE" | tail -n +2 | grep -v "Last updated" | grep -v "> \[!IMPORTANT\]")
    if [[ -n "$EXISTING_CONTEXT" ]]; then
        echo "$EXISTING_CONTEXT" >> "$TEMP_FILE"
    else
        echo "- Focus on detecting latest changes." >> "$TEMP_FILE"
    fi
    
    echo "" >> "$TEMP_FILE"
    echo "Last updated: $(date +%Y-%m-%d)" >> "$TEMP_FILE"
    
    mv "$TEMP_FILE" "$FOCUS_FILE"
    echo "✅ $FOCUS_FILE updated."
    
    if [[ -n "$ARCH_NOTE" ]]; then
        echo "⚠️  Flagged architectural changes for next session."
    fi
else
    echo "⚠️ $FOCUS_FILE not found."
fi

echo "✅ Context Updated. Ready for next session."
EOF

    # New Feature Script
    cat > scripts/ai/new-feature.sh << 'EOF'
#!/bin/bash
# new-feature.sh: Create a new feature with ID and Timestamp
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
ROOT_DIR="$(dirname "$(dirname "$SCRIPT_DIR")")"
FEATURES_DIR="$ROOT_DIR/.ai/features"

mkdir -p "$FEATURES_DIR"
cd "$FEATURES_DIR"

LATEST_ID=$(ls | grep -E '^[0-9]{4}-' | cut -d'-' -f1 | sort -rn | head -n 1)
if [[ -z "$LATEST_ID" ]]; then
    NEXT_ID="0001"
else
    NEXT_ID=$(printf "%04d" $((10#$LATEST_ID + 1)))
fi

echo "🆕 Creating New Feature (ID: $NEXT_ID)"
read -p "Enter feature name (slug): " FEATURE_NAME
SLUG=$(echo "$FEATURE_NAME" | tr '[:upper:]' '[:lower:]' | sed 's/ /-/g' | sed 's/[^a-z0-9-]//g')

DATE_CODE=$(date +%y%m%d)
FILENAME="${NEXT_ID}-${SLUG}-${DATE_CODE}-${DATE_CODE}.md"
FULL_PATH="$FEATURES_DIR/$FILENAME"

cat > "$FULL_PATH" << INNEREOF
# Feature: $FEATURE_NAME
**ID**: $NEXT_ID
**Created**: $(date +%Y-%m-%d)
**Last Updated**: $(date +%Y-%m-%d)
**Status**: DRAFT

## 1. Objective
[Describe what this feature achieves]

## 2. Requirements
- [ ] Requirement A
- [ ] Requirement B

## 3. Implementation Plan
- [ ] Step 1
- [ ] Step 2

## 4. Changelog
- $(date +%Y-%m-%d): Initial Draft
INNEREOF

echo "✅ Created feature: $FILENAME"
EOF

    # Update Feature Script
    cat > scripts/ai/update-feature.sh << 'EOF'
#!/bin/bash
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
ROOT_DIR="$(dirname "$(dirname "$SCRIPT_DIR")")"
FEATURES_DIR="$ROOT_DIR/.ai/features"
cd "$FEATURES_DIR" || exit 1

echo "🔍 Selecting feature to update..."
OPTIONS=($(ls *.md))
if [ ${#OPTIONS[@]} -eq 0 ]; then echo "No features found."; exit 1; fi

select FILE in "${OPTIONS[@]}"; do
    if [[ -n "$FILE" ]]; then break; else echo "Invalid selection."; fi
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
echo "✅ Feature updated."
EOF

    chmod +x scripts/ai/new-feature.sh scripts/ai/update-feature.sh
    chmod +x scripts/ai/update-context.sh

    echo "✅ Automation scripts created"
}

# --- 7. Execution ---
main() {
    create_structure
    create_context_files
    create_prompts
    create_additional_prompts
    create_skills
    create_automation
    
    echo ""
    echo "🎉 AI Environment Setup Complete!"
    echo "   Location: $ROOT_DIR/.ai"
    echo "   Detected Components: ${COMPONENTS[*]}"
}

main