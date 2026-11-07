# Memory SSA byte-lane design

Status: **DESIGN NOTE — NOT IMPLEMENTED**

## Problem

The current solver creates reaching definitions for exact stack/frame locations keyed by both address and access width. It separately annotates intersecting byte ranges in `overlappingAccesses`. That annotation is useful alias evidence, but it is not a reaching definition and must not be consumed as one.

A store of four bytes at `0x10($sp)` followed by a load of two bytes at `0x12($sp)` is the motivating case: the load is fully covered by the store, even though the access keys differ. Conversely, a one-byte store at `0x12($sp)` cannot establish the other three bytes of a later word load.

## Required representation

The next implementation should model memory state per byte lane within a bounded address space:

- Normalize exact stack/frame accesses to a canonical base plus signed byte offset.
- Represent each byte as a reaching definition token, with live-on-entry represented by version zero.
- A multi-byte store updates only the lanes it definitely writes.
- A multi-byte load records the reaching token for every byte lane it reads.
- A join creates lane-specific MemoryPhi nodes only where predecessor tokens differ.
- A merged access may expose a compact summary only when every lane has a compatible source; do not fabricate one scalar version for mixed provenance.
- Keep SP and FP distinct unless a separate, proven base-equivalence analysis is introduced.

## Control-flow and instruction semantics

The dataflow solver must remain fixed-point based so loop-carried definitions converge. Conditional stores must not be treated as definite writes. Merge stores must update only the byte lanes guaranteed by the instruction semantics; their aligned containing word/doubleword is not necessarily fully overwritten. Merge loads must record the bytes actually consumed, rather than treating the aligned containing range as a full-width read.

Unknown and probable pointer spaces remain outside the exact byte-lane solver. They must not silently alias exact stack/frame locations. A future alias-analysis layer may conservatively invalidate lane states when it proves or cannot rule out overlap.

## Acceptance tests

1. A 4-byte store followed by a contained 2-byte load reaches the store on both loaded lanes.
2. A 1-byte store followed by a 4-byte load reports three lanes from the previous state and one from the store.
3. Adjacent non-overlapping byte ranges remain independent.
4. SP and FP locations do not alias.
5. A branch join creates lane Phis only for lanes whose incoming versions differ.
6. A loop-carried partial store converges and preserves unaffected lanes.
7. Conditional and merge stores update only semantically guaranteed lanes.
8. Existing exact-width version behavior remains compatible or is migrated through an explicitly documented API change.

## Integration boundary

This design does not claim that the current `overlappingAccesses` metadata implements byte-level Memory SSA. It is a prerequisite specification for a separate solver change and must be validated independently before call effects are injected as Memory SSA definitions.
