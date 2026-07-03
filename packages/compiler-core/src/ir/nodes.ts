import { Span } from '../text/span';

/**
 * The ClearKrypt intermediate representation.
 *
 * Constitution (Document 5, IR purpose): the IR exists so the Swift, Kotlin,
 * and React emitters do not become three separate compilers. Emitters consume
 * this model and never re-derive semantics: every expression already carries
 * its resolved type, every reference carries its owning module, and every
 * node carries an origin for source mapping.
 *
 * This is the single MVP-level IR. The architecture reserves room for a
 * HIR/MIR split later (Document 5 §12) — nothing here may prevent that.
 */

// ---------------------------------------------------------------------------
// Origins (source mapping)
// ---------------------------------------------------------------------------

/** Where an IR node came from, for diagnostics and generated-code mapping. */
export interface IrOrigin {
  readonly file: string;
  readonly span: Span;
  readonly module: string;
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type IrPrimitiveName =
  | 'String'
  | 'Int'
  | 'Float'
  | 'Decimal'
  | 'Bool'
  | 'Date'
  | 'DateTime'
  | 'ID'
  | 'Email'
  | 'URL'
  | 'Data'
  | 'Void'
  | 'Never';

export type IrType =
  | IrPrimitiveType
  | IrDeclaredType
  | IrOptionalType
  | IrListType
  | IrMapType
  | IrSetType;

export interface IrPrimitiveType {
  readonly kind: 'primitive';
  readonly name: IrPrimitiveName;
}

/** A reference to a declared model, enum, or error, with its owning module. */
export interface IrDeclaredType {
  readonly kind: 'declared';
  readonly name: string;
  readonly module: string;
  readonly declarationKind: 'model' | 'enum' | 'error';
}

export interface IrOptionalType {
  readonly kind: 'optional';
  readonly inner: IrType;
}

export interface IrListType {
  readonly kind: 'list';
  readonly element: IrType;
}

export interface IrMapType {
  readonly kind: 'map';
  readonly key: IrType;
  readonly value: IrType;
}

export interface IrSetType {
  readonly kind: 'set';
  readonly element: IrType;
}

// ---------------------------------------------------------------------------
// Expressions (every expression carries its resolved type)
// ---------------------------------------------------------------------------

export type IrExpression =
  | IrStringLiteral
  | IrInterpolatedString
  | IrIntLiteral
  | IrFloatLiteral
  | IrBoolLiteral
  | IrNullLiteral
  | IrLocalRef
  | IrParamRef
  | IrFieldAccess
  | IrCall
  | IrConstruct
  | IrEnumValue
  | IrMatch
  | IrTry
  | IrBinary
  | IrUnary;

export interface IrStringLiteral {
  readonly kind: 'stringLiteral';
  readonly value: string;
  readonly type: IrType;
}

/** `"Hello, \(name)!"` — text and expression parts in source order. */
export interface IrInterpolatedString {
  readonly kind: 'interpolatedString';
  readonly parts: readonly ({ readonly kind: 'text'; readonly value: string } | IrExpression)[];
  readonly type: IrType;
}

export interface IrIntLiteral {
  readonly kind: 'intLiteral';
  /** Original digits from source, preserved exactly. */
  readonly text: string;
  readonly type: IrType;
}

export interface IrFloatLiteral {
  readonly kind: 'floatLiteral';
  readonly text: string;
  readonly type: IrType;
}

export interface IrBoolLiteral {
  readonly kind: 'boolLiteral';
  readonly value: boolean;
  readonly type: IrType;
}

export interface IrNullLiteral {
  readonly kind: 'nullLiteral';
  readonly type: IrType;
}

/** A reference to a local `let`/`var` binding. */
export interface IrLocalRef {
  readonly kind: 'localRef';
  readonly name: string;
  readonly type: IrType;
}

/** A reference to a function parameter. */
export interface IrParamRef {
  readonly kind: 'paramRef';
  readonly name: string;
  readonly type: IrType;
}

/** `object.field` (or `object?.field` when `optionalChaining` is set). */
export interface IrFieldAccess {
  readonly kind: 'fieldAccess';
  readonly object: IrExpression;
  readonly field: string;
  readonly optionalChaining: boolean;
  readonly type: IrType;
}

/** One resolved call argument. Names are always resolved by the checker. */
export interface IrArgument {
  readonly name: string;
  readonly value: IrExpression;
}

/** A call to a declared function. */
export interface IrCall {
  readonly kind: 'call';
  readonly function: { readonly name: string; readonly module: string };
  readonly args: readonly IrArgument[];
  readonly type: IrType;
}

/** Construction of a model value, e.g. `User(id: id, name: "Ada")`. */
export interface IrConstruct {
  readonly kind: 'construct';
  readonly model: { readonly name: string; readonly module: string };
  readonly args: readonly IrArgument[];
  readonly type: IrType;
}

/**
 * An enum or error case value: `OrderStatus.pending` or
 * `NetworkError.server(message: "down")`. Args are named per payload field
 * and empty for simple cases.
 */
export interface IrEnumValue {
  readonly kind: 'enumValue';
  readonly enumType: IrDeclaredType;
  readonly caseName: string;
  readonly args: readonly IrArgument[];
  readonly type: IrType;
}

/** One arm of a match: bound payload fields plus the result expression. */
export interface IrMatchArm {
  readonly caseName: string;
  /** Binding name per payload field, in declaration order. */
  readonly bindings: readonly { readonly name: string; readonly field: string; readonly type: IrType }[];
  readonly body: IrExpression;
}

/**
 * `match value { ... }` over an enum or error. Exhaustiveness was proven by
 * the checker: either every case appears or `elseBody` is present.
 */
export interface IrMatch {
  readonly kind: 'match';
  readonly scrutinee: IrExpression;
  readonly enumType: IrDeclaredType;
  readonly arms: readonly IrMatchArm[];
  readonly elseBody?: IrExpression;
  readonly type: IrType;
}

/** `try f(...)` — the wrapped call may throw; targets render their marker. */
export interface IrTry {
  readonly kind: 'try';
  readonly expression: IrExpression;
  readonly type: IrType;
}

export type IrBinaryOperator =
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
  | '||'
  | '??';

export interface IrBinary {
  readonly kind: 'binary';
  readonly operator: IrBinaryOperator;
  readonly left: IrExpression;
  readonly right: IrExpression;
  readonly type: IrType;
}

export interface IrUnary {
  readonly kind: 'unary';
  readonly operator: '-' | '!';
  readonly operand: IrExpression;
  readonly type: IrType;
}

// ---------------------------------------------------------------------------
// Statements
// ---------------------------------------------------------------------------

export type IrStatement =
  | IrLet
  | IrReturn
  | IrIf
  | IrIfLet
  | IrThrow
  | IrExpressionStatement
  | IrLocalFunction;

export interface IrLet {
  readonly kind: 'let';
  readonly name: string;
  readonly mutable: boolean;
  readonly type: IrType;
  readonly value: IrExpression;
}

export interface IrReturn {
  readonly kind: 'return';
  readonly value?: IrExpression;
}

export interface IrIf {
  readonly kind: 'if';
  readonly condition: IrExpression;
  readonly then: readonly IrStatement[];
  readonly else?: readonly IrStatement[];
}

/** `if let name = value { ... } else { ... }`; `type` is the unwrapped type. */
export interface IrIfLet {
  readonly kind: 'ifLet';
  readonly name: string;
  readonly type: IrType;
  readonly value: IrExpression;
  readonly then: readonly IrStatement[];
  readonly else?: readonly IrStatement[];
}

/** `throw value` — value's type equals the enclosing function's throws type. */
export interface IrThrow {
  readonly kind: 'throw';
  readonly value: IrExpression;
}

export interface IrExpressionStatement {
  readonly kind: 'expr';
  readonly expression: IrExpression;
}

/**
 * A nested (local) function declared as a statement. Shares `IrFunction`'s
 * shape exactly: emitters render it as a Swift local `func`, a Kotlin local
 * `fun`, or a TS nested `function`, all of which natively support capturing
 * the enclosing scope, so lowering needs nothing special for closures.
 */
export interface IrLocalFunction {
  readonly kind: 'localFunction';
  readonly function: IrFunction;
}

// ---------------------------------------------------------------------------
// Declarations
// ---------------------------------------------------------------------------

export interface IrField {
  readonly name: string;
  readonly type: IrType;
  readonly defaultValue?: IrExpression;
  readonly origin: IrOrigin;
}

export interface IrModel {
  readonly kind: 'model';
  readonly name: string;
  readonly fields: readonly IrField[];
  readonly origin: IrOrigin;
}

export interface IrEnumCase {
  readonly name: string;
  /** Associated values; empty for simple cases. */
  readonly fields: readonly IrField[];
  readonly origin: IrOrigin;
}

export interface IrEnum {
  readonly kind: 'enum';
  readonly name: string;
  readonly cases: readonly IrEnumCase[];
  /** True when no case carries associated values. */
  readonly isSimple: boolean;
  readonly origin: IrOrigin;
}

/** A typed error declaration; same shape as an enum, error semantics. */
export interface IrErrorType {
  readonly kind: 'error';
  readonly name: string;
  readonly cases: readonly IrEnumCase[];
  readonly isSimple: boolean;
  readonly origin: IrOrigin;
}

export interface IrParam {
  readonly name: string;
  readonly type: IrType;
  readonly defaultValue?: IrExpression;
  readonly origin: IrOrigin;
}

export interface IrFunction {
  readonly kind: 'function';
  readonly name: string;
  readonly params: readonly IrParam[];
  readonly returnType: IrType;
  readonly isAsync: boolean;
  readonly throwsType?: IrDeclaredType;
  readonly body: readonly IrStatement[];
  readonly origin: IrOrigin;
}

export type IrDeclaration = IrModel | IrEnum | IrErrorType | IrFunction;

// ---------------------------------------------------------------------------
// Modules and project
// ---------------------------------------------------------------------------

export interface IrModule {
  readonly name: string;
  /** Source file the module came from, for generated headers and mapping. */
  readonly file: string;
  /** Declarations in source order, so generated output stays stable. */
  readonly declarations: readonly IrDeclaration[];
}

export interface IrProject {
  readonly modules: readonly IrModule[];
}
