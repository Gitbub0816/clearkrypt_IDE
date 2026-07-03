import {
  IrDeclaration,
  IrExpression,
  IrProject,
  IrStatement,
  IrType,
} from '../ir/nodes';

/**
 * Readable IR outline for snapshot tests and the IDE's IR view.
 * Mirrors the style of `printAst`: indentation shows structure, types are
 * rendered the way a developer would write them.
 */
export function printIr(project: IrProject): string {
  const lines: string[] = [];
  for (const module of project.modules) {
    lines.push(`Module ${module.name} (${module.file})`);
    for (const decl of module.declarations) {
      printDeclaration(decl, lines);
    }
  }
  return lines.join('\n') + '\n';
}

function printDeclaration(decl: IrDeclaration, lines: string[]): void {
  switch (decl.kind) {
    case 'model':
      lines.push(`  Model ${decl.name}`);
      for (const field of decl.fields) {
        const suffix = field.defaultValue ? ` = ${printExpression(field.defaultValue)}` : '';
        lines.push(`    Field ${field.name}: ${printType(field.type)}${suffix}`);
      }
      break;
    case 'enum':
    case 'error':
      lines.push(`  ${decl.kind === 'enum' ? 'Enum' : 'Error'} ${decl.name}${decl.isSimple ? ' (simple)' : ''}`);
      for (const c of decl.cases) {
        const params = c.fields.map((f) => `${f.name}: ${printType(f.type)}`).join(', ');
        lines.push(`    Case ${c.name}${params ? `(${params})` : ''}`);
      }
      break;
    case 'function': {
      const params = decl.params.map((p) => `${p.name}: ${printType(p.type)}`).join(', ');
      const asyncPart = decl.isAsync ? ' async' : '';
      const throwsPart = decl.throwsType ? ` throws ${decl.throwsType.name}` : '';
      lines.push(
        `  Function ${decl.name}(${params})${asyncPart}${throwsPart} -> ${printType(decl.returnType)}`,
      );
      for (const statement of decl.body) {
        printStatement(statement, lines, '    ');
      }
      break;
    }
  }
}

function printStatement(statement: IrStatement, lines: string[], indent: string): void {
  switch (statement.kind) {
    case 'let':
      lines.push(
        `${indent}${statement.mutable ? 'Var' : 'Let'} ${statement.name}: ` +
          `${printType(statement.type)} = ${printExpression(statement.value)}`,
      );
      break;
    case 'return':
      lines.push(`${indent}Return${statement.value ? ` ${printExpression(statement.value)}` : ''}`);
      break;
    case 'if':
      lines.push(`${indent}If ${printExpression(statement.condition)}`);
      for (const s of statement.then) printStatement(s, lines, indent + '  ');
      if (statement.else) {
        lines.push(`${indent}Else`);
        for (const s of statement.else) printStatement(s, lines, indent + '  ');
      }
      break;
    case 'ifLet':
      lines.push(
        `${indent}IfLet ${statement.name}: ${printType(statement.type)} = ` +
          printExpression(statement.value),
      );
      for (const s of statement.then) printStatement(s, lines, indent + '  ');
      if (statement.else) {
        lines.push(`${indent}Else`);
        for (const s of statement.else) printStatement(s, lines, indent + '  ');
      }
      break;
    case 'throw':
      lines.push(`${indent}Throw ${printExpression(statement.value)}`);
      break;
    case 'expr':
      lines.push(`${indent}Expr ${printExpression(statement.expression)}`);
      break;
  }
}

function printExpression(expr: IrExpression): string {
  switch (expr.kind) {
    case 'stringLiteral':
      return `"${expr.value}" : ${printType(expr.type)}`;
    case 'intLiteral':
      return `${expr.text} : ${printType(expr.type)}`;
    case 'floatLiteral':
      return `${expr.text} : ${printType(expr.type)}`;
    case 'boolLiteral':
      return `${expr.value} : ${printType(expr.type)}`;
    case 'nullLiteral':
      return `null : ${printType(expr.type)}`;
    case 'localRef':
      return `local(${expr.name}) : ${printType(expr.type)}`;
    case 'paramRef':
      return `param(${expr.name}) : ${printType(expr.type)}`;
    case 'fieldAccess':
      return (
        `${printExpression(expr.object)}${expr.optionalChaining ? '?.' : '.'}${expr.field}` +
        ` : ${printType(expr.type)}`
      );
    case 'interpolatedString':
      return (
        'interp("' +
        expr.parts
          .map((p) => (p.kind === 'text' ? p.value : '\\(' + printExpression(p) + ')'))
          .join('') +
        `") : ${printType(expr.type)}`
      );
    case 'enumValue':
      return (
        `case ${expr.enumType.name}.${expr.caseName}` +
        (expr.args.length > 0
          ? `(${expr.args.map((a) => `${a.name}: ${printExpression(a.value)}`).join(', ')})`
          : '') +
        ` : ${printType(expr.type)}`
      );
    case 'match': {
      const arms = expr.arms
        .map(
          (arm) =>
            `${arm.caseName}${arm.bindings.length > 0 ? `(${arm.bindings.map((b) => b.name).join(', ')})` : ''} -> ${printExpression(arm.body)}`,
        )
        .join('; ');
      const elsePart = expr.elseBody ? `; else -> ${printExpression(expr.elseBody)}` : '';
      return `match(${printExpression(expr.scrutinee)}) { ${arms}${elsePart} } : ${printType(expr.type)}`;
    }
    case 'try':
      return `try ${printExpression(expr.expression)}`;
    case 'call':
      return (
        `call ${expr.function.module}.${expr.function.name}(` +
        expr.args.map((a) => `${a.name}: ${printExpression(a.value)}`).join(', ') +
        `) : ${printType(expr.type)}`
      );
    case 'construct':
      return (
        `construct ${expr.model.module}.${expr.model.name}(` +
        expr.args.map((a) => `${a.name}: ${printExpression(a.value)}`).join(', ') +
        `) : ${printType(expr.type)}`
      );
    case 'binary':
      return `(${printExpression(expr.left)} ${expr.operator} ${printExpression(expr.right)}) : ${printType(expr.type)}`;
    case 'unary':
      return `(${expr.operator}${printExpression(expr.operand)}) : ${printType(expr.type)}`;
  }
}

function printType(type: IrType): string {
  switch (type.kind) {
    case 'primitive':
      return type.name;
    case 'declared':
      return type.name;
    case 'optional':
      return `${printType(type.inner)}?`;
    case 'list':
      return `List<${printType(type.element)}>`;
    case 'map':
      return `Map<${printType(type.key)}, ${printType(type.value)}>`;
    case 'set':
      return `Set<${printType(type.element)}>`;
  }
}
