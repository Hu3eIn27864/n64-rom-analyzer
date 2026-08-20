export type CType = 'void' | 'int32_t' | 'uint32_t' | 'float' | 'double' | 'pointer' | 'unknown';

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
}

export interface CProgram { functions: CFunction[]; }

export function renderExpr(expr: CExpr): string {
  switch (expr.kind) {
    case 'literal': return String(expr.value ?? '0');
    case 'variable': return String(expr.value ?? 'unknown');
    case 'binary': return `(${renderExpr(expr.left!)} ${expr.op ?? '?'} ${renderExpr(expr.right!)})`;
    case 'unary': return `(${expr.op ?? '?'}${renderExpr(expr.operand!)})`;
    case 'call': return `${expr.callee ?? 'unknown'}(${(expr.args ?? []).map(renderExpr).join(', ')})`;
    case 'cast': return `((${expr.type ?? 'unknown'})${renderExpr(expr.operand!)})`;
  }
}

function flattenBranchStatements(statements: readonly CStmt[]): CStmt[] {
  const flattened: CStmt[] = [];
  for (const statement of statements) {
    if (statement.kind === 'block' && statement.body?.length === 1 && statement.body[0]?.kind === 'block') {
      flattened.push(...flattenBranchStatements(statement.body));
    } else {
      flattened.push(statement);
    }
  }
  return flattened;
}

export function renderStmt(stmt: CStmt, indent = ''): string {
  switch (stmt.kind) {
    case 'decl': return `${indent}${stmt.type ?? 'unknown'} ${stmt.name ?? 'tmp'}${stmt.init ? ` = ${renderExpr(stmt.init)}` : ''};`;
    case 'expr': return `${indent}${renderExpr(stmt.expr!)};`;
    case 'return': return `${indent}return${stmt.expr ? ` ${renderExpr(stmt.expr)}` : ''};`;
    case 'break': return `${indent}break;`;
    case 'continue': return `${indent}continue;`;
    case 'if': {
      const renderBranchBody = (branch: CStmt | undefined, branchIndent: string): string => {
        if (!branch) return `${branchIndent}    {}`;
        if (branch.kind === 'block') {
          return flattenBranchStatements(branch.body ?? []).map(s => renderStmt(s, `${branchIndent}    `)).join('\n');
        }
        return renderStmt(branch, `${branchIndent}    `);
      };
      const thenText = renderBranchBody(stmt.thenBranch, indent);
      const elseText = stmt.elseBranch ? ` else\n${indent}{\n${renderBranchBody(stmt.elseBranch, indent)}\n${indent}}` : '';
      return `${indent}if (${renderExpr(stmt.condition!)})\n${indent}{\n${thenText}\n${indent}}${elseText}`;
    }
    case 'while': return `${indent}while (${renderExpr(stmt.condition!)})\n${indent}{\n${flattenBranchStatements(stmt.body ?? []).map(s => renderStmt(s, `${indent}    `)).join('\n')}\n${indent}}`;
    case 'block': return `${indent}{\n${(stmt.body ?? []).map(s => renderStmt(s, `${indent}    `)).join('\n')}\n${indent}}`;
  }
}

export function renderFunction(fn: CFunction): string {
  const params = fn.parameters.length === 0 ? '()' : fn.parameters.map(p => `${p.type} ${p.name}`).join(', ');
  const body = fn.body.map(stmt => renderStmt(stmt, '    ')).join('\n');
  return `${fn.returnType} ${fn.name}(${params})\n{\n${body}\n}`;
}

export function renderProgram(program: CProgram): string {
  return program.functions.map(renderFunction).join('\n\n') + (program.functions.length ? '\n' : '');
}
