import type { CDeclaration } from './cDeclaration';
export interface DeclarationExpression { readonly declaration:CDeclaration;readonly expression:string;readonly authoritative:boolean; }
export function bindDeclarationExpression(declaration:CDeclaration,expression:string):DeclarationExpression|undefined { if(!declaration.authoritative||!expression.trim())return undefined;return {declaration,expression:expression.trim(),authoritative:true}; }
