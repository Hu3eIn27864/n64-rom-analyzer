import type { CWhileStatement } from './cControlFlowStatement';
export function emitCWhileStatement(value:CWhileStatement,indent=''):string { const child=`${indent}    `;const body=value.body.map(s=>`${child}${s.text}`).join('\n');return `${indent}while (${value.condition}) {\n${body}\n${indent}}`; }
