import test from 'node:test';
import { strict as assert } from 'node:assert';
import { inferTypes, integerEvidence, pointerEvidence } from '../../engine/ir/typeInference';

test('resolves pointer when address-use evidence is strongest', () => {
  const result = inferTypes({
    r4: [
      pointerEvidence('used as a memory address', 0.9),
      integerEvidence('uint32_t', 'also participates in arithmetic', 0.4),
    ],
  });
  assert.equal(result.variables[0].resolved, 'pointer');
});

test('retains candidate evidence instead of discarding weaker hypotheses', () => {
  const result = inferTypes({
    r5: [
      integerEvidence('uint32_t', 'compared as an unsigned value', 0.6),
      integerEvidence('int32_t', 'used in signed arithmetic', 0.5),
    ],
  });
  assert.equal(result.variables[0].candidates.length, 2);
  assert.equal(result.variables[0].resolved, 'uint32_t');
});

test('returns unknown when no evidence exists', () => {
  const result = inferTypes({ r6: [] });
  assert.equal(result.variables[0].resolved, 'unknown');
});
