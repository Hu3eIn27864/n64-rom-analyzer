# Phase 2.3 — Implementation Record

Status: **IMPLEMENTED — PENDING TEST EXECUTION**

## Confirmed defect

`engine/mips/reachability.ts` previously invoked `decodeInstruction(0, address)`. The canonical decoder accepts the word supplied by its caller and preserves it as `raw`, so the defect was at the reachability input boundary, not in the decoder adapter.

## Implemented boundary

```ts
type InstructionWordReader = (address: number) => number;
```

`discoverReachableCode()` now requires a reader and passes the returned ROM word to `decodeInstruction(word, address)`.

`createRomInstructionWordReader()` provides an explicit big-endian, bounds-checked ROM-backed implementation with a configurable ROM base address.

## Regression coverage

`tests/analysis/reachability.test.ts` covers:

- actual ROM words are decoded;
- different addresses preserve different ROM words;
- unaligned addresses are rejected;
- out-of-range addresses are rejected;
- non-zero ROM bases are explicit and deterministic.

## Required invariant

For every emitted reachable instruction:

```text
instruction.raw === ROM.readUint32BE(address)
```

subject to the explicit address-to-ROM mapping supplied to the reader.

## Integration rule

This phase repairs the canonical reachability component only. It does **not** switch the production API to the canonical pipeline. That remains Phase 2.5 after function-recovery stabilization and integration work.

## Remaining verification

- [ ] Execute the repository test suite and TypeScript checks.
- [ ] Update Phase-2 truth classification from BROKEN to IMPLEMENTED only after execution succeeds.
- [ ] Mark INTEGRATED only when the canonical runtime pipeline consumes this reader.
