# Phase 2.5 — Canonical Structural Composition and Parity

Status: **INITIAL SLICE IMPLEMENTED — BROADER PARITY OPEN**

## Objective

Compose the canonical ROM-backed structural components without replacing the legacy production API, then establish a reproducible parity baseline against the existing extractor.

## Implemented composition

engine/analysis/structuralPipeline.ts exports analyzeCanonicalStructure(). It composes:

1. ROM-backed reachable-code discovery and function recovery;
2. canonical CFG construction for each recovered function;
3. canonical call-graph generation, retaining unknown indirect-call edges.

Entry points and the instruction-word reader/address map are explicit. The function does not guess a ROM-to-VRAM mapping and does not silently fall back to a linear sweep.

## Verified parity slice

Synthetic fixtures compare canonical function boundaries with the legacy extractSubroutines() implementation for:

- a direct JAL call with a delay slot and separate callee;
- multiple direct JAL calls from one function;
- a conditional branch with fallthrough, target and return delay slot;
- a branch-likely (BEQL) function with delay-slot coverage.

The comparisons assert function entry addresses, end addresses and instruction counts. Separate tests verify canonical CFG composition, direct JAL edges and unknown JALR edges.

## Explicit limitations

This is not full legacy parity and is not a production API cutover.

Still open:

- broad CFG edge parity;
- precise branch-likely annulment and delay-slot path semantics;
- indirect calls, tail calls and jump tables;
- exception and privileged control flow;
- ROM segment discovery and complete ROM-to-VRAM mapping;
- side-by-side analysis result exposure through the API;
- evidence aggregation and user-facing verification levels.

## Acceptance status

- [x] Canonical structural pass composes recovery, CFG and call graph.
- [x] Explicit entry points and ROM-word reader are required.
- [x] Control-transfer delay slots are retained.
- [x] Direct-call, multiple-call, conditional-branch and branch-likely function-boundary parity fixtures pass.
- [x] Unknown indirect-call edges remain explicit.
- [ ] Broader canonical/legacy CFG and call-graph parity.
- [ ] Side-by-side canonical results exposed by the analysis API.
- [ ] Production cutover after parity and regression gates.

## Next checkpoint

Expand the synthetic parity corpus to cover nested control flow, indirect calls, jump tables and CFG edge identity. Keep the legacy production path authoritative until those comparisons are stable.
