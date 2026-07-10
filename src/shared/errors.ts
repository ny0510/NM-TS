/**
 * Coerces an unknown value into an Error instance.
 *
 * Use this for logger callsites so the message string includes the original
 * value when it isn't already an Error (mirrors the pattern documented in
 * src/events/AGENTS.md).
 */
export function toError(value: unknown, context?: string): Error {
  if (value instanceof Error) return value;
  return new Error(context ? `${context}: ${String(value)}` : String(value));
}