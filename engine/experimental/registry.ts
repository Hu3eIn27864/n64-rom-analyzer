export type ExperimentalEngineKind = 'ai-naming' | 'cpp-lifting' | 'speculative-semantics';

export interface ExperimentalEngineDescriptor {
  id: string;
  kind: ExperimentalEngineKind;
  description: string;
  authoritative: false;
}

const engines = new Map<string, ExperimentalEngineDescriptor>();

export function registerExperimentalEngine(descriptor: ExperimentalEngineDescriptor): void {
  engines.set(descriptor.id, { ...descriptor, authoritative: false });
}

export function listExperimentalEngines(): ExperimentalEngineDescriptor[] {
  return [...engines.values()].map((engine) => ({ ...engine }));
}

export function getExperimentalEngine(id: string): ExperimentalEngineDescriptor | undefined {
  const engine = engines.get(id);
  return engine ? { ...engine } : undefined;
}
