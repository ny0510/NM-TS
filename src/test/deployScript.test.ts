import {afterEach, expect, test} from 'bun:test';
import {mkdtemp, readFile, rm, writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';

const fixtures: string[] = [];
afterEach(async () => {
  await Promise.all(fixtures.splice(0).map(path => rm(path, {recursive: true, force: true})));
});

async function runDeploy(failingCommand = '') {
  const root = await mkdtemp(join(tmpdir(), 'nm-deploy-'));
  fixtures.push(root);
  const log = join(root, 'commands.log');
  await writeFile(
    join(root, 'git'),
    `#!/usr/bin/env bash
case "$1" in
  rev-parse) printf '%s\\n' "$DEPLOY_FIXTURE_ROOT" ;;
  tag) printf 'v2.14.0\\n' ;;
esac
`,
    {mode: 0o755},
  );
  await writeFile(
    join(root, 'docker'),
    `#!/usr/bin/env bash
printf '%s\\n' "$*" >> "$DEPLOY_COMMAND_LOG"
if [[ "$*" == "$DEPLOY_FAIL_COMMAND" ]]; then exit 1; fi
if [[ "$*" == 'compose logs --tail=100 nm' ]]; then printf 'Ready! Logged in as fixture\\n'; fi
`,
    {mode: 0o755},
  );
  const deployment = Bun.spawn(['bash', join(import.meta.dir, '../../scripts/deploy.sh')], {
    env: {...Bun.env, PATH: `${root}:${Bun.env.PATH}`, DEPLOY_FIXTURE_ROOT: root, DEPLOY_COMMAND_LOG: log, DEPLOY_FAIL_COMMAND: failingCommand, NM_STOP_TIMEOUT: '30'},
    stdout: 'pipe',
    stderr: 'pipe',
  });
  const [exitCode, stdout, stderr] = await Promise.all([deployment.exited, new Response(deployment.stdout).text(), new Response(deployment.stderr).text()]);
  return {exitCode, stdout, stderr, commands: (await readFile(log, 'utf8')).trim().split('\n')};
}

test('deployment builds the plugin before downtime and starts NM after Lavalink readiness and migration', async () => {
  const result = await runDeploy();
  expect(result.exitCode).toBe(0);
  expect(result.commands).toEqual([
    'compose config --quiet',
    'compose pull nm migrate',
    'compose build lavalink',
    'compose up -d --wait --no-recreate postgres ejs-api',
    'compose stop -t 30 nm',
    'compose up -d --wait --no-build --no-deps lavalink',
    'compose run --rm --no-deps migrate',
    'compose up -d --no-build --no-deps nm',
    'compose ps nm postgres lavalink',
    'compose logs --tail=100 nm',
    'compose logs --tail=100 nm',
  ]);
});

test('a failed plugin build never stops the running bot', async () => {
  const result = await runDeploy('compose build lavalink');
  expect(result.exitCode).toBe(1);
  expect(result.commands.at(-1)).toBe('compose build lavalink');
  expect(result.commands.some(command => command.startsWith('compose stop'))).toBe(false);
});

test('failed Lavalink readiness prevents migration and bot startup', async () => {
  const result = await runDeploy('compose up -d --wait --no-build --no-deps lavalink');
  expect(result.exitCode).toBe(1);
  expect(result.commands.some(command => command.startsWith('compose run'))).toBe(false);
  expect(result.commands).not.toContain('compose up -d --no-build --no-deps nm');
});
