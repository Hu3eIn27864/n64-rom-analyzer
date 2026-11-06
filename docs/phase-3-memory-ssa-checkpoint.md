# Phase 3 — Memory SSA from Canonical Micro-C

Status: **PARTIAL IMPLEMENTATION — INTEGRATED WITHIN FUNCTIONIR, NOT A GENERAL ALIAS MODEL**

## Implemented path

engine/ir/memorySsaBuilder.ts extracts memory accesses directly from canonical FunctionIR and feeds the block graph to the Memory SSA solver.

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

## Remaining work

- Byte-range overlap between differently sized accesses.
- Multiple reaching byte versions for partially overlapping stores/loads.
- Stronger pointer and alias analysis beyond stack/frame offsets.
- Interprocedural memory effects and call clobbers.
- Device/external writes and complete LL/SC observer semantics.
- Formal integration with the canonical analysis result and evidence report.

## Safety boundary

No memory dependency is inferred for probable or unknown addresses. Exact address equality is not treated as proof of general pointer non-aliasing. This implementation is an isolated semantic-analysis component, not a claim of complete memory correctness.
