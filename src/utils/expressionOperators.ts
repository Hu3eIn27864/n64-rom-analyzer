export type UnaryOperator='neg'|'not'|'bitnot';
export type BinaryOperator='add'|'sub'|'mul'|'and'|'or'|'xor'|'shl'|'shr';
export interface UnaryExpression { readonly operator:UnaryOperator; readonly operand:string; readonly authoritative:boolean; }
export interface BinaryExpression { readonly operator:BinaryOperator; readonly left:string; readonly right:string; readonly authoritative:boolean; }
export function normalizeUnaryExpression(value:UnaryExpression):UnaryExpression|undefined { if(!value.operand.trim()||!value.authoritative)return undefined; return {...value,operand:value.operand.trim()}; }
export function normalizeBinaryExpression(value:BinaryExpression):BinaryExpression|undefined { if(!value.left.trim()||!value.right.trim()||!value.authoritative)return undefined; return {...value,left:value.left.trim(),right:value.right.trim()}; }
