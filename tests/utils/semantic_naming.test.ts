import test from 'node:test';
import assert from 'node:assert/strict';
import { createSemanticNameCandidate, hasAuthoritativeSemanticEvidence } from '../../src/utils/semanticNameEvidence';
import { rankSemanticNameCandidates } from '../../src/utils/semanticNameRanking';
import { synthesizeSemanticFunctionName } from '../../src/utils/semanticNameSynthesis';
import { inferSemanticNamespace } from '../../src/utils/semanticNameNamespace';

const evidence = [{ kind: 'loop-shape' as const, detail: 'stable update loop', confidence: 0.95, authoritative: true }];

test('semantic naming evidence normalizes and preserves authority', () => {
  const candidate = createSemanticNameCandidate('0x80001000', 'update_state', evidence);
  assert.ok(candidate);
  assert.equal(hasAuthoritativeSemanticEvidence(candidate.evidence), true);
});

test('semantic naming ranking is deterministic', () => {
  const first = createSemanticNameCandidate('0x80001000', 'update_state', [{ ...evidence[0], confidence: 0.95 }])!;
  const second = createSemanticNameCandidate('0x80002000', 'process_state', [{ ...evidence[0], confidence: 0.7 }])!;
  assert.deepEqual(rankSemanticNameCandidates([second, first]).map((item) => item.proposedName), ['update_state', 'process_state']);
});

test('semantic naming synthesis is conservative without authority', () => {
  const result = synthesizeSemanticFunctionName({ address: 0x80001234, role: 'render', evidence: [] });
  assert.deepEqual(result, { name: 'sub_0x80001234', authoritative: false, reason: 'address-fallback' });
});

test('semantic namespace requires explicit authoritative evidence', () => {
  const result = inferSemanticNamespace([{ kind: 'memory-access', detail: 'namespace:audio', confidence: 0.93, authoritative: true }]);
  assert.deepEqual(result, { namespace: 'audio', confidence: 0.93, source: 'namespace:audio' });
});
