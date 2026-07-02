import { Diagnostic, DiagnosticCodes, IrOrigin } from '@clearkrypt/compiler-core';

/**
 * Constitution (Document 6 §14, Unsupported feature law): a backend that
 * cannot emit a feature correctly must fail with a diagnostic naming the
 * target and citing the source span — never with broken or dropped output.
 *
 * Every render function in this package is written against the closed IR
 * union types, so the `default` switch arms that call this helper are
 * unreachable for valid, current IR. They exist so that if the IR grows a new
 * node kind before this emitter is updated, the backend fails loudly with a
 * diagnostic instead of emitting broken TypeScript or throwing.
 */
export function unsupportedFeature(origin: IrOrigin, message: string): Diagnostic {
  return {
    code: DiagnosticCodes.UnsupportedTargetFeature,
    severity: 'error',
    message: `${message} (React/TypeScript target)`,
    span: origin.span,
    target: 'react',
  };
}
