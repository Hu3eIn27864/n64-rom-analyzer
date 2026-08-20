import type { CType } from './cType';
import { createCDeclaration,type CDeclaration } from './cDeclaration';
export interface VariableEvidence { readonly name:string; readonly type:CType; readonly initializer?:string; readonly authoritative:boolean; }
export function recoverVariableDeclaration(value:VariableEvidence):CDeclaration|undefined { if(!value.authoritative)return undefined;return createCDeclaration(value.name,value.type,value.initializer); }
