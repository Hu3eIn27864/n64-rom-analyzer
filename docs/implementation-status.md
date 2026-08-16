# Implementation status

This document records the intended implementation order. It is deliberately conservative: a capability is marked complete only when the repository contains the implementation and tests needed to support that claim.

## Baseline

- [x] Deterministic synthetic N64 fixture
- [x] Baseline fixture test
- [x] Reproducible test/typecheck/build script entry points
- [x] Baseline documentation

## Near-term architecture

- [ ] Canonical analysis data model
- [ ] Canonical VR4300 decoder API
- [ ] Expanded VR4300 decoding corpus
- [ ] ROM segment/address-map model
- [ ] Reachable-code discovery
- [ ] First-class function recovery
- [ ] Canonical CFG and call graph

## Decompiler pipeline

- [ ] Canonical Micro-C IR
- [ ] Formal MIPS semantics integration
- [ ] Memory SSA/data-flow analysis
- [ ] Evidence-driven type inference
- [ ] Structured C AST generation

## Verification

- [ ] Independent execution-backed differential verification
- [ ] Real compiler/toolchain rebuild
- [ ] Real ROM byte comparison

## Experimental work

Existing experimental/AI/C++ analysis code remains available while the canonical engine is built. It must not silently turn speculative output into authoritative verification.

## Status vocabulary

Use `implemented`, `inferred`, `experimental`, `not-run`, or `unverified` where appropriate. Avoid unconditional claims such as `100% verified` unless the corresponding evidence level has actually been achieved.
