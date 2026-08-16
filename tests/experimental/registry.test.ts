import test from 'node:test';
import { strict as assert } from 'node:assert';
import { getExperimentalEngine, listExperimentalEngines, registerExperimentalEngine } from '../../engine/experimental/registry';

test('experimental engines are explicitly non-authoritative', () => {
  registerExperimentalEngine({
    id: 'cpp-lifter',
    kind: 'cpp-lifting',
    description: 'Experimental C++ lifting backend',
    authoritative: false,
  });

  const engine = getExperimentalEngine('cpp-lifter');
  assert.ok(engine);
  assert.equal(engine.authoritative, false);
  assert.equal(listExperimentalEngines().length, 1);
});
