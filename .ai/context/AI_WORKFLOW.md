# AI Development Workflow

This project uses a strict, automated workflow for tracking features and managing AI context, ensuring full observability and consistent history.

## 1. Session Management (`session.sh`)

Use this script to start your work and ensure the AI agent has the correct context, and to end your work by logging your progress.

### Scenario A: Starting your day
**Command:**
```bash
./scripts/ai/session.sh start
```
**What happens:**
1.  Updates the `Last Updated` timestamp in `CURRENT_FOCUS.md`.
2.  Outputs a list of context files and copy-paste commands for your AI tool.

**Example Output:**
```text
🤖 Starting AI Session in /mnt/work/Projects/tauri/datalake
   - Updating timestamp in CURRENT_FOCUS.md
✅ Context refreshed.

🚀 LOAD THIS CONTEXT INTO YOUR AI AGENT:
----------------------------------------
File List (Copy & Paste):
.ai/context/PROJECT_OVERVIEW.md
.ai/context/ARCHITECTURE.md
.ai/context/CURRENT_FOCUS.md
----------------------------------------
```

### Scenario B: Wrapping up
**Command:**
```bash
./scripts/ai/session.sh end
```
**What happens:**
1.  Fetches your recent git commits.
2.  Prompts you for a summary (defaults to git log).
3.  Checks for **Architectural Changes** (critical for context integrity).
4.  Updates `CURRENT_FOCUS.md` with your session log and next steps.

**Interaction:**
```text
🔄 Ending AI Session...
   - Reading recent git activity...

Enter a brief summary of what you accomplished in this session:
`Default: - feat: added login screen;`
> Implemented the basic login UI [ENTER]

Did you make any ARCHITECTURAL or STRUCTURE changes? (y/n)
> n [ENTER]
```

---

## 2. Feature Lifecycle (`feature.sh`)

Features are stored in `.ai/features/` with the convention: `ID-slug-UPDATED-CREATED.md`.

### Scenario C: Starting a new feature
**Command:**
```bash
./scripts/ai/feature.sh new
```
**What happens:**
1.  Auto-detects the next ID (e.g., `0005`).
2.  Generates a file like `0005-user-settings-260122-260122.md`.
3.  Pre-fills it with a standard template.

**Interaction:**
```text
🆕 Creating Feature ID: 0005
Enter feature name (slug): User Settings [ENTER]
✅ Created: 0005-user-settings-260122-260122.md
```

### Scenario D: Updating a feature
**When:** You worked on a feature today.
**Command:**
```bash
./scripts/ai/feature.sh update
```
**What happens:**
1.  Lists active features.
2.  **Renames** the selected file to update the `UPDATED` timestamp (e.g., to `...-260123-260122.md`).
3.  Updates the metadata inside the file.

**Interaction:**
```text
🔍 Select feature to update:
1) 0001-ui-layout-260120-260110.md
2) 0005-user-settings-260122-260122.md
#? 2 [ENTER]

🔄 Renamed to: 0005-user-settings-260123-260122.md
✅ Metadata updated.
```

## 3. Why this matters
- **Sorting**: Files naturally sort by ID (logical order).
- **Recency**: The filename suffix (`-UPDATED-CREATED`) gives instant visibility into feature activity.
- **Context**: AI agents can list `.ai/features/` to see the full project history.
