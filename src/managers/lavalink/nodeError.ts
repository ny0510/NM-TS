const NETWORK_CODES = new Set(['ECONNREFUSED', 'ECONNRESET', 'ETIMEDOUT', 'EHOSTUNREACH', 'ENETUNREACH', 'EAI_AGAIN']);
export const EARLY_SOCKET_CLOSE = 'Websocket closed before a connection was established';

export function unwrapNodeError(value: unknown): Error {
  let current = value;
  for (let depth = 0; depth < 4; depth++) {
    if (current instanceof Error) return current;
    if (typeof current !== 'object' || current === null) break;
    if ('error' in current && current.error != null && current.error !== current) {
      current = current.error;
      continue;
    }
    if ('message' in current && typeof current.message === 'string' && current.message) {
      const error = new Error(current.message, {cause: current});
      if ('code' in current) Object.assign(error, {code: current.code});
      if ('statusCode' in current) Object.assign(error, {statusCode: current.statusCode});
      return error;
    }
    break;
  }
  return new Error(String(current), {cause: value});
}

export function isTransientNodeError(error: Error): boolean {
  if ('code' in error && typeof error.code === 'string' && NETWORK_CODES.has(error.code)) return true;
  if (/\b(?:ECONNREFUSED|ECONNRESET|ETIMEDOUT|EHOSTUNREACH|ENETUNREACH|EAI_AGAIN)\b/.test(error.message)) return true;
  return /^WebSocket connection to '.+' failed: (?:Failed to connect|Connection refused|Connection reset by peer|Connection timed out)$/i.test(error.message);
}

export function describeNodeError(error: Error): string {
  const code = 'code' in error && (typeof error.code === 'string' || typeof error.code === 'number') ? ` [${error.code}]` : '';
  return `${error.message}${code}`;
}
