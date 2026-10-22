import {afterEach, expect, test} from 'bun:test';
import {mkdir, mkdtemp, readFile, rm, writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join, resolve} from 'node:path';

const temporary: string[] = [];
afterEach(async () => {
  await Promise.all(temporary.splice(0).map(directory => rm(directory, {recursive: true, force: true})));
});

async function runStartup(syncFails: boolean, existing: boolean) {
  const directory = await mkdtemp(join(tmpdir(), 'nm-radio-startup-'));
  temporary.push(directory);
  const log = join(directory, 'calls');
  if (existing) {
    await mkdir(join(directory, 'data/radio'), {recursive: true});
    await writeFile(join(directory, 'data/radio/stations.json'), '{}');
    await writeFile(join(directory, 'data/radio/streams.json'), '{}');
  }
  await writeFile(
    join(directory, 'bun'),
    `#!/bin/sh
printf '%s\\n' "$*" >> "$STARTUP_LOG"
if [ "$*" = 'run radio:sync' ] && [ "$SYNC_FAILS" = 'true' ]; then exit 1; fi
`,
    {mode: 0o755},
  );
  const child = Bun.spawn(['sh', resolve(import.meta.dir, '../../../scripts/docker-entrypoint.sh')], {
    cwd: directory,
    env: {...process.env, PATH: `${directory}:${process.env.PATH}`, STARTUP_LOG: log, SYNC_FAILS: String(syncFails)},
    stdout: 'pipe',
    stderr: 'pipe',
  });
  const [exitCode, stderr] = await Promise.all([child.exited, new Response(child.stderr).text()]);
  return {exitCode, stderr, calls: (await readFile(log, 'utf8')).trim().split('\n')};
}

test('Docker startup synchronizes radio before starting the bot', async () => {
  const result = await runStartup(false, false);
  expect(result.exitCode).toBe(0);
  expect(result.calls).toEqual(['run radio:sync', 'run src/index.ts']);
});

test('Docker startup keeps working with existing settings when synchronization fails', async () => {
  const result = await runStartup(true, true);
  expect(result.exitCode).toBe(0);
  expect(result.calls).toEqual(['run radio:sync', 'run src/index.ts']);
  expect(result.stderr).toContain('기존 설정');
});

test('Docker startup stops after failed initialization when no radio data exists', async () => {
  const result = await runStartup(true, false);
  expect(result.exitCode).toBe(1);
  expect(result.calls).toEqual(['run radio:sync']);
});
