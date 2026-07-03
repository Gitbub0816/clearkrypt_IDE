import { Diagnostic, TargetName } from '../diagnostics/diagnostic';
import { DiagnosticCodes } from '../diagnostics/codes';
import {
  IrDeclaration,
  IrDeclaredType,
  IrEnumCase,
  IrExpression,
  IrField,
  IrFunction,
  IrModule,
  IrOrigin,
  IrParam,
  IrProject,
  IrStatement,
  IrType,
} from '../ir/nodes';
import {
  CaseDecl,
  Expression,
  FieldDecl,
  FunctionDecl,
  IfStatement,
  MatchExpression,
  NativeTarget,
  ParamDecl,
  SourceFileNode,
  Statement,
  TypeRef,
} from '../syntax/ast';
import { Span } from '../text/span';
import { CheckedProject } from '../sem/checker';
import { SemType } from '../sem/types';

/**
 * Lowers a checked project into the target-neutral IR.
 *
 * Constitution (Document 5 §9): no code is emitted from unchecked source.
 * If the checked project contains error diagnostics, this returns an empty
 * IR project and no extra diagnostics — callers gate the build on the
 * checker's output.
 *
 * Declarations the emitters cannot honestly produce yet (screens,
 * components, routes, capabilities, native bodies) are reported as CK0004
 * warnings per declaration instead of being silently dropped.
 */
export interface LowerResult {
  readonly project: IrProject;
  readonly diagnostics: readonly Diagnostic[];
}

export interface LowerOptions {
  /** Targets the project builds for; defaults to all three. */
  readonly targets?: readonly TargetName[];
}

const allTargets: readonly TargetName[] = ['swift', 'kotlin', 'react'];

/** Which native-block target satisfies each build target. */
const nativeTargetFor: Readonly<Record<TargetName, NativeTarget>> = {
  swift: 'swift',
  kotlin: 'kotlin',
  react: 'typescript',
};

export function lowerProject(checked: CheckedProject, options: LowerOptions = {}): LowerResult {
  if (checked.diagnostics.some((d) => d.severity === 'error')) {
    return { project: { modules: [] }, diagnostics: [] };
  }
  const lowerer = new Lowerer(checked, options.targets ?? allTargets);
  return lowerer.lower();
}

class Lowerer {
  private readonly diagnostics: Diagnostic[] = [];

  constructor(
    private readonly checked: CheckedProject,
    private readonly targets: readonly TargetName[],
  ) {}

  lower(): LowerResult {
    const modules: IrModule[] = [];
    for (const module of this.checked.modules) {
      modules.push(this.lowerModule(module.fileNode, module.name));
    }
    return { project: { modules }, diagnostics: this.diagnostics };
  }

  private lowerModule(file: SourceFileNode, moduleName: string): IrModule {
    const declarations: IrDeclaration[] = [];
    for (const decl of file.declarations) {
      switch (decl.kind) {
        case 'ModelDecl':
          declarations.push({
            kind: 'model',
            name: decl.name.text,
            fields: decl.fields.map((f) => this.lowerField(f, moduleName)),
            origin: this.origin(moduleName, file.path, decl.span),
          });
          break;
        case 'EnumDecl':
        case 'ErrorDecl': {
          const cases = decl.cases.map((c) => this.lowerCase(c, moduleName, file.path));
          const isSimple = cases.every((c) => c.fields.length === 0);
          declarations.push({
            kind: decl.kind === 'EnumDecl' ? 'enum' : 'error',
            name: decl.name.text,
            cases,
            isSimple,
            origin: this.origin(moduleName, file.path, decl.span),
          });
          break;
        }
        case 'FunctionDecl':
          declarations.push(this.lowerFunction(decl, moduleName, file.path));
          break;
        case 'ScreenDecl':
        case 'ComponentDecl':
        case 'RouteDecl':
        case 'CapabilityDecl': {
          const what =
            decl.kind === 'ScreenDecl'
              ? `Screen '${decl.name.text}'`
              : decl.kind === 'ComponentDecl'
                ? `Component '${decl.name.text}'`
                : decl.kind === 'CapabilityDecl'
                  ? `Capability '${decl.name.text}'`
                  : 'This route';
          this.diagnostics.push({
            code: DiagnosticCodes.UnsupportedTargetFeature,
            severity: 'warning',
            message:
              `${what} type-checks but is not emitted yet: target lowering for it lands ` +
              `with a later milestone (see docs/19-target-mappings.md). It was left out of ` +
              `the generated output.`,
            span: decl.span,
          });
          break;
        }
        case 'NativeFunctionDecl':
          this.checkNativeCoverage(decl.name.text, moduleName);
          break;
      }
    }
    return { name: moduleName, file: file.path, declarations };
  }

  /** Reports CK0005 per missing target and CK0004 once per native group. */
  private readonly reportedNativeGroups = new Set<string>();

  private checkNativeCoverage(name: string, moduleName: string): void {
    const key = `${moduleName}.${name}`;
    if (this.reportedNativeGroups.has(key)) return;
    this.reportedNativeGroups.add(key);

    const symbol = this.checked.modules
      .find((m) => m.name === moduleName)
      ?.declarations.get(name);
    if (!symbol || !symbol.nativeImplementations) return;

    for (const target of this.targets) {
      const needed = nativeTargetFor[target];
      if (!symbol.nativeImplementations.has(needed)) {
        this.diagnostics.push({
          code: DiagnosticCodes.MissingNativeImplementation,
          severity: 'error',
          message:
            `Native function '${name}' has no ${needed} implementation, but the '${target}' ` +
            `target is selected. Implemented targets: ` +
            `${[...symbol.nativeImplementations.keys()].join(', ')}. Add a ` +
            `'native ${needed} fn ${name}(...)' block or narrow the selected targets.`,
          span: symbol.nameSpan,
          target,
        });
      }
    }
    this.diagnostics.push({
      code: DiagnosticCodes.UnsupportedTargetFeature,
      severity: 'warning',
      message:
        `Native function '${name}' type-checks but native build inclusion lands with a later ` +
        `milestone (see docs/19-target-mappings.md). It was left out of the generated output.`,
      span: symbol.nameSpan,
    });
  }

  private lowerField(field: FieldDecl | ParamDecl, moduleName: string): IrField {
    return {
      name: field.name.text,
      type: this.lowerTypeRef(field.type),
      defaultValue: field.defaultValue ? this.lowerExpression(field.defaultValue) : undefined,
      origin: this.origin(moduleName, field.name.span.file, field.span),
    };
  }

  private lowerCase(c: CaseDecl, moduleName: string, file: string): IrEnumCase {
    return {
      name: c.name.text,
      fields: c.params.map((p) => this.lowerField(p, moduleName)),
      origin: this.origin(moduleName, file, c.span),
    };
  }

  private lowerFunction(decl: FunctionDecl, moduleName: string, file: string): IrFunction {
    const params: IrParam[] = decl.params.map((p) => ({
      name: p.name.text,
      type: this.lowerTypeRef(p.type),
      defaultValue: p.defaultValue ? this.lowerExpression(p.defaultValue) : undefined,
      origin: this.origin(moduleName, file, p.span),
    }));
    const returnType: IrType = decl.returnType
      ? this.lowerTypeRef(decl.returnType)
      : { kind: 'primitive', name: 'Void' };
    let throwsType: IrDeclaredType | undefined;
    if (decl.throwsType) {
      const lowered = this.lowerTypeRef(decl.throwsType);
      if (lowered.kind === 'declared') {
        throwsType = lowered;
      }
    }
    return {
      kind: 'function',
      name: decl.name.text,
      params,
      returnType,
      isAsync: decl.isAsync,
      throwsType,
      body: decl.body.statements.map((s) => this.lowerStatement(s, moduleName, file)),
      origin: this.origin(moduleName, file, decl.span),
    };
  }

  private lowerStatement(statement: Statement, moduleName: string, file: string): IrStatement {
    switch (statement.kind) {
      case 'LetStatement':
        return {
          kind: 'let',
          name: statement.name.text,
          mutable: statement.mutable,
          type: this.typeOf(statement.initializer),
          value: this.lowerExpression(statement.initializer),
        };
      case 'ReturnStatement':
        return {
          kind: 'return',
          value: statement.value ? this.lowerExpression(statement.value) : undefined,
        };
      case 'IfStatement':
        return {
          kind: 'if',
          condition: this.lowerExpression(statement.condition),
          then: statement.thenBlock.statements.map((s) => this.lowerStatement(s, moduleName, file)),
          else: this.lowerElseBranch(statement.elseBlock, moduleName, file),
        };
      case 'IfLetStatement': {
        const valueType = this.typeOf(statement.value);
        return {
          kind: 'ifLet',
          name: statement.name.text,
          type: valueType.kind === 'optional' ? valueType.inner : valueType,
          value: this.lowerExpression(statement.value),
          then: statement.thenBlock.statements.map((s) => this.lowerStatement(s, moduleName, file)),
          else: this.lowerElseBranch(statement.elseBlock, moduleName, file),
        };
      }
      case 'ThrowStatement':
        return { kind: 'throw', value: this.lowerExpression(statement.value) };
      case 'ExpressionStatement':
        return { kind: 'expr', expression: this.lowerExpression(statement.expression) };
      case 'FunctionDecl':
        return { kind: 'localFunction', function: this.lowerFunction(statement, moduleName, file) };
    }
  }

  private lowerElseBranch(
    elseBlock: IfStatement['elseBlock'],
    moduleName: string,
    file: string,
  ): IrStatement[] | undefined {
    if (!elseBlock) return undefined;
    if (elseBlock.kind === 'IfStatement' || elseBlock.kind === 'IfLetStatement') {
      return [this.lowerStatement(elseBlock, moduleName, file)];
    }
    return elseBlock.statements.map((s) => this.lowerStatement(s, moduleName, file));
  }

  private lowerExpression(expr: Expression): IrExpression {
    const type = this.typeOf(expr);
    switch (expr.kind) {
      case 'StringLiteral':
        return { kind: 'stringLiteral', value: expr.value, type };
      case 'IntLiteral':
        return { kind: 'intLiteral', text: expr.text, type };
      case 'FloatLiteral':
        return { kind: 'floatLiteral', text: expr.text, type };
      case 'BoolLiteral':
        return { kind: 'boolLiteral', value: expr.value, type };
      case 'NullLiteral':
        return { kind: 'nullLiteral', type };
      case 'Identifier': {
        const kind = this.checked.identifierKinds.get(expr) ?? 'local';
        return kind === 'param'
          ? { kind: 'paramRef', name: expr.name, type }
          : { kind: 'localRef', name: expr.name, type };
      }
      case 'MemberAccess': {
        const enumValue = this.checked.enumValues.get(expr);
        if (enumValue) {
          return this.lowerEnumValue(expr, enumValue, type);
        }
        return {
          kind: 'fieldAccess',
          object: this.lowerExpression(expr.object),
          field: expr.member.text,
          optionalChaining: expr.optionalChaining,
          type,
        };
      }
      case 'InterpolatedString':
        return {
          kind: 'interpolatedString',
          parts: expr.parts.map((part) =>
            part.kind === 'StringTextPart'
              ? { kind: 'text' as const, value: part.value }
              : this.lowerExpression(part),
          ),
          type,
        };
      case 'Match':
        return this.lowerMatch(expr, type);
      case 'Try':
        return { kind: 'try', expression: this.lowerExpression(expr.expression), type };
      case 'Call': {
        const enumValue = this.checked.enumValues.get(expr);
        if (enumValue) {
          return this.lowerEnumValue(expr, enumValue, type);
        }
        const resolution = this.checked.callResolutions.get(expr);
        if (!resolution) {
          // Unresolvable calls only exist in projects with errors, which are
          // gated out above; this is a defensive fallback.
          throw new Error('lowerProject called on a project with unresolved calls');
        }
        const args = resolution.args.map((a) => ({
          name: a.name,
          value: this.lowerExpression(a.value),
        }));
        if (resolution.kind === 'construct') {
          return {
            kind: 'construct',
            model: { name: resolution.target.name, module: resolution.target.module },
            args,
            type,
          };
        }
        return {
          kind: 'call',
          function: { name: resolution.target.name, module: resolution.target.module },
          args,
          type,
        };
      }
      case 'Binary':
        return {
          kind: 'binary',
          operator: expr.operator,
          left: this.lowerExpression(expr.left),
          right: this.lowerExpression(expr.right),
          type,
        };
      case 'Unary':
        return {
          kind: 'unary',
          operator: expr.operator,
          operand: this.lowerExpression(expr.operand),
          type,
        };
    }
  }

  private lowerEnumValue(
    expr: Expression,
    enumValue: { readonly caseName: string; readonly args: readonly { name: string; value: Expression }[] },
    type: IrType,
  ): IrExpression {
    if (type.kind !== 'declared') {
      throw new Error('internal error: enum value without a declared type reached lowering');
    }
    return {
      kind: 'enumValue',
      enumType: type,
      caseName: enumValue.caseName,
      args: enumValue.args.map((a) => ({ name: a.name, value: this.lowerExpression(a.value) })),
      type,
    };
  }

  private lowerMatch(expr: MatchExpression, type: IrType): IrExpression {
    const scrutineeType = this.typeOf(expr.scrutinee);
    if (scrutineeType.kind !== 'declared') {
      throw new Error('internal error: match over a non-declared type reached lowering');
    }
    return {
      kind: 'match',
      scrutinee: this.lowerExpression(expr.scrutinee),
      enumType: scrutineeType,
      arms: expr.arms.map((arm) => {
        const fields = this.checked.matchArmFields.get(arm) ?? [];
        return {
          caseName: arm.caseName.text,
          bindings: fields.map((f) => ({
            name: f.name,
            field: f.field,
            type: semToIrType(f.type),
          })),
          body: this.lowerExpression(arm.body),
        };
      }),
      elseBody: expr.elseArm ? this.lowerExpression(expr.elseArm) : undefined,
      type,
    };
  }

  private typeOf(expr: Expression): IrType {
    const semType = this.checked.expressionTypes.get(expr);
    if (!semType) {
      throw new Error('lowerProject called on an expression the checker never saw');
    }
    return semToIrType(semType);
  }

  private lowerTypeRef(ref: TypeRef): IrType {
    const semType = this.checked.typeRefTypes.get(ref);
    if (!semType) {
      throw new Error('lowerProject called on a type reference the checker never resolved');
    }
    return semToIrType(semType);
  }

  private origin(module: string, file: string, span: Span): IrOrigin {
    return { file, span, module };
  }
}

function semToIrType(type: SemType): IrType {
  switch (type.kind) {
    case 'primitive':
      return { kind: 'primitive', name: type.name };
    case 'declared':
      return {
        kind: 'declared',
        name: type.name,
        module: type.module,
        declarationKind: type.declarationKind,
      };
    case 'optional':
      return { kind: 'optional', inner: semToIrType(type.inner) };
    case 'list':
      return { kind: 'list', element: semToIrType(type.element) };
    case 'map':
      return { kind: 'map', key: semToIrType(type.key), value: semToIrType(type.value) };
    case 'set':
      return { kind: 'set', element: semToIrType(type.element) };
    case 'null':
    case 'error':
      // Gated out by the error check in lowerProject; never reachable for
      // valid projects.
      throw new Error(`internal error: '${type.kind}' type reached lowering`);
  }
}
