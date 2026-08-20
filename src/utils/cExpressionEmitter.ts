import type { CStatement } from './cStatement';
export interface CExpressionEmission { readonly statement:CStatement;readonly source:string;readonly authoritative:boolean; }
export function emitCExpression(statement:CStatement):CExpressionEmission|undefined { if(statement.kind!=='expression'&&statement.kind!=='assignment'&&statement.kind!=='call')return undefined;const source=statement.text.trim();if(!source)return undefined;return {statement,source,authoritative:statement.authoritative}; }
