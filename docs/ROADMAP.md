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
- [x] Canonical VR4300 decoder API and expanded decode corpus.
- [x] Synthetic coverage for z64/v64/n64 normalization, malformed byte-order signatures, incomplete headers and byte-offset views.
- [ ] Formal instruction semantics integration. A partial descriptive metadata layer exists; complete instruction semantics and runtime integration remain open.
- [ ] Broader malformed-ROM and endian corpus, including segment and address-map edge cases.
**Estimate for hardening:** 3–6 weeks.

## M2 — Structural analysis (implemented; validation expansion)
- [x] ROM-backed reachable-code discovery with explicit word reader and MIPS delay-slot decoding (isolated).
- [x] Deterministic function recovery with caller/callee relationships and return delay-slot inclusion (isolated).
- [x] Canonical CFG and call graph components.
- [x] Canonical structural pipeline composing recovery, CFG and call graph.
- [x] Narrow legacy-parity fixtures for direct-call and conditional-branch function boundaries.
- [ ] Broader CFG/edge parity for branch-likely, indirect control flow, jump tables and exceptional paths.
- [ ] Production-pipeline integration.
**Estimate:** 1–3 months.

## M3 — Semantic analysis and memory model (in progress)
- [x] Canonical Micro-C IR.
- [x] Evidence-driven type inference.
- [x] Conservative block-local memory definition/use versions.
- [x] Acyclic CFG Memory SSA with reaching definitions and MemoryPhi nodes at conflicting joins.
- [ ] Loop-carried memory definitions and fixed-point Memory SSA.
- [ ] Byte-range overlap, pointer aliasing and interprocedural memory reasoning.
- [ ] Formal MIPS semantics integration.
**Estimate:** 3–6 months.

## M4 — Structured source generation (not complete)
- [x] C AST and source renderer primitives.
- [x] Narrow proof-gated branch/loop lowering for supported shapes.
- [ ] General control-flow structuring for loops, branches and irreducible graphs.
- [ ] Stable expression and statement lowering across the supported semantic subset.
- [ ] Compile generated C with a real toolchain.
**Estimate:** 3–6 months.

## M5 — Independent verification (not complete)
- [ ] Execution-backed differential tests for selected functions.
- [ ] Rebuild/link pipeline for supported fixtures.
- [ ] Separate behavioral and binary verification reports.
- [ ] Regression corpus with documented ROM provenance and legal test status.
**Estimate:** 3–9 months initially; ongoing thereafter.

## Near-term schedule

| Period | Focus | Deliverable |
|---|---|---|
| Weeks 1–4 | M1 hardening | Expanded decoder/ROM fixtures |
| Months 2–3 | M2 integration and validation | Broader side-by-side canonical/legacy parity on synthetic programs |
| Months 3–6 | M3 | Loop-capable CFG memory data-flow prototype |
| Months 6–12 | M4 | First structured C output for constrained cases |
| Months 12–18+ | M5 | Independent verification prototype and test corpus |

## Verification policy

Use the levels defined in [verification-levels.md](verification-levels.md): parsed (L0), decoded (L1), structurally analyzed (L2), semantically inferred (L3), behaviorally verified (L4) and binary verified (L5). Confidence is not a substitute for verification.

## Scope controls

- Unknown instructions and uncertain code/data boundaries remain explicit.
- Keep experimental and legacy paths separate from canonical analysis contracts.
- Do not claim general source-level decompilation from disassembly or CFG recovery alone.
- Keep commercial ROMs outside version control; use synthetic and legally distributable fixtures.
