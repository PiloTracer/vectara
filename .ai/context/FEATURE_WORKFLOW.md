# Feature Development Workflow

This project uses a strict, automated workflow for tracking features, ensuring full observability and consistent history.

## 1. Feature Identification
Features are stored in `.ai/features/` and follow this naming convention:
\`\`\`
ID-slug-UPDATED-CREATED.md
\`\`\`
Example: `0001-user-auth-260122-260120.md`
- **ID**: 4-digit index (0001, 0002...) for logical sorting.
- **Slug**: Human-readable name.
- **UPDATED**: Date of last activity (YYMMDD).
- **CREATED**: Date of creation (YYMMDD).

## 2. Creating a New Feature
**Do not create files manually.** Use the automation script:
```bash
./scripts/ai/new-feature.sh
```
1.  It automatically finds the next available ID (e.g., 0002).
2.  It asks for the feature name.
3.  It generates the document with standard templates (Objective, Requirements, Plan).

## 3. Working on a Feature
When you update a feature (change status, check off items, add notes), you **must** update its timestamp to reflect activity.

Use the automation script:
```bash
./scripts/ai/update-feature.sh
```
1.  Select the feature from the list.
2.  The script will **rename the file** updating the `UPDATED` segment of the filename to today's date.
3.  It updates the internal metadata `**Last Updated**: YYYY-MM-DD`.

## 4. Why this matters
- **Sorting**: Files naturally sort by ID (logical order).
- **Recency**: You can see exactly when a feature was last touched by looking at the filename.
- **Context**: AI agents can list `.ai/features/` and immediately know the history and active status of all work.
