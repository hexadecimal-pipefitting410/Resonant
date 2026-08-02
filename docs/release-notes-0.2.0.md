# Resonant 0.2.0

Agent-mode release for Windows and local MCP hosts.

- Local STDIO MCP server compatible with project-scoped Codex and Claude Code configuration.
- Sixteen focused tools for project discovery, composition, clip variation, arrangement, instrument and mixer control, automation, WAV import, mix analysis, deterministic render, validation, and recovery.
- One production-guide resource and one reusable blank-to-render prompt.
- Root-confined file access, complete project validation, optimistic revision checks, atomic replacement, and 20 bounded pre-change snapshots.
- Peak/RMS, crest-factor, stereo-balance/correlation, DC-offset, and clipped-sample analysis from the production renderer.
- External project-change detection in the desktop application with dirty-state confirmation.
- Agent guidance for Codex (`AGENTS.md`, `.codex/config.toml`) and Claude Code (`CLAUDE.md`, `.mcp.json`).

Known non-blocking limitations: agents operate on saved files rather than transient UI state; transport, audition, microphone, and recording control are not exposed; WAV import accepts PCM and 32-bit float RIFF/WAVE only; a human should audition final artistic decisions. Windows binaries remain unsigned.
