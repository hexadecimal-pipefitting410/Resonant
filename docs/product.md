# Resonant 0.3 product contract

Resonant is a compact Windows music workstation for creating an original piece from a blank project. Its three workspaces are Flow (clips plus pattern/piano-roll editor), Arrange (linear song), and Mix (levels, pan, delay, automation). They share one project and one set of clip sources.

## Release workflows

1. Start blank, choose a track and clip, program notes, press Play, and hear built-in drum/synth voices or an installed sampled instrument.
2. Launch clips by track or scene with beat quantization; capture the active combination into the arrangement.
3. Place, move, resize, and remove clip references on the arrangement timeline.
4. Arm the audio track and capture microphone audio, or import a WAV/audio file, then launch and arrange it non-destructively.
5. Mix with volume, pan, mute, solo, per-track delay, a master limiter, and clip-level volume automation.
6. Undo/redo edits, atomically save/open `.resonant` projects, use autosave recovery, and export deterministic 44.1 kHz stereo WAV.
7. Connect Codex or Claude Code through the local MCP server to create, inspect, compose, arrange, mix, analyze, render, and recover saved projects without raw JSON editing.
8. Install GeneralUser GS or WebAudioFont presets, or import SF2/SF3/DLS/SFZ/audio instruments, once into a shared library and reuse them without inflating project files.
9. Develop section-tagged lyrics, generate vocals or instrumentals through a durable optional ACE-Step job, and run technical/approximate transcript checks before listening approval.

## Compatibility and limits

- Windows 10/11 x64; stereo output; OS-selected default input/output; 44.1/48 kHz live engine; exported WAV is stereo 44.1 kHz/16-bit. External MIDI device capture and per-device selection are deferred; the piano roll and step editor remain fully usable by pointer/keyboard.
- Projects use schema version 1. Audio is content-addressed in one shared library to avoid project bloat; legacy embedded media remains readable. A missing shared asset produces an actionable error without replacing the working project.
- VST/AU plugin hosting, comping, tempo maps, side-chain buses, score notation, and multi-channel recording remain outside 0.3.
- Agent mode operates on saved project files and can deterministically render installed SF2/SF3/DLS presets. WebAudioFont and compressed user-sample rendering is desktop-only in 0.3; live transport control, microphone capture, and unsaved UI state remain outside agent mode.
