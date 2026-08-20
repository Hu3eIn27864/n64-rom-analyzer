import type { CFunctionSignature } from './cFunctionSignature';
export interface FunctionSymbolRegistry { readonly symbols:ReadonlyMap<string,CFunctionSignature>; readonly authoritative:boolean; }
export function createFunctionSymbolRegistry(signatures:readonly CFunctionSignature[]):FunctionSymbolRegistry { const symbols=new Map<string,CFunctionSignature>();for(const signature of signatures){if(signature.authoritative&&!symbols.has(signature.name))symbols.set(signature.name,signature);}return {symbols,authoritative:signatures.every(s=>s.authoritative)}; }
