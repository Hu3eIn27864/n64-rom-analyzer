# Analyzer architecture

## Purpose

The analyzer is being developed as a layered pipeline. Commit 02 documents the intended boundaries without moving or deleting the existing implementation.

```text
ROM input
  -> ROM/header parsing
  -> byte-order normalization
  -> MIPS instruction decoding/classification
  -> code/function/CFG analysis
  -> IR and semantic analysis
  -> type/structure inference
  -> C generation
  -> optional verification/rebuild
```

## Current repository structure

- `engine/rom/` contains ROM byte-order and header handling.
- `engine/mips/` contains the newer engine-facing instruction model and adapters/classifiers.
- `engine/pipeline.ts` is the engine pipeline entry point.
- `engine/decompiler/` contains C-generation work.
- `src/utils/` contains the larger existing analysis/decompiler implementations.
- `src/components/` contains the UI views for analysis and verification.

## Boundary rule

The `engine/` layer should become the canonical home for reusable analysis contracts and passes. Existing `src/utils/` implementations are not deleted merely because a newer engine interface exists; they are migrated or adapted incrementally.

## Evidence rule

Every analysis result should distinguish facts obtained directly from the ROM from inferred or experimentally verified conclusions. A later commit will formalize the shared data model and verification types.
