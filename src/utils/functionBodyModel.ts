export type StatementKind='expression'|'if'|'loop'|'return'|'break'|'continue'|'unknown';
export interface FunctionStatement { readonly id:string; readonly kind:StatementKind; readonly expression?:string; readonly authoritative:boolean; }
export interface FunctionBody { readonly functionSymbol:string; readonly statements:readonly FunctionStatement[]; }
export function normalizeFunctionStatement(value:FunctionStatement):FunctionStatement|undefined { if(!value.id.trim()||!value.authoritative)return undefined;return {...value,id:value.id.trim(),expression:value.expression?.trim()}; }
export function createFunctionBody(functionSymbol:string,statements:readonly FunctionStatement[]):FunctionBody|undefined { if(!functionSymbol.trim())return undefined;return {functionSymbol:functionSymbol.trim(),statements:[...statements]}; }
