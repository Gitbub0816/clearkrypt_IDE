/**
 * Naming helpers shared across the React/TypeScript emitter.
 *
 * Constitution (Document 6 §13, Target naming law): backends may adapt names
 * to target conventions, but the mapping must remain traceable, and reserved
 * target keywords may be escaped predictably.
 */

/** Converts a dotted ClearKrypt module name (`app.main`) into a path segment (`app/main`). */
export function modulePath(moduleName: string): string {
  return moduleName.split('.').join('/');
}

// TypeScript/JavaScript reserved words that would be illegal as a variable,
// parameter, or function name. Property names (interface fields, object
// literal keys) don't need this — reserved words are legal there unquoted —
// so this only applies to identifiers in declaration position.
const TS_RESERVED = new Set<string>([
  'break', 'case', 'catch', 'class', 'const', 'continue', 'debugger', 'default', 'delete', 'do',
  'else', 'enum', 'export', 'extends', 'false', 'finally', 'for', 'function', 'if', 'import', 'in',
  'instanceof', 'new', 'null', 'return', 'super', 'switch', 'this', 'throw', 'true', 'try', 'typeof',
  'var', 'void', 'while', 'with', 'as', 'implements', 'interface', 'let', 'package', 'private',
  'protected', 'public', 'static', 'yield', 'await',
]);

/** Adapts a ClearKrypt identifier to a legal TS identifier if it collides with a reserved word. */
export function tsIdentifier(name: string): string {
  return TS_RESERVED.has(name) ? `${name}_` : name;
}
