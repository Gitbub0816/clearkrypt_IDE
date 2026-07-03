/**
 * The diagnostic code registry.
 *
 * Codes are stable public API: tools, tests, editors, and documentation refer
 * to them. Never reuse or renumber a code. Semantic codes use CK0xxx and
 * syntax codes use CK1xxx.
 *
 * The summaries here describe the category; concrete diagnostics carry
 * specific human messages that explain what failed, where, why, and what the
 * developer can do next (Constitution, Document 1: the compiler is a teacher).
 */
export const DiagnosticCodes = {
  // Semantic codes (CK0xxx).
  UnknownSymbol: 'CK0001',
  DuplicateDeclaration: 'CK0002',
  TypeMismatch: 'CK0003',
  UnsupportedTargetFeature: 'CK0004',
  MissingNativeImplementation: 'CK0005',
  InvalidRouteParameter: 'CK0006',
  MissingReturn: 'CK0007',
  UnknownType: 'CK0008',
  WrongArgumentCount: 'CK0009',
  UnknownImport: 'CK0010',
  InvalidArgumentName: 'CK0011',
  DuplicateModule: 'CK0012',
  MissingModule: 'CK0013',

  // Syntax codes (CK1xxx).
  UnexpectedToken: 'CK1001',
  UnterminatedString: 'CK1002',
  InvalidCharacter: 'CK1003',
  ExpectedDeclaration: 'CK1004',
  UnterminatedBlockComment: 'CK1005',
  ExpectedType: 'CK1006',
  UnterminatedNativeBlock: 'CK1007',
} as const;

export type DiagnosticCode = (typeof DiagnosticCodes)[keyof typeof DiagnosticCodes];

/** Human-readable summaries for every registered code, keyed by code. */
export const diagnosticCodeSummaries: Readonly<Record<DiagnosticCode, string>> = {
  CK0001: 'Unknown symbol',
  CK0002: 'Duplicate declaration',
  CK0003: 'Type mismatch',
  CK0004: 'Unsupported target feature',
  CK0005: 'Missing native implementation',
  CK0006: 'Invalid route parameter',
  CK0007: 'Missing return',
  CK0008: 'Unknown type',
  CK0009: 'Wrong argument count',
  CK0010: 'Unknown import',
  CK0011: 'Invalid argument name',
  CK0012: 'Duplicate module declaration',
  CK0013: 'Missing module declaration',
  CK1001: 'Unexpected token',
  CK1002: 'Unterminated string literal',
  CK1003: 'Invalid character',
  CK1004: 'Expected a declaration',
  CK1005: 'Unterminated block comment',
  CK1006: 'Expected a type',
  CK1007: 'Unterminated native block',
};
