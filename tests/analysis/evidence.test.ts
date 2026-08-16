import test from 'node:test';
import { strict as assert } from 'node:assert';
import { createEvidenceSummary, isAuthoritative } from '../../engine/analysis/evidence';

test('preserves analysis counts and evidence status', () => {
  const summary = createEvidenceSummary(
    { functions: 2, basicBlocks: 5, instructions: 12 },
    {
      romParsed: { status: 'verified' },
      mipsDecoded: { status: 'verified' },
      cfg: { status: 'verified' },
      functions: { status: 'inferred' },
      types: { status: 'inferred' },
      semantics: { status: 'unverified', reason: 'independent backend unavailable' },
      differential: { status: 'not-run' },
      byteMatch: { status: 'not-run' },
    },
  );

  assert.equal(summary.functions, 2);
  assert.equal(summary.instructions, 12);
  assert.equal(summary.verification.semantics.status, 'unverified');
});

test('only verified stages are authoritative', () => {
  assert.equal(isAuthoritative({ status: 'verified' }), true);
  assert.equal(isAuthoritative({ status: 'inferred' }), false);
  assert.equal(isAuthoritative({ status: 'unverified' }), false);
  assert.equal(isAuthoritative({ status: 'not-run' }), false);
});
