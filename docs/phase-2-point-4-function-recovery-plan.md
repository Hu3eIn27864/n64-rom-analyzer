# Phase 2.4 — Function Recovery Stabilization

Status: **IMPLEMENTED — NOT YET INTEGRATED**

## Objective

Make canonical function recovery deterministic, re-entrant, and correctly dependent on the repaired ROM-backed reachability boundary.

## Implementation

`recoverFunctions()` uses only call-local state:

- local reachable-instruction index;
- local discovered-address set and work queue;
- local function-result map;
- deterministic address-sorted output;
- deduplicated, sorted caller/callee relationships.

No mutable result map is stored on the function or shared between invocations. The `InstructionWordReader` and `ReachabilityOptions` are passed unchanged to `discoverReachableCode()`.

Function confidence remains inference metadata. A `JR $ra` return is recorded as structural evidence; it is not behavioral or binary verification.

## Verification evidence

The canonical tests in `tests/analysis/functionRecovery.test.ts` cover:

- isolation between sequential invocations with different roots;
- identical structured output for repeated identical inputs;
- direct JAL callee discovery;
- deduplicated caller/callee relationships;
- explicit JR $ra termination;
- confidence remaining separate from verification status.

The full repository CI and Analysis Regression gates execute the analysis tests.

## Acceptance status

- [x] No function-level mutable recovery state exists.
- [x] Same input produces deterministic structured results.
- [x] Separate calls are isolated.
- [x] Direct JAL callees are discovered consistently.
- [x] Caller/callee relationships are deduplicated and deterministic.
- [x] Return detection remains explicit.
- [x] Confidence remains non-authoritative inference.
- [x] Tests cover the above cases.
- [x] Function Recovery is classified IMPLEMENTED after CI execution.
- [ ] Function Recovery is not INTEGRATED until the canonical production pipeline consumes it.

## Non-goals

- No CFG redesign.
- No call-graph redesign beyond deterministic local recovery metadata.
- No production pipeline cutover.
- No evidence status promotion.
