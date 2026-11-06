# Phase 2.2 — Canonical vs Legacy Inventory

Status: **COMPLETE — AUDIT ONLY**

## Objective

Inventory the competing analysis implementations and determine which one is actually authoritative at runtime. This phase does **not** delete or replace legacy code. It establishes the migration boundary from observed repository usage.

## Current findings

| Capability | Legacy implementation | Canonical implementation | Current status | Decision |
|---|---|---|---|---|
| ROM parsing | src/utils/n64Parser.ts and legacy parser helpers | engine/rom/* | Legacy parser remains active in the production API path; canonical header/address components are tested | Preserve compatibility and add parity fixtures before cutover. |
| MIPS decoding | src/utils/mipsDisassembler.ts | engine/mips/decoder.ts | Canonical API is an adapter over legacy decoding; it is not yet the production boundary | Keep the adapter and require corpus parity before replacement. |
| Reachability | Linear sweep / legacy extraction | engine/mips/reachability.ts | Implemented with an explicit ROM-word reader and bounds checks; isolated from production API | Integration remains open. |
| Function recovery | src/utils/subroutineExtractor.ts | engine/mips/functionRecovery.ts | Deterministic local-state implementation with isolation, JAL, return and deduplication tests; isolated | Integration remains open. |
| CFG | src/utils/controlFlowGraph.ts | engine/mips/cfgBuilder.ts | Canonical builder exists and is tested; production API still uses legacy extraction/CFG | Compare canonical and legacy graphs before cutover. |
| Call graph | Legacy-derived relationships | engine/mips/callGraph.ts | Canonical call-graph builder exists; isolated from the production API | Require relationship parity tests. |
| IR / Micro-C | Existing decompiler/lifting infrastructure | engine/ir/* | Canonical IR and a growing VR4300 semantic subset exist; unsupported operations remain explicit | Continue semantic coverage and fail-closed diagnostics. |
| Formal semantics | Legacy semantic utilities | engine/mips/formalSemantics.ts | Partial descriptive metadata; not a complete ISA semantics engine and not wired as runtime authority | Expand by instruction family with architecture-specific tests. |
| Memory/data flow | Legacy alias-analysis utilities | engine/ir/memoryState.ts, memoryPhi.ts, memorySsa.ts | Small isolated primitives/prototypes exist; no complete CFG-driven Memory SSA or general alias analysis | Do not mark M3 complete. |
| Structured C | Existing experimental C/decompiler paths | engine/ir/cAst.ts, engine/decompiler/structuredC.ts and proof modules | AST/rendering and narrow proof-gated lowering exist; general control-flow structuring is incomplete | Keep unsupported CFG shapes rejected. |
| Evidence | N/A in legacy path | engine/analysis/evidence.ts | Evidence types/helper exist but are not constructed and exposed by the production API | Wire only after the canonical pipeline boundary is authoritative. |

## Runtime authority

The HTTP endpoint in server.ts imports the synchronous analyzeRom() export from engine/pipeline.ts. That function currently calls the legacy ROM parser, linear-sweep disassembler and subroutine extractor. The separate asynchronous analyzeRomReal() path also uses legacy parser/disassembler/extractor/type and semantic utilities.

Therefore the canonical engine components are **not production-integrated** merely because they exist under engine/ or have passing tests.

## Migration order

1. Preserve ROM parser/decoder compatibility and build parity fixtures.
2. Integrate ROM-backed reachability and deterministic function recovery behind a non-default analysis path.
3. Compare canonical and legacy CFG/call-graph output on synthetic fixtures.
4. Integrate Micro-C and formal semantics only for explicitly supported instruction families.
5. Add memory data-flow with explicit alias uncertainty and CFG join semantics.
6. Wire evidence aggregation into the analysis result and API.
7. Promote the canonical path only after parity and regression gates pass.

## Cutover rules

- No legacy module is deleted merely because a canonical replacement exists.
- A canonical module is not authoritative merely because it has tests.
- Each migration requires input/output parity tests against the current mature implementation where applicable.
- Inferred or unverified results remain non-authoritative through the evidence layer.
- Runtime imports decide INTEGRATED; directory placement does not.

## Acceptance status

- [x] Legacy and canonical implementations identified.
- [x] Runtime consumers identified.
- [x] Migration order and cutover rules documented.
- [x] Reachability repaired and tested (Phase 2.3), but isolated.
- [x] Function recovery stabilized and tested (Phase 2.4), but isolated.
- [ ] Canonical pipeline cutover performed.
- [ ] Evidence exposed through the production API/UI.

## Next

Proceed to **Phase 2.5 — Canonical pipeline integration and parity**. Do not switch the production API wholesale; first introduce a side-by-side canonical analysis result on deterministic synthetic fixtures and compare it with the legacy output.
