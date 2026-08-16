# Phase 2.4 — Function Recovery Stabilization

Status: **PLANNED / READY TO IMPLEMENT**

## Objective

Make canonical function recovery deterministic, re-entrant, and correctly dependent on the repaired ROM-backed reachability boundary.

## Current risks

`recoverFunctions()` currently stores intermediate results on `recoverFunctions._results`, a mutable function-level map. This creates unnecessary shared state and makes nested, repeated, or concurrent analysis unsafe.

Function discovery also currently treats every recovered linear sequence as a function candidate and derives confidence from whether the sequence ends in `JR $ra`; this must remain explicit evidence rather than becoming authoritative verification.

## Design

Use local state only:

```text
recoverFunctions(...)
   ├── reachability result
   ├── local discovered set
   ├── local work queue
   ├── local function map
   └── deterministic sorted output
```

No mutable state may survive the call.

## Implementation steps

1. Remove `recoverFunctions._results`.
2. Replace it with a local `Map<number, RecoveredFunction>`.
3. Preserve deduplication by entry address and deterministic ordering.
4. Keep `InstructionWordReader`/`ReachabilityOptions` flowing unchanged into `discoverReachableCode()`.
5. Make call/callee discovery deterministic and ensure caller lists are deduplicated.
6. Add tests proving two sequential calls cannot contaminate each other.
7. Add tests proving repeated recovery with the same input produces identical results.
8. Add a regression test for direct `JAL` discovery.
9. Add a regression test for `JR $ra` function termination.
10. Document confidence/evidence as inference metadata, not verification.

## Acceptance criteria

- [ ] No function-level mutable recovery state exists.
- [ ] Same input produces byte-for-byte equivalent structured results.
- [ ] Separate calls are isolated.
- [ ] Direct JAL callees are discovered consistently.
- [ ] Caller/callee relationships are deduplicated and deterministic.
- [ ] Return detection remains explicit.
- [ ] Confidence remains non-authoritative inference.
- [ ] Tests cover all above cases.
- [ ] Phase-2 audit changes Function Recovery from PARTIAL to IMPLEMENTED only after test execution.
- [ ] Do not mark Function Recovery INTEGRATED until the canonical production pipeline consumes it.

## Non-goals

- No CFG redesign.
- No call-graph redesign beyond deterministic local recovery metadata.
- No production pipeline cutover.
- No evidence status promotion.
