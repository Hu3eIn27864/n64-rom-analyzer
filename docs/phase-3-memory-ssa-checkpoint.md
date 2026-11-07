# Phase 3 — Memory SSA from Canonical Micro-C

Status: **PARTIAL IMPLEMENTATION — FUNCTIONIR ADAPTER AND BOUNDED ROM PATH; NOT PRODUCTION-INTEGRATED**

## Implemented path

engine/ir/memorySsaBuilder.ts extracts memory accesses directly from canonical FunctionIR and feeds the block graph to the Memory SSA solver.

engine/analysis/romFunctionAnalysis.ts composes bounded ROM-function CFG decoding, Micro-C lowering and Memory SSA in one explicit-entry analysis call.

Supported Micro-C memory operations:

- ordinary loads and stores;
- word and doubleword merge loads/stores;
- linked loads and conditional stores;
- COP1 memory loads/stores.

Address normalization:

- stack/frame base plus constant offset is exact;
- GP/T9 base plus constant offset remains probable;
- dynamic and other register expressions remain unknown;
- LWL/LWR/SWL/SWR accesses are aligned to the containing 4-byte word;
- LDL/LDR/SDL/SDR accesses are aligned to the containing 8-byte doubleword.

The solver propagates versions through CFG predecessor edges, creates MemoryPhi nodes at conflicting joins, computes loop-carried definitions with a fixed-point iteration, and collapses trivial Phis after convergence. Version zero denotes live-on-entry memory.

## Verification

tests/ir/memorySsaBuilder.test.ts covers:

- store-to-load def-use within a block;
- conflicting stores on CFG branches and a join MemoryPhi;
- conservative treatment of dynamic and global-register addresses;
- access widths and alignment for merge, linked, conditional and FPU memory operations.

tests/ir/memorySsa.test.ts additionally covers loop-carried MemoryPhi inputs, fixed-point convergence, trivial-Phi collapse and unknown/probable location handling.

tests/analysis/romFunctionAnalysis.test.ts exercises the bounded ROM-to-Micro-C-to-Memory-SSA composition, including a stack store/load and branch-likely taken-only delay slot.

## Remaining work

- Descriptive byte-range overlap metadata for exact stack/frame accesses is implemented; it reports symmetric intersections across blocks without changing reaching-definition results.
- Multiple reaching byte versions for partially overlapping stores/loads.
- Stronger pointer and alias analysis beyond stack/frame offsets.
- Fixed-point summaries for direct calls across successfully analyzed functions in a mapped ROM program, including transitive and recursive calls; unknown or out-of-set targets remain conservative. Stack/frame-relative ranges are now represented in separate `sp` and `fp` address spaces with signed offsets; GP/T9 and other dynamic bases remain unknown.
- Per-function call-clobber validation is integrated into mapped ROM program results and follows reachable CFG paths. It checks ordinary, linked, COP1 and aligned merge loads against known call write ranges.
- This remains conservative rather than a full Memory SSA rewrite: call effects are reported as validation/invalidation evidence, not yet inserted as Memory SSA definitions or Phis. Stack/frame-relative ranges are base-aware in function summaries, but are not yet materialized as call-site Memory SSA definitions or Phis.
- Device/external writes and complete LL/SC observer semantics.
- Formal integration with the canonical production analysis result and evidence report.

- Mapped ROM program analysis now returns a closed-world memory-effect summary per successfully analyzed function plus per-function call-memory validation. Failed functions and unresolved/indirect targets are not silently treated as effect-free.

## Safety boundary

No memory dependency is inferred for probable or unknown addresses. Exact address equality is not treated as proof of general pointer non-aliasing. This implementation is an isolated semantic-analysis component, not a claim of complete memory correctness.


## Alias boundary audit (November 2026)

The current exact interprocedural range domain is intentionally limited to absolute constants and base-relative stack/frame offsets:

| Address form | Memory SSA confidence | Function effect summary |
| --- | --- | --- |
| Absolute constant | Not a stack/frame SSA location | Exact absolute range |
| SP + constant | Exact | Base-aware signed-offset range |
| FP + constant | Exact | Base-aware signed-offset range |
| GP/T9 + constant | Probable | Unknown |
| Other register + constant | Unknown | Unknown |
| Computed/dynamic pointer | Unknown | Unknown |

A GP/T9 expression is not promoted to an exact object merely because it has a constant displacement. The register may refer to a global data region, a small-data region, a table, or a dynamically established base. No cross-space alias conclusion is made.

Direct calls outside the analyzed closed function set, indirect calls, and calls with unknown summaries remain conservative. External/device writes are not modeled as a known finite set of ranges. Linked-load/conditional-store pairs are represented as memory accesses, but reservation invalidation by intervening writes and external observers is not yet a complete LL/SC model.

Regression coverage guards the current boundary: GP/T9 and other pointer expressions must not appear as precise read/write ranges. Future global-data analysis must introduce explicit object identity or a validated global address map before changing this classification.
