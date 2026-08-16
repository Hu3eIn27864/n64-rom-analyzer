# Phase 2 — Engine Integration & Truth Audit

Status: **IN PROGRESS**

Base: `master` after Commit 20 / PR #11

## Purpose

Determine which of the original 20 roadmap layers are actually implemented, integrated into the runtime pipeline, isolated scaffolding, partial, broken, or experimental before adding new engine features.

## Classification

- **IMPLEMENTED** — code exists and is covered by meaningful tests.
- **INTEGRATED** — code participates in the canonical end-to-end analysis path.
- **ISOLATED** — code exists but is not consumed by the canonical runtime path.
- **PARTIAL** — only part of the intended capability exists.
- **BROKEN** — implementation exists but has a correctness/integration defect.
- **EXPERIMENTAL** — intentionally non-authoritative or provisional.
- **NOT VERIFIED** — no sufficient evidence yet.

## Initial findings

| Area | Current state | Evidence / blocker |
|---|---|---|
| Evidence model | IMPLEMENTED / ISOLATED | `engine/analysis/evidence.ts` exists; API response does not yet expose it. |
| Evidence tests | IMPLEMENTED / NOT WIRED | `tests/analysis/evidence.test.ts` exists, but package test scripts still target `tests/baseline.test.ts`. |
| Canonical decoder | IMPLEMENTED / ISOLATED | `engine/mips/decoder.ts` is an adapter around the legacy decoder. |
| Reachability | BROKEN / ISOLATED | `discoverReachableCode()` currently calls `decodeInstruction(0, address)`, so it does not consume actual ROM words. |
| Function recovery | PARTIAL / ISOLATED | Depends on reachability and therefore inherits its input defect; uses mutable `_results` state. |
| CFG | IMPLEMENTED / ISOLATED | Canonical builder exists but current real pipeline still calls the legacy CFG implementation. |
| Real pipeline | PARTIAL | `analyzeRomReal()` uses the mature parser/disassembler/extractor and explicitly documents linear-sweep integration boundary. |
| API pipeline | BROKEN / PARTIAL | `server.ts` imports `analyzeRom`, while the inspected engine pipeline exports `analyzeRomReal`. |
| Evidence API/UI | NOT INTEGRATED | `/api/analyze-rom` currently returns header, size, instructions and functions without verification evidence. |
| CI | NOT PRESENT | No GitHub Actions workflows currently exist. |
| Status documentation | STALE | Implementation-status document does not reflect the current engine additions. |

## Phase 2 order

1. Trace the actual runtime path from `/api/analyze-rom` to engine output.
2. Inventory all canonical vs legacy implementations and their consumers.
3. Repair the reachability input boundary so analysis consumes real decoded words.
4. Replace mutable function-recovery state with local state.
5. Wire canonical decoder/reachability/function recovery/CFG into one deterministic pipeline.
6. Wire evidence aggregation into the pipeline and API.
7. Wire analysis tests into the normal test command.
8. Add CI only after the local test/typecheck contract is deterministic.
9. Update implementation-status documentation from observed repository truth.
10. Only then define the next feature commit.

## Rule

No new feature commit should be declared until the canonical pipeline has one authoritative data path and every reported verification status is backed by executable evidence.
