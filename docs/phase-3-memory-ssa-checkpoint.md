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
- Fixed-point summaries for direct calls across successfully analyzed functions in a mapped ROM program, including transitive and recursive calls; unknown or out-of-set targets remain conservative.
- Per-function call-clobber validation is integrated into mapped ROM program results and follows reachable CFG paths. It checks ordinary, linked, COP1 and aligned merge loads against known call write ranges.
- This remains conservative rather than a full Memory SSA rewrite: call effects are reported as validation/invalidation evidence, not yet inserted as Memory SSA definitions or Phis. Stack/frame-relative effects remain unknown in numeric program summaries until a base-aware range domain is introduced.
- Device/external writes and complete LL/SC observer semantics.
- Formal integration with the canonical production analysis result and evidence report.

- Mapped ROM program analysis now returns a closed-world memory-effect summary per successfully analyzed function plus per-function call-memory validation. Failed functions and unresolved/indirect targets are not silently treated as effect-free.

## Safety boundary

No memory dependency is inferred for probable or unknown addresses. Exact address equality is not treated as proof of general pointer non-aliasing. This implementation is an isolated semantic-analysis component, not a claim of complete memory correctness.
