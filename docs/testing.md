# Testing and quality gates

- `npm test`: pure time, project validation, command, persistence, and offline-render tests.
- `npm run check`: TypeScript and all tests.
- `npm run build`: production renderer build.
- `npm run package:win`: checks, builds, and creates the portable Windows executable.
- `npm run package:release`: runs the complete desktop and MCP gates, then creates both Windows package formats, release notes, manifest, and SHA-256 checksums.
- `npm run build:mcp`: bundles the local STDIO MCP server for Node.js 22.
- `npm run mcp:smoke`: spawns the compiled server through an MCP client and completes a blank-project-to-analyzed-WAV workflow using a generated SoundFont pack, including instrument discovery/assignment, deterministic repeat rendering, and adversarial rejection checks.
- `npm run mcp:packaged-smoke`: assembles an unpacked Windows application, verifies the license and launcher are present, then starts the 29-tool MCP server from inside `app.asar` through Resonant's embedded Node runtime.
- `npm run electron:smoke`: drives the production Electron renderer through the first-run instrument library, project creation, MIDI editing, real audio import, fake-device recording, transport and loop boundaries, arrangement editing, mixing, autosave, save/reopen, and WAV export. Set `RESONANT_SMOKE_AUDIO` to an absolute WAV path to choose the import fixture.
- `npm run mcp:audit -- <project.resonant> <output.wav> <report.json>`: inspects, validates, analyzes, and renders an existing project through the local MCP server without editing project JSON.

Reference environment: Windows 11 Home x64 (build 26200), Intel Core i9-14900HX, 32 GB RAM, Node 22.14, 44.1 kHz export. Release budgets are: installed first launch under 5 s; installed aggregate idle working set under 550 MB; audible starter-session playback with reported output latency under 100 ms; 32-bar offline render under 5 s; atomic save and reopen under 500 ms for projects without long embedded recordings. The installer is the performance-supported Windows path. The unsigned portable artifact has a functional launch gate but no startup-time budget because self-extraction and first-scan time varied from 16 to 38 seconds on the same machine.

Measured 0.1.0 results: installed first launch 2.253 s; installed aggregate working set 487,415,808 bytes across four Electron processes; portable first launch 16.753 s; live output latency 58 ms; 32-bar reference render 475 ms; atomic save 5.82 ms; reopen and validation 1.66 ms. Re-run the release gates below to produce fresh machine-local reports.

Agent-mode gates add strict MCP TypeScript checks, workspace and music-operation unit tests, Codex TOML and Claude JSON config parsing, STDIO tool/resource/prompt discovery, revision-conflict rejection, traversal rejection, schema rejection, two-render hash equality, and a desktop production-build regression check. Smoke-test reports are generated locally under the ignored `.agent/evidence/` directory.
