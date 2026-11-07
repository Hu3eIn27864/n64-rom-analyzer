# Memory SSA byte-lane design

Status: **PARTIALLY IMPLEMENTED — STACK/ABSOLUTE BYTE-LANE DATAFLOW, MERGE MASKS, AND CONSERVATIVE CALL CLOBBERS INTEGRATED**

## Problem

The legacy solver still exposes access-width reaching definitions and descriptive `overlappingAccesses`. A supplemental byte-lane dataflow pass now records per-byte `reachingByteVersions` and `previousByteVersions` for exact SP/FP and absolute-address accesses. It creates lane-specific `bytePhis` at joins and solves loop-carried definitions to a fixed point. The legacy scalar fields remain for compatibility and must not be mistaken for a complete summary when the byte lanes have mixed provenance.

A store of four bytes at `0x10($sp)` followed by a load of two bytes at `0x12($sp)` is the motivating case: the load is fully covered by the store, even though the access keys differ. Conversely, a one-byte store at `0x12($sp)` cannot establish the other three bytes of a later word load.

## Implemented slice

- Exact stack/frame accesses are expanded to byte lanes with SP and FP kept distinct; constant absolute addresses use a separate shared `absolute` lane namespace.
- Full and partial definite stores update only their addressed lanes.
- Loads expose the reaching version for every byte in address order.
- CFG joins create a separate Phi for each lane whose predecessor versions differ.
- Loop-carried lane definitions are solved by a bounded fixed-point pass.
- Conditional stores and merge stores are classified as `mayDef` rather than definite full-range stores. Merge operations carry the exact big-endian byte mask selected by their effective-address lane and left/right direction; conditional stores conservatively describe their full modeled range. A may-def no longer replaces the definite reaching version: its token is propagated separately in `possibleByteVersions`, including across CFG joins. A later definite store clears the possible tokens for the bytes it fully overwrites.
- The old width-keyed `phis` and scalar version fields remain in place for compatibility; the new lane-specific Phis are exposed as `bytePhis`.

## Remaining work

- Teach downstream consumers to interpret `possibleByteVersions` as conditional provenance rather than definite dataflow. The byte-lane solver records these tokens, but consumers must not treat them as definite reaching definitions.
- Extend conservative invalidation for unknown external effects and aliases beyond the exact lanes currently observed in a function. Current call-effect integration covers modeled caller lanes and known callee summaries; it is not a general points-to or alias analysis.
- Define a documented compact scalar summary for mixed byte provenance, or explicitly keep the per-byte arrays as the only authoritative representation and deprecate ambiguous scalar fields.

## Implemented representation

The current implementation models memory state per byte lane within a bounded address space:

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

This design does not claim that `overlappingAccesses` metadata alone implements byte-level Memory SSA. Unknown call effects are injected conservatively into observed caller stack/frame and absolute lanes. Known callee absolute writes are injected into the shared absolute lane domain; known callee-private SP/FP ranges are intentionally not treated as caller-frame aliases. GP-relative and dynamic aliases remain unresolved.


## Proven GP-base contract

`FunctionIR.globalPointerBase` is optional metadata and must be populated only by a caller that has independently validated the runtime `$gp` value for that function. When present, GP-relative constant offsets are normalized to the shared absolute address namespace before byte-lane construction and effect summarization. When absent, GP-relative accesses remain probable/unknown and do not participate in exact reaching definitions. The current ROM lifting pipeline does not infer this value from relocation placeholders or heuristics.


## Program-level GP metadata

Mapped ROM program analysis accepts an optional `globalPointerBases` map keyed by validated function VRAM entry address. Values must be aligned unsigned 32-bit addresses supplied by an external source that has established the runtime `$gp` value. The map is validated against the segment map, attached to the corresponding `FunctionIR` before program memory-effect inference, and used to rebuild byte-lane Memory SSA before call-effect integration. No automatic GP inference is performed from instruction patterns alone.
