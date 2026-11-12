# Phase 2.4 — Function Recovery Stabilization

Status: **IMPLEMENTED — INTEGRATED INTO THE CANONICAL STRUCTURAL AND MAPPED-PROGRAM ANALYSIS PATHS; LEGACY API CUTOVER REMAINS OPEN**

## Objective

Make canonical function recovery deterministic, re-entrant, and correctly dependent on the repaired ROM-backed reachability boundary.

## Implementation

recoverFunctions() uses only call-local state:

- local reachable-instruction index;
- local discovered-address set and work queue;
- local function-result map;
- deterministic address-sorted output;
- deduplicated, sorted caller/callee relationships.

Control-transfer delay slots are retained in recovered function ranges. A JR $ra terminator is recognized together with its delay slot; confidence is based on the terminator evidence rather than the final delay-slot instruction.

No mutable result map is stored on the function or shared between invocations. The InstructionWordReader and ReachabilityOptions are passed unchanged to discoverReachableCode().

Function confidence remains inference metadata. A JR $ra return is structural evidence; it is not behavioral or binary verification. Direct intra-function jumps are followed as CFG edges; direct calls remain separate callees, and unresolved indirect control transfers remain explicit diagnostics.

## Verification evidence

The canonical tests in tests/analysis/functionRecovery.test.ts cover:

- isolation between sequential invocations with different roots;
- identical structured output for repeated identical inputs;
- direct JAL callee discovery;
- deduplicated caller/callee relationships;
- inclusion of call and return delay slots;
- explicit JR $ra termination;
- confidence remaining separate from verification status.

The full repository CI and Analysis Regression gates execute the analysis tests.

## Acceptance status

- [x] No function-level mutable recovery state exists.
- [x] Same input produces deterministic structured results.
- [x] Separate calls are isolated.
- [x] Direct JAL callees are discovered consistently.
- [x] Caller/callee relationships are deduplicated and deterministic.
- [x] Return delay slots are included in function boundaries.
- [x] Confidence remains non-authoritative inference.
- [x] Tests cover the above cases.
- [x] Function Recovery is classified IMPLEMENTED after CI execution.
- [x] Function Recovery is consumed by `analyzeCanonicalStructure()` and `analyzeMappedRomProgram()` for explicit mapped entry points.
- [ ] Full production API cutover and automatic ROM segment/function-entry discovery remain open.

## Non-goals

- No general CFG redesign.
- No call-graph redesign beyond deterministic local recovery metadata.
- No production pipeline cutover.
- No evidence status promotion.
