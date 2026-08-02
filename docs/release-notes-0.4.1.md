# Resonant 0.4.1

Resonant 0.4.1 is a reliability update for AI-assisted songwriting and local ACE-Step generation.

## What changed

- Multilingual section labels are normalized for ACE-Step while the original native-language lyrics remain intact in the Resonant project.
- Korean and other installed songwriting packs can now pass their language context through the complete MCP generation workflow.
- ACE-Step generation runs independently from the MCP client process, so a long-running song job continues if Codex, Claude Code, or another client disconnects.
- Interrupted or abandoned generation jobs can be restarted safely without creating duplicate work.
- ACE-Step status is scoped to an installed runtime, so a service running elsewhere no longer makes an empty installation location appear active.
- MCP documentation now includes a simple assistant-guided setup path: share the repository URL with an AI assistant and ask it to configure Resonant.
- Regression coverage was added for multilingual prompt normalization, detached generation, abandoned-job recovery, and language propagation.

## Validation

- Delivery-graph validation, TypeScript checks, and the complete unit/domain suite pass.
- Production renderer and MCP builds pass.
- MCP smoke validates all 29 registered tools, songwriting-language discovery, revision safety, confinement, analysis, rendering, and AI-generator status.
- Electron smoke covers startup, instruments, audio, arrangement, mixing, save/open/recovery, playback, and WAV export.
- Packaged MCP smoke validates the server bundled inside the Windows application.
- A live Korean ACE-Step job was started, reconnected after the originating MCP client exited, and completed successfully.

## Downloads

- `Resonant-Setup-0.4.1-Windows-x64.exe` — standard Windows installer.
- `Resonant-0.4.1-Windows-x64.exe` — portable Windows build.
- `SHA256SUMS.txt` — checksums for verifying both executables.

The Windows executables are currently unsigned, so Windows SmartScreen may show a warning. Source installation instructions remain available in the README.
