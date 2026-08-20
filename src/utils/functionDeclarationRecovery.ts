import type { CFunctionSignature } from './cFunctionSignature';
import type { CDeclaration } from './cDeclaration';
export interface FunctionDeclarationRecovery { readonly signature:CFunctionSignature;readonly locals:readonly CDeclaration[];readonly complete:boolean; }
export function recoverFunctionDeclaration(signature:CFunctionSignature,locals:readonly CDeclaration[]):FunctionDeclarationRecovery|undefined { if(!signature.authoritative||locals.some(l=>!l.authoritative))return undefined;return {signature,locals:[...locals].sort((a,b)=>a.name.localeCompare(b.name)),complete:true}; }
