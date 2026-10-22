import {afterEach, expect, test} from 'bun:test';
import {copyFile, mkdir, mkdtemp, readFile, rm, symlink, writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join, resolve} from 'node:path';
import {parseRadioStreams} from '@/features/radio/radioStreamSchema';
import seed from '../../../assets/radio/stations.json';

const root = resolve(import.meta.dir, '../../..');
const script = join(root, 'scripts/sync-radio-streams.ts');
const evidence = resolve(process.env.RADIO_SYNC_EVIDENCE_DIR ?? join(root, '.omo/evidence/radio-sync/tests'));
const temporaryDirectories: string[] = [];
const commonProviders = new Set(['ytn', 'ifm', 'obs', 'kookbang', 'arirang', 'befm', 'ggn']);
const ids = [...new Set(seed.regions.flatMap(region => region.stations.map(station => station.id)))];

async function fixture(empty = false) {
  const directory = await mkdtemp(join(tmpdir(), 'nm-radio-sync-'));
  temporaryDirectories.push(directory);
  const source = join(directory, 'source');
  await mkdir(source);
  for (const path of ['scripts', 'assets/radio', 'src/features/radio']) await mkdir(join(directory, path), {recursive: true});
  await copyFile(script, join(directory, 'scripts/sync-radio-streams.ts'));
  await copyFile(join(root, 'src/features/radio/radioStreamSchema.ts'), join(directory, 'src/features/radio/radioStreamSchema.ts'));
  await copyFile(join(root, 'assets/radio/stations.json'), join(directory, 'assets/radio/stations.json'));
  await symlink(join(root, 'node_modules'), join(directory, 'node_modules'), 'dir');
  const active = join(directory, 'data/radio/streams.json');
  const before = JSON.stringify(Object.fromEntries(ids.map(id => [id, {type: 'direct', url: `https://active.example/${id}.m3u8`}])));
  if (!empty) {
    await mkdir(join(directory, 'data/radio'), {recursive: true});
    await writeFile(active, before);
    await copyFile(join(root, 'assets/radio/stations.json'), join(directory, 'data/radio/stations.json'));
  }
  const groups = new Map<string, string[]>();
  for (const id of ids.filter(id => !id.startsWith('kbs:'))) {
    const [provider, channel, city] = id.split(':');
    if (!provider || !channel || !city) throw new TypeError('Invalid fixture station');
    const file = commonProviders.has(provider) ? 'common' : provider;
    const entry = `{station:${JSON.stringify(provider)}, channel:${channel === 'default' ? 'null' : JSON.stringify(channel)}, city:${city === 'default' ? 'null' : JSON.stringify(city)}, streamUrl:${JSON.stringify(`https://fixture.example/${id}.m3u8`)}}`;
    groups.set(file, [...(groups.get(file) ?? []), entry]);
  }
  for (const [file, entries] of groups) await writeFile(join(source, `${file}.js`), `export const ${file}Urls = [${entries.join(',')}];`);
  const channels = [...new Set(ids.filter(id => id.startsWith('kbs:')).map(id => id.split(':')[1]))];
  const cities = [...new Set(ids.filter(id => id.startsWith('kbs:') && !id.endsWith(':default')).map(id => id.split(':')[2]))];
  await writeFile(join(source, 'kbs.js'), `const channelCodes = ${JSON.stringify(channels.map(param => ({param, code: param === '1radio' ? '31' : '32'})))}; const cityCodes = ${JSON.stringify(cities.map(param => ({param, code: '7_'})))};`);
  return {directory, source, active, output: join(directory, 'streams.proposed.json'), before};
}

async function replaceStream(source: string, provider: string, channel: string, city: string, expression: string) {
  const file = join(source, `${commonProviders.has(provider) ? 'common' : provider}.js`);
  const oldValue = JSON.stringify(`https://fixture.example/${provider}:${channel}:${city}.m3u8`);
  const content = await readFile(file, 'utf8');
  if (!content.includes(oldValue)) throw new TypeError('Fixture entry absent');
  await writeFile(file, content.replace(oldValue, expression));
}

async function invoke(name: string, source: string, output?: string, args: string[] = []) {
  const checkout = resolve(source, '..');
  const invocation = [process.execPath, 'run', join(checkout, 'scripts/sync-radio-streams.ts'), '--source-dir', source, ...(output ? ['--output', output] : []), ...args];
  const child = Bun.spawn(invocation, {cwd: checkout, stdout: 'pipe', stderr: 'pipe'});
  const [stdout, stderr, exitCode] = await Promise.all([new Response(child.stdout).text(), new Response(child.stderr).text(), child.exited]);
  await mkdir(evidence, {recursive: true});
  await writeFile(join(evidence, `${name}.json`), JSON.stringify({invocation, exitCode, stdout, stderr}, null, 2));
  if (exitCode === 0) await writeFile(join(evidence, `${name}.proposed.json`), await readFile(JSON.parse(stdout).output));
  return {stdout, stderr, exitCode};
}

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map(directory => rm(directory, {recursive: true, force: true})));
});

test('creates a changed candidate from static sources without executing JavaScript or modifying active data', async () => {
  // Given
  const setup = await fixture();
  const marker = join(setup.directory, 'executed');
  await writeFile(setup.output, 'outdated proposal');
  await replaceStream(setup.source, 'ebs', 'fm', 'default', JSON.stringify('https://changed.example/fm.m3u8'));
  await writeFile(join(setup.source, 'ebs.js'), `${await readFile(join(setup.source, 'ebs.js'), 'utf8')}\nawait Bun.write(${JSON.stringify(marker)}, 'executed');`);
  // When
  const result = await invoke('static', setup.source, setup.output);
  // Then
  expect(result.exitCode).toBe(0);
  const proposed = parseRadioStreams(JSON.parse(await readFile(setup.output, 'utf8')));
  expect(proposed['ebs:fm:default']).toEqual({type: 'direct', url: 'https://changed.example/fm.m3u8'});
  expect(proposed['kbs:1radio:busan']).toEqual({type: 'kbs', url: 'https://cfpwwwapi.kbs.co.kr/api/v1/landing/live/channel_code/7_31'});
  expect(JSON.parse(result.stdout).changed).toContain('ebs:fm:default');
  expect(JSON.parse(result.stdout).source.files['ebs.js']).toMatch(/^[a-f0-9]{64}$/);
  expect(await Bun.file(marker).exists()).toBe(false);
  expect(await readFile(setup.active, 'utf8')).toBe(setup.before);
});

test('maps broadcaster APIs, audio selection, date templates and AFN paths from source syntax', async () => {
  // Given
  const setup = await fixture();
  await replaceStream(setup.source, 'mbc', 'sfm', 'default', 'async () => {const response = await fetch("https://api.example/mbc-new"); const url = await response.text(); return url;}');
  await replaceStream(setup.source, 'mbc', 'bora', 'default', 'async () => {const response = await fetch("https://api.example/bora-new"); let url = await response.text(); url = url.replace("callback(", ""); return url;}');
  await replaceStream(setup.source, 'sbs', 'powerfm', 'default', 'async (bora = null) => {const endpoint = bora == "true" ? "https://api.example/video" : "https://api.example/audio-new"; const response = await fetch(endpoint); const url = await response.text(); return url;}');
  await replaceStream(setup.source, 'ifm', 'default', 'default', 'async (bora = null) => {const url = bora == "true" ? "https://fixture.example/video" : "https://fixture.example/ifm-new"; return url;}');
  await replaceStream(setup.source, 'mbc', 'sfm', 'busan', 'async () => {return "https://fixture.example/live." + await todayBSMBCdatecode() + "/playlist.m3u8";}');
  await writeFile(join(setup.source, 'mbc.js'), `const datecodeMap = {"0":"a","1":"b","2":"c","3":"d","4":"e","5":"f","6":"g","7":"h","8":"i","9":"j"};\n${await readFile(join(setup.source, 'mbc.js'), 'utf8')}`);
  await replaceStream(setup.source, 'afn', 'default', 'humphreys', `async () => {const response = await fetch("https://api.example/afn-new"); const text = await response.text(); return \`https://\${text}/NEW_AAC.aac\`;}`);
  // When
  const result = await invoke('dynamic', setup.source, setup.output);
  // Then
  expect(result.exitCode).toBe(0);
  const proposed = parseRadioStreams(JSON.parse(await readFile(setup.output, 'utf8')));
  expect(proposed['mbc:sfm:default']).toEqual({type: 'text', url: 'https://api.example/mbc-new'});
  expect(proposed['mbc:bora:default']).toEqual({type: 'mbc-bora', url: 'https://api.example/bora-new'});
  expect(proposed['sbs:powerfm:default']).toEqual({type: 'text', url: 'https://api.example/audio-new'});
  expect(proposed['ifm:default:default']).toEqual({type: 'direct', url: 'https://fixture.example/ifm-new'});
  expect(proposed['mbc:sfm:busan']).toEqual({type: 'busan-mbc', url: 'https://fixture.example/live.{date}/playlist.m3u8', dateCodes: 'abcdefghij'});
  expect(proposed['afn:default:humphreys']).toEqual({type: 'afn', url: 'https://api.example/afn-new', path: '/NEW_AAC.aac'});
  expect(await readFile(setup.active, 'utf8')).toBe(setup.before);
});

test.each(['malformed', 'missing-file', 'missing-station', 'invalid-url', 'unsupported-function'] as const)('fails atomically for %s source', async scenario => {
  // Given
  const setup = await fixture();
  await writeFile(setup.output, 'existing proposal');
  switch (scenario) {
    case 'malformed':
      await writeFile(join(setup.source, 'ebs.js'), 'export const ebsUrls = [');
      break;
    case 'missing-file':
      await rm(join(setup.source, 'ebs.js'));
      break;
    case 'missing-station':
      await writeFile(join(setup.source, 'ebs.js'), 'export const ebsUrls = [];');
      break;
    case 'invalid-url':
      await replaceStream(setup.source, 'ebs', 'fm', 'default', '"file:///tmp/stream"');
      break;
    case 'unsupported-function':
      await replaceStream(setup.source, 'ebs', 'fm', 'default', 'async () => unknownResolver()');
      break;
  }
  // When
  const result = await invoke(scenario, setup.source, setup.output);
  // Then
  expect(result.exitCode).toBe(1);
  expect(result.stderr.length).toBeGreaterThan(0);
  expect(await readFile(setup.output, 'utf8')).toBe('existing proposal');
  expect(await readFile(setup.active, 'utf8')).toBe(setup.before);
});

test('refuses an active configuration output path', async () => {
  // Given
  const setup = await fixture();
  // When
  const result = await invoke('active-path-refused', setup.source, setup.active);
  // Then
  expect(result.exitCode).toBe(1);
  expect(await readFile(setup.active, 'utf8')).toBe(setup.before);
});

test('refuses a proposal symlink pointing at the active configuration', async () => {
  // Given
  const setup = await fixture();
  await symlink(setup.active, setup.output);
  // When
  const result = await invoke('symlink-refused', setup.source, setup.output);
  // Then
  expect(result.exitCode).toBe(1);
  expect(await readFile(setup.active, 'utf8')).toBe(setup.before);
});

test('initializes both JSON files when the entire data directory is absent', async () => {
  // Given
  const setup = await fixture(true);
  // When
  const result = await invoke('bootstrap', setup.source);
  // Then
  expect(result.exitCode).toBe(0);
  expect(Object.keys(parseRadioStreams(JSON.parse(await readFile(setup.active, 'utf8')))).length).toBe(ids.length);
  expect(JSON.parse(await readFile(join(setup.directory, 'data/radio/stations.json'), 'utf8'))).toEqual(seed);
  expect(JSON.parse(result.stdout).initialized).toBe(true);
});

test('writes only a proposal on the second run and preserves local catalog edits', async () => {
  // Given
  const setup = await fixture(true);
  expect((await invoke('second-run-setup', setup.source)).exitCode).toBe(0);
  const before = await readFile(setup.active, 'utf8');
  const catalogPath = join(setup.directory, 'data/radio/stations.json');
  const catalog = JSON.parse(await readFile(catalogPath, 'utf8'));
  catalog.regions[0].label = '지역 이름 수정';
  const catalogText = JSON.stringify(catalog);
  await writeFile(catalogPath, catalogText);
  await replaceStream(setup.source, 'ebs', 'fm', 'default', JSON.stringify('https://changed.example/second.m3u8'));
  // When
  const result = await invoke('second-run', setup.source);
  // Then
  expect(result.exitCode).toBe(0);
  const proposed = parseRadioStreams(JSON.parse(await readFile(join(setup.directory, 'data/radio/streams.proposed.json'), 'utf8')));
  expect(proposed['ebs:fm:default']?.url).toBe('https://changed.example/second.m3u8');
  expect(await readFile(setup.active, 'utf8')).toBe(before);
  expect(await readFile(catalogPath, 'utf8')).toBe(catalogText);
});

test('leaves no active files when source validation fails during bootstrap', async () => {
  // Given
  const setup = await fixture(true);
  await writeFile(join(setup.source, 'ebs.js'), 'export const ebsUrls = [');
  // When
  const result = await invoke('bootstrap-failed', setup.source);
  // Then
  expect(result.exitCode).toBe(1);
  expect(await Bun.file(setup.active).exists()).toBe(false);
  expect(await Bun.file(join(setup.directory, 'data/radio/stations.json')).exists()).toBe(false);
});
