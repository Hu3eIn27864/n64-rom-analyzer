import type { StackSlot } from './stackFrameIndex';
export interface StackParameterBinding { readonly functionSymbol:string; readonly parameterIndex:number; readonly offset:number; readonly size:1|2|4|8; }
export function bindStackParameter(slot:StackSlot, parameterIndex:number):StackParameterBinding|undefined { if(slot.kind!=='parameter')return undefined; if(!Number.isInteger(parameterIndex)||parameterIndex<0)return undefined; return {functionSymbol:slot.functionSymbol,parameterIndex,offset:slot.offset,size:slot.size}; }
