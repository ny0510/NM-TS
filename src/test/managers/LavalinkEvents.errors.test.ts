import {afterEach, expect, spyOn, test} from 'bun:test';
import {EventEmitter} from 'node:events';
import type {NMClient} from '@/client';
import {registerLavalinkEvents} from '@/managers/lavalink';
import {Logger} from '@/shared/logger';

const restores: Array<() => void> = [];
afterEach(() => {
  for (const restore of restores.splice(0)) restore();
});
function setup() {
  const errors: unknown[] = [];
  const warnings: string[] = [];
  const restored: string[] = [];
  const error = spyOn(Logger.prototype, 'error').mockImplementation(value => {
    errors.push(value);
  });
  const warn = spyOn(Logger.prototype, 'warn').mockImplementation(value => {
    warnings.push(value);
  });
  restores.push(
    () => error.mockRestore(),
    () => warn.mockRestore(),
  );
  const shoukaku = new EventEmitter();
  const client: NMClient = Object.create(null);
  Object.assign(client, {channels: {cache: new Map()}, services: {lavalinkManager: {getShoukaku: () => shoukaku, getSessions: () => new Map(), restoreNode: (name: string) => restored.push(name)}}});
  registerLavalinkEvents(client);
  return {shoukaku, errors, warnings, restored};
}

test('restart refusal is a concise warning with unwrapped ErrorEvent detail', () => {
  const {shoukaku, errors, warnings, restored} = setup();
  shoukaku.emit('close', 'local', 1001, 'restart');
  const cause = Object.assign(new Error('connect ECONNREFUSED'), {code: 'ECONNREFUSED'});
  shoukaku.emit('error', 'local', new ErrorEvent('error', {error: cause, message: cause.message}));
  shoukaku.emit('error', 'local', new Error('Websocket closed before a connection was established'));
  expect(errors).toEqual([]);
  expect(warnings.join('\n')).toContain('ECONNREFUSED');
  expect(warnings.join('\n')).not.toContain('[object ErrorEvent]');
  expect(restored).toEqual(['local', 'local']);
});

test('first failure and authentication errors remain errors after unwrapping', () => {
  const {shoukaku, errors} = setup();
  const initial = Object.assign(new Error('connect ECONNREFUSED'), {code: 'ECONNREFUSED'});
  shoukaku.emit('error', 'local', new ErrorEvent('error', {error: initial, message: initial.message}));
  shoukaku.emit('reconnecting', 'local', 0, 5);
  const auth = Object.assign(new Error('Unexpected server response: 401'), {statusCode: 401});
  shoukaku.emit('error', 'local', new ErrorEvent('error', {error: auth, message: auth.message}));
  shoukaku.emit('error', 'local', new Error('Websocket closed before a connection was established'));
  expect(errors).toHaveLength(3);
  expect(errors[0]).toHaveProperty('cause', initial);
  expect(errors[1]).toHaveProperty('cause', auth);
});

test('successful recovery resets warning classification and unknown protocol failures remain errors', () => {
  const {shoukaku, errors} = setup();
  shoukaku.emit('close', 'local', 1001, 'restart');
  shoukaku.emit('error', 'local', new Error('Invalid WebSocket frame: RSV1 must be clear'));
  shoukaku.emit('ready', 'local', false, true);
  shoukaku.emit('error', 'local', new Error('Websocket closed before a connection was established'));
  expect(errors).toHaveLength(2);
});

test.each(['Unexpected server response: 403', "WebSocket connection to 'ws://127.0.0.1:1234/' failed: Expected 101 status code", 'Unknown transport failure'])('message-only event remains an error: %s', message => {
  const {shoukaku, errors} = setup();
  shoukaku.emit('reconnecting', 'local', 0, 5);
  shoukaku.emit('error', 'local', new ErrorEvent('error', {message}));
  expect(errors).toHaveLength(1);
  expect(errors[0]).toBeInstanceOf(Error);
  expect(errors[0]).toHaveProperty('message', `Node local error: ${message}`);
  expect(errors[0]).toHaveProperty('cause.message', message);
});
