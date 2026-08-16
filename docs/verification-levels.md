# Verification levels

The analyzer uses evidence levels to avoid presenting inference as proof.

| Level | Meaning | Examples |
| --- | --- | --- |
| L0 | Parsed | ROM header, size, byte order, raw bytes |
| L1 | Decoded | MIPS instruction and operand decoding |
| L2 | Structurally analyzed | Reachability, functions, basic blocks, CFG, call graph |
| L3 | Semantically inferred | Data-flow meaning, types, structures, recovered names |
| L4 | Behaviorally verified | Original and generated representations agree under controlled execution |
| L5 | Binary verified | Rebuilt output is compared against the original binary |

## Rules

- A lower level does not imply that all higher levels are true.
- L3 results are hypotheses supported by evidence, not compiler-grade proof.
- L4 requires an independent execution/comparison path; source similarity is insufficient.
- L5 requires bytes produced by an actual rebuild/link process; copying original bytes is not verification.
- If a stage has not been performed, its status is `not-run`, not `verified`.

## Confidence versus verification

Confidence scores may be useful inside an inference pass, but confidence is not a verification level. A result can have high-confidence inference while remaining behaviorally unverified.

## Provenance

Future analysis objects should retain the evidence that produced each conclusion, for example:

```text
fact: jal target 0x1040
level: L1
source: instruction at 0x1010

inference: function 0x1040 likely adds a0 and a1
level: L3
source: data-flow through instructions 0x1040-0x1048
```
