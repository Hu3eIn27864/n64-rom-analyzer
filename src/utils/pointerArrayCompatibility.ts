import type { CType } from './cType';
export function pointerArrayCompatible(pointer:CType,array:CType):boolean { if(pointer.kind!=='pointer'||array.kind!=='array'||!pointer.element||!array.element)return false;return pointer.element.authoritative&&array.element.authoritative&&pointer.element.name===array.element.name; }
export function decayArrayToPointer(array:CType):CType|undefined { if(array.kind!=='array'||!array.element?.authoritative)return undefined;return {kind:'pointer',name:`${array.element.name} *`,element:array.element,authoritative:true}; }
