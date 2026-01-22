# Architectural Decision Records (ADR)

## ADR-001: Component Separation
**Status**: Accepted
**Context**: We need separate update cycles for desktop, AI engine, and auth.
**Decision**: Split into `vectara`, `tools-iadata`, and `tools-iam`.
