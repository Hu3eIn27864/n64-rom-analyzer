import type { StructPointerCallSite } from './structPointerCallSites';

export interface StructPointerCallValidation {
  readonly valid: boolean;
  readonly conflicts: readonly string[];
}

export function validateStructPointerCalls(sites: readonly StructPointerCallSite[]): StructPointerCallValidation {
  const byTarget = new Map<string, Set<string>>();
  for (const site of sites) {
    const key = `${site.callee}#${site.argumentIndex}`;
    const values = byTarget.get(key) ?? new Set<string>();
    values.add(site.structName);
    byTarget.set(key, values);
  }
  const conflicts = [...byTarget.entries()]
    .filter(([, values]) => values.size > 1)
    .map(([key]) => key)
    .sort();
  return { valid: conflicts.length === 0, conflicts };
}
