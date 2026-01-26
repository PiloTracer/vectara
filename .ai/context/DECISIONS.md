# Architectural Decision Records (ADR)

## ADR-001: Component Separation
**Status**: Accepted
**Context**: We need separate update cycles for desktop, AI engine, and auth.
**Decision**: Split into `vectara`, `tools-iadata`, and `tools-iam`.

## ADR-002: Bridge Network Binding
**Status**: Accepted
**Context**: The Docker container (`tools-iadata`) could not access the host desktop app's Bridge API when it was bound to `127.0.0.1`.
**Decision**: Bind the Bridge server to `0.0.0.0` (all interfaces) to allow access from the `host.docker.internal` network alias.
**Security Implication**: The Bridge is now exposed on the local network. We must rely on the randomized port (or future auth token) and local firewall rules for security.

## ADR-003: Base64 Encoding for Binary Ingestion
**Status**: Accepted
**Context**: Sending binary files (Excel, Images) as raw bytes over the JSON-based Bridge API caused encoding errors.
**Decision**: Adopt a standard where the Bridge Base64-encodes file content before returning it to the Python backend. The backend decodes it before processing.
