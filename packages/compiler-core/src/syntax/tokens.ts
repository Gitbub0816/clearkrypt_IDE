import { Span } from '../text/span';

/**
 * Token kinds.
 *
 * Keywords get distinct kinds (prefixed `Kw`) so parser code reads clearly
 * and token snapshots stay self-describing. Contextual words such as `title`
 * inside screens are ordinary identifiers, not keywords.
 */
export type TokenKind =
  // Literals and names.
  | 'Identifier'
  | 'StringLiteral'
  | 'IntLiteral'
  | 'FloatLiteral'
  // Punctuation and operators.
  | 'LeftBrace'
  | 'RightBrace'
  | 'LeftParen'
  | 'RightParen'
  | 'LessThan'
  | 'GreaterThan'
  | 'LessThanEquals'
  | 'GreaterThanEquals'
  | 'EqualsEquals'
  | 'BangEquals'
  | 'AmpAmp'
  | 'PipePipe'
  | 'Bang'
  | 'Colon'
  | 'Comma'
  | 'Dot'
  | 'Question'
  | 'Equals'
  | 'Arrow' // ->
  | 'Plus'
  | 'Minus'
  | 'Star'
  | 'Slash'
  | 'Percent'
  | 'At'
  // Trivia tokens, only produced when the lexer is asked to keep them.
  | 'LineComment'
  | 'BlockComment'
  // Control.
  | 'EndOfFile'
  | 'Unknown'
  // Keywords (reserved words from the language spec).
  | 'KwModule'
  | 'KwImport'
  | 'KwModel'
  | 'KwEnum'
  | 'KwFn'
  | 'KwScreen'
  | 'KwComponent'
  | 'KwRoute'
  | 'KwEffect'
  | 'KwCapability'
  | 'KwRequires'
  | 'KwError'
  | 'KwNative'
  | 'KwSwift'
  | 'KwKotlin'
  | 'KwTypescript'
  | 'KwReact'
  | 'KwLet'
  | 'KwVar'
  | 'KwIf'
  | 'KwElse'
  | 'KwFor'
  | 'KwIn'
  | 'KwWhile'
  | 'KwReturn'
  | 'KwThrows'
  | 'KwTry'
  | 'KwCatch'
  | 'KwAsync'
  | 'KwTrue'
  | 'KwFalse'
  | 'KwNull'
  | 'KwPublic'
  | 'KwPrivate'
  | 'KwInternal';

export interface Token {
  readonly kind: TokenKind;
  /** The exact source text of the token. */
  readonly text: string;
  readonly span: Span;
}

/** Reserved words mapped to their token kinds. */
export const keywordKinds: Readonly<Record<string, TokenKind>> = {
  module: 'KwModule',
  import: 'KwImport',
  model: 'KwModel',
  enum: 'KwEnum',
  fn: 'KwFn',
  screen: 'KwScreen',
  component: 'KwComponent',
  route: 'KwRoute',
  effect: 'KwEffect',
  capability: 'KwCapability',
  requires: 'KwRequires',
  error: 'KwError',
  native: 'KwNative',
  swift: 'KwSwift',
  kotlin: 'KwKotlin',
  typescript: 'KwTypescript',
  react: 'KwReact',
  let: 'KwLet',
  var: 'KwVar',
  if: 'KwIf',
  else: 'KwElse',
  for: 'KwFor',
  in: 'KwIn',
  while: 'KwWhile',
  return: 'KwReturn',
  throws: 'KwThrows',
  try: 'KwTry',
  catch: 'KwCatch',
  async: 'KwAsync',
  true: 'KwTrue',
  false: 'KwFalse',
  null: 'KwNull',
  public: 'KwPublic',
  private: 'KwPrivate',
  internal: 'KwInternal',
};
