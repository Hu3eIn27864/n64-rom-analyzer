export type SemanticFunctionRole = 'initializer' | 'update' | 'dispatcher' | 'wrapper' | 'accessor' | 'handler' | 'unknown';

export interface FunctionRoleEvidence {
  readonly calls: number;
  readonly callers: number;
  readonly loops: number;
  readonly returns: number;
  readonly memoryReads: number;
  readonly memoryWrites: number;
  readonly branches: number;
}

export interface SemanticFunctionClassification {
  readonly role: SemanticFunctionRole;
  readonly confidence: number;
}

export function classifySemanticFunctionRole(e: FunctionRoleEvidence): SemanticFunctionClassification {
  const n = (v: number) => Number.isFinite(v) && v >= 0 ? v : 0;
  const calls = n(e.calls), callers = n(e.callers), loops = n(e.loops), reads = n(e.memoryReads), writes = n(e.memoryWrites), branches = n(e.branches), returns = n(e.returns);
  if (callers > 1 && branches >= 2 && calls >= 2) return { role: 'dispatcher', confidence: Math.min(1, 0.55 + callers * 0.05 + branches * 0.04) };
  if (loops > 0 && writes > reads) return { role: 'update', confidence: Math.min(1, 0.65 + loops * 0.08) };
  if (calls === 1 && reads + writes <= 1 && returns >= 1) return { role: 'wrapper', confidence: 0.72 };
  if (reads > 0 && writes === 0 && calls === 0) return { role: 'accessor', confidence: 0.7 };
  if (writes > 0 && callers <= 1 && loops === 0) return { role: 'initializer', confidence: 0.68 };
  if (branches > 0 && calls > 0) return { role: 'handler', confidence: 0.62 };
  return { role: 'unknown', confidence: 0 };
}
