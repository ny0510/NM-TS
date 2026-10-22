import {request} from 'undici';

export type RadioApiReader = (url: string, signal?: AbortSignal) => Promise<string>;

export class RadioRequestError extends Error {
  override readonly name = 'RadioRequestError';
}

export const readRadioText: RadioApiReader = async (url, signal) => {
  signal?.throwIfAborted();
  const timeout = AbortSignal.timeout(8000);
  const response = await request(url, {signal: signal ? AbortSignal.any([signal, timeout]) : timeout, headersTimeout: 8000, bodyTimeout: 8000});
  if (response.statusCode !== 200) {
    await response.body.dump();
    throw new RadioRequestError(`Radio HTTP request returned ${response.statusCode}`);
  }
  return response.body.text();
};

export function waitForRadioRequest<T>(promise: Promise<T>, signal?: AbortSignal): Promise<T> {
  if (!signal) return promise;
  return new Promise<T>((resolve, reject) => {
    const abort = () => reject(signal.reason);
    signal.addEventListener('abort', abort, {once: true});
    promise.then(
      value => {
        signal.removeEventListener('abort', abort);
        resolve(value);
      },
      error => {
        signal.removeEventListener('abort', abort);
        reject(error);
      },
    );
    if (signal.aborted) abort();
  });
}
