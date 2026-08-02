# ADR 0001: Electron, React, and Web Audio

Status: accepted — 2026-08-01

Use Electron 43 with a sandboxed React renderer. Chromium's Web Audio implementation owns the real-time audio callback; application code schedules bounded look-ahead events and never enters that callback. `OfflineAudioContext`-compatible project semantics are implemented by a deterministic pure renderer so export is testable without hardware.

Electron main owns file dialogs and atomic writes. A context-isolated preload exposes one validated operation per IPC message. Node integration is disabled. This gives a reproducible Windows package, native media-device support, and a single TypeScript domain model.

Alternatives rejected: a native C++/JUCE build has stronger plugin-hosting potential but would consume the first release in infrastructure; Tauri adds a Rust bridge without improving Chromium audio capabilities. Third-party plugins are explicitly deferred.
