import type { CType } from './cType';
import type { CFunctionParameter } from './cFunctionType';
import { createCFunctionType,type CFunctionType } from './cFunctionType';
import { createCFunctionSignature,type CFunctionSignature } from './cFunctionSignature';
export interface CFunctionSignatureRecovery { readonly signature:CFunctionSignature;readonly complete:boolean; }
export function recoverCFunctionSignature(name:string,returnType:CType,parameters:readonly CFunctionParameter[]):CFunctionSignatureRecovery|undefined { const type=createCFunctionType(returnType,parameters);if(!type)return undefined;const signature=createCFunctionSignature(name,type);if(!signature)return undefined;return {signature,complete:true}; }
export function recoverCFunctionType(returnType:CType,parameters:readonly CFunctionParameter[]):CFunctionType|undefined { return createCFunctionType(returnType,parameters); }
