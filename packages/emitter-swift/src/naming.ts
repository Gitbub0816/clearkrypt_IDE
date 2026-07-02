/**
 * Naming helpers shared across the Swift emitter.
 *
 * Constitution (Document 6 §13, Target naming law): backends may adapt names
 * to target conventions, but the mapping must remain traceable, and reserved
 * target keywords may be escaped predictably.
 */

/** Converts a dotted ClearKrypt module name (`app.main`) into a path segment (`app/main`). */
export function modulePath(moduleName: string): string {
  return moduleName.split('.').join('/');
}

// Swift keywords that would otherwise collide with a ClearKrypt identifier
// used as a field, parameter, or local name. Escaped with backticks, which is
// Swift's own predictable escape mechanism.
const SWIFT_KEYWORDS = new Set<string>([
  'associatedtype', 'class', 'deinit', 'enum', 'extension', 'fileprivate', 'func', 'import',
  'init', 'inout', 'internal', 'let', 'open', 'operator', 'private', 'protocol', 'public',
  'rethrows', 'static', 'struct', 'subscript', 'typealias', 'var',
  'break', 'case', 'continue', 'default', 'defer', 'do', 'else', 'fallthrough', 'for', 'guard',
  'if', 'in', 'repeat', 'return', 'switch', 'where', 'while',
  'as', 'Any', 'catch', 'false', 'is', 'nil', 'super', 'self', 'Self', 'throw', 'throws', 'true', 'try',
]);

/** Escapes a ClearKrypt identifier with backticks if it collides with a Swift keyword. */
export function swiftIdentifier(name: string): string {
  return SWIFT_KEYWORDS.has(name) ? `\`${name}\`` : name;
}
