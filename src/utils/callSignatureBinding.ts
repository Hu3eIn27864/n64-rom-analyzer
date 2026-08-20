import type { CFunctionSignature } from './cFunctionSignature';
import type { FunctionSymbolRegistry } from './functionSymbolRegistry';
export interface CallSignatureBinding { readonly target:string;readonly signature:CFunctionSignature;readonly authoritative:boolean; }
export function bindCallSignature(target:string,registry:FunctionSymbolRegistry):CallSignatureBinding|undefined { const name=target.trim();if(!name)return undefined;const signature=registry.symbols.get(name);if(!signature?.authoritative)return undefined;return {target:name,signature,authoritative:true}; }
