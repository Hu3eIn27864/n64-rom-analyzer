# Phase 2.3 — Implementation Record

Status: **IMPLEMENTED — ISOLATED FROM THE PRODUCTION PIPELINE**

## Confirmed defect

`engine/mips/reachability.ts` previously invoked `decodeInstruction(0, address)`. The canonical decoder accepts the word supplied by its caller and preserves it as `raw`, so the defect was at the reachability input boundary, not in the decoder adapter.

## Implemented boundary

```ts
type InstructionWordReader = (address: number) => number;
```

`discoverReachableCode()` requires a reader and passes the returned ROM word to `decodeInstruction(word, address)`.

`createRomInstructionWordReader()` provides an explicit big-endian, bounds-checked ROM-backed implementation with a configurable ROM base address.

## Regression coverage

`tests/analysis/reachability.test.ts` covers:

- actual ROM words are decoded;
- different addresses preserve different ROM words;
- unaligned addresses are rejected;
- out-of-range addresses are rejected;
- non-zero ROM bases are explicit and deterministic.

These tests are part of the full unit-test and Analysis Regression CI workflows and have passed on the current mainline test suite.

## Required invariant

For every emitted reachable instruction:

```text
instruction.raw === ROM.readUint32BE(address)
```

subject to the explicit address-to-ROM mapping supplied to the reader.

## Integration rule

This phase repairs the canonical reachability component only. It does **not** switch the production API to the canonical pipeline. The component remains isolated until the canonical runtime pipeline consumes this reader.

## Acceptance status

- [x] Reachability never decodes a hard-coded zero word.
- [x] Every decoded instruction originates from the supplied ROM word reader.
- [x] Address validation is deterministic and testable.
- [x] Tests cover normal, invalid, unaligned, and distinct-word cases.
- [x] Existing reachability target handling remains intact.
- [x] The integration boundary is documented.
- [x] No authoritative evidence status is changed by this repair alone.
- [ ] Canonical production-pipeline integration remains open.
