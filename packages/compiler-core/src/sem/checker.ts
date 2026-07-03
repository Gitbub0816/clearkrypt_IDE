import { Diagnostic, DiagnosticSeverity } from '../diagnostics/diagnostic';
import { DiagnosticCodes } from '../diagnostics/codes';
import { SourceFileInput } from '../text/sourceFile';
import { Span } from '../text/span';
import {
  Argument,
  Block,
  CallExpression,
  CaseDecl,
  Declaration,
  Expression,
  FunctionDecl,
  IdentifierExpression,
  InterpolatedStringExpression,
  MatchArm,
  MatchExpression,
  MemberAccessExpression,
  NameNode,
  NativeFunctionDecl,
  NativeTarget,
  ParamDecl,
  RouteDecl,
  ScreenDecl,
  ComponentDecl,
  SourceFileNode,
  Statement,
  TypeRef,
  UiElement,
} from '../syntax/ast';
import { parseSource } from '../parse/parser';
import {
  errorType,
  primitiveNames,
  primitiveType,
  SemType,
  typesAssignable,
  typeToString,
} from './types';
import { DeclarationSymbol, ModuleSymbol, SemanticModel, SymbolInfo, SymbolKind } from './symbols';

/**
 * The ClearKrypt project checker.
 *
 * Produces the trusted semantic model (Constitution Document 5 §9-10): no
 * code is emitted from unchecked source. Alongside diagnostics it records
 * resolution maps keyed by AST node identity, so lowering never re-derives
 * semantics.
 */

/** How a call expression was resolved: a function call or model construction. */
export interface CallResolution {
  readonly kind: 'function' | 'construct' | 'native';
  readonly target: DeclarationSymbol;
  /** Arguments with resolved parameter/field names, in declaration order. */
  readonly args: readonly { readonly name: string; readonly value: Expression }[];
}

export interface CheckedProject {
  readonly files: readonly SourceFileNode[];
  readonly modules: readonly ModuleSymbol[];
  readonly semanticModel: SemanticModel;
  readonly diagnostics: readonly Diagnostic[];
  /** Resolved type of every checked expression (AST node identity keys). */
  readonly expressionTypes: ReadonlyMap<Expression, SemType>;
  /** Whether an identifier expression names a local binding or a parameter. */
  readonly identifierKinds: ReadonlyMap<IdentifierExpression, 'local' | 'param'>;
  /** Resolution of every call expression. */
  readonly callResolutions: ReadonlyMap<CallExpression, CallResolution>;
  /** Resolved semantic type of every written type reference. */
  readonly typeRefTypes: ReadonlyMap<TypeRef, SemType>;
  /** Resolved payload bindings for every checked match arm: binding name, declared field, type. */
  readonly matchArmFields: ReadonlyMap<
    MatchArm,
    readonly { name: string; field: string; type: SemType }[]
  >;
  /** Enum/error case values (`Status.pending`, `E.server(message: x)`), keyed by node. */
  readonly enumValues: ReadonlyMap<
    Expression,
    { readonly caseName: string; readonly args: readonly { name: string; value: Expression }[] }
  >;
}

export function checkProject(sources: readonly SourceFileInput[]): CheckedProject {
  const parsed = sources.map((source) => parseSource(source));
  return checkParsedProject(parsed);
}

export function checkParsedProject(
  parsed: readonly { file: SourceFileNode; diagnostics: readonly Diagnostic[] }[],
): CheckedProject {
  const checker = new Checker();
  return checker.check(parsed);
}

// ---------------------------------------------------------------------------
// Implementation
// ---------------------------------------------------------------------------

interface FunctionContext {
  readonly returnType: SemType;
  /** The declared throws type of the enclosing function, when it has one. */
  readonly throwsType?: SemType;
  /** Innermost scope last. Scope 0 holds parameters. */
  readonly scopes: Map<string, { type: SemType; kind: 'local' | 'param' }>[];
  /**
   * Local (nested) function declarations visible at each block depth,
   * innermost last, parallel to `scopes`. A synthesized `DeclarationSymbol`
   * per entry lets local calls reuse the same resolution and lowering path
   * as top-level function calls (Constitution Document 5: one resolution
   * pipeline, not a parallel one for a "lesser" feature).
   */
  readonly localFunctions: Map<string, DeclarationSymbol>[];
  /** Import + module scope for the enclosing file. */
  readonly fileScope: FileScope;
}

interface FileScope {
  readonly module: ModuleSymbol;
  /** Imported symbols by local name. */
  readonly imports: Map<string, DeclarationSymbol>;
}

class Checker {
  private readonly diagnostics: Diagnostic[] = [];
  private readonly modules = new Map<string, ModuleSymbol>();
  private readonly expressionTypes = new Map<Expression, SemType>();
  private readonly identifierKinds = new Map<IdentifierExpression, 'local' | 'param'>();
  private readonly callResolutions = new Map<CallExpression, CallResolution>();
  private readonly typeRefTypes = new Map<TypeRef, SemType>();
  private readonly matchArmFields = new Map<
    MatchArm,
    { name: string; field: string; type: SemType }[]
  >();
  private readonly enumValues = new Map<
    Expression,
    { caseName: string; args: { name: string; value: Expression }[] }
  >();

  check(
    parsed: readonly { file: SourceFileNode; diagnostics: readonly Diagnostic[] }[],
  ): CheckedProject {
    for (const p of parsed) {
      this.diagnostics.push(...p.diagnostics);
    }

    const fileScopes = this.collectModules(parsed.map((p) => p.file));
    this.resolveImports(fileScopes);
    // Two passes: all signatures resolve before any body is checked, so a
    // call may reference a function declared later in its file or project.
    for (const scope of fileScopes) {
      this.checkSignatures(scope);
    }
    for (const scope of fileScopes) {
      this.checkBodies(scope);
    }

    return {
      files: parsed.map((p) => p.file),
      modules: [...this.modules.values()],
      semanticModel: this.buildSemanticModel(),
      diagnostics: this.diagnostics,
      expressionTypes: this.expressionTypes,
      identifierKinds: this.identifierKinds,
      callResolutions: this.callResolutions,
      typeRefTypes: this.typeRefTypes,
      matchArmFields: this.matchArmFields,
      enumValues: this.enumValues,
    };
  }

  // -- Phase A/B: modules and declaration symbols ---------------------------

  private collectModules(files: readonly SourceFileNode[]): FileScope[] {
    const scopes: FileScope[] = [];
    for (const file of files) {
      if (!file.module) {
        if (file.declarations.length > 0 || file.imports.length > 0) {
          this.report(
            DiagnosticCodes.MissingModule,
            'error',
            `This file declares no module. Add a module declaration such as ` +
              `'module app.main' as the first line so its declarations can be ` +
              `referenced from the rest of the project.`,
            file.span,
          );
        }
        continue;
      }
      const existing = this.modules.get(file.module.name);
      if (existing) {
        this.report(
          DiagnosticCodes.DuplicateModule,
          'error',
          `Module '${file.module.name}' is already declared in ${existing.file}. ` +
            `Each module may be declared by exactly one file.`,
          file.module.span,
          { related: [{ message: 'First declared here.', span: existing.fileNode.module!.span }] },
        );
        continue;
      }
      const declarations = new Map<string, DeclarationSymbol>();
      const routes: RouteDecl[] = [];
      for (const decl of file.declarations) {
        this.collectDeclaration(file.module.name, decl, declarations, routes);
      }
      const moduleSymbol: ModuleSymbol = {
        name: file.module.name,
        file: file.path,
        fileNode: file,
        declarations,
        routes,
      };
      this.modules.set(file.module.name, moduleSymbol);
      scopes.push({ module: moduleSymbol, imports: new Map() });
    }
    return scopes;
  }

  private collectDeclaration(
    moduleName: string,
    decl: Declaration,
    declarations: Map<string, DeclarationSymbol>,
    routes: RouteDecl[],
  ): void {
    if (decl.kind === 'RouteDecl') {
      routes.push(decl);
      return;
    }
    const kind = symbolKindOf(decl);
    const name = decl.name.text;
    const existing = declarations.get(name);

    if (decl.kind === 'NativeFunctionDecl') {
      if (existing && existing.kind === 'native') {
        const impls = existing.nativeImplementations as Map<NativeTarget, NativeFunctionDecl>;
        if (impls.has(decl.target)) {
          this.report(
            DiagnosticCodes.DuplicateDeclaration,
            'error',
            `Native function '${name}' already has a ${decl.target} implementation ` +
              `in module '${moduleName}'. Each target may be implemented once.`,
            decl.name.span,
            { related: [{ message: 'First implementation here.', span: impls.get(decl.target)!.name.span }] },
          );
          return;
        }
        impls.set(decl.target, decl);
        return;
      }
      if (existing) {
        this.reportDuplicate(name, moduleName, decl.name.span, existing.nameSpan);
        return;
      }
      declarations.set(name, {
        name,
        kind: 'native',
        module: moduleName,
        nameSpan: decl.name.span,
        node: decl,
        nativeImplementations: new Map([[decl.target, decl]]),
      });
      return;
    }

    if (existing) {
      this.reportDuplicate(name, moduleName, decl.name.span, existing.nameSpan);
      return;
    }
    declarations.set(name, { name, kind, module: moduleName, nameSpan: decl.name.span, node: decl });
  }

  private reportDuplicate(name: string, moduleName: string, span: Span, firstSpan: Span): void {
    this.report(
      DiagnosticCodes.DuplicateDeclaration,
      'error',
      `'${name}' is already declared in module '${moduleName}'. ` +
        `Declaration names must be unique within a module.`,
      span,
      { related: [{ message: 'First declared here.', span: firstSpan }] },
    );
  }

  // -- Phase C: imports ------------------------------------------------------

  private resolveImports(fileScopes: readonly FileScope[]): void {
    for (const scope of fileScopes) {
      for (const imp of scope.module.fileNode.imports) {
        const segments = imp.path.split('.');
        if (segments.length < 2) {
          this.report(
            DiagnosticCodes.UnknownImport,
            'error',
            `Import path '${imp.path}' is too short. Imports name a symbol inside a ` +
              `module, e.g. 'import app.models.User'.`,
            imp.span,
          );
          continue;
        }
        const symbolName = segments[segments.length - 1]!;
        const moduleName = segments.slice(0, -1).join('.');
        const targetModule = this.modules.get(moduleName);
        if (!targetModule) {
          this.report(
            DiagnosticCodes.UnknownImport,
            'error',
            `Cannot find module '${moduleName}' in this project. ` +
              `Check the module declaration in the file that should provide '${symbolName}'.`,
            imp.span,
          );
          continue;
        }
        const symbol = targetModule.declarations.get(symbolName);
        if (!symbol) {
          this.report(
            DiagnosticCodes.UnknownImport,
            'error',
            `Module '${moduleName}' has no declaration named '${symbolName}'. ` +
              `Available: ${listNames([...targetModule.declarations.keys()])}.`,
            imp.span,
          );
          continue;
        }
        const collision =
          scope.imports.get(symbolName) ?? scope.module.declarations.get(symbolName);
        if (collision) {
          this.report(
            DiagnosticCodes.DuplicateDeclaration,
            'error',
            `'${symbolName}' is already available in this file. ` +
              `Remove the duplicate import or rename the local declaration.`,
            imp.span,
          );
          continue;
        }
        scope.imports.set(symbolName, symbol);
      }
    }
  }

  // -- Phase D: type resolution ----------------------------------------------

  private resolveTypeRef(ref: TypeRef, scope: FileScope, allowVoidNever: boolean): SemType {
    const resolved = this.resolveTypeRefInner(ref, scope, allowVoidNever);
    this.typeRefTypes.set(ref, resolved);
    return resolved;
  }

  private resolveTypeRefInner(ref: TypeRef, scope: FileScope, allowVoidNever: boolean): SemType {
    if (ref.kind === 'OptionalType') {
      const inner = this.resolveTypeRef(ref.inner, scope, false);
      return inner.kind === 'error' ? errorType : { kind: 'optional', inner };
    }

    const name = ref.name;
    const args = ref.typeArgs;

    if ((primitiveNames as readonly string[]).includes(name)) {
      if (args.length > 0) {
        this.report(
          DiagnosticCodes.UnknownType,
          'error',
          `'${name}' does not take type arguments.`,
          ref.span,
        );
        return errorType;
      }
      if ((name === 'Void' || name === 'Never') && !allowVoidNever) {
        this.report(
          DiagnosticCodes.UnknownType,
          'error',
          `'${name}' can only be used as a function return type.`,
          ref.span,
        );
        return errorType;
      }
      return primitiveType(name as SemType extends never ? never : (typeof primitiveNames)[number]);
    }

    if (name === 'List' || name === 'Set') {
      if (args.length !== 1) {
        this.report(
          DiagnosticCodes.UnknownType,
          'error',
          `'${name}' takes exactly one type argument, e.g. ${name}<String>; found ${args.length}.`,
          ref.span,
        );
        return errorType;
      }
      const element = this.resolveTypeRef(args[0]!, scope, false);
      if (element.kind === 'error') return errorType;
      return name === 'List' ? { kind: 'list', element } : { kind: 'set', element };
    }

    if (name === 'Map') {
      if (args.length !== 2) {
        this.report(
          DiagnosticCodes.UnknownType,
          'error',
          `'Map' takes exactly two type arguments, e.g. Map<ID, User>; found ${args.length}.`,
          ref.span,
        );
        return errorType;
      }
      const key = this.resolveTypeRef(args[0]!, scope, false);
      const value = this.resolveTypeRef(args[1]!, scope, false);
      if (key.kind === 'error' || value.kind === 'error') return errorType;
      return { kind: 'map', key, value };
    }

    if (args.length > 0) {
      this.report(
        DiagnosticCodes.UnknownType,
        'error',
        `Generic user-defined types are not supported yet; '${name}' cannot take type arguments.`,
        ref.span,
      );
      return errorType;
    }

    const symbol = scope.module.declarations.get(name) ?? scope.imports.get(name);
    if (!symbol) {
      const hint = this.findTypeElsewhere(name);
      this.report(
        DiagnosticCodes.UnknownType,
        'error',
        `Unknown type '${name}'.` +
          (hint ? ` Did you mean to add 'import ${hint}.${name}'?` : ''),
        ref.span,
      );
      return errorType;
    }
    if (symbol.kind !== 'model' && symbol.kind !== 'enum' && symbol.kind !== 'error') {
      this.report(
        DiagnosticCodes.UnknownType,
        'error',
        `'${name}' is a ${symbol.kind}, not a type. Only models, enums, and errors can be used as types.`,
        ref.span,
      );
      return errorType;
    }
    return { kind: 'declared', name, module: symbol.module, declarationKind: symbol.kind };
  }

  private findTypeElsewhere(name: string): string | undefined {
    for (const module of this.modules.values()) {
      const symbol = module.declarations.get(name);
      if (symbol && (symbol.kind === 'model' || symbol.kind === 'enum' || symbol.kind === 'error')) {
        return module.name;
      }
    }
    return undefined;
  }

  // -- Phase E: declaration checking ------------------------------------------

  /** Pass 1: resolve every declared type surface and report signature errors. */
  private checkSignatures(scope: FileScope): void {
    for (const decl of scope.module.fileNode.declarations) {
      switch (decl.kind) {
        case 'ModelDecl':
          this.checkFieldList(
            decl.fields.map((f) => ({ name: f.name, type: f.type, defaultValue: f.defaultValue })),
            scope,
            `model '${decl.name.text}'`,
          );
          break;
        case 'EnumDecl':
        case 'ErrorDecl':
          this.checkCases(decl.cases, scope, decl.kind === 'EnumDecl' ? 'enum' : 'error', decl.name.text);
          break;
        case 'FunctionDecl':
        case 'NativeFunctionDecl':
          this.checkFunctionSignature(decl, scope);
          break;
        case 'ComponentDecl':
        case 'ScreenDecl':
          this.checkParams(decl.params, scope, `'${decl.name.text}'`);
          break;
        case 'CapabilityDecl':
        case 'RouteDecl':
          break;
      }
    }
  }

  /** Pass 2: check bodies, UI expressions, and routes against resolved signatures. */
  private checkBodies(scope: FileScope): void {
    for (const decl of scope.module.fileNode.declarations) {
      switch (decl.kind) {
        case 'FunctionDecl':
          this.checkFunction(decl, scope);
          break;
        case 'ComponentDecl':
        case 'ScreenDecl':
          this.checkUiDeclaration(decl, scope);
          break;
        case 'RouteDecl':
          this.checkRoute(decl, scope);
          break;
        default:
          break;
      }
    }
  }

  /** Rebuilds a resolved param map from pass 1 without re-reporting diagnostics. */
  private resolvedParams(params: readonly ParamDecl[]): Map<string, SemType> {
    const result = new Map<string, SemType>();
    for (const param of params) {
      if (result.has(param.name.text)) continue;
      result.set(param.name.text, this.typeRefTypes.get(param.type) ?? errorType);
    }
    return result;
  }

  private checkFieldList(
    fields: readonly { name: { text: string; span: Span }; type: TypeRef; defaultValue?: Expression }[],
    scope: FileScope,
    owner: string,
  ): void {
    const seen = new Map<string, Span>();
    for (const field of fields) {
      const first = seen.get(field.name.text);
      if (first) {
        this.report(
          DiagnosticCodes.DuplicateDeclaration,
          'error',
          `Field '${field.name.text}' is declared twice in ${owner}.`,
          field.name.span,
          { related: [{ message: 'First declared here.', span: first }] },
        );
      } else {
        seen.set(field.name.text, field.name.span);
      }
      const type = this.resolveTypeRef(field.type, scope, false);
      if (field.defaultValue) {
        const valueType = this.checkExpression(field.defaultValue, emptyFunctionContext(scope));
        this.requireAssignable(
          valueType,
          type,
          field.defaultValue.span,
          `The default value for '${field.name.text}'`,
        );
      }
    }
  }

  private checkCases(
    cases: readonly CaseDecl[],
    scope: FileScope,
    kindWord: string,
    ownerName: string,
  ): void {
    const seen = new Map<string, Span>();
    for (const c of cases) {
      const first = seen.get(c.name.text);
      if (first) {
        this.report(
          DiagnosticCodes.DuplicateDeclaration,
          'error',
          `Case '${c.name.text}' is declared twice in ${kindWord} '${ownerName}'.`,
          c.name.span,
          { related: [{ message: 'First declared here.', span: first }] },
        );
      } else {
        seen.set(c.name.text, c.name.span);
      }
      this.checkFieldList(
        c.params.map((p) => ({ name: p.name, type: p.type, defaultValue: p.defaultValue })),
        scope,
        `case '${c.name.text}' of ${kindWord} '${ownerName}'`,
      );
    }
  }

  private checkParams(params: readonly ParamDecl[], scope: FileScope, owner: string): Map<string, SemType> {
    const result = new Map<string, SemType>();
    for (const param of params) {
      if (result.has(param.name.text)) {
        this.report(
          DiagnosticCodes.DuplicateDeclaration,
          'error',
          `Parameter '${param.name.text}' is declared twice in ${owner}.`,
          param.name.span,
        );
        continue;
      }
      const type = this.resolveTypeRef(param.type, scope, false);
      if (param.defaultValue) {
        const valueType = this.checkExpression(param.defaultValue, emptyFunctionContext(scope));
        this.requireAssignable(
          valueType,
          type,
          param.defaultValue.span,
          `The default value for parameter '${param.name.text}'`,
        );
      }
      result.set(param.name.text, type);
    }
    return result;
  }

  private checkFunctionSignature(
    decl: FunctionDecl | NativeFunctionDecl,
    scope: FileScope,
  ): { params: Map<string, SemType>; returnType: SemType } {
    const params = this.checkParams(decl.params, scope, `function '${decl.name.text}'`);
    const returnType = decl.returnType
      ? this.resolveTypeRef(decl.returnType, scope, true)
      : primitiveType('Void');
    if (decl.throwsType) {
      const throwsType = this.resolveTypeRef(decl.throwsType, scope, false);
      if (throwsType.kind === 'declared' && throwsType.declarationKind !== 'error') {
        this.report(
          DiagnosticCodes.TypeMismatch,
          'error',
          `'${throwsType.name}' is a ${throwsType.declarationKind}, but a throws clause needs an ` +
            `error type declared with 'error ${throwsType.name} { ... }'.`,
          decl.throwsType.span,
        );
      } else if (throwsType.kind !== 'declared' && throwsType.kind !== 'error') {
        this.report(
          DiagnosticCodes.TypeMismatch,
          'error',
          `A throws clause needs an error type, found '${typeToString(throwsType)}'.`,
          decl.throwsType.span,
        );
      }
    }
    return { params, returnType };
  }

  private checkFunction(decl: FunctionDecl, scope: FileScope): void {
    // Signature diagnostics were reported in pass 1; reuse the resolutions.
    const params = this.resolvedParams(decl.params);
    const returnType = decl.returnType
      ? this.typeRefTypes.get(decl.returnType) ?? errorType
      : primitiveType('Void');

    for (const cap of decl.requiresCapabilities) {
      const symbol = scope.module.declarations.get(cap.text) ?? scope.imports.get(cap.text);
      if (!symbol) {
        this.report(
          DiagnosticCodes.UnknownSymbol,
          'error',
          `Unknown capability '${cap.text}'. Declare it with 'capability ${cap.text}' or import it.`,
          cap.span,
        );
      } else if (symbol.kind !== 'capability') {
        this.report(
          DiagnosticCodes.TypeMismatch,
          'error',
          `'${cap.text}' is a ${symbol.kind}; a requires clause needs a capability.`,
          cap.span,
        );
      }
    }

    const throwsType = decl.throwsType ? this.typeRefTypes.get(decl.throwsType) : undefined;
    const ctx: FunctionContext = {
      returnType,
      throwsType,
      scopes: [new Map([...params].map(([name, type]) => [name, { type, kind: 'param' as const }]))],
      localFunctions: [new Map()],
      fileScope: scope,
    };
    const definitelyReturns = this.checkBlock(decl.body, ctx);
    const wantsValue =
      !(returnType.kind === 'primitive' && (returnType.name === 'Void' || returnType.name === 'Never'));
    if (wantsValue && !definitelyReturns && returnType.kind !== 'error') {
      this.report(
        DiagnosticCodes.MissingReturn,
        'error',
        `Function '${decl.name.text}' declares return type ` +
          `'${typeToString(returnType)}' but not every path returns a value. ` +
          `Add a return statement (an if needs an else when it is the last statement).`,
        decl.name.span,
      );
    }
  }

  private checkUiDeclaration(decl: ComponentDecl | ScreenDecl, scope: FileScope): void {
    const params = this.resolvedParams(decl.params);
    const ctx: FunctionContext = {
      returnType: primitiveType('Void'),
      scopes: [new Map([...params].map(([name, type]) => [name, { type, kind: 'param' as const }]))],
      localFunctions: [new Map()],
      fileScope: scope,
    };
    for (const element of decl.body) {
      this.checkUiElement(element, ctx);
    }
  }

  private checkUiElement(element: UiElement, ctx: FunctionContext): void {
    // UI element names are not validated yet (Roadmap Milestone 7); the
    // expressions handed to them are, so screens stay honest about data flow.
    for (const arg of element.args) {
      this.checkExpression(arg.value, ctx);
    }
    for (const child of element.children) {
      this.checkUiElement(child, ctx);
    }
  }

  private checkRoute(decl: RouteDecl, scope: FileScope): void {
    const screen = scope.module.declarations.get(decl.screen.text) ?? scope.imports.get(decl.screen.text);
    if (!screen) {
      this.report(
        DiagnosticCodes.UnknownSymbol,
        'error',
        `Unknown screen '${decl.screen.text}'. Routes must point at a screen declared ` +
          `in this module or imported.`,
        decl.screen.span,
      );
    } else if (screen.kind !== 'screen') {
      this.report(
        DiagnosticCodes.UnknownSymbol,
        'error',
        `'${decl.screen.text}' is a ${screen.kind}; a route must point at a screen.`,
        decl.screen.span,
      );
    }

    const paramSegments = decl.segments.filter((s) => s.kind === 'ParamRouteSegment');
    const bindingNames = new Map(decl.bindings.map((b) => [b.name.text, b]));

    for (const segment of paramSegments) {
      if (segment.kind !== 'ParamRouteSegment') continue;
      if (!bindingNames.has(segment.name)) {
        this.report(
          DiagnosticCodes.InvalidRouteParameter,
          'error',
          `Route parameter ':${segment.name}' has no typed binding. ` +
            `Add '(${segment.name}: ID)' (or another primitive type) after the screen name.`,
          segment.span,
        );
      }
    }
    for (const binding of decl.bindings) {
      const matches = paramSegments.some(
        (s) => s.kind === 'ParamRouteSegment' && s.name === binding.name.text,
      );
      if (!matches) {
        this.report(
          DiagnosticCodes.InvalidRouteParameter,
          'error',
          `Binding '${binding.name.text}' does not match any ':param' segment in the route path.`,
          binding.name.span,
        );
      }
      const type = this.resolveTypeRef(binding.type, scope, false);
      if (type.kind !== 'primitive' && type.kind !== 'error') {
        this.report(
          DiagnosticCodes.InvalidRouteParameter,
          'error',
          `Route parameters must have primitive types; '${typeToString(type)}' cannot be ` +
            `carried in a URL segment.`,
          binding.type.span,
        );
      }
    }
  }

  // -- Statements --------------------------------------------------------------

  /** Checks a block in a fresh child scope. Returns whether it definitely returns. */
  private checkBlock(block: Block, ctx: FunctionContext): boolean {
    ctx.scopes.push(new Map());
    ctx.localFunctions.push(new Map());
    let definitelyReturns = false;
    for (const statement of block.statements) {
      if (this.checkStatement(statement, ctx)) {
        definitelyReturns = true;
      }
    }
    ctx.scopes.pop();
    ctx.localFunctions.pop();
    return definitelyReturns;
  }

  private checkStatement(statement: Statement, ctx: FunctionContext): boolean {
    switch (statement.kind) {
      case 'LetStatement': {
        const name = statement.name.text;
        const shadowedFunction = this.lookupLocalFunction(name, ctx);
        for (const scope of ctx.scopes) {
          const existing = scope.get(name);
          if (existing) {
            this.report(
              DiagnosticCodes.DuplicateDeclaration,
              'error',
              `'${name}' is already ${existing.kind === 'param' ? 'a parameter' : 'declared'} ` +
                `in this function. Choose a different name.`,
              statement.name.span,
            );
            break;
          }
        }
        if (shadowedFunction) {
          this.report(
            DiagnosticCodes.DuplicateDeclaration,
            'error',
            `'${name}' is already a local function in this scope. Choose a different name.`,
            statement.name.span,
            { related: [{ message: 'First declared here.', span: shadowedFunction.nameSpan }] },
          );
        }
        const initializerType =
          statement.initializer.kind === 'Match'
            ? this.checkMatch(statement.initializer, ctx)
            : this.checkExpression(statement.initializer, ctx);
        let bindingType: SemType;
        if (statement.declaredType) {
          bindingType = this.resolveTypeRef(statement.declaredType, ctx.fileScope, false);
          this.requireAssignable(
            initializerType,
            bindingType,
            statement.initializer.span,
            `The initializer of '${name}'`,
          );
        } else if (initializerType.kind === 'null') {
          this.report(
            DiagnosticCodes.TypeMismatch,
            'error',
            `Cannot infer a type from 'null'. Add an annotation, e.g. 'let ${name}: String? = null'.`,
            statement.span,
          );
          bindingType = errorType;
        } else {
          bindingType = initializerType;
        }
        ctx.scopes[ctx.scopes.length - 1]!.set(name, { type: bindingType, kind: 'local' });
        return false;
      }
      case 'ReturnStatement': {
        const wantsVoid =
          ctx.returnType.kind === 'primitive' && ctx.returnType.name === 'Void';
        if (statement.value) {
          const valueType =
            statement.value.kind === 'Match'
              ? this.checkMatch(statement.value, ctx)
              : this.checkExpression(statement.value, ctx);
          if (wantsVoid) {
            this.report(
              DiagnosticCodes.TypeMismatch,
              'error',
              `This function returns Void, so 'return' cannot carry a value.`,
              statement.value.span,
            );
          } else {
            this.requireAssignable(valueType, ctx.returnType, statement.value.span, 'The returned value');
          }
        } else if (!wantsVoid && ctx.returnType.kind !== 'error') {
          this.report(
            DiagnosticCodes.TypeMismatch,
            'error',
            `This function must return '${typeToString(ctx.returnType)}', ` +
              `but this return carries no value.`,
            statement.span,
          );
        }
        return true;
      }
      case 'IfStatement': {
        const conditionType = this.checkExpression(statement.condition, ctx);
        if (
          !(conditionType.kind === 'primitive' && conditionType.name === 'Bool') &&
          conditionType.kind !== 'error'
        ) {
          this.report(
            DiagnosticCodes.TypeMismatch,
            'error',
            `An if condition must be Bool, found '${typeToString(conditionType)}'.`,
            statement.condition.span,
          );
        }
        const thenReturns = this.checkBlock(statement.thenBlock, ctx);
        let elseReturns = false;
        if (statement.elseBlock) {
          elseReturns =
            statement.elseBlock.kind === 'IfStatement' || statement.elseBlock.kind === 'IfLetStatement'
              ? this.checkStatement(statement.elseBlock, ctx)
              : this.checkBlock(statement.elseBlock, ctx);
        }
        return thenReturns && elseReturns;
      }
      case 'IfLetStatement': {
        const name = statement.name.text;
        for (const scope of ctx.scopes) {
          if (scope.has(name)) {
            this.report(
              DiagnosticCodes.DuplicateDeclaration,
              'error',
              `'${name}' is already declared in this function. Choose a different name ` +
                `for the if let binding.`,
              statement.name.span,
            );
            break;
          }
        }
        const valueType = this.checkExpression(statement.value, ctx);
        let unwrapped: SemType = errorType;
        if (valueType.kind === 'optional') {
          unwrapped = valueType.inner;
        } else if (valueType.kind !== 'error') {
          this.report(
            DiagnosticCodes.TypeMismatch,
            'error',
            `'if let' unwraps optional values, but this has type ` +
              `'${typeToString(valueType)}'. Use a plain 'if' or make the value optional.`,
            statement.value.span,
          );
        }
        ctx.scopes.push(new Map([[name, { type: unwrapped, kind: 'local' as const }]]));
        const thenReturns = this.checkBlock(statement.thenBlock, ctx);
        ctx.scopes.pop();
        let elseReturns = false;
        if (statement.elseBlock) {
          elseReturns =
            statement.elseBlock.kind === 'IfStatement' || statement.elseBlock.kind === 'IfLetStatement'
              ? this.checkStatement(statement.elseBlock, ctx)
              : this.checkBlock(statement.elseBlock, ctx);
        }
        return thenReturns && elseReturns;
      }
      case 'ThrowStatement': {
        const valueType = this.checkExpression(statement.value, ctx);
        if (!ctx.throwsType) {
          this.report(
            DiagnosticCodes.InvalidThrow,
            'error',
            `'throw' is only allowed inside a function declared with ` +
              `'throws <ErrorType>'. Add a throws clause to the enclosing function.`,
            statement.span,
          );
        } else {
          this.requireAssignable(valueType, ctx.throwsType, statement.value.span, 'The thrown value');
        }
        // A throw exits the function, so this path definitely "returns".
        return true;
      }
      case 'ExpressionStatement': {
        this.checkExpression(statement.expression, ctx);
        return false;
      }
      case 'FunctionDecl':
        this.checkLocalFunction(statement, ctx);
        return false;
    }
  }

  /**
   * Checks a nested (local) function declared as a statement. It behaves
   * like a top-level function — its own return/throws type, its own missing-
   * return check — but its body sees every enclosing scope (real capture),
   * and it is registered for calls (including self-recursion) before its own
   * body is checked.
   */
  private checkLocalFunction(decl: FunctionDecl, ctx: FunctionContext): void {
    const name = decl.name.text;
    const shadowedBinding = this.firstShadowedBinding(name, ctx);
    if (shadowedBinding) {
      this.report(
        DiagnosticCodes.DuplicateDeclaration,
        'error',
        `'${name}' is already ${shadowedBinding === 'param' ? 'a parameter' : 'declared'} ` +
          `in this function. Choose a different name.`,
        decl.name.span,
      );
    }
    const shadowedFunction = this.lookupLocalFunction(name, ctx);
    if (shadowedFunction) {
      this.report(
        DiagnosticCodes.DuplicateDeclaration,
        'error',
        `A local function named '${name}' is already declared in this scope.`,
        decl.name.span,
        { related: [{ message: 'First declared here.', span: shadowedFunction.nameSpan }] },
      );
    }

    const { params, returnType } = this.checkFunctionSignature(decl, ctx.fileScope);
    const throwsType = decl.throwsType ? this.typeRefTypes.get(decl.throwsType) : undefined;
    for (const cap of decl.requiresCapabilities) {
      const symbol = ctx.fileScope.module.declarations.get(cap.text) ?? ctx.fileScope.imports.get(cap.text);
      if (!symbol) {
        this.report(
          DiagnosticCodes.UnknownSymbol,
          'error',
          `Unknown capability '${cap.text}'. Declare it with 'capability ${cap.text}' or import it.`,
          cap.span,
        );
      } else if (symbol.kind !== 'capability') {
        this.report(
          DiagnosticCodes.TypeMismatch,
          'error',
          `'${cap.text}' is a ${symbol.kind}; a requires clause needs a capability.`,
          cap.span,
        );
      }
    }

    // Registered before the body is checked, so the function can call itself
    // (and siblings declared earlier in this scope can already see it once
    // its own turn comes, matching how 'let' bindings are sequential too).
    const localSymbol: DeclarationSymbol = {
      name,
      kind: 'function',
      module: ctx.fileScope.module.name,
      nameSpan: decl.name.span,
      node: decl,
    };
    if (!shadowedFunction) {
      ctx.localFunctions[ctx.localFunctions.length - 1]!.set(name, localSymbol);
    }

    const paramScope = new Map(
      [...params].map(([paramName, type]) => [paramName, { type, kind: 'param' as const }]),
    );
    ctx.scopes.push(paramScope);
    ctx.localFunctions.push(new Map());
    const nestedCtx: FunctionContext = {
      returnType,
      throwsType,
      scopes: ctx.scopes,
      localFunctions: ctx.localFunctions,
      fileScope: ctx.fileScope,
    };
    const definitelyReturns = this.checkBlock(decl.body, nestedCtx);
    ctx.scopes.pop();
    ctx.localFunctions.pop();

    const wantsValue =
      !(returnType.kind === 'primitive' && (returnType.name === 'Void' || returnType.name === 'Never'));
    if (wantsValue && !definitelyReturns && returnType.kind !== 'error') {
      this.report(
        DiagnosticCodes.MissingReturn,
        'error',
        `Function '${name}' declares return type '${typeToString(returnType)}' but not every ` +
          `path returns a value. Add a return statement (an if needs an else when it is the ` +
          `last statement).`,
        decl.name.span,
      );
    }
  }

  /** Innermost-first lookup of a local (nested) function's synthesized symbol. */
  private lookupLocalFunction(name: string, ctx: FunctionContext): DeclarationSymbol | undefined {
    for (let i = ctx.localFunctions.length - 1; i >= 0; i--) {
      const found = ctx.localFunctions[i]!.get(name);
      if (found) return found;
    }
    return undefined;
  }

  /** Innermost-first lookup of a plain local/param binding's kind, for duplicate diagnostics. */
  private firstShadowedBinding(name: string, ctx: FunctionContext): 'local' | 'param' | undefined {
    for (const scope of ctx.scopes) {
      const existing = scope.get(name);
      if (existing) return existing.kind;
    }
    return undefined;
  }

  // -- Expressions ---------------------------------------------------------------

  private checkExpression(expr: Expression, ctx: FunctionContext): SemType {
    const type = this.checkExpressionInner(expr, ctx);
    this.expressionTypes.set(expr, type);
    return type;
  }

  private checkExpressionInner(expr: Expression, ctx: FunctionContext): SemType {
    switch (expr.kind) {
      case 'StringLiteral':
        return primitiveType('String');
      case 'IntLiteral':
        return primitiveType('Int');
      case 'FloatLiteral':
        return primitiveType('Float');
      case 'BoolLiteral':
        return primitiveType('Bool');
      case 'NullLiteral':
        return { kind: 'null' };
      case 'Identifier':
        return this.checkIdentifier(expr, ctx);
      case 'MemberAccess': {
        // `EnumType.caseName` is a case value, not a field read.
        const enumSymbol = this.enumSymbolFor(expr.object, ctx);
        if (enumSymbol) {
          return this.checkEnumCaseValue(expr, enumSymbol, [], ctx);
        }
        const objectType = this.checkExpression(expr.object, ctx);
        if (objectType.kind === 'error') return errorType;

        let fieldOwner: SemType = objectType;
        if (objectType.kind === 'optional') {
          if (!expr.optionalChaining) {
            this.report(
              DiagnosticCodes.TypeMismatch,
              'error',
              `This value has type '${typeToString(objectType)}' and may be absent. ` +
                `Use '?.' for optional access, or unwrap it first with ` +
                `'if let ${describeUnwrapName(expr.object)} = ...'.`,
              expr.span,
            );
            return errorType;
          }
          fieldOwner = objectType.inner;
        } else if (expr.optionalChaining) {
          this.report(
            DiagnosticCodes.TypeMismatch,
            'error',
            `'?.' is for optional values, but this has type '${typeToString(objectType)}'. Use '.'.`,
            expr.member.span,
          );
          return errorType;
        }

        if (fieldOwner.kind !== 'declared' || fieldOwner.declarationKind !== 'model') {
          this.report(
            DiagnosticCodes.TypeMismatch,
            'error',
            `Fields can only be read from model values; '${typeToString(objectType)}' has no fields.`,
            expr.member.span,
          );
          return errorType;
        }
        const model = this.modules.get(fieldOwner.module)?.declarations.get(fieldOwner.name);
        if (!model || model.node.kind !== 'ModelDecl') return errorType;
        const field = model.node.fields.find((f) => f.name.text === expr.member.text);
        if (!field) {
          this.report(
            DiagnosticCodes.UnknownSymbol,
            'error',
            `Model '${fieldOwner.name}' has no field '${expr.member.text}'. ` +
              `Fields: ${listNames(model.node.fields.map((f) => f.name.text))}.`,
            expr.member.span,
          );
          return errorType;
        }
        const fieldType =
          this.typeRefTypes.get(field.type) ?? this.resolveTypeRef(field.type, ctx.fileScope, false);
        if (!expr.optionalChaining) {
          return fieldType;
        }
        // `?.` produces an optional; already-optional fields stay singly optional.
        return fieldType.kind === 'optional' || fieldType.kind === 'error'
          ? fieldType
          : { kind: 'optional', inner: fieldType };
      }
      case 'InterpolatedString': {
        for (const part of expr.parts) {
          if (part.kind === 'StringTextPart') continue;
          const partType = this.checkExpression(part, ctx);
          if (partType.kind !== 'primitive' && partType.kind !== 'error') {
            this.report(
              DiagnosticCodes.TypeMismatch,
              'error',
              `Only primitive values can be interpolated into strings; found ` +
                `'${typeToString(partType)}'. Interpolate a specific field instead.`,
              part.span,
            );
          }
        }
        return primitiveType('String');
      }
      case 'Match':
        this.report(
          DiagnosticCodes.InvalidMatch,
          'error',
          `A match expression must directly initialize a binding ('let x = match ...') or be ` +
            `returned ('return match ...') so every target can emit it cleanly.`,
          expr.span,
        );
        // Still check the arms so the user sees all their diagnostics at once.
        this.checkMatch(expr, ctx);
        return errorType;
      case 'Try':
        return this.checkTry(expr, ctx);
      case 'Call':
        return this.checkCall(expr, ctx);
      case 'Binary':
        return this.checkBinary(expr, ctx);
      case 'Unary': {
        const operandType = this.checkExpression(expr.operand, ctx);
        if (operandType.kind === 'error') return errorType;
        if (expr.operator === '!') {
          if (operandType.kind === 'primitive' && operandType.name === 'Bool') return operandType;
          this.report(
            DiagnosticCodes.TypeMismatch,
            'error',
            `'!' needs a Bool operand, found '${typeToString(operandType)}'.`,
            expr.span,
          );
          return errorType;
        }
        if (operandType.kind === 'primitive' && (operandType.name === 'Int' || operandType.name === 'Float')) {
          return operandType;
        }
        this.report(
          DiagnosticCodes.TypeMismatch,
          'error',
          `Unary '-' needs an Int or Float operand, found '${typeToString(operandType)}'.`,
          expr.span,
        );
        return errorType;
      }
    }
  }

  private checkIdentifier(expr: IdentifierExpression, ctx: FunctionContext): SemType {
    for (let i = ctx.scopes.length - 1; i >= 0; i--) {
      const binding = ctx.scopes[i]!.get(expr.name);
      if (binding) {
        this.identifierKinds.set(expr, binding.kind);
        return binding.type;
      }
    }
    const symbol =
      this.lookupLocalFunction(expr.name, ctx) ??
      ctx.fileScope.module.declarations.get(expr.name) ??
      ctx.fileScope.imports.get(expr.name);
    if (symbol && (symbol.kind === 'function' || symbol.kind === 'native')) {
      this.report(
        DiagnosticCodes.TypeMismatch,
        'error',
        `Functions are not values in this version. Did you mean to call '${expr.name}(...)'?`,
        expr.span,
      );
      return errorType;
    }
    if (symbol && (symbol.kind === 'enum' || symbol.kind === 'error')) {
      this.report(
        DiagnosticCodes.TypeMismatch,
        'error',
        `'${expr.name}' is a type. Pick a case, e.g. '${expr.name}.someCase'.`,
        expr.span,
      );
      return errorType;
    }
    if (symbol && symbol.kind === 'model') {
      this.report(
        DiagnosticCodes.TypeMismatch,
        'error',
        `'${expr.name}' is a model type. Construct a value with '${expr.name}(field: value, ...)'.`,
        expr.span,
      );
      return errorType;
    }
    this.report(
      DiagnosticCodes.UnknownSymbol,
      'error',
      `Unknown name '${expr.name}'. It is not a local, parameter, or declaration ` +
        `visible in this file.`,
      expr.span,
    );
    return errorType;
  }

  private checkCall(expr: CallExpression, ctx: FunctionContext, allowsThrow = false): SemType {
    // `EnumType.caseName(args)` constructs a case with payload.
    if (expr.callee.kind === 'MemberAccess') {
      const enumSymbol = this.enumSymbolFor(expr.callee.object, ctx);
      if (enumSymbol) {
        return this.checkEnumCaseValue(expr, enumSymbol, expr.args, ctx, expr.callee.member);
      }
    }
    if (expr.callee.kind !== 'Identifier') {
      this.report(
        DiagnosticCodes.TypeMismatch,
        'error',
        `Only direct calls like 'name(...)' are supported in this version.`,
        expr.callee.span,
      );
      for (const arg of expr.args) this.checkExpression(arg.value, ctx);
      return errorType;
    }
    const name = expr.callee.name;
    const symbol =
      this.lookupLocalFunction(name, ctx) ??
      ctx.fileScope.module.declarations.get(name) ??
      ctx.fileScope.imports.get(name);
    if (!symbol) {
      this.report(
        DiagnosticCodes.UnknownSymbol,
        'error',
        `Unknown function or model '${name}'.` +
          (this.findTypeElsewhere(name) ? ` Did you mean to import it?` : ''),
        expr.callee.span,
      );
      for (const arg of expr.args) this.checkExpression(arg.value, ctx);
      return errorType;
    }

    if (symbol.kind === 'model' && symbol.node.kind === 'ModelDecl') {
      return this.checkConstruction(expr, symbol, ctx);
    }
    if ((symbol.kind === 'function' || symbol.kind === 'native') &&
        (symbol.node.kind === 'FunctionDecl' || symbol.node.kind === 'NativeFunctionDecl')) {
      return this.checkFunctionCall(expr, symbol, ctx, allowsThrow);
    }
    this.report(
      DiagnosticCodes.TypeMismatch,
      'error',
      `'${name}' is a ${symbol.kind} and cannot be called.`,
      expr.callee.span,
    );
    for (const arg of expr.args) this.checkExpression(arg.value, ctx);
    return errorType;
  }

  private checkFunctionCall(
    expr: CallExpression,
    symbol: DeclarationSymbol,
    ctx: FunctionContext,
    allowsThrow = false,
  ): SemType {
    const decl = symbol.node as FunctionDecl | NativeFunctionDecl;

    if (decl.throwsType && !allowsThrow) {
      this.report(
        DiagnosticCodes.InvalidTry,
        'error',
        `'${symbol.name}' can throw; mark the call with 'try ${symbol.name}(...)'.`,
        expr.callee.span,
      );
    }
    if (decl.throwsType && allowsThrow) {
      const calleeThrows = this.typeRefTypes.get(decl.throwsType);
      if (!ctx.throwsType) {
        this.report(
          DiagnosticCodes.InvalidTry,
          'error',
          `'try ${symbol.name}(...)' propagates the error, so the enclosing function must ` +
            `declare 'throws ${calleeThrows ? typeToString(calleeThrows) : '...'}'. ` +
            `Catch blocks arrive in a later milestone.`,
          expr.span,
        );
      } else if (
        calleeThrows &&
        !typesAssignable(calleeThrows, ctx.throwsType)
      ) {
        this.report(
          DiagnosticCodes.TypeMismatch,
          'error',
          `'${symbol.name}' throws '${typeToString(calleeThrows)}', but the enclosing function ` +
            `throws '${typeToString(ctx.throwsType)}'. Error conversion is a later milestone; ` +
            `align the error types for now.`,
          expr.span,
        );
      }
    }

    const params = decl.params;
    const provided = new Map<string, Argument>();
    let sawNamed = false;
    let positionalIndex = 0;
    let poisoned = false;

    for (const arg of expr.args) {
      if (arg.name) {
        sawNamed = true;
        const param = params.find((p) => p.name.text === arg.name!.text);
        if (!param) {
          this.report(
            DiagnosticCodes.InvalidArgumentName,
            'error',
            `'${symbol.name}' has no parameter named '${arg.name.text}'. ` +
              `Parameters: ${listNames(params.map((p) => p.name.text))}.`,
            arg.name.span,
          );
          this.checkExpression(arg.value, ctx);
          poisoned = true;
          continue;
        }
        if (provided.has(param.name.text)) {
          this.report(
            DiagnosticCodes.InvalidArgumentName,
            'error',
            `Argument '${param.name.text}' is provided twice.`,
            arg.name.span,
          );
          poisoned = true;
          continue;
        }
        provided.set(param.name.text, arg);
      } else {
        if (sawNamed) {
          this.report(
            DiagnosticCodes.InvalidArgumentName,
            'error',
            `Positional arguments cannot follow named arguments.`,
            arg.span,
          );
          this.checkExpression(arg.value, ctx);
          poisoned = true;
          continue;
        }
        const param = params[positionalIndex];
        positionalIndex++;
        if (!param) {
          this.report(
            DiagnosticCodes.WrongArgumentCount,
            'error',
            `'${symbol.name}' takes ${params.length} argument${params.length === 1 ? '' : 's'}, ` +
              `but more were provided.`,
            arg.span,
          );
          this.checkExpression(arg.value, ctx);
          poisoned = true;
          continue;
        }
        provided.set(param.name.text, arg);
      }
    }

    const missing = params.filter((p) => !provided.has(p.name.text) && !p.defaultValue);
    if (missing.length > 0) {
      this.report(
        DiagnosticCodes.WrongArgumentCount,
        'error',
        `'${symbol.name}' is missing argument${missing.length === 1 ? '' : 's'} ` +
          `${listNames(missing.map((p) => p.name.text))}.`,
        expr.span,
      );
      poisoned = true;
    }

    const resolvedArgs: { name: string; value: Expression }[] = [];
    for (const param of params) {
      const arg = provided.get(param.name.text);
      if (!arg) continue;
      const argType = this.checkExpression(arg.value, ctx);
      const paramType =
        this.typeRefTypes.get(param.type) ?? this.resolveTypeRef(param.type, ctx.fileScope, false);
      this.requireAssignable(argType, paramType, arg.value.span, `Argument '${param.name.text}'`);
      resolvedArgs.push({ name: param.name.text, value: arg.value });
    }

    if (!poisoned) {
      this.callResolutions.set(expr, {
        kind: symbol.kind === 'native' ? 'native' : 'function',
        target: symbol,
        args: resolvedArgs,
      });
    }
    const returnType = decl.returnType
      ? this.typeRefTypes.get(decl.returnType) ??
        this.resolveTypeRef(decl.returnType, this.scopeForModule(symbol.module) ?? ctx.fileScope, true)
      : primitiveType('Void');
    return returnType;
  }

  private checkConstruction(
    expr: CallExpression,
    symbol: DeclarationSymbol,
    ctx: FunctionContext,
  ): SemType {
    const model = symbol.node;
    if (model.kind !== 'ModelDecl') return errorType;
    const provided = new Map<string, Argument>();
    let poisoned = false;

    for (const arg of expr.args) {
      if (!arg.name) {
        this.report(
          DiagnosticCodes.InvalidArgumentName,
          'error',
          `Model values are constructed with named arguments: ` +
            `'${symbol.name}(${model.fields.map((f) => `${f.name.text}: ...`).join(', ')})'.`,
          arg.span,
        );
        this.checkExpression(arg.value, ctx);
        poisoned = true;
        continue;
      }
      const field = model.fields.find((f) => f.name.text === arg.name!.text);
      if (!field) {
        this.report(
          DiagnosticCodes.InvalidArgumentName,
          'error',
          `Model '${symbol.name}' has no field '${arg.name.text}'. ` +
            `Fields: ${listNames(model.fields.map((f) => f.name.text))}.`,
          arg.name.span,
        );
        this.checkExpression(arg.value, ctx);
        poisoned = true;
        continue;
      }
      if (provided.has(field.name.text)) {
        this.report(
          DiagnosticCodes.InvalidArgumentName,
          'error',
          `Field '${field.name.text}' is provided twice.`,
          arg.name.span,
        );
        poisoned = true;
        continue;
      }
      provided.set(field.name.text, arg);
    }

    const missing = model.fields.filter((f) => !provided.has(f.name.text) && !f.defaultValue);
    if (missing.length > 0) {
      this.report(
        DiagnosticCodes.WrongArgumentCount,
        'error',
        `Construction of '${symbol.name}' is missing field${missing.length === 1 ? '' : 's'} ` +
          `${listNames(missing.map((f) => f.name.text))}.`,
        expr.span,
      );
      poisoned = true;
    }

    const declScope = this.scopeForModule(symbol.module) ?? ctx.fileScope;
    const resolvedArgs: { name: string; value: Expression }[] = [];
    for (const field of model.fields) {
      const arg = provided.get(field.name.text);
      if (!arg) continue;
      const argType = this.checkExpression(arg.value, ctx);
      const fieldType =
        this.typeRefTypes.get(field.type) ?? this.resolveTypeRef(field.type, declScope, false);
      this.requireAssignable(argType, fieldType, arg.value.span, `Field '${field.name.text}'`);
      resolvedArgs.push({ name: field.name.text, value: arg.value });
    }

    if (!poisoned) {
      this.callResolutions.set(expr, { kind: 'construct', target: symbol, args: resolvedArgs });
    }
    return { kind: 'declared', name: symbol.name, module: symbol.module, declarationKind: 'model' };
  }

  private checkBinary(
    expr: Expression & { kind: 'Binary' },
    ctx: FunctionContext,
  ): SemType {
    const left = this.checkExpression(expr.left, ctx);
    const right = this.checkExpression(expr.right, ctx);
    if (left.kind === 'error' || right.kind === 'error') return errorType;

    const fail = (): SemType => {
      this.report(
        DiagnosticCodes.TypeMismatch,
        'error',
        `Operator '${expr.operator}' cannot combine '${typeToString(left)}' and ` +
          `'${typeToString(right)}'.`,
        expr.span,
      );
      return errorType;
    };
    const bothPrimitive = (name: string): boolean =>
      left.kind === 'primitive' && right.kind === 'primitive' && left.name === name && right.name === name;
    const bothStringLike = typesAssignable(left, primitiveType('String')) &&
      typesAssignable(right, primitiveType('String')) &&
      left.kind === 'primitive' && right.kind === 'primitive';

    switch (expr.operator) {
      case '??': {
        if (left.kind !== 'optional') {
          this.report(
            DiagnosticCodes.TypeMismatch,
            'error',
            `The left side of '??' must be optional, found '${typeToString(left)}'.`,
            expr.left.span,
          );
          return errorType;
        }
        if (right.kind === 'optional' || right.kind === 'null') {
          if (right.kind === 'null' || typesAssignable(right, left)) {
            return left; // Optional fallback keeps the result optional.
          }
        } else if (typesAssignable(right, left.inner)) {
          return left.inner; // Non-optional fallback unwraps the result.
        }
        this.report(
          DiagnosticCodes.TypeMismatch,
          'error',
          `The fallback of '??' must match the unwrapped type ` +
            `'${typeToString(left.inner)}', found '${typeToString(right)}'.`,
          expr.right.span,
        );
        return errorType;
      }
      case '+':
        if (bothStringLike) return primitiveType('String');
        if (bothPrimitive('Int')) return primitiveType('Int');
        if (bothPrimitive('Float')) return primitiveType('Float');
        return fail();
      case '-':
      case '*':
      case '/':
      case '%':
        if (bothPrimitive('Int')) return primitiveType('Int');
        if (bothPrimitive('Float')) return primitiveType('Float');
        return fail();
      case '<':
      case '<=':
      case '>':
      case '>=':
        if (bothPrimitive('Int') || bothPrimitive('Float')) return primitiveType('Bool');
        return fail();
      case '==':
      case '!=':
        if (typesAssignable(left, right) || typesAssignable(right, left)) {
          return primitiveType('Bool');
        }
        return fail();
      case '&&':
      case '||':
        if (bothPrimitive('Bool')) return primitiveType('Bool');
        return fail();
    }
  }

  // -- Power-pack features -------------------------------------------------------

  /** Resolves an expression to an enum/error declaration when it names a type. */
  private enumSymbolFor(expr: Expression, ctx: FunctionContext): DeclarationSymbol | undefined {
    if (expr.kind !== 'Identifier') return undefined;
    // A local or parameter shadows the type name.
    for (const scope of ctx.scopes) {
      if (scope.has(expr.name)) return undefined;
    }
    const symbol =
      ctx.fileScope.module.declarations.get(expr.name) ?? ctx.fileScope.imports.get(expr.name);
    if (symbol && (symbol.kind === 'enum' || symbol.kind === 'error')) {
      return symbol;
    }
    return undefined;
  }

  /**
   * Checks `Enum.case` / `Enum.case(args)` and records the resolution for
   * lowering. `expr` is the MemberAccess or the enclosing Call node.
   */
  private checkEnumCaseValue(
    expr: Expression,
    symbol: DeclarationSymbol,
    args: readonly Argument[],
    ctx: FunctionContext,
    memberName?: NameNode,
  ): SemType {
    const node = symbol.node;
    if (node.kind !== 'EnumDecl' && node.kind !== 'ErrorDecl') return errorType;
    const caseNameNode =
      memberName ?? (expr.kind === 'MemberAccess' ? expr.member : undefined);
    if (!caseNameNode) return errorType;

    const enumCase = node.cases.find((c) => c.name.text === caseNameNode.text);
    const resultType: SemType = {
      kind: 'declared',
      name: symbol.name,
      module: symbol.module,
      declarationKind: symbol.kind === 'error' ? 'error' : 'enum',
    };
    if (!enumCase) {
      this.report(
        DiagnosticCodes.UnknownSymbol,
        'error',
        `'${symbol.name}' has no case '${caseNameNode.text}'. ` +
          `Cases: ${listNames(node.cases.map((c) => c.name.text))}.`,
        caseNameNode.span,
      );
      for (const arg of args) this.checkExpression(arg.value, ctx);
      return errorType;
    }

    const declScope = this.scopeForModule(symbol.module) ?? ctx.fileScope;
    const resolvedArgs: { name: string; value: Expression }[] = [];
    if (enumCase.params.length === 0 && args.length > 0) {
      this.report(
        DiagnosticCodes.WrongArgumentCount,
        'error',
        `Case '${caseNameNode.text}' carries no payload; write '${symbol.name}.${caseNameNode.text}' ` +
          `without parentheses.`,
        expr.span,
      );
      for (const arg of args) this.checkExpression(arg.value, ctx);
    } else if (enumCase.params.length > 0) {
      const provided = new Map<string, Argument>();
      let positionalIndex = 0;
      for (const arg of args) {
        const param = arg.name
          ? enumCase.params.find((p) => p.name.text === arg.name!.text)
          : enumCase.params[positionalIndex++];
        if (!param) {
          this.report(
            DiagnosticCodes.InvalidArgumentName,
            'error',
            arg.name
              ? `Case '${caseNameNode.text}' has no payload field '${arg.name.text}'. ` +
                `Fields: ${listNames(enumCase.params.map((p) => p.name.text))}.`
              : `Case '${caseNameNode.text}' takes ${enumCase.params.length} value${
                  enumCase.params.length === 1 ? '' : 's'
                }, but more were provided.`,
            arg.span,
          );
          this.checkExpression(arg.value, ctx);
          continue;
        }
        if (provided.has(param.name.text)) {
          this.report(
            DiagnosticCodes.InvalidArgumentName,
            'error',
            `Payload field '${param.name.text}' is provided twice.`,
            arg.span,
          );
          continue;
        }
        provided.set(param.name.text, arg);
      }
      const missing = enumCase.params.filter((p) => !provided.has(p.name.text));
      if (missing.length > 0) {
        this.report(
          DiagnosticCodes.WrongArgumentCount,
          'error',
          `Case '${caseNameNode.text}' is missing payload value${missing.length === 1 ? '' : 's'} ` +
            `${listNames(missing.map((p) => p.name.text))}.`,
          expr.span,
        );
      }
      for (const param of enumCase.params) {
        const arg = provided.get(param.name.text);
        if (!arg) continue;
        const argType = this.checkExpression(arg.value, ctx);
        const paramType =
          this.typeRefTypes.get(param.type) ?? this.resolveTypeRef(param.type, declScope, false);
        this.requireAssignable(argType, paramType, arg.value.span, `Payload '${param.name.text}'`);
        resolvedArgs.push({ name: param.name.text, value: arg.value });
      }
    }

    this.enumValues.set(expr, { caseName: caseNameNode.text, args: resolvedArgs });
    return resultType;
  }

  /**
   * Checks a match expression: scrutinee is an enum or error, every arm names
   * a real case with the right number of bindings, arm results unify, and
   * coverage is exhaustive (Constitution Document 4 §21).
   */
  private checkMatch(expr: MatchExpression, ctx: FunctionContext): SemType {
    const scrutineeType = this.checkExpression(expr.scrutinee, ctx);
    if (scrutineeType.kind === 'error') {
      for (const arm of expr.arms) this.checkExpression(arm.body, ctx);
      if (expr.elseArm) this.checkExpression(expr.elseArm, ctx);
      return errorType;
    }
    if (
      scrutineeType.kind !== 'declared' ||
      (scrutineeType.declarationKind !== 'enum' && scrutineeType.declarationKind !== 'error')
    ) {
      this.report(
        DiagnosticCodes.InvalidMatch,
        'error',
        `match inspects enum or error values, but this has type ` +
          `'${typeToString(scrutineeType)}'.`,
        expr.scrutinee.span,
      );
      for (const arm of expr.arms) this.checkExpression(arm.body, ctx);
      if (expr.elseArm) this.checkExpression(expr.elseArm, ctx);
      return errorType;
    }

    const enumSymbol = this.modules.get(scrutineeType.module)?.declarations.get(scrutineeType.name);
    const node = enumSymbol?.node;
    if (!node || (node.kind !== 'EnumDecl' && node.kind !== 'ErrorDecl')) return errorType;
    const declScope = this.scopeForModule(scrutineeType.module) ?? ctx.fileScope;

    let resultType: SemType | undefined;
    const covered = new Set<string>();

    for (const arm of expr.arms) {
      const enumCase = node.cases.find((c) => c.name.text === arm.caseName.text);
      if (!enumCase) {
        this.report(
          DiagnosticCodes.InvalidMatch,
          'error',
          `'${scrutineeType.name}' has no case '${arm.caseName.text}'. ` +
            `Cases: ${listNames(node.cases.map((c) => c.name.text))}.`,
          arm.caseName.span,
        );
        this.checkExpression(arm.body, ctx);
        continue;
      }
      if (covered.has(enumCase.name.text)) {
        this.report(
          DiagnosticCodes.InvalidMatch,
          'error',
          `Case '${enumCase.name.text}' is matched twice; remove the duplicate arm.`,
          arm.caseName.span,
        );
      }
      covered.add(enumCase.name.text);

      const fields: { name: string; field: string; type: SemType }[] = [];
      if (arm.bindings.length !== enumCase.params.length) {
        this.report(
          DiagnosticCodes.InvalidMatch,
          'error',
          enumCase.params.length === 0
            ? `Case '${enumCase.name.text}' carries no payload; write it without bindings.`
            : `Case '${enumCase.name.text}' carries ${enumCase.params.length} payload value${
                enumCase.params.length === 1 ? '' : 's'
              } (${listNames(enumCase.params.map((p) => p.name.text))}), but ` +
              `${arm.bindings.length} binding${arm.bindings.length === 1 ? ' was' : 's were'} written.`,
          arm.span,
        );
      }
      const armScope = new Map<string, { type: SemType; kind: 'local' | 'param' }>();
      arm.bindings.forEach((binding, index) => {
        const param = enumCase.params[index];
        const bindingType = param
          ? this.typeRefTypes.get(param.type) ?? this.resolveTypeRef(param.type, declScope, false)
          : errorType;
        armScope.set(binding.text, { type: bindingType, kind: 'local' });
        if (param) {
          fields.push({ name: binding.text, field: param.name.text, type: bindingType });
        }
      });
      this.matchArmFields.set(arm, fields);

      ctx.scopes.push(armScope);
      const bodyType = this.checkExpression(arm.body, ctx);
      ctx.scopes.pop();

      if (!resultType || resultType.kind === 'error') {
        resultType = bodyType;
      } else if (!typesAssignable(bodyType, resultType)) {
        this.report(
          DiagnosticCodes.TypeMismatch,
          'error',
          `Match arms must produce the same type: this arm produces ` +
            `'${typeToString(bodyType)}', but earlier arms produce '${typeToString(resultType)}'.`,
          arm.body.span,
        );
      }
    }

    if (expr.elseArm) {
      const elseType = this.checkExpression(expr.elseArm, ctx);
      if (!resultType || resultType.kind === 'error') {
        resultType = elseType;
      } else if (!typesAssignable(elseType, resultType)) {
        this.report(
          DiagnosticCodes.TypeMismatch,
          'error',
          `Match arms must produce the same type: the else arm produces ` +
            `'${typeToString(elseType)}', but earlier arms produce '${typeToString(resultType)}'.`,
          expr.elseArm.span,
        );
      }
    } else {
      const missing = node.cases.filter((c) => !covered.has(c.name.text));
      if (missing.length > 0) {
        this.report(
          DiagnosticCodes.NonExhaustiveMatch,
          'error',
          `This match does not cover ${listNames(missing.map((c) => c.name.text))}. ` +
            `Add the missing arm${missing.length === 1 ? '' : 's'} or an 'else ->' arm.`,
          expr.span,
        );
      }
    }

    const finalType = resultType ?? errorType;
    this.expressionTypes.set(expr, finalType);
    return finalType;
  }

  /** Checks `try f(...)`: the call throws, and the enclosing function can propagate. */
  private checkTry(expr: Expression & { kind: 'Try' }, ctx: FunctionContext): SemType {
    if (expr.expression.kind !== 'Call') {
      this.report(
        DiagnosticCodes.InvalidTry,
        'error',
        `'try' marks a call into a throwing function, e.g. 'try fetchUser(id: id)'.`,
        expr.span,
      );
      return this.checkExpression(expr.expression, ctx);
    }
    const resultType = this.checkCall(expr.expression, ctx, true);
    this.expressionTypes.set(expr.expression, resultType);

    const resolution = this.callResolutions.get(expr.expression);
    const decl = resolution?.target.node;
    if (
      decl &&
      (decl.kind === 'FunctionDecl' || decl.kind === 'NativeFunctionDecl') &&
      !decl.throwsType
    ) {
      this.report(
        DiagnosticCodes.InvalidTry,
        'warning',
        `'${resolution!.target.name}' cannot throw; the 'try' here does nothing.`,
        expr.span,
      );
    }
    return resultType;
  }

  // -- Helpers ----------------------------------------------------------------

  private scopeForModule(moduleName: string): FileScope | undefined {
    const module = this.modules.get(moduleName);
    if (!module) return undefined;
    // Imports of the declaring file are not needed to resolve its own
    // declaration types again: they were already resolved into typeRefTypes
    // during declaration checking. This scope is a fallback for first use.
    return { module, imports: new Map() };
  }

  private requireAssignable(from: SemType, to: SemType, span: Span, subject: string): void {
    if (typesAssignable(from, to)) return;
    this.report(
      DiagnosticCodes.TypeMismatch,
      'error',
      `${subject} has type '${typeToString(from)}', but '${typeToString(to)}' is expected.`,
      span,
    );
  }

  private report(
    code: string,
    severity: DiagnosticSeverity,
    message: string,
    span: Span,
    extra?: { related?: Diagnostic['related'] },
  ): void {
    this.diagnostics.push({ code, severity, message, span, related: extra?.related });
  }

  private buildSemanticModel(): SemanticModel {
    return {
      modules: [...this.modules.values()].map((module) => ({
        name: module.name,
        file: module.file,
        symbols: [...module.declarations.values()].map((symbol) => toSymbolInfo(symbol)),
      })),
    };
  }
}

function emptyFunctionContext(scope: FileScope): FunctionContext {
  return {
    returnType: primitiveType('Void'),
    scopes: [new Map()],
    localFunctions: [new Map()],
    fileScope: scope,
  };
}

function symbolKindOf(decl: Declaration): SymbolKind {
  switch (decl.kind) {
    case 'ModelDecl':
      return 'model';
    case 'EnumDecl':
      return 'enum';
    case 'ErrorDecl':
      return 'error';
    case 'CapabilityDecl':
      return 'capability';
    case 'FunctionDecl':
      return 'function';
    case 'ScreenDecl':
      return 'screen';
    case 'ComponentDecl':
      return 'component';
    case 'NativeFunctionDecl':
      return 'native';
    case 'RouteDecl':
      throw new Error('routes are collected separately');
  }
}

function toSymbolInfo(symbol: DeclarationSymbol): SymbolInfo {
  return {
    name: symbol.name,
    kind: symbol.kind,
    module: symbol.module,
    span: symbol.nameSpan,
    signature: renderSignature(symbol),
  };
}

function renderSignature(symbol: DeclarationSymbol): string {
  const node = symbol.node;
  switch (node.kind) {
    case 'ModelDecl':
      return `model ${node.name.text}`;
    case 'EnumDecl':
      return `enum ${node.name.text}`;
    case 'ErrorDecl':
      return `error ${node.name.text}`;
    case 'CapabilityDecl':
      return `capability ${node.name.text}`;
    case 'ScreenDecl':
      return `screen ${node.name.text}(${renderParams(node.params)})`;
    case 'ComponentDecl':
      return `component ${node.name.text}(${renderParams(node.params)})`;
    case 'FunctionDecl':
    case 'NativeFunctionDecl': {
      const asyncPart = node.isAsync ? ' async' : '';
      const throwsPart = node.throwsType ? ` throws ${renderTypeRef(node.throwsType)}` : '';
      const returnPart = node.returnType ? ` -> ${renderTypeRef(node.returnType)}` : '';
      const prefix = node.kind === 'NativeFunctionDecl' ? `native ${node.target} fn` : 'fn';
      return `${prefix} ${node.name.text}(${renderParams(node.params)})${asyncPart}${throwsPart}${returnPart}`;
    }
    default:
      return symbol.name;
  }
}

function renderParams(params: readonly ParamDecl[]): string {
  return params.map((p) => `${p.name.text}: ${renderTypeRef(p.type)}`).join(', ');
}

function renderTypeRef(ref: TypeRef): string {
  if (ref.kind === 'OptionalType') {
    return `${renderTypeRef(ref.inner)}?`;
  }
  if (ref.typeArgs.length === 0) return ref.name;
  return `${ref.name}<${ref.typeArgs.map(renderTypeRef).join(', ')}>`;
}

function listNames(names: readonly string[]): string {
  return names.map((n) => `'${n}'`).join(', ');
}

/** A friendly binding-name suggestion for if-let hints. */
function describeUnwrapName(expr: Expression): string {
  if (expr.kind === 'Identifier') return expr.name;
  if (expr.kind === 'MemberAccess') return expr.member.text;
  return 'value';
}
