# Reproducible analysis baseline

Commit 01 establishes a small, deterministic fixture that can be used to record the analyzer's current behavior before architectural changes.

## Golden fixture

`tests/fixtures/golden/` contains a synthetic N64 big-endian (`z64`) ROM. It is intentionally not a bootable commercial ROM and does not claim to have valid N64 checksums.

The fixture contains two functions:

- entry at `0x1000`, calling `0x1040`
- `0x1040`, computing `v0 = a0 + a1`

The expected semantic result is `30` for `a0 = 10` and `a1 = 20`.

## Baseline test

`tests/baseline.test.ts` regenerates the fixture, validates its header and instruction words, and checks the expected analysis contract. The generated binary is removed after the test so the repository stays source-only and deterministic.

This test is deliberately independent of the UI and does not assert unverified decompiler or byte-match claims.
