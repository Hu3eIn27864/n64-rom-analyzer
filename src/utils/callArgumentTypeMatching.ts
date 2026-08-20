import type { CType } from './cType';
import type { CFunctionSignature } from './cFunctionSignature';
import { compatibleCTypes } from './cTypeCompatibility';
export interface CallArgumentTypeMatch { readonly parameter:string;readonly argumentType:CType;readonly compatible:boolean;readonly authoritative:boolean; }
export function matchCallArgumentTypes(signature:CFunctionSignature,argumentTypes:readonly CType[]):readonly CallArgumentTypeMatch[] { return signature.type.parameters.map((parameter,index)=>{const argumentType=argumentTypes[index];const compatible=Boolean(argumentType&&compatibleCTypes(parameter.type,argumentType));return {parameter:parameter.name,argumentType:argumentType??{kind:'unknown',name:'unknown',authoritative:false},compatible,authoritative:parameter.authoritative&&Boolean(argumentType?.authoritative)&&compatible};}); }
