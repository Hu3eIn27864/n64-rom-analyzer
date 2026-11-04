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
- [ ] Formal instruction semantics integration.
- [ ] Broader malformed-ROM and endian test corpus.
**Estimate for hardening:** 3–6 weeks.

## M2 — Structural analysis (implemented; validation expansion)
- [x] Reachable-code discovery.
- [x] Function recovery.
- [x] Canonical CFG and call graph.
- [ ] Validate indirect control flow, jump tables and delay-slot edge cases.
- [ ] Expand golden tests across multiple synthetic programs.
**Estimate:** 1–3 months.

## M3 — Semantic analysis and memory model (in progress)
- [x] Canonical Micro-C IR.
- [x] Evidence-driven type inference.
- [ ] Formal MIPS semantics integration.
- [ ] Memory SSA/data-flow analysis.
- [ ] Stronger pointer, alias and interprocedural memory reasoning.
**Estimate:** 3–6 months.

## M4 — Structured source generation (not complete)
- [ ] Structured C AST generation.
- [ ] Control-flow structuring for loops, branches and irreducible graphs.
- [ ] Stable expression and statement lowering.
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
| Months 2–3 | M2 validation | Stable CFG/function recovery tests |
| Months 3–6 | M3 | Memory data-flow prototype |
| Months 6–12 | M4 | First structured C output for constrained cases |
| Months 12–18+ | M5 | Independent verification prototype and test corpus |

## Verification policy

Use the levels defined in [verification-levels.md](verification-levels.md): parsed (L0), decoded (L1), structurally analyzed (L2), semantically inferred (L3), behaviorally verified (L4) and binary verified (L5). Confidence is not a substitute for verification.

## Scope controls

- Unknown instructions and uncertain code/data boundaries remain explicit.
- Keep experimental and legacy paths separate from canonical analysis contracts.
- Do not claim general source-level decompilation from disassembly or CFG recovery alone.
- Keep commercial ROMs outside version control; use synthetic and legally distributable fixtures.
