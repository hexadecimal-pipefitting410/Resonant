# ADR-0003: Local MCP agent control

Status: accepted — 2026-08-01

## Context

Resonant needs to support music-production requests from Codex and Claude Code without tying its project model to either vendor or asking an agent to click the UI. The desktop application already has a versioned project model, validation, deterministic renderer, atomic saves, and undoable in-memory commands. It does not expose those capabilities outside its isolated Electron renderer.

## Decision

Build one local Model Context Protocol server over STDIO using the stable TypeScript SDK. The server imports the same `src/domain` project and rendering modules as the desktop application. Codex and Claude Code launch the same compiled server process.

The initial control plane is file-backed. Every tool is confined to a configured project root, parses and validates the current `.resonant` file, supports optimistic revision checks, writes through a sibling temporary file, and snapshots bounded history before mutation. Rendered WAV files and imported WAV sources must also remain inside the root. The server exposes focused musical operations rather than arbitrary JSON patches or shell access.

The desktop main process observes externally changed open projects and offers the renderer a reload event. Agent tools do not directly control transport or microphones in this release; those require a future authenticated live-session command channel.

## Consequences

- One protocol implementation works with Codex and Claude Code.
- Agent changes use the production project invariants and DSP renderer.
- A saved project remains the durable boundary, making agent sessions testable and recoverable.
- The user must save/open a project file; transient unsaved UI state is not agent-visible.
- Plugins or skills are optional distribution layers and must not fork the tool implementation.

## Rejected alternatives

- UI automation is fragile, hard to validate, and cannot provide useful structured state.
- Direct agent edits to raw JSON bypass invariants, revision checks, and history.
- Embedding a single model vendor's SDK inside Resonant would not satisfy the cross-agent requirement.
- A network-listening HTTP server adds authentication and exposure without improving the local Windows workflow.
