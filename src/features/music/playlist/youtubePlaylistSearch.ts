import {Agent, type Dispatcher, fetch as fetchRequest, RetryAgent} from 'undici/index.js';
import {Innertube} from 'youtubei.js';
import {z} from 'zod';

export const MAX_PLAYLIST_SEARCH_RESULTS = 10;
const SEARCH_TIMEOUT_MS = 10_000;
const searchDispatcher = new RetryAgent(new Agent({connections: 2, connect: {timeout: 3_000}}), {maxRetries: 1, minTimeout: 250, maxTimeout: 250, methods: ['POST']});
const playlistIdSchema = z
  .string()
  .min(1)
  .max(64)
  .regex(/^[\w-]+$/)
  .brand<'YouTubePlaylistId'>();
const textSchema = z.object({simpleText: z.string().optional(), runs: z.array(z.object({text: z.string()})).optional()}).transform(text => text.simpleText ?? text.runs?.map(run => run.text).join('') ?? '');
const playlistItemSchema = z.union([
  z.object({playlistRenderer: z.object({playlistId: playlistIdSchema, title: textSchema.pipe(z.string().trim().min(1)), shortBylineText: textSchema.optional()})}).transform(({playlistRenderer}) => ({id: playlistRenderer.playlistId, title: playlistRenderer.title, author: playlistRenderer.shortBylineText ?? ''})),
  z
    .object({
      lockupViewModel: z.object({
        contentType: z.literal('LOCKUP_CONTENT_TYPE_PLAYLIST'),
        contentId: playlistIdSchema,
        metadata: z.object({
          lockupMetadataViewModel: z.object({
            title: z.object({content: z.string().trim().min(1)}),
            metadata: z.object({contentMetadataViewModel: z.object({metadataRows: z.array(z.object({metadataParts: z.array(z.object({text: z.object({content: z.string()}).optional()})).optional()}))})}).optional(),
          }),
        }),
      }),
    })
    .transform(({lockupViewModel}) => ({
      id: lockupViewModel.contentId,
      title: lockupViewModel.metadata.lockupMetadataViewModel.title.content,
      author: lockupViewModel.metadata.lockupMetadataViewModel.metadata?.contentMetadataViewModel.metadataRows[0]?.metadataParts?.[0]?.text?.content ?? '',
    })),
]);
const searchResultSchema = z.object({
  contents: z.object({
    twoColumnSearchResultsRenderer: z.object({
      primaryContents: z.object({
        sectionListRenderer: z.object({contents: z.array(z.object({itemSectionRenderer: z.object({contents: z.array(z.unknown())}).optional()}))}),
      }),
    }),
  }),
});
const candidateSchema = z.object({playlistRenderer: z.unknown().optional(), lockupViewModel: z.object({contentType: z.string()}).optional()});

export type YouTubePlaylist = Readonly<z.infer<typeof playlistItemSchema>>;

export class YouTubePlaylistSearchError extends Error {
  override readonly name = 'YouTubePlaylistSearchError';

  constructor(
    readonly kind: 'http' | 'response' | 'network',
    readonly statusCode?: number,
    options?: ErrorOptions,
  ) {
    super(`YouTube playlist search failed (${kind})`, options);
  }
}

export function parseYouTubePlaylistSearch(data: unknown): readonly YouTubePlaylist[] {
  try {
    const sections = searchResultSchema.parse(data).contents.twoColumnSearchResultsRenderer.primaryContents.sectionListRenderer.contents;
    const playlists = new Map<YouTubePlaylist['id'], YouTubePlaylist>();
    for (const item of sections.flatMap(section => section.itemSectionRenderer?.contents ?? [])) {
      const result = playlistItemSchema.safeParse(item);
      if (result.success) {
        if (!playlists.has(result.data.id)) playlists.set(result.data.id, result.data);
        if (playlists.size === MAX_PLAYLIST_SEARCH_RESULTS) break;
      } else {
        const candidate = candidateSchema.safeParse(item);
        if (candidate.success && (candidate.data.playlistRenderer !== undefined || candidate.data.lockupViewModel?.contentType === 'LOCKUP_CONTENT_TYPE_PLAYLIST')) throw new YouTubePlaylistSearchError('response');
      }
    }
    return [...playlists.values()];
  } catch (error) {
    if (error instanceof z.ZodError) throw new YouTubePlaylistSearchError('response', undefined, {cause: error});
    throw error;
  }
}

export async function searchYouTubePlaylists(query: string, dispatcher: Dispatcher = searchDispatcher): Promise<readonly YouTubePlaylist[]> {
  const normalizedQuery = query.trim();
  if (!normalizedQuery) return [];

  try {
    const youtube = await Innertube.create({
      lang: 'ko',
      location: 'KR',
      generate_session_locally: true,
      retrieve_player: false,
      retrieve_innertube_config: false,
      enable_session_cache: false,
      fetch: Object.assign(
        async (input: Parameters<typeof fetch>[0], init?: Parameters<typeof fetch>[1]) => {
          const request = input instanceof Request ? new Request(input, init) : new Request(input.toString(), init);
          const response = await fetchRequest(request.url, {method: request.method, headers: Object.fromEntries(request.headers), body: request.body ? await request.text() : undefined, dispatcher, signal: AbortSignal.timeout(SEARCH_TIMEOUT_MS)});
          if (!response.ok) {
            await response.body?.cancel();
            throw new YouTubePlaylistSearchError('http', response.status);
          }
          return new Response(await response.arrayBuffer(), {status: response.status, headers: Object.fromEntries(response.headers)});
        },
        {preconnect: fetch.preconnect},
      ),
    });
    const response = await youtube.actions.execute('/search', {query: normalizedQuery, params: 'EgIQAw=='});
    return parseYouTubePlaylistSearch(response.data);
  } catch (error) {
    if (error instanceof YouTubePlaylistSearchError) throw error;
    if (error instanceof SyntaxError) throw new YouTubePlaylistSearchError('response', undefined, {cause: error});
    if (error instanceof Error) throw new YouTubePlaylistSearchError('network', undefined, {cause: error});
    throw error;
  }
}
