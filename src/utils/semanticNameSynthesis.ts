import type { SemanticNameEvidence } from './semanticNameEvidence';
import { hasAuthoritativeSemanticEvidence } from './semanticNameEvidence';

export type SemanticFunctionRole = 'init' | 'update' | 'process' | 'render' | 'copy' | 'decode' | 'compare' | 'wait' | 'dma' | 'math';

export interface SemanticNameSynthesisInput {
  readonly address: number;
  readonly role?: SemanticFunctionRole;
  readonly namespace?: string;
  readonly evidence: readonly SemanticNameEvidence[];
}

export interface SemanticNameSynthesisResult {
  readonly name: string;
  readonly authoritative: boolean;
  readonly reason: 'role-evidence' | 'address-fallback';
}

function addressSuffix(address: number): string {
  if (!Number.isInteger(address) || address < 0) return 'unknown';
  return `0x${address.toString(16).padStart(8, '0')}`;
}

function identifier(value: string): string {
  return value.trim().replace(/[^A-Za-z0-9_]+/g, '_').replace(/^([0-9])/, '_$1');
}

export function synthesizeSemanticFunctionName(input: SemanticNameSynthesisInput): SemanticNameSynthesisResult {
  const authoritative = hasAuthoritativeSemanticEvidence(input.evidence);
  if (input.role && authoritative) {
    const namespace = input.namespace ? `${identifier(input.namespace)}_` : '';
    return { name: `${namespace}${input.role}_${addressSuffix(input.address)}`, authoritative: true, reason: 'role-evidence' };
  }
  return { name: `sub_${addressSuffix(input.address)}`, authoritative: false, reason: 'address-fallback' };
}
