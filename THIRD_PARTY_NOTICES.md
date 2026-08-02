# Third-party notices

Resonant is distributed under the GNU Affero General Public License v3.0 only. The canonical terms are in `LICENSE`. This license covers the Resonant software and does not claim ownership of original music created with it. Optional models, instrument packs, and imported media retain their respective licenses.

The installer bundles no sample packs, AI model weights, fonts, photos, or external media. Optional instrument packs and ACE-Step files are downloaded or imported by the user into separate shared libraries and retain their own notices and source metadata.

The generated starter groove is project code/data and contains no third-party samples.

Runtime components:

- Electron — MIT License; Copyright OpenJS Foundation and Electron contributors.
- React and React DOM — MIT License; Copyright Meta Platforms, Inc. and affiliates.
- Lucide — ISC License; Copyright Lucide Contributors.
- pinyin-pro — MIT License; Copyright zh-lx and contributors. Used locally for Standard Mandarin pronunciation finals and rhyme analysis.

Build and agent-development components include Vite, TypeScript, Vitest, electron-builder, esbuild, the Model Context Protocol TypeScript SDK, and Zod under their respective permissive licenses. The MCP SDK and Zod are bundled into the locally built agent server but are not included in exported music. Complete transitive license metadata is available in `node_modules` after `npm install`.

Additional runtime and optional instrument sources:

- spessasynth_core — Apache License 2.0; Copyright Spessasus contributors. Used for SF2/SF3/DLS indexing and synthesis.
- WebAudioFont catalog/project code — MIT License. Individual preset sample provenance varies and is identified by the selected bank.
- GeneralUser GS — downloaded from its canonical repository; its included license permits use and redistribution subject to the accompanying terms.
- ACE-Step 1.5 — optional source/runtime downloaded from the official ACE-Step repository under its MIT License. Model files retain the licenses and notices published with their official repositories.
- OpenAI Whisper — optional `tiny.en` or `base.en` model downloaded only when local vocal-transcript analysis is explicitly requested; model and code are published under the MIT License.
