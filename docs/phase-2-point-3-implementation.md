# Phase 2.3 — Implementation Record

Status: **READY / NOT YET CODED**

## Confirmed defect

`engine/mips/reachability.ts` currently invokes `decodeInstruction(0, address)`. The canonical decoder accepts the word supplied by its caller and preserves it as `raw`, so the defect is at the reachability input boundary, not in the decoder adapter.

## Required invariant

For every emitted reachable instruction:

```text
instruction.raw === ROM.readUint32BE(address)
```

subject to the repository's explicit address-to-ROM mapping.

## Planned API boundary

```ts
type InstructionWordReader = (address: number) => number;
```

The reachability engine will consume this dependency rather than owning ROM storage or depending on server/application state.

## Verification strategy

Use deterministic synthetic words with distinct opcodes and assert that the resulting `raw`, mnemonic/opcode, and address correspond to the supplied ROM data. Include invalid and unaligned addresses. Keep indirect control-transfer reporting unchanged.

## Integration rule

This phase repairs the canonical reachability component only. It does **not** switch the production API to the canonical pipeline. That remains Phase 2.5 after function-recovery stabilization and integration work.
