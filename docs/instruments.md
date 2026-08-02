# Instrument library

Resonant 0.3 adds a general-purpose sampler and shared instrument library. A `.resonant` project stores only the installed instrument ID, preset, and normal track controls. The SoundFont, SFZ, and sample data is not embedded or duplicated between projects.

## Easiest setup

1. Open the library icon at the top right.
2. Choose **Install GeneralUser GS**. This downloads about 31 MB once and indexes roughly 287 presets, including pianos, guitars, basses, strings, violin, brass, woodwinds, ethnic instruments, percussion, and drum kits.
3. Select a MIDI track. In Inspector → Sound → Instrument, choose the preset.
4. Draw notes as usual. Flow, Arrange, Mix, live playback, project saving, and WAV export all use that instrument.

Use the WebAudioFont search for alternate violin, guitar, flute, tabla, piano, drum, and orchestral colors. Each result is installed independently, so a search does not download the entire 3,000-preset catalog. There is no application-imposed pack-size limit; free disk space and upstream server limits still apply.

## Importing your own instruments

- SF2, SF3, and DLS banks are indexed into their individual presets through SpessaSynth.
- SFZ imports copy the definition's referenced samples into one managed pack. Resonant supports the essential key, velocity, tuning, gain, one-shot, and loop opcodes; unsupported SFZ effects are ignored.
- WAV, OGG, MP3, FLAC, and M4A can become a chromatically pitched single-sample instrument rooted at middle C.

The default location is the Electron application-data directory under `instrument-library`. Set `RESONANT_INSTRUMENT_ROOT` before launching Resonant and its MCP server to use another drive. Removing a pack does not corrupt projects; the desktop falls back to the built-in track voice until that instrument is installed again.

## MCP

`list_instruments` exposes installed IDs and families. `set_track_instrument` assigns or clears one in a revision-checked project transaction. MCP deterministic analysis/render supports installed SF2, SF3, and DLS presets. The desktop app additionally decodes SFZ and WebAudioFont sample data for live playback and export. MCP never downloads or removes packs; use the desktop library manager for those state-changing operations.
