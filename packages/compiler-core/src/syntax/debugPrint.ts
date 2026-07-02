import { Token } from './tokens';
import {
  Argument,
  AstNode,
  Declaration,
  Expression,
  FieldDecl,
  ParamDecl,
  SourceFileNode,
  Statement,
  TypeRef,
  UiElement,
} from './ast';

/**
 * Debug/outline printing for tokens and the AST.
 *
 * This is the text form the IDE's AST view builds on, so it favors a compact
 * but genuinely readable outline over a raw structural dump: types are
 * rendered back to source syntax (`List<User>`, `URL?`), literals show their
 * value, and every node keeps its `line:col-line:col` range for cross-checking
 * against the source.
 */

/** One token per line: `KwModule 'module' 1:1-1:7`. */
export function printTokens(tokens: Token[]): string {
  const lines = tokens.map((tok) => `${tok.kind} '${tok.text}' ${locRange(tok.span)}`);
  return `${lines.join('\n')}\n`;
}

type Push = (depth: number, text: string) => void;

export function printAst(file: SourceFileNode): string {
  const lines: string[] = [];
  const push: Push = (depth, text) => lines.push(`${'  '.repeat(depth)}${text}`);

  push(0, `SourceFile ${file.path} ${loc(file)}`);
  if (file.module) {
    push(1, `Module ${file.module.name} ${loc(file.module)}`);
  }
  for (const imp of file.imports) {
    push(1, `Import ${imp.path} ${loc(imp)}`);
  }
  for (const decl of file.declarations) {
    printDeclaration(decl, 1, push);
  }
  return `${lines.join('\n')}\n`;
}

// ---------------------------------------------------------------------------
// Locations
// ---------------------------------------------------------------------------

function locRange(span: { startLine: number; startColumn: number; endLine: number; endColumn: number }): string {
  return `${span.startLine}:${span.startColumn}-${span.endLine}:${span.endColumn}`;
}

function loc(node: AstNode): string {
  return locRange(node.span);
}

// ---------------------------------------------------------------------------
// Types and expressions, rendered back to source-like syntax
// ---------------------------------------------------------------------------

function renderType(type: TypeRef): string {
  if (type.kind === 'OptionalType') {
    return `${renderType(type.inner)}?`;
  }
  const args = type.typeArgs.length > 0 ? `<${type.typeArgs.map(renderType).join(', ')}>` : '';
  return `${type.name}${args}`;
}

function renderExpr(expr: Expression): string {
  switch (expr.kind) {
    case 'StringLiteral':
      return JSON.stringify(expr.value);
    case 'IntLiteral':
    case 'FloatLiteral':
      return expr.text;
    case 'BoolLiteral':
      return expr.value ? 'true' : 'false';
    case 'NullLiteral':
      return 'null';
    case 'Identifier':
      return expr.name;
    case 'MemberAccess':
      return `${renderExpr(expr.object)}.${expr.member.text}`;
    case 'Call':
      return `${renderExpr(expr.callee)}(${expr.args.map(renderArgument).join(', ')})`;
    case 'Binary':
      return `${renderExpr(expr.left)} ${expr.operator} ${renderExpr(expr.right)}`;
    case 'Unary':
      return `${expr.operator}${renderExpr(expr.operand)}`;
  }
}

function renderArgument(arg: Argument): string {
  const value = renderExpr(arg.value);
  return arg.name ? `${arg.name.text}: ${value}` : value;
}

function renderParam(param: ParamDecl): string {
  const defaultText = param.defaultValue ? ` = ${renderExpr(param.defaultValue)}` : '';
  return `${param.name.text}: ${renderType(param.type)}${defaultText}`;
}

function renderParams(params: readonly ParamDecl[]): string {
  return params.map(renderParam).join(', ');
}

// ---------------------------------------------------------------------------
// Declarations
// ---------------------------------------------------------------------------

function printDeclaration(decl: Declaration, depth: number, push: Push): void {
  switch (decl.kind) {
    case 'ModelDecl':
      printModel(decl, depth, push);
      return;
    case 'EnumDecl':
      printEnumLike('Enum', decl.name.text, decl.cases, decl, depth, push);
      return;
    case 'ErrorDecl':
      printEnumLike('Error', decl.name.text, decl.cases, decl, depth, push);
      return;
    case 'CapabilityDecl':
      push(depth, `Capability ${decl.name.text} ${loc(decl)}`);
      return;
    case 'FunctionDecl':
      printFunction(decl, depth, push);
      return;
    case 'ComponentDecl':
      push(depth, `Component ${decl.name.text}(${renderParams(decl.params)}) ${loc(decl)}`);
      for (const el of decl.body) printUiElement(el, depth + 1, push);
      return;
    case 'ScreenDecl':
      push(depth, `Screen ${decl.name.text}(${renderParams(decl.params)}) ${loc(decl)}`);
      if (decl.title) {
        push(depth + 1, `Title ${JSON.stringify(decl.title.value)} ${loc(decl.title)}`);
      }
      for (const el of decl.body) printUiElement(el, depth + 1, push);
      return;
    case 'RouteDecl':
      printRoute(decl, depth, push);
      return;
    case 'NativeFunctionDecl':
      printNativeFunction(decl, depth, push);
      return;
  }
}

function printModel(decl: Extract<Declaration, { kind: 'ModelDecl' }>, depth: number, push: Push): void {
  push(depth, `Model ${decl.name.text} ${loc(decl)}`);
  for (const field of decl.fields) {
    printField(field, depth + 1, push);
  }
}

function printField(field: FieldDecl, depth: number, push: Push): void {
  const defaultText = field.defaultValue ? ` = ${renderExpr(field.defaultValue)}` : '';
  push(depth, `Field ${field.name.text}: ${renderType(field.type)}${defaultText} ${loc(field)}`);
}

function printEnumLike(
  label: 'Enum' | 'Error',
  name: string,
  cases: Extract<Declaration, { kind: 'EnumDecl' | 'ErrorDecl' }>['cases'],
  decl: AstNode,
  depth: number,
  push: Push,
): void {
  push(depth, `${label} ${name} ${loc(decl)}`);
  for (const c of cases) {
    const paramsText = c.params.length > 0 ? `(${renderParams(c.params)})` : '';
    push(depth + 1, `Case ${c.name.text}${paramsText} ${loc(c)}`);
  }
}

function printFunction(decl: Extract<Declaration, { kind: 'FunctionDecl' }>, depth: number, push: Push): void {
  push(depth, `Function ${functionSignature(decl)} ${loc(decl)}`);
  for (const stmt of decl.body.statements) {
    printStatement(stmt, depth + 1, push);
  }
}

function functionSignature(decl: {
  name: { text: string };
  params: readonly ParamDecl[];
  requiresCapabilities: readonly { text: string }[];
  isAsync: boolean;
  throwsType?: TypeRef;
  returnType?: TypeRef;
}): string {
  let signature = `${decl.name.text}(${renderParams(decl.params)})`;
  if (decl.requiresCapabilities.length > 0) {
    signature += ` requires ${decl.requiresCapabilities.map((c) => c.text).join(', ')}`;
  }
  if (decl.isAsync) {
    signature += ' async';
  }
  if (decl.throwsType) {
    signature += ` throws ${renderType(decl.throwsType)}`;
  }
  if (decl.returnType) {
    signature += ` -> ${renderType(decl.returnType)}`;
  }
  return signature;
}

function printRoute(decl: Extract<Declaration, { kind: 'RouteDecl' }>, depth: number, push: Push): void {
  const pathText = decl.segments
    .map((s) => (s.kind === 'StaticRouteSegment' ? `/${s.text}` : `/:${s.name}`))
    .join('');
  const bindingsText =
    decl.bindings.length > 0 ? `(${decl.bindings.map((b) => `${b.name.text}: ${renderType(b.type)}`).join(', ')})` : '';
  push(depth, `Route ${pathText} -> ${decl.screen.text}${bindingsText} ${loc(decl)}`);
}

function printNativeFunction(decl: Extract<Declaration, { kind: 'NativeFunctionDecl' }>, depth: number, push: Push): void {
  const signature = functionSignature({
    name: decl.name,
    params: decl.params,
    requiresCapabilities: [],
    isAsync: decl.isAsync,
    throwsType: decl.throwsType,
    returnType: decl.returnType,
  });
  push(depth, `Native ${decl.target} fn ${signature} ${loc(decl)}`);
  push(depth + 1, `Raw ${loc(decl.rawBody)}`);
  for (const line of decl.rawBody.text.split('\n')) {
    push(depth + 2, line);
  }
}

// ---------------------------------------------------------------------------
// Statements
// ---------------------------------------------------------------------------

function printStatement(stmt: Statement, depth: number, push: Push): void {
  switch (stmt.kind) {
    case 'LetStatement': {
      const keyword = stmt.mutable ? 'Var' : 'Let';
      const typeText = stmt.declaredType ? `: ${renderType(stmt.declaredType)}` : '';
      push(depth, `${keyword} ${stmt.name.text}${typeText} = ${renderExpr(stmt.initializer)} ${loc(stmt)}`);
      return;
    }
    case 'ReturnStatement':
      push(depth, `Return${stmt.value ? ` ${renderExpr(stmt.value)}` : ''} ${loc(stmt)}`);
      return;
    case 'IfStatement':
      printIf(stmt, depth, push);
      return;
    case 'ExpressionStatement':
      push(depth, `Expr ${renderExpr(stmt.expression)} ${loc(stmt)}`);
      return;
  }
}

function printIf(stmt: Extract<Statement, { kind: 'IfStatement' }>, depth: number, push: Push): void {
  push(depth, `If ${renderExpr(stmt.condition)} ${loc(stmt)}`);
  for (const s of stmt.thenBlock.statements) {
    printStatement(s, depth + 1, push);
  }
  if (stmt.elseBlock) {
    push(depth, `Else ${loc(stmt.elseBlock)}`);
    if (stmt.elseBlock.kind === 'IfStatement') {
      printStatement(stmt.elseBlock, depth + 1, push);
    } else {
      for (const s of stmt.elseBlock.statements) {
        printStatement(s, depth + 1, push);
      }
    }
  }
}

// ---------------------------------------------------------------------------
// UI elements
// ---------------------------------------------------------------------------

function printUiElement(el: UiElement, depth: number, push: Push): void {
  const argsText = el.args.length > 0 ? `(${el.args.map(renderArgument).join(', ')})` : '';
  push(depth, `Ui ${el.name.text}${argsText} ${loc(el)}`);
  for (const child of el.children) {
    printUiElement(child, depth + 1, push);
  }
}
