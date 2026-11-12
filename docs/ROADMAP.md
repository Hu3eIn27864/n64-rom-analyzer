# N64 ROM Analyzer Roadmap

This roadmap reflects the current implementation checklist and verification model. Estimates assume one developer at approximately 10–15 focused hours per week. They are planning ranges, not delivery guarantees.

## M0 — Reproducible baseline (implemented)
- [x] Synthetic big-endian N64 fixture.
- [x] Baseline fixture test.
- [x] Typecheck, test, build and analysis-regression entry points.
**Gate:** repeatable baseline on a clean checkout.

## M1 — Canonical ROM and decoder layer (implemented; continue hardening)
- [x] Canonical analysis data model.
- [x] ROM segment/address map.
- [x] Paired, equal-length, non-overlapping ROM/VRAM segment validation and integer-only address translation.
- [x] Canonical VR4300 decoder API and expanded decode corpus.
- [x] Synthetic coverage for z64/v64/n64 normalization, malformed byte-order signatures, incomplete headers and byte-offset views.
- [x] Decoder-aware descriptive register semantics for integer and COP1 instructions, including FPR/FCR/FCC data-flow metadata.
- [ ] Complete semantic integration into canonical Micro-C lifting; descriptive annotations must not be mistaken for executable semantics.
- [ ] Broader malformed-ROM and endian corpus, including segment and address-map edge cases.
**Estimate for hardening:** 3–6 weeks.

## M2 — Structural analysis (implemented; validation expansion)
- [x] ROM-backed reachable-code discovery with explicit word reader and MIPS delay-slot decoding (isolated).
- [x] Deterministic function recovery with caller/callee relationships and return delay-slot inclusion (isolated).
- [x] Canonical CFG and call graph components.
- [x] Canonical structural pipeline composing recovery, CFG and call graph.
- [x] Narrow legacy-parity fixtures for direct calls, multiple calls, conditional branches and branch-likely function boundaries.
- [x] Bounded ROM-function CFG decoding with explicit taken-only branch-likely delay-slot blocks.
- [x] Bounded ROM-function pipeline to Micro-C IR and Memory SSA for explicit entries.
- [x] Resolved direct intra-function jump targets are queued and recovered as CFG blocks; direct call targets remain separate functions.
- [x] Unresolved indirect jumps/calls are retained as explicit fatal diagnostics rather than silently terminating analysis.
- [x] Loop-region analysis validates reciprocal unique CFG edges and rejects unreachable components before dominator analysis.
- [ ] Broader CFG/edge parity for jump tables, computed indirect targets and exceptional paths.
- [ ] Full ROM segment/function-entry discovery and production API cutover.
**Estimate:** 1–3 months.

## M3 — Semantic analysis and memory model (in progress)
- [x] Canonical Micro-C IR.
- [x] Evidence-driven type inference.
- [x] Conservative block-local memory definition/use versions.
- [x] CFG Memory SSA with reaching definitions, join MemoryPhi nodes and loop-carried fixed-point propagation.
- [x] Trivial MemoryPhi collapse when predecessor versions converge.
- [x] Derive memory accesses from canonical FunctionIR loads, stores, merge operations, LL/SC and COP1 memory operations.
- [x] Normalize exact stack/frame effective addresses, including aligned merge-operation addresses.
- [x] Descriptive byte-range overlap metadata for exact stack/frame accesses (partial overlaps are not reaching definitions).
- [x] Closed-world direct-call memory-effect summaries integrated into mapped ROM program analysis, with conservative per-function CFG-aware call-clobber validation.
- [ ] Base-aware stack/frame call-effect ranges, pointer aliasing, globals and full interprocedural Memory SSA integration.
- [ ] External/device write invalidation and complete atomic memory semantics, including full LL/SC reservation-observer behavior.
- [ ] Close the gap between descriptive MIPS semantics and canonical Micro-C lifting, with explicit unsupported diagnostics for every unmodeled architectural effect.
**Estimate:** 3–6 months.

## M4 — Structured source generation (not complete)
- [x] C AST and source renderer primitives.
- [x] Narrow proof-gated branch/loop lowering for supported shapes, including explicit-preheader natural loops and header-Phi loop-carried values.
- [x] CFG-aware GPR live-in inference, including edge-specific Phi incoming uses.
- [x] Fail-closed lowering when IR contains diagnostics for omitted instruction semantics or unsupported Phi placement.
- [x] Compile generated conditional and preheader-loop C with a real C toolchain on synthetic ROM fixtures.
- [ ] General control-flow structuring for nested/composed loops, irreducible graphs and multi-block loop bodies.
- [ ] ABI-aware source-level parameter/return-type reconstruction beyond machine-state live-ins.
- [ ] Stable expression and statement lowering across the full supported semantic subset.
**Estimate:** 3–6 months.

## M5 — Independent verification (not complete)
- [ ] Execution-backed differential tests for selected functions.
- [ ] Rebuild/link pipeline for supported fixtures.
- [ ] Separate behavioral and binary verification reports.
- [ ] Regression corpus with documented ROM provenance and legal test status.
**Estimate:** 3–9 months initially; ongoing thereafter.

## Immediate integration milestones

1. Complete semantic integration for remaining VR4300 families; CP0/TLB/exception state, SYNC and CACHE remain explicitly unsupported.
2. Expand independent execution/differential fixtures beyond state-shape comparison to selected instruction sequences.
3. Extend synthetic ROM vertical slices from returns, conditional branches and simple preheader loops to nested loops and jump-table patterns.
4. Reconstruct real O32/N64 ABI signatures and validate them against known compiler-generated fixtures.

These milestones prioritize a verified vertical slice over broad but disconnected feature additions.

## Near-term schedule

| Period | Focus | Deliverable |
|---|---|---|
| Weeks 1–4 | M1 hardening | Expanded decoder/ROM fixtures |
| Months 2–3 | M2 integration and validation | Broader side-by-side canonical/legacy parity on synthetic programs |
| Months 3–6 | M3 | Byte-range alias model and interprocedural memory effects |
| Months 6–12 | M4 | First structured C output for constrained cases |
| Months 12–18+ | M5 | Independent verification prototype and test corpus |

## Verification policy

Use the levels defined in [verification-levels.md](verification-levels.md): parsed (L0), decoded (L1), structurally analyzed (L2), semantically inferred (L3), behaviorally verified (L4) and binary verified (L5). Confidence is not a substitute for verification.

## Scope controls

- Unknown instructions and uncertain code/data boundaries remain explicit.
- Keep experimental and legacy paths separate from canonical analysis contracts.
- Do not claim general source-level decompilation from disassembly or CFG recovery alone.
- Keep commercial ROMs outside version control; use synthetic and legally distributable fixtures.
