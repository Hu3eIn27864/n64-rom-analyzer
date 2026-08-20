export type ComparisonOperator='eq'|'ne'|'lt'|'le'|'gt'|'ge';
export interface ComparisonExpression { readonly operator:ComparisonOperator; readonly left:string; readonly right:string; readonly authoritative:boolean; }
export function normalizeComparison(value:ComparisonExpression):ComparisonExpression|undefined { if(!value.authoritative||!value.left.trim()||!value.right.trim())return undefined; return {...value,left:value.left.trim(),right:value.right.trim()}; }
