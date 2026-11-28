import {expect, test} from 'bun:test';
import {RadioRequestError, readRadioText} from '@/features/radio/radioRequest';

test.each([403, 404])('reports HTTP %s instead of a body cleanup error', async status => {
  const server = Bun.serve({hostname: '127.0.0.1', port: 0, fetch: () => new Response('unavailable', {status})});
  try {
    await expect(readRadioText(server.url.toString())).rejects.toEqual(new RadioRequestError(`Radio HTTP request returned ${status}`));
  } finally {
    await server.stop(true);
  }
});

test('aborts a real HTTP request when its caller cancels', async () => {
  const entered = Promise.withResolvers<void>();
  const release = Promise.withResolvers<Response>();
  const server = Bun.serve({
    hostname: '127.0.0.1',
    port: 0,
    fetch: () => {
      entered.resolve();
      return release.promise;
    },
  });
  const controller = new AbortController();
  try {
    const reading = readRadioText(server.url.toString(), controller.signal);
    await entered.promise;

    controller.abort();

    await expect(reading).rejects.toThrow();
  } finally {
    release.resolve(new Response('done'));
    await server.stop(true);
  }
});
