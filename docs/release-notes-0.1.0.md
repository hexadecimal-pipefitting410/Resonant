# Resonant 0.1.0

Initial Windows release.

- Four-slot clip launcher with scene launch and per-track stop.
- 16-step drum editor, melodic piano roll, note velocity, and clip-volume automation.
- Built-in drum voices and four-wave subtractive synth with attack, release, and filter controls.
- Linear arrangement made from shared, looping clip references with place, move, resize, duplicate, delete, and editable transport loop-region commands.
- Microphone capture and embedded audio import, gain, and non-destructive trim.
- Mixer with level, pan, mute, solo, delay sends, audio arming, and a stereo soft-limited master.
- Versioned project save/open, 80-step undo/redo history, autosave recovery, and deterministic stereo WAV export.
- Conventional per-user Windows installer plus a zero-install portable executable.

Known non-blocking limitations: default system input/output only; one tempo and 4/4 meter per project; audio is embedded rather than referenced; no VST hosting or external MIDI device capture; unsigned Windows binaries. The portable build takes about 16 seconds to launch on the reference machine because it extracts the application on every start; use the installer for a roughly 2-second installed launch.
