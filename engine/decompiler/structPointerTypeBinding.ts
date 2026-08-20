import type { StructPointerNode } from './structPointerPropagationGraph';

export interface StructPointerTypeBinding { readonly functionSymbol: string; readonly parameterIndex: number; readonly structName: string; readonly authoritative: boolean; }

export function bindStructPointerTypes(nodes: readonly StructPointerNode[]): readonly StructPointerTypeBinding[] {
  const grouped = new Map<string, Set<string>>();
  for (const node of nodes) {
    const key = `${node.functionSymbol}#${node.parameterIndex}`;
    const names = grouped.get(key) ?? new Set<string>();
    names.add(node.structName);
    grouped.set(key, names);
  }
  return [...grouped.entries()].map(([key, names]) => {
    const [functionSymbol, index] = key.split('#');
    const values = [...names].sort();
    return { functionSymbol, parameterIndex: Number(index), structName: values.length === 1 ? values[0] : 'UNKNOWN', authoritative: values.length === 1 };
  }).sort((a,b)=>a.functionSymbol.localeCompare(b.functionSymbol)||a.parameterIndex-b.parameterIndex);
}
