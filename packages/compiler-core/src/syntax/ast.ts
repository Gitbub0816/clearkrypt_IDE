import { Span } from '../text/span';

/**
 * The ClearKrypt AST.
 *
 * Constitution (Document 5, AST law): the AST represents source structure,
 * not target code. Every node carries a span so diagnostics, the outline,
 * visual views, and generated-code mapping can point back at source.
 *
 * The MVP grammar covers: module, import, model, enum (with associated
 * values), error, capability, fn (with bodies), component, screen, route,
 * and native function blocks. Screens and components are parsed structurally
 * now and lowered to targets in a later milestone (Roadmap, Milestone 7).
 */

// ---------------------------------------------------------------------------
// Shared shapes
// ---------------------------------------------------------------------------

export interface AstNode {
  readonly kind: string;
  readonly span: Span;
}

/** A name occurrence, e.g. a declared name or a reference to one. */
export interface NameNode extends AstNode {
  readonly kind: 'Name';
  readonly text: string;
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type TypeRef = NamedTypeRef | OptionalTypeRef;

/**
 * A written type reference such as `String`, `User`, or `List<User>`.
 * `List`, `Map`, and `Set` are named types with type arguments; the checker
 * gives them their collection semantics.
 */
export interface NamedTypeRef extends AstNode {
  readonly kind: 'NamedType';
  readonly name: string;
  readonly typeArgs: readonly TypeRef[];
}

/** `T?` — the value may be absent. */
export interface OptionalTypeRef extends AstNode {
  readonly kind: 'OptionalType';
  readonly inner: TypeRef;
}

// ---------------------------------------------------------------------------
// Expressions
// ---------------------------------------------------------------------------

export type Expression =
  | StringLiteral
  | IntLiteral
  | FloatLiteral
  | BoolLiteral
  | NullLiteral
  | IdentifierExpression
  | MemberAccessExpression
  | CallExpression
  | BinaryExpression
  | UnaryExpression;

export interface StringLiteral extends AstNode {
  readonly kind: 'StringLiteral';
  /** The decoded value (escapes resolved). */
  readonly value: string;
}

export interface IntLiteral extends AstNode {
  readonly kind: 'IntLiteral';
  /** Original digits, preserved for exact target emission. */
  readonly text: string;
}

export interface FloatLiteral extends AstNode {
  readonly kind: 'FloatLiteral';
  readonly text: string;
}

export interface BoolLiteral extends AstNode {
  readonly kind: 'BoolLiteral';
  readonly value: boolean;
}

export interface NullLiteral extends AstNode {
  readonly kind: 'NullLiteral';
}

export interface IdentifierExpression extends AstNode {
  readonly kind: 'Identifier';
  readonly name: string;
}

/** `expr.name` */
export interface MemberAccessExpression extends AstNode {
  readonly kind: 'MemberAccess';
  readonly object: Expression;
  readonly member: NameNode;
}

/** One call argument; `name` is present for named arguments like `id: value`. */
export interface Argument extends AstNode {
  readonly kind: 'Argument';
  readonly name?: NameNode;
  readonly value: Expression;
}

/** `callee(args)` — function calls and model construction share this shape. */
export interface CallExpression extends AstNode {
  readonly kind: 'Call';
  readonly callee: Expression;
  readonly args: readonly Argument[];
}

export type BinaryOperator =
  | '+'
  | '-'
  | '*'
  | '/'
  | '%'
  | '=='
  | '!='
  | '<'
  | '<='
  | '>'
  | '>='
  | '&&'
  | '||';

export interface BinaryExpression extends AstNode {
  readonly kind: 'Binary';
  readonly operator: BinaryOperator;
  readonly left: Expression;
  readonly right: Expression;
}

export type UnaryOperator = '-' | '!';

export interface UnaryExpression extends AstNode {
  readonly kind: 'Unary';
  readonly operator: UnaryOperator;
  readonly operand: Expression;
}

// ---------------------------------------------------------------------------
// Statements
// ---------------------------------------------------------------------------

export type Statement = LetStatement | ReturnStatement | IfStatement | ExpressionStatement;

export interface Block extends AstNode {
  readonly kind: 'Block';
  readonly statements: readonly Statement[];
}

/** `let name = expr` or `var name: Type = expr`. */
export interface LetStatement extends AstNode {
  readonly kind: 'LetStatement';
  readonly name: NameNode;
  readonly mutable: boolean;
  readonly declaredType?: TypeRef;
  readonly initializer: Expression;
}

export interface ReturnStatement extends AstNode {
  readonly kind: 'ReturnStatement';
  readonly value?: Expression;
}

export interface IfStatement extends AstNode {
  readonly kind: 'IfStatement';
  readonly condition: Expression;
  readonly thenBlock: Block;
  readonly elseBlock?: Block | IfStatement;
}

export interface ExpressionStatement extends AstNode {
  readonly kind: 'ExpressionStatement';
  readonly expression: Expression;
}

// ---------------------------------------------------------------------------
// Declarations
// ---------------------------------------------------------------------------

export type Declaration =
  | ModelDecl
  | EnumDecl
  | ErrorDecl
  | CapabilityDecl
  | FunctionDecl
  | ComponentDecl
  | ScreenDecl
  | RouteDecl
  | NativeFunctionDecl;

/** `module app.profile` */
export interface ModuleDecl extends AstNode {
  readonly kind: 'ModuleDecl';
  /** Dotted module path, e.g. `app.profile`. */
  readonly name: string;
}

/** `import app.models.User` — the last segment is the imported symbol. */
export interface ImportDecl extends AstNode {
  readonly kind: 'ImportDecl';
  /** Full dotted path as written, e.g. `app.models.User`. */
  readonly path: string;
}

export interface FieldDecl extends AstNode {
  readonly kind: 'FieldDecl';
  readonly name: NameNode;
  readonly type: TypeRef;
  readonly defaultValue?: Expression;
}

export interface ModelDecl extends AstNode {
  readonly kind: 'ModelDecl';
  readonly name: NameNode;
  readonly fields: readonly FieldDecl[];
}

/** A case in an `enum` or `error` declaration; `params` may be empty. */
export interface CaseDecl extends AstNode {
  readonly kind: 'CaseDecl';
  readonly name: NameNode;
  readonly params: readonly ParamDecl[];
}

export interface EnumDecl extends AstNode {
  readonly kind: 'EnumDecl';
  readonly name: NameNode;
  readonly cases: readonly CaseDecl[];
}

/** `error AuthError { ... }` — same case shape as enums, error semantics. */
export interface ErrorDecl extends AstNode {
  readonly kind: 'ErrorDecl';
  readonly name: NameNode;
  readonly cases: readonly CaseDecl[];
}

/** `capability Camera` */
export interface CapabilityDecl extends AstNode {
  readonly kind: 'CapabilityDecl';
  readonly name: NameNode;
}

export interface ParamDecl extends AstNode {
  readonly kind: 'ParamDecl';
  readonly name: NameNode;
  readonly type: TypeRef;
  readonly defaultValue?: Expression;
}

/**
 * `fn name(params) [requires Cap, ...] [async] [throws ErrorType] [-> Type] { body }`
 * A missing return type means `Void`.
 */
export interface FunctionDecl extends AstNode {
  readonly kind: 'FunctionDecl';
  readonly name: NameNode;
  readonly params: readonly ParamDecl[];
  readonly returnType?: TypeRef;
  readonly isAsync: boolean;
  readonly throwsType?: TypeRef;
  readonly requiresCapabilities: readonly NameNode[];
  readonly body: Block;
}

// ---------------------------------------------------------------------------
// UI declarations (parsed structurally; target lowering is Milestone 7)
// ---------------------------------------------------------------------------

/** A UI element call such as `VStack { ... }` or `Text(user.name)`. */
export interface UiElement extends AstNode {
  readonly kind: 'UiElement';
  readonly name: NameNode;
  readonly args: readonly Argument[];
  readonly children: readonly UiElement[];
}

export interface ComponentDecl extends AstNode {
  readonly kind: 'ComponentDecl';
  readonly name: NameNode;
  readonly params: readonly ParamDecl[];
  readonly body: readonly UiElement[];
}

export interface ScreenDecl extends AstNode {
  readonly kind: 'ScreenDecl';
  readonly name: NameNode;
  readonly params: readonly ParamDecl[];
  /** The `title "..."` line, when present. */
  readonly title?: StringLiteral;
  readonly body: readonly UiElement[];
}

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------

export type RouteSegment = StaticRouteSegment | ParamRouteSegment;

export interface StaticRouteSegment extends AstNode {
  readonly kind: 'StaticRouteSegment';
  readonly text: string;
}

/** `:id` in `/users/:id`. */
export interface ParamRouteSegment extends AstNode {
  readonly kind: 'ParamRouteSegment';
  readonly name: string;
}

/** `route /users/:id -> UserDetailScreen(id: ID)` */
export interface RouteDecl extends AstNode {
  readonly kind: 'RouteDecl';
  readonly segments: readonly RouteSegment[];
  readonly screen: NameNode;
  /** Typed bindings for route parameters, in declaration order. */
  readonly bindings: readonly RouteBinding[];
}

export interface RouteBinding extends AstNode {
  readonly kind: 'RouteBinding';
  readonly name: NameNode;
  readonly type: TypeRef;
}

// ---------------------------------------------------------------------------
// Native interop
// ---------------------------------------------------------------------------

export type NativeTarget = 'swift' | 'kotlin' | 'typescript';

/**
 * `native swift fn deviceName() -> String { ...raw target code... }`
 * The body is raw target-language text, preserved verbatim with its span so
 * the IDE can mark the boundary (Constitution, Document 2 §20).
 */
export interface NativeFunctionDecl extends AstNode {
  readonly kind: 'NativeFunctionDecl';
  readonly target: NativeTarget;
  readonly name: NameNode;
  readonly params: readonly ParamDecl[];
  readonly returnType?: TypeRef;
  readonly isAsync: boolean;
  readonly throwsType?: TypeRef;
  readonly rawBody: RawNativeBody;
}

export interface RawNativeBody extends AstNode {
  readonly kind: 'RawNativeBody';
  /** Verbatim target-language source between the braces. */
  readonly text: string;
}

// ---------------------------------------------------------------------------
// File root
// ---------------------------------------------------------------------------

/** The parse result for one `.ck` file. */
export interface SourceFileNode extends AstNode {
  readonly kind: 'SourceFile';
  /** File path as presented to the compiler. */
  readonly path: string;
  readonly module?: ModuleDecl;
  readonly imports: readonly ImportDecl[];
  readonly declarations: readonly Declaration[];
}
