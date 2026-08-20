import type { FunctionBody,FunctionStatement } from './functionBodyModel';
import { createFunctionBody } from './functionBodyModel';
import { orderStatements } from './statementOrdering';
export interface StructuredFunctionRecovery { readonly body:FunctionBody;readonly complete:boolean; }
export function recoverStructuredFunction(functionSymbol:string,statements:readonly FunctionStatement[]):StructuredFunctionRecovery|undefined { const ordered=orderStatements(statements);const body=createFunctionBody(functionSymbol,ordered);if(!body)return undefined;return {body,complete:ordered.every(statement=>statement.authoritative&&statement.kind!=='unknown')}; }
