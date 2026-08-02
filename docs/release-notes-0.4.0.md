# Resonant 0.4.0

Resonant 0.4 adds an optional local generative-music engine and a substantial visual refresh while keeping ordinary projects and startup lightweight.

## Highlights

- Optional ACE-Step 1.5 post-install module with isolated dependencies and shared model storage outside project folders.
- Hardware-aware RTX 4060 Laptop profile: ACE-Step 2B Turbo, 0.6B planner, PyTorch backend, batch size 1, and CPU offload.
- New ACE-Step Studio for prompting instrumental or vocal music, choosing duration and tempo, and adding generated WAVs directly to the Audio track.
- Engine start, stop, storage reporting, generated-output count, and complete independent removal controls.
- MCP `get_ai_generator_status` and `generate_ai_music` tools for agent-driven local generation followed by Resonant import, arrangement, mixing, analysis, and rendering.
- Copy-ready MCP onboarding for Codex, Claude Code, generic STDIO clients, and PowerShell, with workspace confinement and sanitized examples.
- Songwriter Studio language packs for English, Standard Mandarin, Hindi, Korean/K-pop, Latin American Spanish, and Japanese, exposed through both the desktop app and MCP discovery.
- Three creative starters: Neon Raga, Midnight Drive, and Velvet Orbit.
- Premium dark workstation refresh with clearer panel depth, teal/violet hierarchy, stronger contrast, and offline-safe Space Grotesk/Inter/JetBrains Mono font stacks.
- New Reso mascot and theme-aware Resonant wordmark for the public project page.
- Improved hover, focus, disabled, scrollbar, modal, transport, clip, mixer, and keyboard-accessibility states.
- Model caches remain centralized so multiple projects never duplicate the multi-gigabyte runtime.

## Validation

- Unit/domain suite, TypeScript checks, delivery-graph validation, and production build pass.
- MCP smoke covers all 29 registered tools, language-pack discovery, optional AI-generator status, path confinement, revision conflicts, deterministic render, analysis, and undo.
- Electron smoke covers the optional ACE-Step post-install screen plus instruments, Flow, audio import/record, Arrange, Mix, save/open/recovery, playback, and WAV export.
- Real ACE-Step model installation and generated-sample measurements are recorded with the release artifacts.
