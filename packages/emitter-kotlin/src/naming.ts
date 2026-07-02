/**
 * Naming helpers shared across the Kotlin emitter.
 *
 * Constitution (Document 6 §13, Target naming law): backends may adapt names
 * to target conventions, but the mapping must remain traceable, and reserved
 * target keywords may be escaped predictably.
 */

/** Converts a dotted ClearKrypt module name (`app.main`) into a path segment (`app/main`). */
export function modulePath(moduleName: string): string {
  return moduleName.split('.').join('/');
}

// Kotlin's hard keywords (always reserved, unlike Kotlin's many soft/modifier
// keywords which stay legal as identifiers). Escaped with backticks, Kotlin's
// own predictable escape mechanism.
const KOTLIN_KEYWORDS = new Set<string>([
  'as', 'break', 'class', 'continue', 'do', 'else', 'false', 'for', 'fun', 'if', 'in', 'interface',
  'is', 'null', 'object', 'package', 'return', 'super', 'this', 'throw', 'true', 'try', 'typealias',
  'typeof', 'val', 'var', 'when', 'while',
]);

/** Escapes a ClearKrypt identifier with backticks if it collides with a Kotlin keyword. */
export function kotlinIdentifier(name: string): string {
  return KOTLIN_KEYWORDS.has(name) ? `\`${name}\`` : name;
}

/** Adapts a ClearKrypt case name (`invalidCredentials`) to a Kotlin type name (`InvalidCredentials`). */
export function pascalCase(name: string): string {
  if (name.length === 0) {
    return name;
  }
  return name.charAt(0).toUpperCase() + name.slice(1);
}
