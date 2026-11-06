# Phase 2.6 — Bounded ROM-Function Analysis Composition

Status: **IMPLEMENTED FOR EXPLICIT ENTRIES — NOT PRODUCTION-INTEGRATED**

## Objective

Connect bounded ROM function decoding to canonical Micro-C and memory analysis while preserving the legacy production API until ROM mapping and function-entry discovery are reliable.

## Implemented API

engine/analysis/romFunctionAnalysis.ts exports analyzeRomFunction(rom, entry, options).

It composes:

1. decodeRomFunctionCfg() for bounded ROM-backed control-flow decoding;
2. lowerRomCfgToFunctionIR() for canonical Micro-C lowering;
3. buildMemorySSAFromFunctionIR() for CFG-aware memory def-use and MemoryPhi construction.

The caller supplies a RomFunctionEntry containing both the virtual address and ROM offset. The bounded decoder uses this explicit pair for its linear function mapping. It does not infer ROM segments or function boundaries.

## Delay-slot behavior

- Ordinary conditional branches retain their delay-slot instruction on both paths.
- Branch-likely instructions use a separate delay-slot block reachable only on the taken path; the not-taken edge skips it.
- Return and jump delay slots are decoded and retained.
- A control transfer in a delay slot is rejected as unsupported.

## Verification

Synthetic tests cover:

- a stack adjustment, store and load followed by JR $ra, with the load linked to the store's Memory SSA version;
- BEQL with a taken-only store delay slot and a distinct not-taken fallthrough block;
- correct Micro-C branch targets for the taken and not-taken paths.

All four repository quality gates pass on the merged implementation.

## Limits and next work

- No automatic ROM segment discovery.
- No general function-entry discovery or code/data separation.
- No arbitrary ROM-to-VRAM mapping inference.
- The bounded decoder follows an explicit linear ROM mapping from the supplied entry; segmented or non-contiguous function layouts need a richer mapping contract.
- No independent execution-backed behavioral verification.

Next: derive candidate ROM segments and function entries from explicit evidence, then run this bounded pipeline side-by-side with the legacy analysis on a synthetic corpus before any API cutover.
