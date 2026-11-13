# N64 ROM Analyzer

A browser-based Nintendo 64 ROM analysis and decompilation research workbench. The repository combines a React/TypeScript interface with a TypeScript analysis engine for ROM parsing, VR4300/MIPS decoding, reachable-code discovery, function recovery, control-flow analysis, an intermediate representation and evidence-driven type inference.

> **Status: active research prototype.** Several canonical analysis stages and regression workflows are implemented, but the full decompilation pipeline and independent behavioral verification are not complete. Recovered C output must be treated as experimental unless its verification level is stated.

## Current implementation status

According to the checked-in [implementation status](docs/implementation-status.md):

- [x] Deterministic synthetic N64 fixture and baseline tests.
- [x] Canonical analysis data model and VR4300 decoder API.
- [x] ROM segment/address-map model.
- [x] Reachable-code discovery and first-class function recovery.
- [x] Canonical CFG and call graph.
- [x] Canonical Micro-C IR.
- [x] Evidence-driven type inference.
- [x] Typecheck, test/build and analysis-regression workflows.
- [x] Real-ROM byte comparison.
- [ ] Formal MIPS semantics integration.
- [x] Bounded exact-location Memory SSA/data-flow analysis (stack/frame and absolute byte lanes, CFG/loop Phis, may-def provenance, and conservative modeled call clobbers); general pointer aliasing and unknown external effects beyond observed lanes remain incomplete.
- [ ] Structured C AST generation.
- [ ] Independent execution-backed differential verification.
- [ ] Real compiler/toolchain rebuild.

The project distinguishes parsed facts, decoded instructions, structural analysis, semantic inference, behavioral verification and binary verification. See [verification levels](docs/verification-levels.md).

## Requirements

- Node.js (use a current LTS release).
- npm-compatible package manager.
- Gemini API key only for features that call the Google GenAI service.

## Setup

```bash
npm install
cp .env.example .env.local
```

Set GEMINI_API_KEY in .env.local only if using the Gemini-backed features. Never commit API keys.

## Development commands

```bash
npm run dev
npm run typecheck
npm test
npm run test:analysis
npm run build
```

The scripts are defined in package.json. Tests include a deterministic synthetic big-endian N64 fixture; it is not a commercial game ROM and is not intended to boot.

## Architecture

- engine/rom/ — ROM byte order, header and segment/address mapping.
- engine/mips/ — canonical instruction model, decoder and classification.
- engine/analysis/ — function, call-graph and evidence-driven type analysis.
- engine/decompilation/ — function-body recovery and lowering.
- engine/decompiler/ — IR, memory analysis and C-generation experiments.
- src/utils/ — legacy/experimental analysis implementations retained during migration.
- src/components/ — browser UI.
- tests/ — deterministic fixtures and regression coverage.

See [architecture](docs/architecture.md), [analysis pipeline](docs/analysis-pipeline.md) and [baseline fixture](docs/baseline.md).

## Research direction

A general, architecture- and executable-format-independent research outline for evidence-grounded executable-to-source reconstruction is maintained in [research/executable-to-source-reconstruction.md](research/executable-to-source-reconstruction.md). It is a working outline, not a claim that the current N64-focused prototype already supports other formats or architectures.

## Roadmap

See [docs/ROADMAP.md](docs/ROADMAP.md) for milestone status, acceptance criteria and a provisional schedule. The schedule assumes one developer working approximately 10–15 focused hours per week and should be revised after each major pipeline gate.

## Evidence and reporting rules

Do not describe inferred types, recovered functions or generated C as behaviorally verified unless an independent execution-backed comparison has been performed. A binary match is a separate verification level and must come from a real rebuild/link process—not copied input bytes.

## ROM and legal handling

Do not commit commercial ROM images, copyrighted assets, keys or proprietary game data. Keep local ROMs outside version control. Use synthetic fixtures and legally redistributable homebrew samples for tests.
