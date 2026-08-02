# ADR 0002: Shared clip sources

Status: accepted — 2026-08-01

Session slots and arrangement blocks reference the same clip IDs. A clip owns MIDI steps or recorded/imported PCM. Arrangement blocks store only position, length, and source reference. Edits therefore appear in pattern, session, and arrangement contexts without copied musical data. Duplication is an explicit command that creates a new clip ID.
