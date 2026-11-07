# Memory SSA byte-lane design

Status: **PARTIALLY IMPLEMENTED — BYTE-LANE DATAFLOW, MERGE MASKS, AND CONSERVATIVE UNKNOWN-CALL CLOBBERS INTEGRATED**

## Problem

The legacy solver still exposes access-width reaching definitions and descriptive `overlappingAccesses`. A supplemental byte-lane dataflow pass now records per-byte `reachingByteVersions` and `previousByteVersions` for exact SP/FP accesses. It creates lane-specific `bytePhis` at joins and solves loop-carried definitions to a fixed point. The legacy scalar fields remain for compatibility and must not be mistaken for a complete summary when the byte lanes have mixed provenance.

A store of four bytes at `0x10($sp)` followed by a load of two bytes at `0x12($sp)` is the motivating case: the load is fully covered by the store, even though the access keys differ. Conversely, a one-byte store at `0x12($sp)` cannot establish the other three bytes of a later word load.

## Implemented slice

- Exact stack/frame accesses are expanded to byte lanes with SP and FP kept distinct.
- Full and partial definite stores update only their addressed lanes.
- Loads expose the reaching version for every byte in address order.
- CFG joins create a separate Phi for each lane whose predecessor versions differ.
- Loop-carried lane definitions are solved by a bounded fixed-point pass.
- Conditional stores and merge stores are classified as `mayDef` rather than definite full-range stores. Merge operations now carry the exact big-endian byte mask selected by their effective-address lane and left/right direction; conditional stores conservatively invalidate their full modeled range.
- The old width-keyed `phis` and scalar version fields remain in place for compatibility; the new lane-specific Phis are exposed as `bytePhis`.

## Remaining work

- Integrate call-site summaries and external memory effects into lane state.
- Distinguish a may-def token from a definite reaching definition in downstream consumers; currently it is an explicit conservative kill token.
- Integrate call-site summaries and external memory effects into lane state.
- Define a documented compact scalar summary for mixed byte provenance (the lane array remains authoritative).

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

The dataflow solver must remain fixed-point based so loop-carried definitions converge. Conditional stores must not be treated as definite writes. Merge stores must update only the byte lanes guaranteed by the instruction semantics; their aligned containing word/doubleword is not necessarily fully overwritten. Merge loads must record the bytes actually consumed, rather than treating the aligned containing range as a full-width read. For the N64 big-endian MIPS forms, left operations select the prefix through the effective byte lane and right operations select the suffix beginning at that lane.

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

This design does not claim that `overlappingAccesses` metadata alone implements byte-level Memory SSA. Unknown call effects are now injected conservatively into observed caller stack/frame lanes; known callee-private SP/FP ranges are intentionally not treated as caller-frame aliases. Absolute/global call effects and external memory ranges remain outside the current lane domain.
