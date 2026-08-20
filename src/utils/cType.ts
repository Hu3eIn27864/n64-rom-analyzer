export type CScalarType='void'|'bool'|'char'|'signed char'|'unsigned char'|'short'|'unsigned short'|'int'|'unsigned int'|'long'|'unsigned long'|'long long'|'unsigned long long'|'float'|'double'|'unknown';
export interface CType { readonly kind:'scalar'|'pointer'|'array'|'struct'|'unknown'; readonly name:string; readonly element?:CType; readonly length?:number; readonly authoritative:boolean; }
export const UNKNOWN_C_TYPE:CType={kind:'unknown',name:'unknown',authoritative:false};
export function scalarCType(name:CScalarType):CType { return name==='unknown'?UNKNOWN_C_TYPE:{kind:'scalar',name,authoritative:true}; }
export function pointerCType(element:CType):CType { return {kind:'pointer',name:`${element.name} *`,element,authoritative:element.authoritative}; }
