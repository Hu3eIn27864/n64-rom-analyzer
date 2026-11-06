# Phase 2.2 — Canonical vs Legacy Inventory

Status: **COMPLETE — AUDIT ONLY**

## Objective

Inventory the competing analysis implementations and determine which one is actually authoritative at runtime. This phase does **not** delete or replace legacy code. It establishes the migration boundary from observed repository usage.

## Current findings

| Capability | Legacy implementation | Canonical implementation | Current status | Decision |
|---|---|---|---|---|
| ROM parsing | src/utils/n64Parser.ts and legacy parser helpers | engine/rom/* | Legacy parser remains active in the production API path; canonical header/address components are tested | Preserve compatibility and add parity fixtures before cutover. |
| MIPS decoding | src/utils/mipsDisassembler.ts | engine/mips/decoder.ts | Canonical API is an adapter over legacy decoding; it is not yet the production boundary | Keep the adapter and require corpus parity before replacement. |
| Reachability | Linear sweep / legacy extraction | engine/mips/reachability.ts | Implemented with an explicit ROM-word reader, bounds checks and MIPS delay-slot decoding; isolated from production API | Broaden parity and then integrate. |
| Function recovery | src/utils/mipsDisassembler.ts extractSubroutines | engine/mips/functionRecovery.ts | Deterministic local-state implementation includes control-transfer delay slots; isolated | Broaden parity and then integrate. |
| CFG | src/utils/controlFlowGraph.ts | engine/mips/cfgBuilder.ts | Canonical builder exists and is tested; production API still uses legacy extraction/CFG | Compare canonical and legacy edges before cutover. |
| Call graph | Legacy-derived relationships | engine/mips/callGraph.ts | Canonical call-graph builder exists and is composed by the structural pipeline; isolated from the production API | Require relationship parity tests. |
| Structural pipeline | Legacy parser/disassembler/extractor path | engine/analysis/structuralPipeline.ts | Composes canonical function recovery, CFG and call graph using explicit entry points and word reader | Expand side-by-side parity; do not cut over yet. |
| IR / Micro-C | Existing decompiler/lifting infrastructure | engine/ir/* | Canonical IR and a growing VR4300 semantic subset exist; unsupported operations remain explicit | Continue semantic coverage and fail-closed diagnostics. |
| Formal semantics | Legacy semantic utilities | engine/mips/formalSemantics.ts | Partial descriptive metadata; not a complete ISA semantics engine and not wired as runtime authority | Expand by instruction family with architecture-specific tests. |
| Memory/data flow | Legacy alias-analysis utilities | engine/ir/memoryState.ts, memoryPhi.ts, memorySsa.ts | Block-local def-use and loop-capable CFG Memory SSA now exist for exact stack/frame locations; general alias analysis remains open | Continue M3 without overstating completion. |
| Structured C | Existing experimental C/decompiler paths | engine/ir/cAst.ts, engine/decompiler/structuredC.ts and proof modules | AST/rendering and narrow proof-gated lowering exist; unsupported semantic diagnostics now fail closed | Keep unsupported CFG shapes rejected. |
| Evidence | N/A in legacy path | engine/analysis/evidence.ts | Evidence types/helper exist but are not constructed and exposed by the production API | Wire only after the canonical pipeline boundary is authoritative. |

## Runtime authority

The HTTP endpoint in server.ts imports the synchronous analyzeRom() export from engine/pipeline.ts. That function currently calls the legacy ROM parser, linear-sweep disassembler and subroutine extractor. The separate asynchronous analyzeRomReal() path also uses legacy parser/disassembler/extractor/type and semantic utilities.

Therefore the canonical engine components are **not production-integrated** merely because they exist under engine/ or have passing tests.

## Migration order

1. Preserve ROM parser/decoder compatibility and build parity fixtures.
2. Compose canonical ROM-backed reachability, function recovery, CFG and call graph behind a non-default analysis path.
3. Compare canonical and legacy function boundaries, CFG edges and call-graph relationships on synthetic fixtures.
4. Integrate Micro-C and formal semantics only for explicitly supported instruction families.
5. Extend memory data-flow to pointer aliases, byte-range overlap and interprocedural effects.
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
- [x] Reachability repaired and tested, including delay slots, but isolated.
- [x] Function recovery stabilized and tested, including return delay slots, but isolated.
- [x] Canonical structural composition and initial function-boundary parity established.
- [ ] Broad CFG/call-graph parity completed.
- [ ] Canonical pipeline cutover performed.
- [ ] Evidence exposed through the production API/UI.

## Next

Continue Phase 2.5 parity expansion. Do not switch the production API wholesale; compare CFG edges, indirect control flow and broader instruction-family behavior on a deterministic synthetic corpus first.
