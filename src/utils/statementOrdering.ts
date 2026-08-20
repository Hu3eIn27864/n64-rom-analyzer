import type { FunctionStatement } from './functionBodyModel';
export function orderStatements(statements:readonly FunctionStatement[]):readonly FunctionStatement[] { return [...statements].sort((a,b)=>a.id.localeCompare(b.id)); }
