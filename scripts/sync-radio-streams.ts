import {createHash, randomUUID} from 'node:crypto';
import {link, lstat, mkdir, readFile, rename, rm, writeFile} from 'node:fs/promises';
import {basename, dirname, join, resolve} from 'node:path';
import {parseArgs} from 'node:util';
import {type AnyNode, parse} from 'acorn';
import {request} from 'undici';
import {z} from 'zod';
import {parseRadioStreams, type RadioStreamDefinition} from '../src/features/radio/radioStreamSchema';

const repository = 'BSofDeath/radio.bsod.kr';
const sourcePath = 'functions/stream/url';
const projectRoot = resolve(import.meta.dir, '..');
const commonProviders = new Set(['ytn', 'ifm', 'obs', 'kookbang', 'arirang', 'befm', 'ggn']);
const sourceName = (provider: string): string => (commonProviders.has(provider) ? 'common' : provider);
const catalogSchema = z.object({
  legacyGroups: z.record(z.string(), z.array(z.string())),
  regions: z
    .array(
      z.object({
        key: z.string().min(1),
        label: z.string().min(1),
        stations: z
          .array(
            z.object({
              id: z.string().regex(/^[a-z][a-z0-9]*:[a-z0-9]+:[a-z0-9]+$/),
              name: z.string().min(1),
              provider: z.string().min(1),
              band: z.enum(['fm', 'other', 'unknown']),
              frequencyKHz: z.number().int().optional(),
              locality: z.string().optional(),
            }),
          )
          .min(1),
      }),
    )
    .min(1),
});

async function readOptional(path: string): Promise<string | undefined> {
  return readFile(path, 'utf8').catch(error => {
    if (error instanceof Error && 'code' in error && error.code === 'ENOENT') return undefined;
    throw error;
  });
}

function fail(message: string): never {
  throw new TypeError(message);
}

function isNode(value: unknown): value is AnyNode {
  return typeof value === 'object' && value !== null && 'type' in value && typeof value.type === 'string' && 'start' in value && typeof value.start === 'number';
}

function nodes(root: AnyNode): AnyNode[] {
  const result = [root];
  for (const value of Object.values(root)) {
    if (isNode(value)) result.push(...nodes(value));
    else if (Array.isArray(value)) for (const child of value) if (isNode(child)) result.push(...nodes(child));
  }
  return result;
}

function property(node: AnyNode, name: string): AnyNode | undefined {
  if (node.type !== 'ObjectExpression') return undefined;
  const found = node.properties.find(item => item.type === 'Property' && !item.computed && ((item.key.type === 'Identifier' && item.key.name === name) || (item.key.type === 'Literal' && item.key.value === name)));
  return found?.type === 'Property' ? found.value : undefined;
}

function string(node: AnyNode | undefined): string {
  return node?.type === 'Literal' && typeof node.value === 'string' ? node.value : fail('Expected a string literal');
}

function optionalString(node: AnyNode | undefined): string {
  return node === undefined || (node.type === 'Literal' && node.value === null) ? 'default' : string(node);
}

function initializer(root: AnyNode, name: string): AnyNode {
  const found = nodes(root).filter(node => node.type === 'VariableDeclarator' && node.id.type === 'Identifier' && node.id.name === name);
  const declaration = found[0];
  if (found.length !== 1 || declaration?.type !== 'VariableDeclarator' || !declaration.init) fail(`Missing or ambiguous declaration: ${name}`);
  return declaration.init;
}

function array(root: AnyNode, name: string): AnyNode[] {
  const value = initializer(root, name);
  if (value.type !== 'ArrayExpression') fail(`Expected an array: ${name}`);
  return value.elements.map(item => (item?.type === 'ObjectExpression' ? item : fail(`Expected object entries: ${name}`)));
}

function code(root: AnyNode, table: string, param: string): string {
  const matches = array(root, table).filter(item => string(property(item, 'param')) === param);
  if (matches.length !== 1 || !matches[0]) fail(`Missing or ambiguous ${table}: ${param}`);
  return string(property(matches[0], 'code'));
}

function audioAlternative(value: AnyNode): string {
  if (value.type === 'ConditionalExpression' && value.test.type === 'BinaryExpression' && value.test.operator === '==' && value.test.left.type === 'Identifier' && value.test.left.name === 'bora' && string(value.test.right) === 'true') return string(value.alternate);
  return fail('Unsupported audio/video conditional');
}

function fetchUrl(fn: AnyNode): string {
  const calls = nodes(fn).filter(node => node.type === 'CallExpression' && node.callee.type === 'Identifier' && node.callee.name === 'fetch');
  const call = calls[0];
  if (calls.length !== 1 || call?.type !== 'CallExpression') fail('Expected exactly one broadcaster API fetch');
  const argument = call.arguments[0];
  if (argument?.type === 'Literal') return string(argument);
  if (argument?.type === 'Identifier') {
    const value = initializer(fn, argument.name);
    return audioAlternative(value);
  }
  return fail('Unsupported broadcaster API expression');
}

function convert(root: AnyNode, provider: string, channel: string, city: string): RadioStreamDefinition {
  if (provider === 'kbs') {
    const channelCode = code(root, 'channelCodes', channel);
    const cityCode = city === 'default' ? '' : code(root, 'cityCodes', city);
    if (!/^\d+$/.test(channelCode) || !/^\d+_$|^$/.test(cityCode)) fail('Invalid KBS code');
    return {type: 'kbs', url: `https://cfpwwwapi.kbs.co.kr/api/v1/landing/live/channel_code/${cityCode}${channelCode}`};
  }
  const entries = array(root, `${sourceName(provider)}Urls`).filter(item => (commonProviders.has(provider) ? string(property(item, 'station')) === provider : optionalString(property(item, 'channel')) === channel && optionalString(property(item, 'city')) === city));
  if (entries.length !== 1 || !entries[0]) fail(`Missing or ambiguous station: ${provider}:${channel}:${city}`);
  const stream = property(entries[0], 'streamUrl');
  if (stream?.type === 'Literal') return {type: 'direct', url: string(stream)};
  if (stream?.type !== 'ArrowFunctionExpression') fail('Unsupported streamUrl expression');
  if (provider === 'mbc' && city === 'busan') {
    const statements = stream.body.type === 'BlockStatement' ? stream.body.body : [];
    const returned = statements[0];
    const expression = returned?.type === 'ReturnStatement' ? returned.argument : undefined;
    if (statements.length !== 1 || expression?.type !== 'BinaryExpression' || expression.operator !== '+' || expression.left.type !== 'BinaryExpression' || expression.left.operator !== '+') fail('Unsupported Busan MBC date template');
    const date = expression.left.right;
    if (date.type !== 'AwaitExpression' || date.argument.type !== 'CallExpression' || date.argument.callee.type !== 'Identifier' || date.argument.callee.name !== 'todayBSMBCdatecode' || date.argument.arguments.length !== 0) fail('Unsupported Busan MBC date function');
    const dateMap = initializer(root, 'datecodeMap');
    return {type: 'busan-mbc', url: `${string(expression.left.left)}{date}${string(expression.right)}`, dateCodes: Array.from({length: 10}, (_, i) => string(property(dateMap, String(i)))).join('')};
  }
  if (provider === 'ifm' || (provider === 'cbs' && channel === 'sfm' && city === 'default')) return {type: 'direct', url: audioAlternative(initializer(stream, 'url'))};
  const url = fetchUrl(stream);
  if (provider === 'afn') {
    const returns = nodes(stream).filter(node => node.type === 'ReturnStatement');
    const returned = returns[0];
    const template = returned?.type === 'ReturnStatement' ? returned.argument : undefined;
    if (returns.length !== 1 || template?.type !== 'TemplateLiteral' || template.expressions.length !== 1 || template.quasis[0]?.value.cooked !== 'https://') fail('Unsupported AFN stream template');
    const path = template.quasis[1]?.value.cooked;
    if (!path || !/^\/[A-Za-z0-9_]+\.aac$/.test(path)) fail('Unsupported AFN stream path');
    return {type: 'afn', url, path};
  }
  if (provider === 'mbc' && channel === 'bora' && city === 'default') return {type: 'mbc-bora', url};
  if ((provider === 'mbc' || provider === 'sbs') && city === 'default') return {type: 'text', url};
  return fail(`Unsupported dynamic station: ${provider}:${channel}:${city}`);
}

async function download(url: string): Promise<string> {
  const response = await request(url, {headers: {'user-agent': 'NM-radio-sync'}, signal: AbortSignal.timeout(20_000), headersTimeout: 20_000, bodyTimeout: 20_000});
  if (response.statusCode !== 200) {
    await response.body.dump();
    fail(`Source request failed (${response.statusCode}): ${url}`);
  }
  return response.body.text();
}

async function main(): Promise<void> {
  const {values} = parseArgs({args: Bun.argv.slice(2), options: {'source-dir': {type: 'string'}, output: {type: 'string'}, ref: {type: 'string'}, help: {type: 'boolean'}}, strict: true});
  if (values.help) {
    console.log('bun run radio:sync [--ref COMMIT_OR_REF] [--source-dir functions/stream/url] [--output path/streams.proposed.json]');
    return;
  }
  if (values['source-dir'] && values.ref) fail('--ref cannot be combined with --source-dir');
  const activePath = join(projectRoot, 'data/radio/streams.json');
  const catalogPath = join(projectRoot, 'data/radio/stations.json');
  const active = await readOptional(activePath);
  const localCatalog = await readOptional(catalogPath);
  const catalogText = localCatalog ?? (await readFile(join(projectRoot, 'assets/radio/stations.json'), 'utf8'));
  const catalog = catalogSchema.parse(JSON.parse(catalogText));
  const radioStreams = parseRadioStreams(JSON.parse(active ?? '{}'));
  const initialize = active === undefined && values.output === undefined;
  const output = resolve(values.output ?? (initialize ? activePath : join(projectRoot, 'data/radio/streams.proposed.json')));
  if (!initialize && !basename(output).endsWith('.proposed.json')) fail('Output must end in .proposed.json; active configuration cannot be overwritten');
  const existing = await lstat(output).catch(error => {
    if (error instanceof Error && 'code' in error && error.code === 'ENOENT') return undefined;
    throw error;
  });
  if (existing && (!existing.isFile() || existing.nlink !== 1)) fail('Output must be a regular, unlinked proposal file');
  const local = values['source-dir'] ? resolve(values['source-dir']) : undefined;
  const sha = local ? undefined : z.object({sha: z.string().regex(/^[a-f0-9]{40}$/)}).parse(JSON.parse(await download(`https://api.github.com/repos/${repository}/commits/${encodeURIComponent(values.ref ?? 'HEAD')}`))).sha;
  const stations = [...new Set(catalog.regions.flatMap(region => region.stations.map(station => station.id)))].sort();
  const providers = [...new Set(stations.map(id => sourceName(id.split(':')[0] ?? fail('Invalid catalog id'))))];
  const sources = await Promise.all(
    providers.map(async provider => {
      const source = local ? await readFile(join(local, `${provider}.js`), 'utf8') : await download(`https://raw.githubusercontent.com/${repository}/${sha}/${sourcePath}/${provider}.js`);
      return {provider, source, ast: parse(source, {ecmaVersion: 'latest', sourceType: 'module'}), sha256: createHash('sha256').update(source).digest('hex')};
    }),
  );
  const proposed: Record<string, RadioStreamDefinition> = {};
  for (const id of stations) {
    const [provider, channel, city] = id.split(':');
    const source = sources.find(item => item.provider === sourceName(provider ?? ''));
    if (!provider || !channel || !city || !source) fail(`Invalid catalog entry: ${id}`);
    try {
      proposed[id] = convert(source.ast, provider, channel, city);
    } catch (error) {
      throw new TypeError(`${id}: ${error instanceof Error ? error.message : String(error)}`, {cause: error});
    }
  }
  const validated = parseRadioStreams(proposed);
  const report = {
    source: local ? {directory: local, files: Object.fromEntries(sources.map(item => [`${item.provider}.js`, item.sha256]))} : {repository, commit: sha},
    output,
    initialized: initialize,
    catalogCreated: localCatalog === undefined,
    stations: stations.length,
    added: stations.filter(id => !radioStreams[id]),
    changed: stations.filter(id => radioStreams[id] && JSON.stringify(radioStreams[id]) !== JSON.stringify(validated[id])),
    removed: Object.keys(radioStreams).filter(id => !validated[id]),
  };
  const writes = [...(localCatalog === undefined ? [{path: catalogPath, content: catalogText, createOnly: true}] : []), {path: output, content: `${JSON.stringify(validated, null, 2)}\n`, createOnly: initialize}].map(item => ({...item, temporary: `${item.path}.${randomUUID()}.tmp`}));
  const created: string[] = [];
  try {
    for (const item of writes) {
      await mkdir(dirname(item.path), {recursive: true});
      await writeFile(item.temporary, item.content, {flag: 'wx'});
    }
    for (const item of writes) {
      if (item.createOnly) {
        await link(item.temporary, item.path);
        created.push(item.path);
      } else await rename(item.temporary, item.path);
    }
  } catch (error) {
    await Promise.all(created.map(path => rm(path)));
    throw error;
  } finally {
    await Promise.all(writes.map(item => rm(item.temporary, {force: true})));
  }
  console.log(JSON.stringify(report, null, 2));
}

main().catch(error => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
