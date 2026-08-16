import { DecompiledFunction, MipsInstruction } from '../types/n64';
import { createInitialCpuState, executeFormalMipsInstruction } from './mipsFormalSemantics';

/**
 * Differential-execution scaffolding.
 *
 * IMPORTANT: the current implementation executes the original MIPS instruction
 * stream with the project's formal semantics, but it does not execute an
 * independently generated C/C++ candidate. Therefore it can produce reference
 * execution checkpoints, but it cannot prove behavioral equivalence.
 */

export interface ExecutionCheckpoint {
  address: number;
  registerName: string;
  expectedValue: number;
  actualValue: number;
  hasDivergence: boolean;
}

export interface CegarRefinementResult {
  functionName: string;
  totalCheckpointsPassed: number;
  totalCheckpointsFailed: number;
  checkpoints: ExecutionCheckpoint[];
  refinedHypotheses: string[];
  isBehaviorallyIdentical: boolean;
  verificationStatus: 'unverified';
  verificationReason: string;
  faultInjectionTested?: boolean;
  counterexampleDetails?: string;
}

/**
 * Run reference MIPS execution and collect checkpoints.
 *
 * This is intentionally reported as unverified: expectedValue and actualValue
 * below come from the same formal MIPS simulation, so they are not an
 * independent differential comparison against generated code.
 */
export function runCegarDifferentialVerification(
  fn: DecompiledFunction,
  instructions: MipsInstruction[]
): CegarRefinementResult {
  const state = createInitialCpuState();
  state.pc = fn.entryAddress;

  const fnInsts = instructions.filter(
    (i) => i.address >= fn.entryAddress && i.address < fn.endAddress
  );

  const checkpoints: ExecutionCheckpoint[] = [];
  let failedCount = 0;
  let passedCount = 0;

  for (const inst of fnInsts) {
    const res = executeFormalMipsInstruction(inst, state);

    for (const [regIdx, val] of res.modifiedGprs) {
      const expected = val;
      const actual = val;
      const hasDivergentBit = expected !== actual;

      if (hasDivergentBit) {
        failedCount++;
      } else {
        passedCount++;
      }

      checkpoints.push({
        address: inst.address,
        registerName: `$r${regIdx}`,
        expectedValue: expected,
        actualValue: actual,
        hasDivergence: hasDivergentBit,
      });
    }

    state.pc = res.nextPc;
  }

  return {
    functionName: fn.name,
    totalCheckpointsPassed: passedCount,
    totalCheckpointsFailed: failedCount,
    checkpoints,
    refinedHypotheses: [],
    isBehaviorallyIdentical: false,
    verificationStatus: 'unverified',
    verificationReason:
      'Independent candidate execution is not available; checkpoints compare values produced by the same formal MIPS execution path.',
    faultInjectionTested: false,
  };
}

/**
 * Demonstration helper retained for future CEGAR work.
 *
 * This function describes a synthetic counterexample/refinement scenario; it
 * must not be presented as proof that the decompiler corrected itself.
 */
export function verifyCegarSelfCorrectionWithFaultInjection(fn: DecompiledFunction): {
  faultyHypothesis: string;
  counterexampleDetected: string;
  refinedHypothesis: string;
  isCorrected: boolean;
} {
  const faultyHypothesis = 'Field +0x18 = uint32_t bitmask integer';
  const expectedFprBits = 0x3f800000;
  const actualIntBits = 0x00000001;
  const counterexampleDetected = `Synthetic mismatch at PC 0x${fn.entryAddress.toString(16)}: expected IEEE 754 float 1.0f (0x${expectedFprBits.toString(16)}), synthetic uint32 bitfield (0x${actualIntBits.toString(16)})`;
  const refinedHypothesis = 'Field +0x18 = float32_t velocity vector scalar';

  return {
    faultyHypothesis,
    counterexampleDetected,
    refinedHypothesis,
    isCorrected: true,
  };
}
