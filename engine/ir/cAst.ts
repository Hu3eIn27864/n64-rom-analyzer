export type CType = 'void' | 'int32_t' | 'uint32_t' | 'uint64_t' | 'uintptr_t' | 'vr4300_fpu_state *' | 'float' | 'double' | 'pointer' | 'unknown';

export interface CExpr {
  kind: 'literal' | 'variable' | 'binary' | 'unary' | 'call' | 'cast';
  value?: string | number;
  op?: string;
  left?: CExpr;
  right?: CExpr;
  operand?: CExpr;
  callee?: string;
  args?: CExpr[];
  type?: CType;
}

export interface CStmt {
  kind: 'decl' | 'expr' | 'return' | 'if' | 'while' | 'block' | 'break' | 'continue';
  name?: string;
  type?: CType;
  init?: CExpr;
  expr?: CExpr;
  condition?: CExpr;
  thenBranch?: CStmt;
  elseBranch?: CStmt;
  body?: CStmt[];
}

export interface CFunction {
  kind: 'function';
  name: string;
  returnType: CType;
  parameters: Array<{ name: string; type: CType }>;
  body: CStmt[];
  useVoidForEmptyParameters?: boolean;
  /** C runtime definitions required by this decompiled function. */
  preamble?: string[];
}

export interface CProgram {
  functions: CFunction[];
}

export function renderExpr(expr: CExpr): string {
  switch (expr.kind) {
    case 'literal': return String(expr.value ?? '0');
    case 'variable': return String(expr.value ?? 'unknown');
    case 'binary': return `(${renderExpr(expr.left!)} ${expr.op ?? '?'} ${renderExpr(expr.right!)})`;
    case 'unary': return `${expr.op ?? '?'}${renderExpr(expr.operand!)}`;
    case 'call': return `${expr.callee ?? 'unknown'}(${(expr.args ?? []).map(renderExpr).join(', ')})`;
    case 'cast': return `((${expr.type ?? 'unknown'})${renderExpr(expr.operand!)})`;
  }
}

export function renderStmt(stmt: CStmt, indent = ''): string {
  switch (stmt.kind) {
    case 'decl': return `${indent}${stmt.type ?? 'unknown'} ${stmt.name ?? 'tmp'}${stmt.init ? ` = ${renderExpr(stmt.init)}` : ''};`;
    case 'expr': return `${indent}${renderExpr(stmt.expr!)};`;
    case 'return': return `${indent}return${stmt.expr ? ` ${renderExpr(stmt.expr)}` : ''};`;
    case 'break': return `${indent}break;`;
    case 'continue': return `${indent}continue;`;
    case 'if': {
      const renderBranch = (branch: CStmt | undefined): string => {
        if (!branch) return '';
        const statements = branch.kind === 'block' ? (branch.body ?? []) : [branch];
        return statements.map(child => renderStmt(child, `${indent}    `)).join('\n');
      };
      const thenText = renderBranch(stmt.thenBranch);
      const elseText = stmt.elseBranch ? ` else\n${indent}{\n${renderBranch(stmt.elseBranch)}\n${indent}}` : '';
      return `${indent}if (${renderExpr(stmt.condition!)})\n${indent}{\n${thenText}\n${indent}}${elseText}`;
    }
    case 'while': return `${indent}while (${renderExpr(stmt.condition!)})\n${indent}{\n${(stmt.body ?? []).map(s => renderStmt(s, `${indent}    `)).join('\n')}\n${indent}}`;
    case 'block': return `${indent}{\n${(stmt.body ?? []).map(s => renderStmt(s, `${indent}    `)).join('\n')}\n${indent}}`;
  }
}

export function renderFunction(fn: CFunction): string {
  const params = fn.parameters.length === 0 && fn.useVoidForEmptyParameters ? 'void' : fn.parameters.map(p => `${p.type} ${p.name}`).join(', ');
  const body = fn.body.map(stmt => renderStmt(stmt, '    ')).join('\n');
  const preamble = fn.preamble?.length ? fn.preamble.join('\n\n') + '\n\n' : '';
  return preamble + fn.returnType + ' ' + fn.name + '(' + params + ')\n{\n' + body + '\n}';
}

export function renderProgram(program: CProgram): string {
  const preamble = [...new Set(program.functions.flatMap(fn => fn.preamble ?? []))];
  const functions = program.functions.map(fn => renderFunction({ ...fn, preamble: undefined }));
  const prefix = preamble.length ? preamble.join('\n\n') + '\n\n' : '';
  return prefix + functions.join('\n\n') + (functions.length ? '\n' : '');
}
