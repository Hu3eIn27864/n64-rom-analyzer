# Phase 2.2 — Canonical vs Legacy Inventory

Status: **COMPLETE — AUDIT ONLY**

Branch: `phase-2-point-2`

## Objective

Inventory the competing analysis implementations and determine which one is actually authoritative at runtime. This phase does **not** delete or replace legacy code yet. It establishes the migration boundary from observed repository usage.

## Findings

| Capability | Legacy implementation | Canonical implementation | Runtime status | Decision |
|---|---|---|---|---|
| ROM parsing | `src/utils/romParser.ts` | canonical ROM/segment model under `engine/` | Legacy path is active in `engine/pipeline.ts` | Preserve parser contract; migrate output into canonical model before replacing consumers. |
| MIPS decoding | `src/utils/mipsDisassembler.ts` | `engine/mips/decoder.ts` | Legacy decoder is active; canonical decoder is an adapter over it | Canonical API becomes the future boundary; do not remove legacy decoder until corpus parity is demonstrated. |
| Reachability | linear sweep / legacy extraction | `engine/mips/reachability.ts` | Canonical reachability is not in runtime path and currently has a ROM-word input defect | Repair first, then integrate. |
| Function recovery | `src/utils/subroutineExtractor.ts` | `engine/mips/functionRecovery.ts` | Legacy extractor is active; canonical recovery is isolated | Canonical recovery becomes authoritative only after reachability correctness tests. |
| CFG | `src/utils/controlFlowGraph.ts` | `engine/mips/cfgBuilder.ts` | Legacy CFG is active in `engine/pipeline.ts` | Migrate behind a compatibility boundary; compare graphs before cutover. |
| Call graph | legacy-derived function relationships | canonical call-graph layer | Not yet proven as runtime authority | Keep isolated until function/CFG cutover. |
| IR / Micro-C | existing decompiler/lifting infrastructure | `engine/ir/*` | Canonical layer exists but is not the complete runtime source of truth | Integrate after CFG/function recovery. |
| Semantics | existing semantic/lifting utilities | `engine/semantics/*` | Downstream analysis is present but not the canonical source path | Preserve as downstream stage; evidence must distinguish inferred/unverified output. |
| Types | existing type inference | `engine/types/*` | Downstream/partial integration | Do not label authoritative until evidence is wired. |
| Evidence | N/A in legacy path | `engine/analysis/evidence.ts` | Exists but isolated from API/runtime | Make this the single status vocabulary for all analysis results. |

## Architectural conclusion

There are currently **two layers of truth**:

1. The mature `src/utils/*` implementation that still performs most real analysis work.
2. The newer `engine/*` architecture that defines canonical interfaces and progressively reimplements the analysis stages.

The correct Phase-2 strategy is **not** a destructive rewrite. The legacy implementation is the currently working execution substrate, while the canonical engine is the target authority. We therefore migrate one boundary at a time and require parity evidence before each cutover.

## Required migration order

```text
legacy parser
   ↓
canonical ROM model
   ↓
canonical decoder
   ↓
canonical reachability
   ↓
canonical function recovery
   ↓
canonical CFG
   ↓
canonical call graph
   ↓
canonical IR / semantics / types
   ↓
canonical evidence
   ↓
API/UI
```

## Rules for cutover

- No legacy module is deleted merely because a canonical replacement exists.
- A canonical module is not authoritative merely because it has tests.
- Each migration must have input/output parity tests against the current mature implementation where applicable.
- Any result that is inferred or unverified remains non-authoritative through the evidence layer.
- Runtime imports are the deciding factor for `INTEGRATED`; directory placement alone is not.

## Phase 2.2 acceptance criteria

- [x] Legacy implementations identified.
- [x] Canonical implementations identified.
- [x] Runtime consumers identified.
- [x] Canonical-vs-legacy boundary documented.
- [x] Migration order defined.
- [x] Cutover rules defined.
- [ ] Reachability repaired.
- [ ] Canonical pipeline cutover performed.

## Next

Proceed to **Phase 2.3 — Repair the reachability input boundary**. The current implementation passes an instruction word of `0` to the decoder rather than reading the corresponding ROM word, so reachability cannot yet be treated as authoritative.
