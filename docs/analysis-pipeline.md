# Analysis pipeline

The target pipeline is intentionally incremental. Each stage must preserve the evidence produced by the previous stage.

```text
ROM
 |
 v
[ROM parser]
 |
 v
[byte-order / address map]
 |
 v
[MIPS decoder]
 |
 v
[reachable code + function recovery]
 |
 v
[CFG + call graph]
 |
 v
[Micro-C IR]
 |
 +--> [formal instruction semantics]
 |
 +--> [memory/data-flow analysis]
 |
 v
[type and structure inference]
 |
 v
[structured C AST]
 |
 v
[C source]
 |
 +--> [execution-backed differential verification]
 |
 +--> [real rebuild / byte comparison]
```

## Design principles

1. **Decode before interpreting.** Raw ROM bytes are not automatically code.
2. **Reachability before linear-sweep assumptions.** Branches and calls provide evidence for executable regions.
3. **Preserve uncertainty.** Indirect targets and ambiguous data/code boundaries remain explicitly unknown until supported by evidence.
4. **Separate inference from fact.** Names, types, structures, and semantics inferred from patterns must not be presented as verified facts.
5. **Verification is a separate stage.** A generated C representation is not byte-equivalent merely because it resembles the original behavior.
6. **Keep stages testable.** The golden fixture from Commit 01 provides a controlled seed for stage-by-stage tests.

## Commit progression

The roadmap moves from baseline and truthfulness to a canonical data model, MIPS decoding, code discovery, CFG/call graph, IR, semantics, type inference, C generation, execution-backed verification, and finally real ROM rebuilding.
