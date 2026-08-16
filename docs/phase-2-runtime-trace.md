# Phase 2.1 — Runtime Pipeline Trace

## Entry point

`POST /api/analyze-rom` in `server.ts` accepts a base64 ROM, decodes it to `Uint8Array`, calls `analyzeRom(...)`, and serializes header, ROM size, instructions, and a reduced function list. It does not serialize evidence. fileciteturn28file0L2-L3

## Observed path

```text
HTTP POST /api/analyze-rom
  -> server.ts
  -> analyzeRom(Uint8Array)
  -> engine/pipeline.ts
  -> parseRom()
  -> normalizeRom()
  -> DataView
  -> linear sweep from offset 0x1000
  -> disassembleMipsWord()
  -> extractSubroutines()
  -> buildControlFlowGraph()
  -> solveWholeProgramTypesAndLayouts()
  -> runSemanticUltraLifterPipelineAsync()
  -> ProvenanceKnowledgeGraph
  -> API JSON
```

The inspected `engine/pipeline.ts` currently exports `analyzeRomReal`, not `analyzeRom`, and explicitly uses the mature `src/utils/*` parser/disassembler/extractor/CFG path. It labels the linear sweep as a temporary integration boundary. fileciteturn29file0L2-L7

## Canonical split

The canonical decoder exists under `engine/mips`, but the runtime pipeline does not call it. The evidence model exists, but the runtime path does not construct or expose an `AnalysisSummary`. fileciteturn30file0L2-L7

## Phase 2.1 result

**Runtime trace complete.** The authoritative runtime path is currently the legacy/mature pipeline, not the canonical `engine/mips/*` pipeline. Establishing one authoritative path is therefore the next integration task.
