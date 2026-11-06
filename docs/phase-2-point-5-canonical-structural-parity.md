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

A separate bounded function path is available through engine/analysis/romFunctionAnalysis.ts. It composes decodeRomFunctionCfg(), lowerRomCfgToFunctionIR() and buildMemorySSAFromFunctionIR() for an explicit ROM offset/address entry.

## Verified parity and semantic slices

Synthetic fixtures compare canonical function boundaries with the legacy extractSubroutines() implementation for:

- a direct JAL call with a delay slot and separate callee;
- multiple direct JAL calls from one function;
- a conditional branch with fallthrough, target and return delay slot;
- a branch-likely (BEQL) function with delay-slot coverage.

The bounded ROM-function CFG additionally models branch-likely annulment as a taken-only delay-slot block. Its lowered Micro-C branch targets the delay-slot block on the taken path and the fallthrough block on the not-taken path.

Separate tests verify canonical CFG composition, direct JAL edges, unknown JALR edges, stack store/load Memory SSA and branch-likely lowering.

## Explicit limitations

This is not full legacy parity and is not a production API cutover.

Still open:

- broad CFG edge parity;
- indirect calls, tail calls and jump tables;
- exception and privileged control flow;
- ROM segment discovery and complete ROM-to-VRAM mapping from real program evidence;
- robust function-entry discovery for arbitrary ROMs;
- side-by-side analysis result exposure through the API;
- evidence aggregation and user-facing verification levels.

## Acceptance status

- [x] Canonical structural pass composes recovery, CFG and call graph.
- [x] Explicit entry points and ROM-word reader are required.
- [x] Control-transfer delay slots are retained.
- [x] Direct-call, multiple-call, conditional-branch and branch-likely function-boundary parity fixtures pass.
- [x] Bounded ROM CFG models branch-likely annulled delay slots.
- [x] ROM CFG lowers to Micro-C and Memory SSA for explicit entries.
- [x] Unknown indirect-call edges remain explicit.
- [ ] Broader canonical/legacy CFG and call-graph parity.
- [ ] Side-by-side canonical results exposed by the analysis API.
- [ ] Production cutover after parity and ROM mapping gates.

## Next checkpoint

Expand the synthetic parity corpus to cover nested control flow, indirect calls, jump tables and CFG edge identity. Define a safe way to discover/prove ROM segment mappings and function entries before production integration.
