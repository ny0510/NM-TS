import {expect, spyOn, test} from 'bun:test';
import type {ServerWebSocket} from 'bun';
import {Connector, type NodeOption, Shoukaku} from 'shoukaku';
import type {NMClient} from '@/client';
import {LavalinkManager} from '@/managers/LavalinkManager';
import {registerLavalinkEvents} from '@/managers/lavalink';
import {unwrapNodeError} from '@/managers/lavalink/nodeError';
import {Logger} from '@/shared/logger';

class LocalConnector extends Connector {
  getId(): string {
    return 'test-user';
  }
  sendPacket(): void {}
  listen(nodes: NodeOption[]): void {
    queueMicrotask(() => this.ready(nodes));
  }
}

test('real Bun Shoukaku websocket recovers after loopback shutdown and refused handshake', async () => {
  let socket: ServerWebSocket<undefined> | undefined;
  const serve = (port: number) =>
    Bun.serve<undefined>({
      hostname: '127.0.0.1',
      port,
      fetch(request, server) {
        if (server.upgrade(request)) return;
        return new Response('not websocket', {status: 400});
      },
      websocket: {
        message() {},
        open(ws) {
          socket = ws;
          ws.send(JSON.stringify({op: 'ready', resumed: false, sessionId: 'local-session'}));
        },
      },
    });
  let server = serve(0);
  const port = server.port;
  if (!port) throw new Error('Missing loopback port');
  const nodeOption = {name: 'loopback', url: `127.0.0.1:${port}`, auth: 'test-only'};
  const shoukaku = new Shoukaku(new LocalConnector({}), [nodeOption], {reconnectTries: 1, reconnectInterval: 0.03, resume: false, resumeByLibrary: false});
  let stopping = false;
  const manager: LavalinkManager = Object.create(LavalinkManager.prototype);
  Object.assign(manager, {shoukaku, nodeOption, queues: new Map(), radios: new Map(), logger: {warn: () => {}}});
  const restore = manager.restoreNode.bind(manager);
  Object.assign(manager, {
    restoreNode: (name: string) => {
      if (!stopping) restore(name);
    },
  });
  const client: NMClient = Object.create(null);
  Object.assign(client, {services: {lavalinkManager: manager}, channels: {cache: new Map()}});
  const warnings: string[] = [];
  const errors: unknown[] = [];
  const raw: string[] = [];
  const warn = spyOn(Logger.prototype, 'warn').mockImplementation(value => {
    warnings.push(value);
  });
  const error = spyOn(Logger.prototype, 'error').mockImplementation(value => {
    errors.push(value);
  });
  shoukaku.on('error', (_name, value) => {
    raw.push(`${value.constructor.name}: ${unwrapNodeError(value).message}`);
  });
  registerLavalinkEvents(client);
  const nextReady = () =>
    new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('Loopback recovery timed out')), 2_000);
      shoukaku.once('ready', () => {
        clearTimeout(timer);
        resolve();
      });
    });
  try {
    await nextReady();
    const original = shoukaku.nodes.get('loopback');
    const recovered = nextReady();
    socket?.close(1001, 'controlled loopback shutdown');
    await server.stop(true);
    const deadline = Date.now() + 1_000;
    while (raw.length === 0 && Date.now() < deadline) await Bun.sleep(5);
    expect(raw.length).toBeGreaterThan(0);
    server = serve(port);
    await recovered;
    expect(shoukaku.nodes.get('loopback')).not.toBe(original);
    expect(manager.getNode()).toBeDefined();
    expect(errors).toEqual([]);
    expect(warnings.some(value => value.includes('Failed to connect'))).toBe(true);
    expect(raw.some(value => value.includes('ErrorEvent'))).toBe(true);
    console.info(JSON.stringify({scenario: 'loopback restart', rawErrors: raw, warnings, recovered: true}));
  } finally {
    stopping = true;
    shoukaku.options.reconnectTries = 0;
    await server.stop(true);
    await Bun.sleep(50);
    warn.mockRestore();
    error.mockRestore();
  }
});
