# Phase 2.3 — Repair the Reachability Input Boundary

Status: **PLANNED / READY TO IMPLEMENT**

Branch: `phase-2-point-2`

## Problem

`engine/mips/reachability.ts` currently calls `decodeInstruction(0, address)`. The canonical decoder therefore receives a constant zero instruction word instead of the ROM word located at the current address. The reachability graph can consequently appear structurally valid while being semantically disconnected from the ROM bytes.

## Goal

Make reachability consume an explicit, deterministic ROM-word source while keeping the reachability algorithm independent from HTTP/UI/application code.

## Design

Introduce an explicit word-reader boundary:

```text
ROM bytes / segment source
        |
        v
readWord(address)
        |
        v
decodeInstruction(actualWord, address)
        |
        v
reachability
```

The reader should:

- return the actual big-endian 32-bit MIPS word for a valid ROM address;
- reject unaligned or out-of-range addresses;
- make the ROM-to-address mapping explicit rather than hidden in global state;
- remain injectable for unit tests;
- preserve `ReachabilityOptions` compatibility where practical.

## Implementation steps

1. Define a small `InstructionWordReader` type/function contract.
2. Add a ROM-segment-backed reader that uses `Uint8Array`/`DataView` and explicit ROM base/address mapping.
3. Change `discoverReachableCode()` to require/use the reader and pass its returned word to `decodeInstruction()`.
4. Preserve invalid-target and unknown-target reporting.
5. Add tests proving two different ROM words at two addresses produce different decoded instructions.
6. Add tests for unaligned and out-of-range reads.
7. Add a regression test that fails if `decodeInstruction(0, address)` is reintroduced.
8. Update Phase-2 audit status from BROKEN to IMPLEMENTED once tests pass; do not mark INTEGRATED until the canonical pipeline consumes reachability.

## Non-goals

- Do not yet replace the production legacy linear sweep.
- Do not yet redesign function recovery.
- Do not infer VRAM mappings beyond the explicit segment model.
- Do not mark decoded instructions `VERIFIED` merely because they came from ROM bytes; verification evidence is a separate phase.

## Acceptance criteria

- [ ] Reachability never decodes a hard-coded zero word.
- [ ] Every decoded instruction originates from the supplied ROM word reader.
- [ ] Address validation is deterministic and testable.
- [ ] Tests cover normal, invalid, unaligned, and distinct-word cases.
- [ ] Existing reachability target handling remains intact.
- [ ] Audit documents the exact integration boundary.
- [ ] No authoritative evidence status is changed by this repair alone.
