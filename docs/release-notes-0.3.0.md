# Resonant 0.3.0

Resonant 0.3 turns the original drum/synth workstation into a general instrument platform.

## Highlights

- General-purpose multi-zone sampler with pitch, velocity, gain, tuning, loop, one-shot, envelope, pan, delay, and offline export support.
- Shared instrument library stored outside projects, with live size/preset counts and pack removal.
- One-click GeneralUser GS download and indexing (287 presets in the current canonical bank).
- Search and per-preset installation from the 3,000+ WebAudioFont catalog.
- User imports for SF2, SF3, DLS, SFZ, WAV, OGG, MP3, FLAC, and M4A.
- SpessaSynth SoundFont playback is lazy-loaded so built-in-synth startup stays light.
- Track Inspector instrument chooser and first-run library entry point.
- MCP `list_instruments` and `set_track_instrument` tools, plus deterministic SoundFont mix analysis and WAV rendering.
- Missing shared packs fall back safely during live playback; schema-version-1 projects remain compatible.

## Validation

- 20 unit/domain tests pass, including SFZ inheritance and project instrument references.
- Real GeneralUser GS download indexed 287 presets; a rendered violin note produced non-silent stereo PCM.
- Real WebAudioFont Slow Violin installation resolved 28 encoded sample zones.
- Real SFZ import copied and resolved its referenced WAV sample.
- MCP smoke covers discovery, assignment, deterministic SoundFont rendering, revision conflicts, path confinement, analysis, and undo.
- Electron smoke covers the first-run library UI plus Flow, audio import/record, Arrange, Mix, save/open/recovery, playback, and WAV export.
