# VR4300 semantic coverage ledger

This ledger distinguishes decoding from semantic lifting. A mnemonic appearing in the decoder is **not** evidence that its behavior is modeled. The canonical lifter must either emit complete Micro-C semantics or attach an `unsupportedInstructions` diagnostic; silently dropping architectural effects is not acceptable.

## Implemented semantic families

- Integer ALU: supported operations are represented in `engine/ir/lifter.ts`; signed overflow and 64-bit mode restrictions are explicit where modeled.
- HI/LO: word and doubleword multiply/divide plus HI/LO transfers.
- Integer memory: byte/halfword/word/doubleword loads and stores, LL/SC, and both word (`LWL/LWR/SWL/SWR`) and doubleword (`LDL/LDR/SDL/SDR`) merge operations. Word loads sign-extend to 64-bit GPR width; merge stores invalidate a matching LLbit reservation. Reverse-endian lanes and alignment/mode exceptions are modeled by the runtime helpers.
- Decoder metadata: CP0 transfer and CACHE operands are preserved explicitly, even though the corresponding stateful semantics remain unsupported.
- COP1: the currently supported transfers, arithmetic, comparisons, conversions, FCSR behavior, and runtime exceptions are represented in Micro-C.

## Explicitly incomplete families

| Family | Current policy | Work required |
|---|---|---|
| MFC0/DMFC0/MTC0/DMTC0 | Unsupported diagnostic | Model register-specific access, privilege, read/write masks and side effects |

| TLBP/TLBR/TLBWI/TLBWR | Unsupported diagnostic | Model TLB entries, probe/write rules and architectural state |
| ERET | Unsupported diagnostic | Model Status.EXL/ERL, EPC/ErrorEPC selection, mode transition and control-flow termination |
| SYSCALL/BREAK/TRAP instructions | Unsupported diagnostic | Model exception code, EPC/BD, delay-slot state and exception vector |
| SYNC | Unsupported diagnostic | Define the guest memory/concurrency model before lowering ordering semantics |
| CACHE | Unsupported diagnostic | Define cacheability and cache-operation effects; do not treat cache operations as no-ops |

## Verification gates for every new family

1. Decoder fixtures cover all relevant encodings and operand layouts.
2. Lifter tests assert exact Micro-C operations or an explicit unsupported diagnostic.
3. Runtime tests cover boundary lanes, mode/privilege checks, exceptions and state side effects.
4. The full unit suite, canonical ROM/decoder typecheck, Analysis Regression and production build pass on the exact PR head.
5. Synthetic ROM fixtures are preferred. Commercial ROM images must not be committed; any external ROM regression corpus needs documented provenance and legal test status.

## Implementation sequence

1. LWL/LWR/SWL/SWR.
2. CP0 register access and privileged instructions.
3. TLB and exception/control-flow state.
4. SYNC and CACHE, only after the memory/cache model is explicit.
5. Decoder-to-lifter coverage audit and reproducible synthetic ROM regression corpus.

The sequence is dependency-aware: exception state and memory semantics must be trustworthy before privileged control-flow instructions are advertised as supported.
