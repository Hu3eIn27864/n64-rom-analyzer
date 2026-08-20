import type { CDeclaration } from './cDeclaration';
import type { CFunctionSignature } from './cFunctionSignature';
export interface CTranslationUnit { readonly declarations:readonly CDeclaration[]; readonly prototypes:readonly CFunctionSignature[]; readonly authoritative:boolean; }
export function createCTranslationUnit(declarations:readonly CDeclaration[],prototypes:readonly CFunctionSignature[]):CTranslationUnit { return {declarations:[...declarations],prototypes:[...prototypes],authoritative:declarations.every(d=>d.authoritative)&&prototypes.every(p=>p.authoritative)}; }
