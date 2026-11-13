# Toward Evidence-Grounded Executable-to-Source Reconstruction

## Working title

**From Machine Code to Structured Source: An Evidence-Grounded Pipeline for Executable Analysis and Decompilation**

## Abstract (working draft)

Recovering high-level source code from an executable is not a single disassembly operation. It is a sequence of inference problems: identifying code and data, decoding instructions under an execution mode and ABI, recovering functions and control-flow edges, reconstructing data dependencies and memory effects, inferring types and source-level constructs, and emitting a candidate program. Each stage can introduce uncertainty that propagates into later stages. This work-in-progress proposes a staged, architecture-aware pipeline that makes evidence and uncertainty explicit, uses conservative intermediate representations, and gates source reconstruction on structural and semantic proof obligations. The central objective is not merely to produce compilable C, but to distinguish recovered facts, plausible hypotheses, and independently verified behavior. The approach is intended to apply to executable formats and instruction set architectures generally; concrete experiments may use multiple formats and architectures as case studies.

## Research questions

1. Which evidence is sufficient to classify executable regions as code, data, padding, or unresolved?
2. How can control-flow recovery represent direct, indirect, exceptional, and dynamically resolved transfers without silently losing edges?
3. Which SSA and memory-dependence invariants are needed before reconstructing source-level variables, expressions, and control structures?
4. How should an analyzer represent ABI rules, calling conventions, register state, aliasing, and external side effects?
5. What proof obligations justify lowering a recovered region into structured C rather than retaining a lower-level or explicitly unsupported representation?
6. How can semantic equivalence be evaluated independently of source similarity and compiler acceptance?

## Proposed pipeline

1. **Container and loader model** — parse executable headers, sections/segments, relocations, symbols, imports, permissions, address spaces, and entry points. Examples include PE/COFF, ELF, and Mach-O, but the design must not assume their metadata is interchangeable.
2. **Instruction decoding** — decode according to ISA, mode, endianness, privilege state, and architecture-specific rules. Preserve undecodable bytes and decode uncertainty.
3. **Code discovery and function recovery** — combine entry-point metadata, symbols, relocations, call references, recursive traversal, and conservative heuristics. Treat code/data classification as revisable evidence.
4. **Control-flow and call-graph recovery** — model basic blocks, delay slots where applicable, indirect branches, jump tables, exceptions, tail calls, and unresolved transfers explicitly.
5. **Semantic lifting** — translate instructions into an architecture-neutral but sufficiently expressive IR. Preserve flags, condition codes, register aliases, partial writes, atomics, floating-point modes, and exceptional effects.
6. **Data-flow and memory analysis** — build SSA-like value flow and memory dependence; model aliasing and interprocedural effects conservatively. Phi inputs are edge-specific.
7. **Type and ABI inference** — infer types and function signatures from multiple independent evidence sources; report confidence separately from verification.
8. **Control-structure and expression recovery** — recognize branches, loops, switches, and expressions only when graph and data-flow invariants support them. Keep irreducible or ambiguous regions in a lower-level representation.
9. **Source generation** — emit typed C with explicit casts and defined behavior where possible. Unsupported or uncertain regions must be surfaced, not silently approximated.
10. **Validation** — compile generated code, compare traces or state transitions under controlled inputs, use differential testing and fuzzing, and attempt reproducible rebuilds where the environment permits.

## Core design principles

- **Evidence provenance:** every inferred fact should identify the bytes, instructions, edges, symbols, ABI assumptions, or analysis pass that support it.
- **Fail closed:** if a transformation cannot prove its preconditions, retain the lower-level representation and explain why.
- **Architecture-aware semantics:** a common IR must not erase architectural behavior that affects observable results.
- **Separate confidence from verification:** a high-confidence type guess is not proof of behavioral equivalence.
- **Independent validation:** compiling output is a syntax/type sanity check, not semantic verification.
- **Reproducibility:** publish fixtures, toolchain versions, analysis settings, and exact verification procedures.

## Evaluation plan

Build a benchmark matrix spanning executable formats (initially ELF and PE, with Mach-O as a later extension), architectures (initially x86-64 and AArch64, with additional ISAs as resources allow), compiler families, optimization levels, and code patterns. Use source-available programs compiled with known toolchains so ground truth is available, plus stripped binaries to measure realistic recovery. Include hand-constructed fixtures for indirect control flow, jump tables, exception paths, aliasing, vector operations, and optimized loops.

Report separate metrics:
- instruction decoding accuracy;
- code/data classification precision and recall;
- function-boundary and CFG edge precision/recall;
- call-target recovery;
- data-flow and memory-dependence accuracy;
- type/signature accuracy;
- structured-region recovery rate;
- compilable-output rate;
- behavioral equivalence under stated test coverage;
- binary reproducibility where meaningful.

A result must state its denominator, exclusions, toolchain, optimization settings, and whether ground truth was available. Avoid a single aggregate score that hides failure modes.

## Threats to validity and limitations

Optimizing compilers erase or transform source constructs, so exact source recovery is generally underdetermined. Multiple source programs can compile to the same machine code. Undefined behavior, inline assembly, link-time optimization, obfuscation, self-modifying code, packed binaries, dynamic loading, JIT code, concurrency, and environment-dependent behavior complicate equivalence claims. No finite test suite proves general equivalence. Architecture-neutral lifting risks losing details; architecture-specific lifting risks limiting portability. The paper must describe these limits rather than promise universal reconstruction.

## Planned contributions (to be validated)

- A staged pipeline with explicit evidence provenance and verification levels.
- A conservative semantic IR and proof-gated transformations from CFG/SSA to structured source.
- A reproducible cross-format/cross-architecture benchmark methodology.
- An empirical analysis of where executable-to-C reconstruction succeeds, degrades, or must stop.

## Current project as a case study

The existing analyzer is an experimental implementation and validation environment, not evidence that general executable decompilation has been solved. Its current architecture-specific support can serve as one case study for CFG recovery, data-flow, memory modeling, and conservative C lowering. A general paper requires additional formats, ISAs, and independent ground-truth benchmarks before making cross-platform claims.

## Open work before submission

- Define a minimal architecture-neutral IR contract and architecture-specific semantic extension points.
- Add at least one non-MIPS ISA backend and one mainstream executable container (e.g. ELF or PE).
- Establish source-grounded benchmark binaries at multiple optimization levels.
- Implement trace/state differential verification with documented observable-state boundaries.
- Compare against established disassemblers/decompilers using reproducible versions and settings.
- Conduct a focused literature review on binary lifting, CFG recovery, SSA construction, type inference, and semantics-based validation.


## Formal invariant: predecessor-indexed Phi semantics

Let a basic block \\(B\\) have predecessor set \\(Pred(B)\\). A Phi definition for variable \\(x\\) is a finite mapping

\\[
\\phi_x : Pred(B) \\rightarrow Values.
\\]

For every control-flow edge \\(P \\rightarrow B\\), the value selected at entry to \\(B\\) is exactly \\(\\phi_x(P)\\). Consequently, the key set of the Phi mapping must equal the predecessor set of the block:

\\[
\\operatorname{dom}(\\phi_x) = Pred(B).
\\]

A positional list of values is insufficient unless a separately maintained, immutable ordering establishes a bijection with predecessor edges. This project therefore uses predecessor block identifiers as explicit keys. The invariant is checked independently of value identity: two predecessors may legitimately supply the same value, but neither edge may be omitted or invented.

For loop headers, the preheader is an ordinary incoming edge and its initial value must be represented alongside every backedge value. Whether a Phi is required is determined by the complete set of incoming values, not merely by whether the backedges disagree. If the preheader supplies \\(v_0\\) and every backedge supplies \\(v_1\\), then \\(v_0 \\ne v_1\\) still requires a Phi even if all backedges agree with one another.

A validator should additionally check:
- every predecessor and successor identifier resolves to a block;
- predecessor/successor relationships are reciprocal;
- every Phi has exactly one operand for each predecessor and no other operands;
- Phi operations occur before ordinary operations in their block;
- a block does not define the same Phi target more than once.

These are structural preconditions for later transformations, not a proof of whole-program semantic equivalence.

## Verification levels and claims

The implementation and paper should report verification as a ladder rather than one binary label:

| Level | Evidence | What it does not establish |
|---|---|---|
| V0 — decoded | Bytes decode under a stated ISA/mode | Correct code/data classification |
| V1 — structurally valid | CFG and IR invariants pass | Correct instruction semantics |
| V2 — semantically lifted | Supported instruction effects are represented | Correctness of unsupported effects |
| V3 — source emitted | A source representation is generated | That it preserves behavior |
| V4 — compiler accepted | Generated source compiles under stated flags | Behavioral equivalence |
| V5 — differential agreement | Original and output agree on documented tests/traces | Equivalence for all inputs |
| V6 — formal/complete proof | A sound proof covers the stated model and assumptions | Behavior outside that model |

A system must never silently promote a result to a higher level. For example, successful C compilation is V4 evidence only. Differential testing is valuable V5 evidence over its tested domain, but it is not a universal proof.

## Prototype evidence added during development

The current prototype now includes:
- predecessor-keyed register Phi construction rather than positional operands;
- loop-header Phi construction that includes the explicit initial/preheader edge;
- rejection of malformed predecessor identifiers, duplicate targets, empty values, and inconsistent merge metadata;
- a standalone CFG/Phi validator checking exact predecessor coverage, reciprocal edges, Phi placement, and duplicate definitions.

These additions are architecture-independent IR invariants. They do not yet provide a complete SSA construction algorithm, dominance-frontier placement, general loop fixed-point solution, alias-aware memory SSA, or a proof of semantic equivalence. The paper should describe them as implemented prototype checks, not as a complete SSA solution.

## Research methodology: falsifiable claims

Each proposed contribution should be stated as a falsifiable hypothesis with:
1. a precisely defined input population and executable format/ISA;
2. a ground-truth source/build pipeline where available;
3. an explicit output and correctness criterion;
4. a baseline tool or ablation setting;
5. reproducible versions, flags, fixtures, and scripts;
6. separate reporting of unsupported cases and analysis failures.

Useful ablations include removing relocation/symbol evidence, disabling recursive traversal, replacing edge-indexed Phi inputs with positional inputs, disabling memory-effect summaries, and allowing versus forbidding speculative structuring. The edge-indexed Phi ablation should measure both false acceptance of invalid merges and missed valid merges.

## Bibliography work still required

The paper is not submission-ready. A literature review must be conducted and verified against primary publications and project documentation. At minimum, cover:
- classic compiler data-flow analysis and SSA construction;
- binary lifting and intermediate representations;
- static disassembly and code/data classification;
- control-flow recovery for indirect branches and jump tables;
- type recovery and ABI inference;
- semantics-based and differential validation;
- established decompilers and their evaluation methodologies.

Do not add unverified citations or claim novelty until this review and a comparison against prior work are complete.
