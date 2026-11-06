# Phase 2 — Engine Integration & Truth Audit

Status: **IN PROGRESS — UPDATED 2026-11-06**

## Purpose

Classify each analysis layer as implemented, integrated, isolated, partial, experimental or unverified. Implementation and tests do not imply production integration or behavioral verification.

## Classification

- **IMPLEMENTED** — code exists and meaningful tests pass.
- **INTEGRATED** — the capability participates in the canonical production runtime path.
- **ISOLATED** — code exists and may be tested, but the production path does not consume it.
- **PARTIAL** — only a constrained subset exists.
- **EXPERIMENTAL** — provisional or non-authoritative.
- **NOT VERIFIED** — no sufficient evidence yet.

## Current findings

| Area | Current state | Evidence / remaining boundary |
|---|---|---|
| ROM parsing and byte order | IMPLEMENTED / LEGACY-INTEGRATED | Legacy parser is active. Canonical ROM helpers have synthetic tests for z64/v64/n64 normalization, malformed signatures, header bounds and subarray offsets; the full canonical ROM model is not yet the API authority. |
| Canonical decoder | IMPLEMENTED / ISOLATED | engine/mips/decoder.ts is a tested adapter over the legacy decoder; full decoder corpus parity remains a gate. |
| Reachability | IMPLEMENTED / ISOLATED | Requires an injected ROM-word reader, rejects invalid/unaligned/out-of-range reads and preserves actual instruction words. |
| Function recovery | IMPLEMENTED / ISOLATED | Uses call-local state; deterministic repeated calls, invocation isolation, direct JAL, caller/callee deduplication and JR $ra termination are tested. Confidence remains inference metadata. |
| Canonical CFG | IMPLEMENTED / ISOLATED | engine/mips/cfgBuilder.ts builds canonical blocks and edges; production API still consumes legacy extraction/CFG. |
| Canonical call graph | IMPLEMENTED / ISOLATED | Deterministic direct/heuristic edge construction exists; not yet the API's authoritative graph. |
| Micro-C / VR4300 semantics | PARTIAL / ISOLATED | Supported integer, memory, HI/LO and COP1 subsets lower to Micro-C. Unsupported CP0, TLB, ERET, exception, SYNC and CACHE operations remain explicit diagnostics. |
| Formal MIPS semantics metadata | PARTIAL / ISOLATED | Descriptive register/memory/control metadata exists, including merge and linked memory operations; it is not a complete formal ISA model or the canonical execution engine. |
| Memory SSA / alias analysis | PARTIAL / ISOLATED | Memory state merge, memory-Phi validation and basic address-confidence scaffolding exist. A CFG-driven reaching-definition/fixed-point analysis and general alias model remain incomplete. |
| Structured C AST | PARTIAL / ISOLATED | C AST/rendering and narrow proof-gated branch/loop lowering exist. General reducible/irreducible CFG structuring and broad semantic lowering remain incomplete. |
| Production API | LEGACY-INTEGRATED | server.ts calls synchronous analyzeRom() from engine/pipeline.ts; that function currently uses legacy parsing, linear-sweep disassembly and subroutine extraction. |
| Evidence model | IMPLEMENTED / ISOLATED | engine/analysis/evidence.ts defines stage statuses and summary helpers, but the production API does not yet construct/expose the evidence summary. |
| CI | INTEGRATED | CI runs canonical ROM/decoder typecheck, full unit suite and production build; Analysis Regression separately runs its typecheck and regression suite. |
| Differential behavioral verification | NOT IMPLEMENTED | No independent execution-backed comparison is wired as an acceptance gate. |
| Real toolchain rebuild / binary verification | NOT IMPLEMENTED | No complete compile/link/rebuild comparison pipeline is present. |

## Phase 2 progress

1. Runtime trace: complete. The production API still executes the legacy/mature path.
2. Canonical-vs-legacy inventory: complete and updated with the current boundary.
3. Reachability input boundary: implemented and tested; not production-integrated.
4. Function recovery stabilization: implemented and tested; not production-integrated.
5. Canonical pipeline integration and parity: next major integration checkpoint.
6. Evidence API/UI wiring: blocked on a stable canonical result contract.
7. CI: present and passing on the recent mainline changes.

## Rules

- Do not label an isolated component INTEGRATED.
- Do not treat decoder coverage as semantic coverage.
- Do not treat generated C as behaviorally verified without independent execution.
- Do not treat a source-level resemblance or copied bytes as a binary rebuild.
- Keep commercial ROMs and copyrighted assets out of the repository; use synthetic or legally redistributable fixtures.

## Next checkpoint

Create a side-by-side canonical analysis path for deterministic synthetic ROMs. Compare decoded instructions, reachable addresses, recovered function boundaries and CFG edges against the existing legacy pipeline before considering any production API cutover.
