# Plan 0020: Dashboard Components & Structure

## Overview
This plan defines the structural layout and component hierarchy for the **Tools IADATA** Dashboard (`front-dl`). The design prioritizes the "Environment" as the central context for all operations.

## 1. Shell Layout (Global)

### A. Header Bar (Top)
- **Left**: Mini Logo + "Tools IADATA" text (Gradient style).
- **Right**: User Profile Config.
    - Avatar (Initials or Image from Keycloak).
    - Dropdown:
        - "Signed in as [Name]" (App Role badge).
        - Theme Toggle (Dark/Light - default Dark).
        - Sign Out.

### B. Navigation Sidebar (Left)
A persistent, collapsible sidebar organized by logical function.

#### Section 1: Context (Sticky Top)
- **Active Environment Selector**:
    - Dropdown showing currently active Environment.
    - "New Environment" quick action.
    - Status indicator (Ready / Indexing / Error).

#### Section 2: Core Management
- **Environments**: List/Grid view of all environments.
- **Sources**: Data connector management (Local, Drive, Web).
- **Models**: LLM configuration (API Keys, Local endpoints).
- **Agents**: Agent persona and prompt management.

#### Section 3: Workspace
- **Chat**: Main interaction interface.
- **History**: Past sessions/threads.
- **Knowledge**: File browser/indexer status for current environment.

#### Section 4: System (Bottom)
- **Settings**: Application-level preferences.
- **Documentation**: Link to internal docs.

## 2. Component Structure

### `src/components/layout/`
- `Shell.tsx`: Main grid layout (Sidebar + Header + Main).
- `Header.tsx`: Top bar implementation.
- `Sidebar.tsx`: Navigation logic.
- `SidebarItem.tsx`: Reusable nav link with active state.
- `EnvironmentSelector.tsx`: Context switcher.

### `src/components/dashboard/`
- `EnvironmentCard.tsx`: Summary view for environment list.
- `StatCard.tsx`: Metric display (e.g., "Files Indexed", "Storage Used").

## 3. Implementation Steps

1.  **Scaffold Shell**: Create `Shell`, `Header`, and `Sidebar` components.
2.  **Navigation Logic**: Implement `usePathname` hook for active states.
3.  **Auth Integration**: Connect Header User Profile to `auth.ts` session.
4.  **Environment State**: Create a simple Context/Zustand store for "Active Environment".
