# Implementation status

This document records the intended implementation order. It is deliberately conservative: a capability is marked complete only when the repository contains the implementation and tests needed to support that claim.

## Baseline

- [x] Deterministic synthetic N64 fixture
- [x] Baseline fixture test
- [x] Reproducible test/typecheck/build script entry points
- [x] Baseline documentation

## Near-term architecture

- [x] Canonical analysis data model
- [x] Canonical VR4300 decoder API
- [x] Expanded VR4300 decoding corpus
- [x] ROM segment/address-map model
- [x] Reachable-code discovery
- [x] First-class function recovery
- [x] Canonical CFG and call graph

## Decompiler pipeline

- [x] Canonical Micro-C IR
- [ ] Formal MIPS semantics integration
- [ ] Memory SSA/data-flow analysis
- [x] Evidence-driven type inference
- [ ] Structured C AST generation

## Verification

- [ ] Independent execution-backed differential verification
- [ ] Real compiler/toolchain rebuild
- [x] Real ROM byte comparison

## CI regression gates

- [x] Repository typecheck, test, and build workflow
- [x] Dedicated analysis regression workflow
- [x] Canonical analysis regression suite passes locally

## Experimental work

Existing experimental/AI/C++ analysis code remains available while the canonical engine is built. It must not silently turn speculative output into authoritative verification.

## Status vocabulary

Use `implemented`, `inferred`, `experimental`, `not-run`, or `unverified` where appropriate. Avoid unconditional claims such as `100% verified` unless the corresponding evidence level has actually been achieved.
